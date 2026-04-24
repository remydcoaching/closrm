# Tâche 035 — Mapping intelligent des sources à l'import

**Dev :** Rémy
**Statut :** terminé (2026-04-24)
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

## Résultat

Commits (7 + 4 commits de review followup) :
- `2f44801` — types : `SourceMappingAction` + `ImportConfig.source_value_mapping`
- `d125a92` — parser : `SOURCE_SYNONYMS` (conservateur) + helpers, Pass 2 unidirectionnel
- `6d0ebdd` — review followup T2 : retrait de `'form'` (faux positif sur "platform") + cross-ref comment sur `suggestStatusMapping`
- `13ac682` — engine : application de `source_value_mapping` dans `validateRow` + fix scripte enum
- `4e7ea9a` — review followup T3 : commentaires (order + 'manuel' fallback) + A-035-05 loggué
- `882028e` — composant `SourceValueMapper` (clone de `StatusValueMapper`)
- `bd266eb` — intégration Step2 + gating `canContinue`
- `a9ae4f4` — **fix critique** : `updateConfig` en functional updater pour éviter collision d'effets (détecté par reviewer T5)
- `e1f83cd` — review followup T5 : commentaires symétriques sur l'effet source

Testé manuellement avec un CSV de 6 sources couvrant les 3 actions (map / tag / ignore) + auto-suggestion conservatrice + blocage du bouton + combo tag-from-status + tag-from-source.

## Améliorations identifiées

- `A-035-01` · factoriser `StatusValueMapper` + `SourceValueMapper` en composant générique
- `A-035-02` · durcissement des synonymes courts (`'direct'`, `'import'`) dans `SOURCE_SYNONYMS`
- `A-035-03` · ajouter synonymes FR "pub"/"publicité" pour les sources ads
- `A-035-04` · synonymes FR complémentaires pour `formulaire` et `manuel`
- `A-035-05` · trim whitespace sur `prepared.source` dans `validateRow` (pre-existing, parallèle à A-034-01)
