# Tâche 034 — Mapping intelligent des statuts à l'import

**Dev :** Rémy
**Statut :** terminé (2026-04-24)
**Branche :** `feature/remy-restore-plus-dropdown` (continuité de la PR #286)

## Objectif

À l'étape 2 du wizard d'import CSV, quand la colonne statut est mappée, afficher un tableau des valeurs de statut détectées dans le CSV et laisser l'utilisateur décider pour chacune : mapper vers un statut ClosRM existant, convertir en tag, ou ignorer. Auto-suggestion par dictionnaire de synonymes FR/EN.

## Spec

**Document :** [docs/superpowers/specs/2026-04-23-import-status-mapping-design.md](../docs/superpowers/specs/2026-04-23-import-status-mapping-design.md)

**Décisions clés :**
- **N1 seul** : pas de création de statuts custom (N2/N3 remis à plus tard)
- **3 actions** par valeur CSV : Mapper / Tag / Ignorer
- **Auto-suggestion** par dictionnaire, mais **pas de fallback silencieux** : une valeur sans match force l'utilisateur à choisir manuellement (bloque le bouton "Continuer")
- **Tag fallback** pour conserver la valeur CSV quand aucun statut ClosRM ne convient

## Fichiers à créer/modifier

- `src/types/index.ts` — étendre `ImportConfig` avec `status_value_mapping`
- `src/lib/leads/csv-parser.ts` — `STATUS_SYNONYMS`, `extractUniqueStatusValues`, `suggestStatusMapping`
- `src/components/leads/import/Step2_MappingConfig.tsx` — intégrer `StatusValueMapper`
- `src/components/leads/import/StatusValueMapper.tsx` — **nouveau** sous-composant
- `src/lib/leads/import-engine.ts` — étendre `validateRow` pour appliquer le mapping
- Tests unitaires : parser + engine

## Tâches liées

- Tâche 031 (import-leads) — wizard d'import initial
- PR #286 — fix(leads) date de création à l'import (branche commune)

## Résultat

Implémenté et mergé dans PR #286. Commits :
- `d01683f` — types : `StatusMappingAction` + `ImportConfig.status_value_mapping`
- `5ad1e62` — parser : `STATUS_SYNONYMS` + helpers
- `65c530e` — fix post-review : synonyme `qualifié` → `scripte` (anti-faux-positif Pass-2)
- `5740b35` — engine : application du mapping dans `validateRow` + fix latent `scripte` manquant dans `validStatuses`
- `cabb915` — commentaire sur couplage `tagFromStatus` + log A-034-01 / A-034-02 dans `ameliorations.md`
- `e81ddf4` — composant `StatusValueMapper`
- `34651c6` — fix post-review : a11y (`aria-label` sur selects) + exhaustiveness (`STATUS_ORDER` dérivé des clés)
- `9b882a4` — intégration Step2 + gating du bouton Continuer
- `2a2d3de` — fix post-review : import `StatusMappingAction` inutile retiré + A-034-03 / A-034-04 loggués

Testé manuellement avec un CSV de 7 leads couvrant les 3 actions (map / tag / ignore) et l'auto-suggestion FR/EN sur les 12 valeurs historiques du CSV de Rémy.

## Améliorations identifiées (à valider avant implémentation)

- `A-034-01` · trim whitespace sur `prepared.status` dans `validateRow` (pre-existing)
- `A-034-02` · synonymes additionnels courants dans `STATUS_SYNONYMS`
- `A-034-03` · `STATUS_OPTIONS` incomplet dans Step2 (3 statuts absents du dropdown "Statut par défaut")
- `A-034-04` · message d'aide si aucune valeur de statut n'est auto-reconnue
