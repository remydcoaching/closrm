# Spec — Personnalisation des statuts et sources par workspace

**Date :** 2026-04-24
**Auteur :** Rémy
**Statut :** à implémenter
**Tâche liée :** `taches/tache-036-workspace-labels-config.md`

---

## Contexte

Les 8 statuts (`nouveau`, `scripte`, `setting_planifie`, `no_show_setting`, `closing_planifie`, `no_show_closing`, `clos`, `dead`) et 6 sources (`facebook_ads`, `instagram_ads`, `follow_ads`, `formulaire`, `manuel`, `funnel`) de ClosRM sont actuellement figés : **labels, couleurs, ordre et visibilité** sont codés en dur dans `src/components/leads/StatusBadge.tsx` (`STATUS_CONFIG`) et `src/components/leads/SourceBadge.tsx` (`SOURCE_CONFIG`). Chaque coach doit utiliser le même vocabulaire ClosRM, ce qui ne correspond pas à son flux réel.

**Cas d'usage réel** : Rémy parle de "RDV Bilan Pris" et pas de "Setting planifié", n'utilise pas `no_show_closing` et préfère ses propres couleurs. Actuellement, il doit adapter son vocabulaire à l'app au lieu de l'inverse.

Il existe déjà un système partiel de customisation du Kanban via `KanbanColumnsConfigModal` (drag & drop de colonnes + masquage) — mais stocké en **localStorage** (par navigateur), limité au Kanban, et sans rename/recolor.

## Objectif

Permettre à chaque workspace de personnaliser les 14 entités (8 statuts + 6 sources) sur 4 dimensions :
- **Renommer** le label
- **Recolorer** (couleur d'accent + background du badge)
- **Réordonner** l'ordre d'affichage
- **Masquer/afficher** (visibilité)

Les enums DB restent inchangés (CHECK constraints conservés). Seule l'apparence est customisée. Les modules métier (Kanban pipeline, Closing, stats, automations) continuent à fonctionner sur les mêmes clés d'enum.

**Non-objectifs** (hors scope) :
- Ajouter ou supprimer des statuts/sources (= N3, plus lourd)
- Icônes personnalisables (option B du brainstorming, écartée)
- Configuration par utilisateur (toujours workspace-level, acceptable en V1 coach solo)
- Historique des changements / audit log

## Décisions d'architecture

### D1 — Stockage : deux colonnes JSONB sur `workspaces`

```sql
ALTER TABLE workspaces
  ADD COLUMN status_config jsonb,
  ADD COLUMN source_config jsonb;
```

**Structure** (identique pour les deux) :

```typescript
type StatusConfigEntry = {
  key: LeadStatus      // discriminateur, clé d'enum DB inchangée
  label: string        // libellé affiché (personnalisable)
  color: string        // hex '#RRGGBB' pour le texte/accent
  bg: string           // rgba 'rgba(R,G,B,A)' pour le fond du badge
  visible: boolean     // masqué si false
}
type StatusConfig = StatusConfigEntry[]  // ordre = position dans l'array
```

L'ordre est **implicite** (position dans le tableau), pas un champ `order` séparé.

**Défauts** : `status_config IS NULL` → l'app utilise les valeurs hardcodées de `STATUS_CONFIG` / `SOURCE_CONFIG`. Première édition → on copie les defaults en DB puis on applique la modification.

### D2 — Single source of truth + deux points d'entrée UI

Un seul stockage DB, deux endroits d'édition dans l'app :

1. **Paramètres > Réglages** (éditeur complet) : reorder + visibilité + rename + recolor + reset.
2. **Bouton "Configurer les colonnes" dans le Kanban** (quick edit) : reorder + visibilité seulement. Un lien "Personnaliser les libellés" redirige vers Paramètres pour rename/recolor.

Les deux UI écrivent dans les mêmes colonnes DB. Tout changement est **immédiatement global** (Kanban + filtres + stats + import wizard + badges + dropdowns).

### D3 — Diffusion runtime : React Context

Un `WorkspaceConfigProvider` au niveau du layout `/app/(dashboard)/layout.tsx` :
- Au mount, fetch `workspaces.status_config` + `source_config` via une route API.
- Merge avec les defaults si `null` en DB.
- Expose via `useStatusConfig()` et `useSourceConfig()` hooks.
- Les mutations (depuis Paramètres ou Kanban modal) passent par `PATCH /api/workspace/config` puis invalident/mettent à jour le context.

**API route** : `src/app/api/workspace/config/route.ts` avec `GET` et `PATCH`, RLS standard (owner + members du workspace).

### D4 — Migration du système Kanban localStorage existant

Au premier mount de `WorkspaceConfigProvider` :
- Si `workspaces.status_config IS NULL` et `localStorage['closrm.leads.kanban.columns']` existe → on parse, on construit un `StatusConfig` en combinant les defaults hardcodés + les overrides `visible`/`order` du localStorage, on PATCH la DB, on supprime le localStorage.
- Sinon, comportement normal (DB ou defaults).

Cette migration s'exécute une seule fois par workspace + navigateur. Après ça, le système bascule entièrement en DB.

### D5 — Refactor des consommateurs

Tous les fichiers qui importent `STATUS_CONFIG` ou `SOURCE_CONFIG` directement doivent basculer vers les hooks.

**Fichiers impactés (statuts) — 12 fichiers** :
- `src/components/leads/StatusBadge.tsx` — le `STATUS_CONFIG` hardcodé devient le DEFAULT, le composant lui-même lit via hook
- `src/components/shared/LeadSidePanel.tsx`
- `src/components/messages/ContactPanel.tsx`
- `src/components/leads/LeadDetail.tsx`
- `src/app/(dashboard)/parametres/equipe/equipe-client.tsx`
- `src/app/(dashboard)/leads/views/LeadsListView.tsx`
- `src/app/(dashboard)/leads/views/KanbanColumnsConfigModal.tsx`
- `src/app/(dashboard)/leads/views/KanbanColumn.tsx`
- `src/components/automations/WorkflowStatusBadge.tsx`
- `src/components/agenda/BookingDetailPanel.tsx`
- `src/components/follow-ups/FollowUpStatusBadge.tsx`
- (éventuels autres détectés pendant l'implémentation)

**Fichiers impactés (sources)** :
- `src/components/leads/SourceBadge.tsx` — même transformation
- Tous les consommateurs de `SourceBadge` (via le hook indirectement)

**Import wizard (T-034/T-035)** :
- `src/components/leads/import/StatusValueMapper.tsx` — remplacer `STATUS_LABELS`/`STATUS_ORDER` internes par hook
- `src/components/leads/import/SourceValueMapper.tsx` — idem
- `src/components/leads/import/Step2_MappingConfig.tsx` — `STATUS_OPTIONS`/`SOURCE_OPTIONS` doivent filtrer par `visible` et respecter l'ordre du workspace

**Dropdowns de sélection** :
- `src/components/leads/LeadForm.tsx` — l'éditeur lead respecte `visible` + ordre

## Design UX

### Paramètres > Réglages — Section "Statuts du pipeline"

Liste draggable de 8 rows, pattern proche de `KanbanColumnsConfigModal` (déjà implémenté avec `@dnd-kit`) :

```
┌ Statuts du pipeline ──────────────────────────────────┐
│ [=] ☑ [●] [Nouveau            ]  [Éditer] [Réinit.]   │
│ [=] ☑ [●] [Scripté            ]  [Éditer] [Réinit.]   │
│ [=] ☑ [●] [RDV Bilan Pris     ]  [Éditer] [Réinit.]   │
│ [=] ☐ [●] [No-show Setting    ]  [Éditer] [Réinit.]   │
│ ...                                                   │
└───────────────────────────────────────────────────────┘
            [ Réinitialiser tous les statuts ]
```

- **`[=]`** grip → drag & drop (vertical) pour reorder
- **`☑/☐`** → toggle `visible`
- **`[●]`** pastille de couleur — clic ouvre un popover color picker (natif `<input type="color">` suffit en V1, évite la dépendance `react-colorful`)
- **Input label** → édition inline, debounced autosave on blur/enter
- **[Éditer]** → passe la row en mode édition complet (label + couleur + bg en un clic)
- **[Réinit.]** → reset une entrée vers les defaults hardcodés

Même bloc en dessous pour **"Sources des leads"** (6 rows).

### Kanban — Modal simplifié

`KanbanColumnsConfigModal` existe déjà. On le simplifie :
- Supprime l'affichage interne des labels/couleurs hardcodés (le composant `StatusBadge` les fournit via le hook)
- Garde drag & drop + checkbox `visible`
- Ajoute en bas un lien : `🎨 Personnaliser les libellés et couleurs → [Paramètres]`
- L'état local du modal (order, visible) est initialisé depuis le context, le `onSave` PATCH vers la DB via l'API

### Sauvegarde & feedback

- Autosave au blur d'un input / au drop / au toggle (pas de bouton "Sauvegarder" global dans Paramètres)
- Toast succès bref en bas à droite (`"Configuration mise à jour"`)
- En cas d'erreur réseau : toast erreur + rollback local de la modification (optimistic update)

## Flux de données

```
User edits in Paramètres or Kanban modal
  → WorkspaceConfigContext mutate (optimistic)
  → PATCH /api/workspace/config { status_config | source_config }
  → DB updated
  → Tous les consumers via hooks re-render avec les nouvelles valeurs
    (badges, Kanban columns, filters, stats, import wizard dropdowns)
```

## Tests

### Unit tests (scripts Node one-off, pattern T-034/T-035)

- Merge defaults + overrides : entrées absentes prennent les defaults, entrées présentes prennent les overrides
- Parsing des valeurs CSS (hex pour color, rgba pour bg) : format validé côté API
- Migration localStorage → DB : round-trip correct, le localStorage est bien supprimé après

### Test manuel end-to-end

1. **Paramètres > Réglages** : renommer "setting_planifie" → "RDV Bilan Pris", changer couleur en violet, drag-and-drop pour reorder, masquer "no_show_closing"
2. Vérifier que **Kanban** reflète : colonne "RDV Bilan Pris" en violet, dans le nouveau ordre, sans colonne "No-show Closing"
3. Vérifier que **liste leads** affiche le badge personnalisé
4. Vérifier que **filtres statut** proposent le nouveau libellé et excluent "no_show_closing"
5. Vérifier que **stats funnel** utilise le bon libellé
6. Vérifier que **import wizard** (step 2) propose les labels custom dans le dropdown
7. Vérifier que le **bouton "Configurer les colonnes" du Kanban** ouvre le modal simplifié, que drag/toggle persiste en DB
8. Vérifier que le **lien "Personnaliser les libellés"** redirige vers Paramètres
9. **Reset** : cliquer "Réinitialiser tous les statuts" → retour aux defaults ClosRM
10. **Migration localStorage** : avec un workspace vierge (status_config NULL) + un localStorage de Kanban columns → l'ouverture d'une page dashboard importe le localStorage dans la DB, et le localStorage est vidé

## Risques / points d'attention

- **Migration DB** : `status_config` et `source_config` sont nullable par défaut (pas de valeur initiale obligatoire), donc les workspaces existants ne sont pas impactés. La colonne se remplit uniquement à la première édition.

- **Performance** : le context `WorkspaceConfig` re-render tous les consumers à chaque mutation. Acceptable en V1 (changements rares). Si ça devient un problème, on pourra splitter en deux contexts (status et source) ou mémoiser plus finement.

- **Cohérence clé/ordre** : si un statut existe dans l'enum mais pas dans `status_config` (ex: nouveau statut ajouté par une migration future), on doit le réinjecter avec les defaults et l'ajouter à la fin de l'ordre. Même logique inverse : une clé dans `status_config` qui n'existe plus dans l'enum → on la filtre.

- **Inputs de couleur** : `<input type="color">` retourne du hex 6 caractères. Pour générer le `bg` (rgba), on convertit côté client (hex → rgba avec alpha 0.12 par défaut). Logique centralisée dans un helper.

- **Labels vides / doublons** : on valide côté API que `label` est non vide. Les doublons sont autorisés (rien n'empêche deux statuts d'avoir le même label — rare en pratique).

- **`KanbanColumnsConfigModal` existant** : actuellement en localStorage. Il est **conservé** mais rewiring complet vers le context + API.

- **Refactor 12+ fichiers** : le refactor touche beaucoup d'endroits mais chaque modification est mécanique (remplacement d'un import par un hook). Le risque principal est d'oublier un fichier → lint/grep final pour vérifier qu'aucun `STATUS_CONFIG` / `SOURCE_CONFIG` direct n'est importé hors des fichiers canoniques.

## Estimation

**Total ~15h (~2 jours)** :

| Phase | Contenu | Durée |
|---|---|---|
| B.1 | Migration DB + types + defaults partagés | 1h |
| B.2 | API route (`GET`/`PATCH`) + Context + hooks | 3h |
| B.3 | Refactor consumers (statuts + sources, ~12-15 fichiers) vers hooks | 3h |
| B.4 | UI Paramètres > Réglages (form draggable, 2 sections) | 4h |
| B.5 | Migration Kanban localStorage → DB + rewiring `KanbanColumnsConfigModal` | 1h |
| B.6 | Adaptation import wizard (T-034/T-035) pour utiliser le hook | 1h |
| B.7 | Tests manuels end-to-end | 2h |
