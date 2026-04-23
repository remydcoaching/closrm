# Tâche 034 — Mapping intelligent des statuts à l'import

**Dev :** Rémy
**Statut :** spec validée, à implémenter
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
