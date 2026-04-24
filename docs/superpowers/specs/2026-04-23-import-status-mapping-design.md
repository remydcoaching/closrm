# Spec — Mapping intelligent des statuts à l'import de leads

**Date :** 2026-04-23
**Auteur :** Rémy
**Statut :** à implémenter
**Tâche liée :** `taches/tache-034-import-status-mapping.md`

---

## Contexte

Le wizard d'import CSV actuel mappe correctement les colonnes CSV vers les champs ClosRM, mais le champ `status` est un enum strict de 8 valeurs (`nouveau`, `scripte`, `setting_planifie`, `no_show_setting`, `closing_planifie`, `no_show_closing`, `clos`, `dead`). Quand un CSV contient des valeurs étrangères (ex: « RDV Bilan Pris », « Converti », « Jamais décroché », « Bilan effectué »), `validateRow` tombe silencieusement sur `config.default_status` : toutes les valeurs custom deviennent `nouveau` sans prévenir l'utilisateur.

**Cas d'usage réel** : import de 81 leads depuis un ancien CRM (Notion-like) avec 12 statuts custom. L'utilisateur perd l'information de pipeline à l'import.

## Objectif

Permettre à l'utilisateur de choisir, à l'étape 2 du wizard d'import, comment chaque valeur de statut présente dans son CSV doit être interprétée par ClosRM.

**Non-objectifs (hors scope, éventuellement N2/N3 plus tard) :**
- Créer de nouveaux statuts custom par workspace
- Renommer / recolorer les statuts existants
- Sauvegarder le mapping entre imports successifs

## Design UX

### Écran : Step 2 (Mapping & Config)

Quand la colonne statut est mappée à une colonne CSV, un nouveau bloc apparaît sous le mapping des colonnes :

```
┌─ Valeurs de statut détectées (12) ──────────────────────┐
│ Valeur CSV           Action                 Résultat    │
│ Nouveau              [Mapper: nouveau ▼]      ✓         │
│ RDV Bilan Pris       [Mapper: setting_…▼]     ✓         │
│ Converti             [Mapper: clos ▼]         ✓         │
│ Refusé               [Mapper: dead ▼]         ✓         │
│ Jamais décroché      [Mapper: no_show_s.▼]    ✓         │
│ A recontacter        [Convertir en tag ▼]     + tag     │
│ Bilan effectué       [Choisir… ▼]             ⚠ à régler│
└─────────────────────────────────────────────────────────┘
```

### Trois actions possibles par valeur CSV

1. **Mapper vers un statut ClosRM** (choix parmi les 8 statuts). La valeur CSV est remplacée par le statut ClosRM correspondant.
2. **Convertir en tag**. Le statut devient `config.default_status`, et la valeur CSV brute est ajoutée aux tags du lead (pour ne rien perdre).
3. **Ignorer**. Le statut devient `config.default_status`, la valeur est perdue.

### Auto-suggestion

Un dictionnaire de synonymes FR/EN est appliqué automatiquement sur chaque valeur détectée. L'utilisateur voit le match pré-rempli et peut le corriger.

**Dictionnaire** (source de vérité : `src/lib/leads/csv-parser.ts`) :

```ts
const STATUS_SYNONYMS: Record<LeadStatus, string[]> = {
  nouveau:          ['nouveau', 'new', 'lead', 'entrant', 'fresh'],
  scripte:          ['scripté', 'scripte', 'contacté', 'contacted', 'en attente de reponse',
                     'en attente', 'awaiting response'],
  setting_planifie: ['setting planifié', 'setting', 'rdv setting', 'rdv bilan pris',
                     'bilan pris', 'rdv planifié', 'rendez-vous planifié', 'appointment booked'],
  no_show_setting:  ['no show setting', 'absent setting', 'jamais décroché', 'no answer',
                     'manqué'],
  closing_planifie: ['closing planifié', 'closing', 'rdv closing', 'closing booked'],
  no_show_closing:  ['no show closing', 'absent closing', 'no show'],
  clos:             ['clos', 'closé', 'fermé', 'converti', 'conversion', 'won', 'signé',
                     'vendu', 'deal', 'bilan effectué', 'meeting done'],
  dead:             ['dead', 'mort', 'refusé', 'rejeté', 'perdu', 'lost', 'avorté',
                     'avorte - plus de reponse', 'plus de reponse', 'non qualifié',
                     'not qualified', 'disqualifié', 'abandonné'],
}
```

Matching :
- Normalisation : lowercase + strip accents + strip ponctuation courante
- **Pass 1** : match exact avec un synonyme
- **Pass 2** : match par inclusion (synonyme contient la valeur ou inversement)
- Si aucun match : action = "Choisir…" (non réglé)

### Blocage

Le bouton "Continuer" est désactivé si au moins une valeur détectée est à l'état "Choisir…". L'utilisateur doit explicitement trancher pour chaque valeur (comme on le fait déjà pour le mapping des colonnes).

## Architecture technique

### Types (`src/types/index.ts`)

Étendre `ImportConfig` :

```ts
export type StatusMappingAction =
  | { type: 'map'; status: LeadStatus }
  | { type: 'tag' }
  | { type: 'ignore' }

export interface ImportConfig {
  // … champs existants
  status_value_mapping: Record<string, StatusMappingAction>
}
```

La clé est la **valeur CSV brute** (ex: `"RDV Bilan Pris"`), telle qu'elle apparaît dans les rows.

### CSV parser (`src/lib/leads/csv-parser.ts`)

Ajouter :

```ts
export const STATUS_SYNONYMS: Record<LeadStatus, string[]> = { … }

export function extractUniqueStatusValues(
  rows: Record<string, string>[],
  statusField: string,
): string[]

export function suggestStatusMapping(
  value: string,
): LeadStatus | null
```

### UI (`src/components/leads/import/Step2_MappingConfig.tsx`)

Nouveau sous-composant `StatusValueMapper` rendu conditionnellement quand la colonne `status` est mappée. Il maintient l'état `config.status_value_mapping` via `updateConfig`.

Auto-init : au moment où la colonne statut est mappée (ou remappée), peupler `status_value_mapping` avec les suggestions automatiques pour toutes les valeurs détectées. Les valeurs sans suggestion restent absentes de la map → affichées "à régler".

Validation `hasRequiredField` étendue : tous les statuts détectés doivent avoir une entrée dans `status_value_mapping` (sinon bouton "Continuer" désactivé).

### Moteur d'import (`src/lib/leads/import-engine.ts`)

Dans `validateRow`, **avant** la logique actuelle `prepared.status = row.status || config.default_status` :

```ts
const rawStatus = row.status?.trim() || ''
let tagFromStatus: string | null = null

if (rawStatus && config.status_value_mapping) {
  const action = config.status_value_mapping[rawStatus]
  if (action?.type === 'map') {
    prepared.status = action.status
  } else if (action?.type === 'tag') {
    prepared.status = config.default_status
    tagFromStatus = rawStatus
  } else if (action?.type === 'ignore') {
    prepared.status = config.default_status
  } else {
    // Valeur non mappée : fallback actuel (default_status via enum check)
    prepared.status = rawStatus
  }
} else {
  prepared.status = rawStatus || config.default_status
}

// Après le Zod parse, si tagFromStatus défini, l'ajouter aux tags :
if (tagFromStatus) {
  data.tags = [...(data.tags || []), tagFromStatus]
}
```

La validation enum existante (ligne 90-93) reste en fallback pour les cas où `status_value_mapping` est absent (compat descendante avec anciens imports / appels API programmatiques).

## Flux de données (récap)

```
CSV → parseCsvFile → rows (headers FR)
  → Step 2 : user mappe "Statut" → column status
    → extractUniqueStatusValues(rows, statusField) → ['Nouveau', 'RDV Bilan Pris', …]
    → suggestStatusMapping(value) pour chaque → pré-remplit status_value_mapping
    → user ajuste les non-matchs → status_value_mapping complet
  → applyMapping → rows avec row.status = valeur CSV brute
  → POST /api/leads/import { rows, config: { …, status_value_mapping } }
  → executeImport → validateRow :
      lookup config.status_value_mapping[row.status] → action
      applique map/tag/ignore
  → INSERT lead avec status correct + tag si applicable
```

## Tests

### Unit tests (csv-parser)
- `extractUniqueStatusValues` : dédoublonnage, trim, filtre vides
- `suggestStatusMapping` : 
  - Match exact (« Nouveau » → `nouveau`)
  - Match avec accents (« Refusé » → `dead`)
  - Match par inclusion (« Avorté - Plus de réponse » → `dead`)
  - Pas de match (« XYZ blabla ») → `null`

### Unit tests (import-engine)
- `validateRow` avec `status_value_mapping.map` → status mappé
- `validateRow` avec `status_value_mapping.tag` → status = default, tag ajouté
- `validateRow` avec `status_value_mapping.ignore` → status = default, pas de tag
- `validateRow` sans `status_value_mapping` (compat) → comportement actuel

### Test manuel
- Importer CSV de 81 leads avec les 12 statuts custom
- Vérifier que chaque valeur peut être mappée/taggée/ignorée
- Vérifier que "Bilan effectué" est auto-suggéré vers `clos`
- Vérifier que les tags sont bien créés quand action = tag

## Risques / points d'attention

- **Casse sensible à l'espace** : les clés de `status_value_mapping` doivent être normalisées (trim au moins). Sinon « RDV Bilan Pris » et « RDV Bilan Pris  » seront traités comme deux valeurs différentes.
- **Dictionnaire de synonymes** : intentionnellement conservateur. Les cas tordus (ex: « En attente de réponse » qui pourrait matcher `nouveau` ou `scripte`) sont laissés à la discrétion de l'utilisateur.
- **Compat descendante** : si un appel API externe (programmatique) envoie un payload sans `status_value_mapping`, le fallback actuel (enum check) s'applique. Pas de breaking change.

## Estimation

~0.5 jour : dictionnaire + helpers parser (~1h), UI StatusValueMapper (~2h), fix validateRow + types (~1h), tests manuels et unitaires (~1h).
