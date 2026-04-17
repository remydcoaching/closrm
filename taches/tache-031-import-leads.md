# Tâche 031 — Import portefeuille de leads (CSV + alternatives)

> **Statut :** ✅ Terminé (2026-04-15)
> **Développeur :** Rémy
> **Date de création :** 2026-04-07
> **Branche Git prévue :** `feature/remy-leads-import`

---

## Objectif

Permettre à un coach qui rejoint ClosRM d'**importer son portefeuille de leads
existant** depuis n'importe quelle source (autre CRM, fichier perso, contacts
téléphone, etc.) sans tout ressaisir manuellement.

L'import doit gérer le mapping des colonnes, la déduplication, et déclencher
les automations adéquates (cf. T-029 trigger `lead_imported`).

---

## Périmètre

### Phase 1 — Import CSV (priorité)

- [ ] Page `/leads/import` (ou modale depuis le bouton "Importer" sur la
      liste leads)
- [ ] Étape 1 : drag & drop d'un fichier CSV (ou bouton de sélection)
- [ ] Étape 2 : aperçu des 10 premières lignes + détection auto des séparateurs
      (`,` `;` `\t`) et de l'encodage (UTF-8 / Latin-1)
- [ ] Étape 3 : mapping des colonnes CSV → champs ClosRM (drag & drop
      ou dropdown par colonne)
  - Champs cibles : `first_name`, `last_name`, `phone`, `email`,
    `instagram_handle`, `source`, `status`, `tags` (split par `;`),
    `notes`, `created_at`
- [ ] Étape 4 : configuration de l'import
  - Source par défaut (si pas mappée) : sélecteur
  - Statut par défaut : sélecteur
  - Tags à appliquer à tout le batch
  - Stratégie de déduplication : `email` / `phone` / `email + phone` / aucune
  - Action en cas de doublon : ignorer / mettre à jour / créer quand même
- [ ] Étape 5 : preview du diff (X nouveaux, Y mis à jour, Z ignorés) avant
      validation
- [ ] Étape 6 : import en background avec barre de progression (chunks de 100)
- [ ] Étape 7 : récap final + lien vers les leads créés
- [ ] Stockage du `batch_id` dans `leads.import_batch_id` pour pouvoir
      annuler / filtrer plus tard

### Phase 2 — Trigger workflow

- [ ] À la fin d'un import → fire le trigger `lead_imported` (cf. T-029)
      avec `{ batch_id, lead_count, source, workspace_id }`
- [ ] Permet à Pierre côté Automations d'enrôler tout le batch dans une
      séquence email de bienvenue, par exemple

### Phase 3 — Annulation d'un import

- [ ] Page "Historique des imports" listant les batchs (date, source, count,
      status, par qui)
- [ ] Bouton "Annuler cet import" → soft-delete tous les leads avec ce
      `import_batch_id` (uniquement si pas de calls/follow-ups attachés)

### Phase 4 — Sources alternatives au CSV (à valider avant code)

Voici les options possibles, **à choisir avec le coach** selon l'effort/valeur :

| Source | Description | Effort | Valeur estimée |
|--------|-------------|--------|----------------|
| **CSV** ✅ | Format universel, exports possibles depuis Excel, Google Sheets, n'importe quel CRM | Faible | Très haute |
| **Excel (.xlsx)** | Beaucoup de coachs utilisent Excel, évite l'étape "Enregistrer sous CSV". Lib `xlsx` (SheetJS) côté serveur | Faible | Haute |
| **vCard (.vcf)** | Export depuis carnet d'adresses iOS/Android. Pertinent si le coach veut rapatrier ses contacts perso | Moyen (parser) | Moyenne |
| **Google Contacts** | OAuth Google → import direct via People API. Le coach connecte une fois et synchronise | Élevé (OAuth + people API) | Haute si coach peu tech |
| **Coller du texte** | Champ textarea où le coach colle son tableau Excel / Notion. Smart parse colonnes | Moyen | Moyenne (UX rapide) |
| **Notion DB** | Import depuis une base Notion via l'API. Niche mais demandé | Élevé | Faible (V2.1) |
| **Airtable** | Import via API Airtable | Élevé | Faible (V2.1) |
| **HubSpot / Pipedrive / Trello** | Migrations depuis CRMs concurrents | Élevé (par CRM) | Moyenne (acquisition) |
| **API REST** | Endpoint `POST /api/leads/bulk` documenté pour devs | Faible (existe presque) | Moyenne (intégrations custom) |

**Reco V1 :** CSV uniquement (Phase 1+2+3). Phase 4 à prioriser après retour
utilisateurs : très probablement Excel + Google Contacts ensuite.

---

## Fichiers concernés

### Fichiers à créer
| Fichier | Description |
|---------|-------------|
| `supabase/migrations/0XX_lead_import_batches.sql` | Table `lead_import_batches` + colonne `leads.import_batch_id` |
| `src/app/(dashboard)/leads/import/page.tsx` | Page de l'assistant d'import |
| `src/components/leads/import/CsvUpload.tsx` | Étape 1 : upload |
| `src/components/leads/import/CsvPreview.tsx` | Étape 2 : aperçu |
| `src/components/leads/import/ColumnMapper.tsx` | Étape 3 : mapping |
| `src/components/leads/import/ImportConfig.tsx` | Étape 4 : config |
| `src/components/leads/import/ImportProgress.tsx` | Étape 6 : barre |
| `src/app/api/leads/import/route.ts` | API d'import (POST upload + start) |
| `src/app/api/leads/import/[batch_id]/route.ts` | Status du batch |
| `src/lib/leads/csv-parser.ts` | Parser CSV (PapaParse) |
| `src/lib/leads/import-engine.ts` | Logique de dédup + insert + fire trigger |

### Fichiers à modifier
| Fichier | Nature |
|---------|--------|
| `src/types/index.ts` | `Lead` += `import_batch_id`, type `LeadImportBatch` |
| `src/components/leads/leads-page.tsx` | Bouton "Importer" à côté de "Ajouter un lead" |
| `supabase/schema.sql` | Reflet de la migration |

---

## Tâches liées

| Relation | Tâche | Description |
|----------|-------|-------------|
| Coordination avec | T-029 | Trigger `lead_imported` (Pierre l'expose) |
| Liée à | T-027 | Champ `instagram_handle` créé en T-027, importable en CSV |
| Liée à | T-012 | Module Base de données — utilise déjà l'export CSV, on ferme la boucle |

---

## Notes techniques

### Librairies suggérées
- **PapaParse** — parser CSV robuste, streaming, détection encodage
- **SheetJS (xlsx)** — pour Excel en Phase 4

### Performance
- Imports > 1000 leads → background job. Soit via cron interne (lent), soit
  via une queue type Vercel Queue / QStash. Pour la V1 : limite à 5000 leads
  par import et processing inline avec batches de 100 (acceptable < 30s).

### Déduplication
- L'algo doit être configurable (email seul / phone seul / les deux)
- Normaliser les phones avant comparaison (libphonenumber-js déjà installé ?)
- Normaliser les emails (lowercase + trim)

### Sécurité
- Limiter la taille du fichier (5 Mo max)
- Valider chaque ligne avec le schéma Zod existant + skip les lignes invalides
- Logger les erreurs ligne par ligne pour le récap final

---

## Spec

`docs/superpowers/specs/2026-04-15-import-leads-csv-design.md` — Approche hybride (parsing client PapaParse, import serveur), wizard 5 étapes, auto-mapping FR/EN, dédup configurable, correction inline des erreurs, historique + annulation.

---

## Résultat final

### Périmètre livré (Phase 1 + 2 + 3)

- Wizard 5 étapes sur page dédiée `/leads/import`
- Auto-mapping colonnes CSV → champs ClosRM (synonymes FR/EN, confiance vert/orange/rouge)
- Config : source par défaut, statut par défaut, tags batch, stratégie de dédup, action doublon
- Preview diff serveur (compteurs + exemples) avant import
- Import par chunks de 100, max 5000 leads / 5 Mo
- Barre de progression, chunking client si > 2000 lignes
- Récap avec correction inline + réimport des lignes corrigées
- Historique des imports + annulation de batch (soft-delete si pas de calls/follow-ups)
- Trigger `lead_imported` fired à la fin (compatible T-029 Pierre)
- Bouton "Importer" ajouté dans le header de la liste leads

### Migration

`supabase/migrations/023_lead_import_batches.sql` — table `lead_import_batches` + colonne `leads.import_batch_id` + RLS

### Dépendance installée

`papaparse` + `@types/papaparse`

### Fichiers créés (17)

| Fichier | Description |
|---------|-------------|
| `supabase/migrations/023_lead_import_batches.sql` | Migration DB |
| `src/lib/leads/csv-parser.ts` | Parser CSV + auto-mapping |
| `src/lib/leads/import-engine.ts` | Dédup + validation + insert + trigger |
| `src/app/api/leads/import/preview/route.ts` | API preview diff |
| `src/app/api/leads/import/route.ts` | API import |
| `src/app/api/leads/import/[batchId]/route.ts` | API status + annulation |
| `src/app/api/leads/import/history/route.ts` | API historique |
| `src/app/(dashboard)/leads/import/page.tsx` | Page wizard |
| `src/app/(dashboard)/leads/import/import-client.tsx` | Client wizard state machine |
| `src/components/leads/import/ImportStepper.tsx` | Stepper 5 étapes |
| `src/components/leads/import/Step1_UploadPreview.tsx` | Upload + preview |
| `src/components/leads/import/Step2_MappingConfig.tsx` | Mapping + config |
| `src/components/leads/import/Step3_PreviewDiff.tsx` | Preview diff |
| `src/components/leads/import/Step4_ImportProgress.tsx` | Progression |
| `src/components/leads/import/Step5_Recap.tsx` | Récap + correction |
| `src/components/leads/import/ImportHistory.tsx` | Historique |
| `src/app/(dashboard)/leads/import/history/page.tsx` | Page historique |

### Fichiers modifiés (3)

| Fichier | Modification |
|---------|-------------|
| `src/types/index.ts` | `import_batch_id` sur Lead, types import (7 exports) |
| `src/app/(dashboard)/leads/leads-client.tsx` | Bouton "Importer" dans header |
| `supabase/schema.sql` | Reflet migration 023 |

---

## Améliorations identifiées pendant cette tâche

- A-015 : Import Excel (.xlsx) via SheetJS
- A-016 : Import Google Contacts via People API
- A-017 : Normalisation phone avancée (libphonenumber-js)
- A-018 : Background job pour imports > 5000 leads
