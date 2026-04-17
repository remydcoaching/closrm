# T-031 — Import portefeuille de leads (CSV)

> **Date :** 2026-04-15
> **Développeur :** Rémy
> **Branche :** `feature/remy-leads-import`
> **Approche :** Hybrid (parsing client, import serveur)

---

## Résumé

Wizard en 5 étapes sur une page dédiée `/leads/import` permettant à un coach d'importer son portefeuille de leads depuis un fichier CSV. Le parsing se fait côté client (PapaParse) pour un preview instantané. Le serveur gère la déduplication, la validation Zod, l'insertion par chunks et le fire du trigger `lead_imported`.

V1 inclut : import CSV, historique des imports, annulation de batch, correction inline des erreurs.

---

## Décisions de design

| Question | Décision |
|----------|----------|
| Nombre d'étapes | 5 (fusions preview+mapping et config+preview-diff) |
| Format UX | Page dédiée `/leads/import` avec stepper horizontal |
| Mapping colonnes | Auto-mapping intelligent (synonymes FR/EN) + dropdown correction |
| Limite | 5 000 leads / 5 Mo max |
| Dédup par défaut | Configurable (email / phone / email+phone / aucune), "ignorer" par défaut |
| Historique + annulation | Inclus dès la V1 |
| Récap erreurs | Détaillé + correction inline + réimport des lignes corrigées |
| Approche archi | Hybrid : parsing client (PapaParse), import serveur |

---

## Flux du wizard

### Étape 1 — Upload & Preview

- Zone drag & drop (CSV uniquement, 5 Mo max)
- Parsing client via PapaParse : détection séparateur (`,` `;` `\t`), encodage (UTF-8 / Latin-1)
- Affichage des 10 premières lignes + compteur total
- Auto-mapping des headers CSV vers les champs ClosRM (voir section dédiée)
- Séparateur modifiable via dropdown si la détection est incorrecte

### Étape 2 — Mapping & Config

**Mapping (section gauche) :**
- Tableau "Colonne CSV" → "Champ ClosRM" avec dropdown
- Indicateur de confiance : vert (match exact) / orange (suggestion) / rouge (non mappé)
- Champs non mappés = ignorés (grisés)
- Validation : au moins `email` ou `phone` doit être mappé

**Configuration (section droite) :**
- Source par défaut (dropdown `LeadSource`)
- Statut par défaut (dropdown `LeadStatus`)
- Tags à appliquer au batch (input tags)
- Stratégie de dédup (radio : email / phone / email+phone / aucune)
- Action doublon (radio : ignorer / mettre à jour / créer quand même)

### Étape 3 — Preview diff

- Client envoie le JSON mappé à `POST /api/leads/import/preview`
- Serveur exécute dédup + validation **sans insérer**, retourne :
  - Compteurs : à créer / à mettre à jour / ignorés / erreurs
  - Exemples : 5 premiers de chaque catégorie
  - Pour les updates : diff avant/après
  - Détail des erreurs : ligne, champ, valeur, raison
- Affichage : 4 compteurs (vert/bleu/gris/rouge) + onglets exemples

### Étape 4 — Import

- `POST /api/leads/import` avec le JSON mappé + config
- Insert par chunks de 100
- Si > 2000 leads : le client split en appels séquentiels (0-999, 1000-1999, etc.) pour respecter le timeout Vercel
- Barre de progression + compteur "X / Y leads importés"
- Polling `GET /api/leads/import/[batchId]` toutes les 2s
- À la fin : fire trigger `lead_imported`

### Étape 5 — Récap

- Compteurs définitifs : créés / mis à jour / ignorés / erreurs
- Bouton "Voir les leads importés" → `/leads?import_batch_id=xxx`
- Bouton "Nouvel import"
- Tableau des erreurs éditable inline (chaque cellule corrigeable)
- Bouton "Réimporter les lignes corrigées" → renvoie les lignes au même endpoint avec le même `batch_id`
- Lien vers historique des imports

---

## Auto-mapping des colonnes

### Synonymes

```typescript
const COLUMN_SYNONYMS: Record<string, string[]> = {
  first_name:       ['prénom', 'prenom', 'first_name', 'firstname', 'first name', 'nom de baptême'],
  last_name:        ['nom', 'nom de famille', 'last_name', 'lastname', 'last name', 'family name'],
  email:            ['email', 'e-mail', 'mail', 'adresse email', 'courriel'],
  phone:            ['téléphone', 'telephone', 'tel', 'phone', 'mobile', 'portable', 'numéro'],
  instagram_handle: ['instagram', 'insta', 'ig', 'handle', '@instagram'],
  source:           ['source', 'origine', 'provenance', 'canal'],
  status:           ['statut', 'status', 'état', 'etat', 'pipeline'],
  tags:             ['tags', 'étiquettes', 'labels', 'catégories'],
  notes:            ['notes', 'commentaires', 'remarques', 'description', 'observations'],
  created_at:       ['date', 'date de création', 'created_at', 'créé le', 'ajouté le', 'date ajout'],
}
```

### Algorithme

1. Normaliser le header : lowercase, trim, retirer accents
2. Match exact dans les synonymes → confiance verte
3. Match par inclusion (le header contient un synonyme) → confiance orange
4. Aucun match → confiance rouge (non mappé)
5. Le coach corrige uniquement les oranges et rouges

### Contrainte

Au moins `email` ou `phone` doit être mappé pour passer à l'étape suivante.

---

## Déduplication & validation

### Stratégies de dédup

| Stratégie | Logique |
|-----------|---------|
| `email` | Normalise (lowercase + trim), cherche lead existant par email |
| `phone` | Normalise (retirer espaces/tirets/points, garder chiffres + `+`), cherche par phone |
| `email_and_phone` | Doublon si **les deux** matchent |
| `none` | Pas de dédup, tout est créé |

### Actions en cas de doublon

| Action | Comportement |
|--------|-------------|
| `skip` (défaut) | Garde l'existant, ligne comptée comme "ignorée" |
| `update` | Met à jour les champs non-vides du CSV. Les champs vides ne viennent pas écraser |
| `create` | Crée quand même (le coach assume les doublons) |

### Normalisation

- **Email** : `trim().toLowerCase()`
- **Phone** : retirer tout sauf chiffres et `+`
- **Instagram** : retirer le `@` en préfixe

### Validation Zod

Réutilise le `createLeadSchema` existant, adapté :
- Email : optionnel, format valide si présent
- Phone : max 30 chars, nettoyé
- Status : doit être dans `LeadStatus`, sinon → statut par défaut
- Source : doit être dans `LeadSource`, sinon → source par défaut
- Tags : split par `;` si string
- Ligne invalide = pas insérée, ajoutée aux erreurs avec raison

---

## Modèle de données

### Nouvelle table `lead_import_batches`

```sql
create table lead_import_batches (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id),
  file_name     text not null,
  status        text not null default 'pending'
                check (status in ('pending','processing','completed','failed','cancelled')),
  total_rows    int not null default 0,
  created_count int not null default 0,
  updated_count int not null default 0,
  skipped_count int not null default 0,
  error_count   int not null default 0,
  errors        jsonb default '[]',
  config        jsonb not null default '{}',
  created_by    uuid references auth.users(id),
  created_at    timestamptz default now(),
  completed_at  timestamptz
);
```

### Colonne ajoutée à `leads`

```sql
alter table leads add column import_batch_id uuid references lead_import_batches(id);
```

### Format `errors` (jsonb)

```json
[
  { "row": 42, "field": "email", "value": "pas-un-email", "reason": "Format email invalide" },
  { "row": 87, "field": "phone", "value": "", "reason": "Téléphone requis (stratégie dédup: phone)" }
]
```

### `config` (jsonb)

```json
{
  "mapping": { "Prénom": "first_name", "Email": "email", ... },
  "default_source": "manuel",
  "default_status": "nouveau",
  "batch_tags": ["import-avril"],
  "dedup_strategy": "email",
  "dedup_action": "skip"
}
```

### RLS

Policy sur `workspace_id`, même pattern que les autres tables.

---

## API endpoints

| Route | Méthode | Rôle |
|-------|---------|------|
| `/api/leads/import/preview` | POST | Reçoit le JSON mappé + config, retourne le diff sans insérer |
| `/api/leads/import` | POST | Lance l'import, crée le batch, retourne `batch_id` |
| `/api/leads/import/[batchId]` | GET | Statut du batch (progression) |
| `/api/leads/import/[batchId]` | DELETE | Annuler un import (soft-delete leads du batch) |
| `/api/leads/import/history` | GET | Liste des batchs du workspace |

### Annulation

`DELETE /api/leads/import/[batchId]` :
- Soft-delete les leads ayant ce `import_batch_id`
- **Seulement si** le lead n'a pas de calls ou follow-ups attachés
- Retourne le nombre de leads supprimés vs non-supprimables
- Met le batch en `status: 'cancelled'`

---

## Trigger workflow

```typescript
await fireWorkflowTrigger('lead_imported', {
  batch_id: batch.id,
  lead_count: batch.created_count + batch.updated_count,
  source: config.default_source,
  workspace_id
})
```

Le trigger `lead_imported` est déjà défini dans le système de workflows (T-029 Pierre).

---

## UI & Design

### Design system

Suit le design system ClosRM existant :
- Background `#0A0A0A`, surface `#141414`, border `#262626`
- Primary `#E53E3E` (rouge), success `#38A169`, warning `#D69E2E`
- Composants shadcn/ui

### Layout page `/leads/import`

- Stepper horizontal 5 étapes en haut (active = rouge, passée = vert, future = grisée)
- Boutons "Retour" (ghost) à gauche, "Continuer" (primary rouge) à droite
- Bouton "Annuler l'import" discret en haut à droite → retour `/leads`

### Étape 1 — Upload

- Zone drag & drop centrée, icône fichier, texte "Glissez votre fichier CSV ici ou cliquez pour sélectionner"
- Contraintes affichées : "CSV uniquement, 5 Mo max, 5 000 lignes max"
- Après upload : tableau 10 premières lignes, compteur "247 lignes détectées"

### Étape 2 — Mapping & Config

- Layout 2 colonnes : mapping à gauche, config à droite
- Pastilles de confiance sur chaque mapping (vert/orange/rouge)

### Étape 3 — Preview diff

- 4 badges compteurs en gros : créer (vert) / màj (bleu) / ignorés (gris) / erreurs (rouge)
- Onglets sous les compteurs pour exemples de chaque catégorie

### Étape 4 — Import

- Barre de progression animée + pourcentage
- Compteur "156 / 342 leads importés..."

### Étape 5 — Récap

- 4 badges compteurs définitifs
- Boutons "Voir les leads importés" (primary) + "Nouvel import" (secondary)
- Tableau erreurs éditable + bouton "Réimporter les corrigés"

### Point d'entrée

Bouton "Importer" (icône Upload) dans le header de `leads-client.tsx`, à côté de "Ajouter un lead". Navigation vers `/leads/import`.

### Historique

Page `/leads/import/history` accessible depuis le récap ou les paramètres :
- Tableau : date, fichier, créé par, total, créés/màj/ignorés/erreurs, statut
- Bouton "Annuler" par batch

---

## Fichiers à créer

| Fichier | Description |
|---------|-------------|
| `supabase/migrations/023_lead_import_batches.sql` | Table + colonne `import_batch_id` + RLS |
| `src/app/(dashboard)/leads/import/page.tsx` | Page wizard (SSR wrapper) |
| `src/app/(dashboard)/leads/import/import-client.tsx` | Client component wizard |
| `src/app/(dashboard)/leads/import/history/page.tsx` | Page historique imports |
| `src/components/leads/import/ImportWizard.tsx` | State machine du wizard |
| `src/components/leads/import/Step1_UploadPreview.tsx` | Upload + preview + auto-mapping |
| `src/components/leads/import/Step2_MappingConfig.tsx` | Mapping dropdown + config dédup |
| `src/components/leads/import/Step3_PreviewDiff.tsx` | Diff serveur |
| `src/components/leads/import/Step4_ImportProgress.tsx` | Barre de progression |
| `src/components/leads/import/Step5_Recap.tsx` | Résultats + correction inline |
| `src/components/leads/import/ImportHistory.tsx` | Tableau historique |
| `src/app/api/leads/import/preview/route.ts` | API preview diff |
| `src/app/api/leads/import/route.ts` | API import |
| `src/app/api/leads/import/[batchId]/route.ts` | API status + annulation |
| `src/app/api/leads/import/history/route.ts` | API historique |
| `src/lib/leads/csv-parser.ts` | Auto-mapping + normalisation headers |
| `src/lib/leads/import-engine.ts` | Dédup + validation + insert + trigger |

## Fichiers à modifier

| Fichier | Modification |
|---------|-------------|
| `src/types/index.ts` | Ajouter `import_batch_id` à `Lead`, type `LeadImportBatch` |
| `src/app/(dashboard)/leads/leads-client.tsx` | Bouton "Importer" dans le header |
| `supabase/schema.sql` | Reflet de la migration 023 |
| `package.json` | Ajouter `papaparse` + `@types/papaparse` |

---

## Dépendances externes

| Lib | Usage | À installer |
|-----|-------|-------------|
| `papaparse` | Parsing CSV côté client | Oui |
| `@types/papaparse` | Types TS | Oui |

---

## Hors périmètre V1

- Import Excel (.xlsx) — Phase 4
- Import vCard, Google Contacts, Notion, Airtable, HubSpot — Phase 4
- libphonenumber-js pour normalisation phone avancée
- SSE pour la progression (polling suffit)
