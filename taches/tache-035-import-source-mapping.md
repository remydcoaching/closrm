# Tâche 035 — Mapping intelligent des sources à l'import

**Dev :** Rémy
**Statut :** spec validée, à implémenter
**Branche :** `feature/remy-source-import-mapping` (depuis `develop`)

## Objectif

Miroir de T-034 appliqué aux sources : à l'étape 2 du wizard d'import, détecter les valeurs uniques de la colonne source mappée, auto-suggérer via un dictionnaire conservateur, forcer un choix manuel pour les valeurs sans match, trois actions possibles par valeur (mapper / tag / ignorer).

## Spec

**Document :** [docs/superpowers/specs/2026-04-24-import-source-mapping-design.md](../docs/superpowers/specs/2026-04-24-import-source-mapping-design.md)

**Décisions clés :**
- **Pas d'ajout de nouvelles sources** (le `dm` envisagé puis écarté — trop d'impact)
- **Dictionnaire conservateur** : pas de synonyme "Instagram" / "Facebook" seuls pour éviter les faux positifs silencieux
- **Duplication volontaire** du `StatusValueMapper` en `SourceValueMapper` (refus de refactor juste après le merge T-034, amélioration `A-035-01` à créer)

## Fichiers à créer/modifier

- `src/types/index.ts` — `SourceMappingAction` + `ImportConfig.source_value_mapping`
- `src/lib/leads/csv-parser.ts` — `SOURCE_SYNONYMS`, `extractUniqueSourceValues`, `suggestSourceMapping`
- `src/components/leads/import/SourceValueMapper.tsx` — **nouveau** (clone de `StatusValueMapper`)
- `src/components/leads/import/Step2_MappingConfig.tsx` — intégration à côté du `StatusValueMapper` existant
- `src/app/(dashboard)/leads/import/import-client.tsx` — `source_value_mapping: {}` dans `INITIAL_CONFIG`
- `src/lib/leads/import-engine.ts` — branche mapping avant le fallback enum source

## Tâches liées

- Tâche 034 (import status mapping) — pattern source de cette tâche
- Tâche 031 (import leads) — wizard initial
