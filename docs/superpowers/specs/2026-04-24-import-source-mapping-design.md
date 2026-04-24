# Spec — Mapping intelligent des sources à l'import de leads

**Date :** 2026-04-24
**Auteur :** Rémy
**Statut :** à implémenter
**Tâche liée :** `taches/tache-035-import-source-mapping.md`

---

## Contexte

T-034 a ajouté un mapping intelligent des **statuts** à l'étape 2 du wizard d'import : détection des valeurs uniques dans la colonne mappée, auto-suggestion par dictionnaire de synonymes, choix manuel forcé en absence de match, avec trois actions possibles (mapper, convertir en tag, ignorer).

La colonne `source` du CSV subit le même problème : quand une valeur ne correspond à aucune source ClosRM (`facebook_ads`, `instagram_ads`, `follow_ads`, `formulaire`, `manuel`, `funnel`), le moteur tombe silencieusement sur `config.default_source` via la validation enum existante (`import-engine.ts`, ligne ~153). Les valeurs originales sont perdues.

**Cas d'usage réel** : Rémy importe ses 81 leads depuis un ancien CRM avec 4 sources custom (Salle, Instagram, Meta Ads, Bouche-à-oreille). Seule "Meta Ads" matche une source ClosRM (`facebook_ads`). Les trois autres sont aujourd'hui silencieusement converties en `manuel` (le default).

## Objectif

Permettre à l'utilisateur de choisir, à l'étape 2 du wizard d'import, comment chaque valeur de source présente dans son CSV doit être interprétée par ClosRM — en miroir exact du mapping des statuts (T-034).

**Non-objectifs** (hors scope, remis au chantier B — rename/recolor) :
- Créer de nouvelles sources custom par workspace
- Ajouter une source `dm` (évalué puis écarté — trop d'impact : migration DB, enum, SourceBadge, 12 fichiers hardcodés)
- Sauvegarder le mapping entre imports successifs
- Renommer / recolorer les sources existantes

## Design UX

### Écran : Step 2 (Mapping & Config)

Quand la colonne source est mappée, un bloc **"Valeurs de source détectées (N)"** apparaît sous le `StatusValueMapper` existant (et donc sous le tableau de mapping des colonnes). Même structure visuelle que `StatusValueMapper` : table à 3 colonnes (Valeur CSV / Action / Résultat), dropdown par valeur, compteur rouge "X à régler" dans le header.

### Trois actions possibles par valeur CSV

Strictement identiques à T-034 :

1. **Mapper vers une source ClosRM** (choix parmi les 6 sources). La valeur CSV est remplacée par la source ClosRM correspondante.
2. **Convertir en tag**. La source devient `config.default_source` (ou `'manuel'` si non défini), et la valeur CSV brute est ajoutée aux tags du lead.
3. **Ignorer**. La source devient `config.default_source` (ou `'manuel'`), la valeur CSV est perdue.

### Auto-suggestion

Dictionnaire de synonymes appliqué automatiquement. Approche **conservatrice** : on n'inclut que les synonymes qui désignent sans ambiguïté la source cible. Les termes ambigus comme "Instagram" ou "Facebook" seuls (qui peuvent signifier ads ou organique selon le contexte) sont volontairement exclus → ils retournent `null` et l'utilisateur tranche manuellement.

**Dictionnaire** (source de vérité : `src/lib/leads/csv-parser.ts`) :

```ts
const SOURCE_SYNONYMS: Record<LeadSource, string[]> = {
  facebook_ads: [
    'facebook ads', 'meta ads', 'fb ads',
  ],
  instagram_ads: [
    'instagram ads', 'ig ads', 'insta ads',
  ],
  follow_ads: [
    'follow ads',
  ],
  formulaire: [
    'formulaire', 'form', 'website form', 'landing page', 'contact form',
  ],
  manuel: [
    'manuel', 'manual', 'direct', 'import', 'inconnu',
  ],
  funnel: [
    'funnel', 'tunnel', 'vsl',
  ],
}
```

Matching : **identique** à `suggestStatusMapping` — normalisation (lowercase + strip accents + strip ponctuation), pass 1 exact, pass 2 inclusion avec guard `length >= 3`.

### Blocage

Comme pour les statuts : le bouton "Continuer" est désactivé si au moins une valeur de source détectée n'a pas d'action résolue. `canContinue` est étendu à `hasRequiredField && !hasUnresolvedStatusValues && !hasUnresolvedSourceValues`.

### Comportement attendu pour les 4 sources historiques de Rémy

| Valeur CSV | Auto-suggestion | Décision de l'utilisateur (attendue) |
|---|---|---|
| `Meta Ads` | `facebook_ads` ✓ (via "meta ads") | Accepter |
| `Instagram` | `null` (ambigu — ads ou DM ?) | Tag (leads DM, info préservée) |
| `Salle` | `null` | Tag |
| `Bouche-à-oreille` | `null` | Tag |

## Architecture technique

### Types (`src/types/index.ts`)

Ajouter :

```ts
export type SourceMappingAction =
  | { type: 'map'; source: LeadSource }
  | { type: 'tag' }
  | { type: 'ignore' }
```

Et étendre `ImportConfig` :

```ts
export interface ImportConfig {
  // … champs existants
  source_value_mapping: Record<string, SourceMappingAction>
}
```

Comme pour `status_value_mapping`, la clé est la **valeur CSV brute** (ex: `"Meta Ads"`).

### CSV parser (`src/lib/leads/csv-parser.ts`)

Ajouter, en miroir exact de T-034 :

```ts
export const SOURCE_SYNONYMS: Record<LeadSource, string[]> = { … }

export function extractUniqueSourceValues(
  rows: Record<string, string>[],
  csvHeader: string,
): string[]

export function suggestSourceMapping(
  value: string,
): LeadSource | null
```

Les deux fonctions peuvent partager l'implémentation avec leurs jumelles status. Mais par **décision délibérée de non-factorisation** (voir "Risques"), on les duplique pour ne pas toucher au code de T-034 juste après son merge.

### UI (`src/components/leads/import/SourceValueMapper.tsx`)

**Nouveau composant**, **clone exact** de `StatusValueMapper`. Seules différences :
- Constantes `SOURCE_LABELS` et `SOURCE_ORDER` (au lieu de `STATUS_*`)
- Props : `mapping: Record<string, SourceMappingAction>` (au lieu de `StatusMappingAction`)
- `encodeAction` / `decodeAction` : identiques sauf que le préfixe "map:" encode une `LeadSource` au lieu d'une `LeadStatus`

Le nom du composant, le titre du header ("Valeurs de source détectées") et les labels du dropdown changent, le reste est un copier-coller mental.

### Step 2 (`src/components/leads/import/Step2_MappingConfig.tsx`)

Trois ajouts :

1. Nouveaux memos symétriques à ceux des statuts :
   - `sourceCsvHeader` — colonne CSV mappée vers `source`
   - `uniqueSourceValues` — valeurs uniques extraites
2. `useEffect` d'auto-suggestion identique à celui des statuts mais sur `[uniqueSourceValues]`.
3. `hasUnresolvedSourceValues` memo + extension de `canContinue`.
4. Rendu conditionnel du `<SourceValueMapper />` à côté de `<StatusValueMapper />` (juste en dessous).

### Moteur d'import (`src/lib/leads/import-engine.ts`)

Dans `validateRow`, **avant** le bloc de validation enum des sources actuel (lignes ~153-168), insérer une branche miroir de celle des statuts :

```ts
const rawSource = (row.source || '').trim()
let tagFromSource: string | null = null

if (rawSource && config.source_value_mapping && config.source_value_mapping[rawSource]) {
  const action = config.source_value_mapping[rawSource]
  if (action.type === 'map') {
    prepared.source = action.source
  } else if (action.type === 'tag') {
    prepared.source = config.default_source || 'manuel'
    tagFromSource = rawSource
  } else {
    prepared.source = config.default_source || 'manuel'
  }
} else {
  // Existing enum fallback — no change
  const validSources: LeadSource[] = [...]
  if (!validSources.includes(prepared.source as LeadSource)) {
    if (config.default_source) {
      prepared.source = config.default_source
    } else {
      errors.push({ … })
      return { valid: false, errors }
    }
  }
}
```

Puis, dans la préparation de `data` à la fin de `validateRow`, ajouter l'injection du tag en miroir de `tagFromStatus` :

```ts
if (tagFromSource) {
  const existingTags = (data.tags as string[]) || []
  data.tags = [...existingTags, tagFromSource]
}
```

**Note :** si à la fois `tagFromStatus` et `tagFromSource` sont définis, les deux sont ajoutés au même tableau `data.tags`, ordre : batch_tags existants → tag status → tag source.

## Flux de données

```
CSV → parseCsvFile → rows (headers FR)
  → Step 2 : user mappe "Source" → column source
    → extractUniqueSourceValues(rows, statusField) → ['Meta Ads', 'Instagram', 'Salle', 'Bouche-à-oreille']
    → suggestSourceMapping(value) pour chaque → pré-remplit source_value_mapping
    → user ajuste les non-matchs → source_value_mapping complet
  → applyMapping → rows avec row.source = valeur CSV brute
  → POST /api/leads/import { rows, config: { …, source_value_mapping, status_value_mapping } }
  → executeImport → validateRow :
      lookup config.source_value_mapping[row.source] → action
      applique map/tag/ignore
  → INSERT lead avec source correcte + tag si applicable
```

## Tests

### Unit tests (scripts Node one-off, pattern T-034)

**csv-parser :**
- `extractUniqueSourceValues` : dédoublonnage, trim, filtre vides
- `suggestSourceMapping` sur les 4 sources réelles de Rémy :
  - "Meta Ads" → `facebook_ads`
  - "Instagram" → `null`
  - "Salle" → `null`
  - "Bouche-à-oreille" → `null`
- Edge cases : vide → null, "XYZ" → null, "  META ADS  " → `facebook_ads`
- Régressions : "funnel" → `funnel`, "Formulaire" → `formulaire`, "Manual" → `manuel`

**import-engine :**
- `validateRow` avec `source_value_mapping.map` → source mappée
- `validateRow` avec `source_value_mapping.tag` → source = default, tag ajouté
- `validateRow` avec `source_value_mapping.ignore` → source = default, pas de tag
- `validateRow` sans `source_value_mapping` (compat) → fallback enum actuel inchangé
- Combinaison `tagFromStatus` + `tagFromSource` → les deux tags dans `data.tags`

### Test manuel

CSV de test `test-import-source.csv` à la racine (non commité), 5-6 leads couvrant :
- 1 ligne avec source auto-reconnue (ex: "Meta Ads" → `facebook_ads`)
- 3 lignes avec sources non reconnues ("Instagram", "Salle", "Bouche-à-oreille")
- 1 ligne avec source déjà en forme d'enum ("funnel")

Vérifier que :
- Le `SourceValueMapper` apparaît sous le `StatusValueMapper`
- Les 3 valeurs non reconnues bloquent le bouton Continuer
- Une fois les 3 taggées, l'import passe
- Les tags sont bien créés ("Instagram", "Salle", "Bouche-à-oreille") et coexistent avec tout tag de statut

## Risques / points d'attention

- **Duplication de code** : `SourceValueMapper.tsx` sera ~95 % identique à `StatusValueMapper.tsx`. Décision volontaire pour ne pas toucher au code de T-034 fraîchement mergé. Un ticket d'amélioration sera créé dans `ameliorations.md` (`A-035-01`) pour factoriser ultérieurement en composant générique `<ValueMapper<T> />`.

- **useEffect dépendances** : mêmes règles que pour le mapping statut (`[uniqueSourceValues]`, avec `eslint-disable react-hooks/exhaustive-deps` volontaire). La stabilité de la référence du memo est documentée dans `Step2_MappingConfig.tsx` (commentaire explicatif déjà présent pour statuts — à étendre).

- **Synonymes intentionnellement conservateurs** : pas de match pour "Instagram" ou "Facebook" seuls. Coût attendu : 1 clic manuel par valeur unique lors de l'import. Bénéfice : 0 faux positif silencieux (leçon de T-034 avec "Qualifié" → dead).

- **Pre-existing : `SOURCE_OPTIONS` dans Step2 probablement incomplet** (comme `STATUS_OPTIONS` l'était, loggé dans A-034-03). À vérifier pendant l'implémentation et logger en amélioration si concerné.

## Estimation

~3-4h :
- Types (~10 min)
- Parser + helpers + dictionnaire + script de test (~45 min)
- Engine (~45 min)
- `SourceValueMapper.tsx` (~30 min, clone)
- Intégration Step2 (~1h)
- Test manuel (~30 min)
- Finalisation (commit de fichier de tâche, push) (~15 min)
