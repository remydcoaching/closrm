# Tâche 036 — Personnalisation des statuts et sources par workspace

**Dev :** Rémy
**Statut :** spec validée, à implémenter
**Branche :** `feature/remy-workspace-labels-config` (depuis `develop`)

## Objectif

Chaque workspace peut personnaliser ses 8 statuts + 6 sources sur 4 dimensions : renommer (label), recolorer (color + bg), réordonner (position), masquer (visible). Les enums DB restent inchangés — seule l'apparence/visibilité varie par workspace.

Deux points d'entrée UI pour une seule source de vérité (DB) : Paramètres > Réglages (éditeur complet) et bouton "Configurer les colonnes" du Kanban (quick edit reorder+visible uniquement).

## Spec

**Document :** [docs/superpowers/specs/2026-04-24-workspace-labels-config-design.md](../docs/superpowers/specs/2026-04-24-workspace-labels-config-design.md)

**Décisions clés :**
- **Stockage** : deux colonnes JSONB sur `workspaces` (`status_config`, `source_config`) — nullable, fallback sur defaults hardcodés
- **Structure** : array ordonné d'`{ key, label, color, bg, visible }` — l'ordre = position dans l'array
- **Runtime** : React Context au niveau du dashboard layout + hooks `useStatusConfig` / `useSourceConfig`
- **Refactor** : ~12-15 fichiers consommateurs de `STATUS_CONFIG`/`SOURCE_CONFIG` basculent vers les hooks
- **Migration** : le localStorage du Kanban existant est migré vers la DB au premier mount
- **Hors scope** : ajout/suppression de statuts (N3), icônes, configuration par utilisateur

## Fichiers à créer/modifier

### Nouveaux
- `supabase/migrations/050_workspace_status_source_config.sql` — deux colonnes JSONB
- `src/lib/workspace/status-defaults.ts` — `DEFAULT_STATUS_CONFIG` + `DEFAULT_SOURCE_CONFIG` extraits des valeurs hardcodées actuelles
- `src/lib/workspace/config.ts` — helpers de merge (defaults + overrides), conversions hex ↔ rgba
- `src/app/api/workspace/config/route.ts` — `GET` et `PATCH`
- `src/lib/workspace/context.tsx` — `WorkspaceConfigProvider` + hooks `useStatusConfig`, `useSourceConfig`
- `src/app/(dashboard)/parametres/reglages/labels-editor.tsx` — composant éditeur (une seule implémentation, réutilisée pour statuts et sources)

### Modifiés
- `src/types/index.ts` — types `StatusConfigEntry`, `SourceConfigEntry`, `StatusConfig`, `SourceConfig`
- `src/app/(dashboard)/layout.tsx` — wrapper dans `WorkspaceConfigProvider`
- `src/components/leads/StatusBadge.tsx` — `STATUS_CONFIG` devient le DEFAULT, le composant lit via hook
- `src/components/leads/SourceBadge.tsx` — idem pour les sources
- `src/app/(dashboard)/leads/views/KanbanColumnsConfigModal.tsx` — rewiring localStorage → context + API
- `src/app/(dashboard)/parametres/reglages/page.tsx` — ajout des sections Statuts + Sources
- ~12 fichiers consumers des `STATUS_CONFIG`/`SOURCE_CONFIG` — refactor mécanique vers hooks
- `src/components/leads/import/StatusValueMapper.tsx` — remplacer `STATUS_LABELS` par hook
- `src/components/leads/import/SourceValueMapper.tsx` — remplacer `SOURCE_LABELS` par hook
- `src/components/leads/import/Step2_MappingConfig.tsx` — `STATUS_OPTIONS`/`SOURCE_OPTIONS` filtrés par `visible` et triés

### Supprimés
- Logique localStorage pour `closrm.leads.kanban.columns` dans `src/lib/ui-prefs/leads-prefs.ts` (conservée en fallback pour la migration, puis supprimée)

## Tâches liées

- Tâche 031 (import leads) — wizard initial
- Tâche 034 (import status mapping) — consume les labels via le hook désormais
- Tâche 035 (import source mapping) — idem
- Migration 003 (branding) — pattern JSONB déjà en place sur `workspaces` pour `accent_color`/`logo_url`
