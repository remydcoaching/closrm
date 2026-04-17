# Leads — Vue Kanban + Date range picker

**Date:** 2026-04-17
**Auteur:** Pierre + Claude
**Statut:** spec validée, prête pour plan d'implémentation

---

## 1. Objectif

Ajouter deux fonctionnalités à la page `/leads` :

1. Une **seconde vue kanban** (style GoHighLevel) en complément de la vue liste actuelle, avec drag & drop pour changer le statut d'un lead.
2. Un **sélecteur de plage de dates** (Aujourd'hui / Hier / 7J / 30J / Personnalisé / Tout) partagé par les deux vues, avec choix du champ de date (création / mise à jour / clôture).

Contraintes : rester performant à 100k+ leads, architecture multi-tenant respectée (RLS Supabase par `workspace_id`).

## 2. Audit initial

- `src/app/(dashboard)/leads/leads-client.tsx` fait 680 lignes — doit être éclaté avant ajout.
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `date-fns` : déjà dans `package.json`.
- `react-day-picker` : à ajouter (~12 kb gzipped).
- `leadFiltersSchema` (`src/lib/validations/leads.ts`) n'a pas de filtre de date — à étendre.
- `STATUS_CONFIG` défini dans `src/components/leads/StatusBadge.tsx` : source de vérité pour labels + couleurs.
- RLS Supabase : toutes les requêtes passent déjà par `createClient()` côté serveur, les filtres `workspace_id` sont appliqués — pas de changement de modèle de sécurité.

## 3. Architecture des composants

Découpage du fichier monolithique actuel :

```
src/app/(dashboard)/leads/
  leads-client.tsx              # Orchestrateur : filtres, toggle vue, modales partagées
  views/
    LeadsListView.tsx           # Extraction 1:1 du <table> actuel
    LeadsKanbanView.tsx         # Nouvelle vue kanban (DndContext)
    KanbanColumn.tsx            # 1 colonne = 1 statut (SortableContext)
    KanbanCard.tsx              # Carte lead draggable
    KanbanColumnsConfigModal.tsx # Modale "⚙ Colonnes" : visibilité + ordre
src/components/leads/
  DateRangePicker.tsx           # Presets + popover react-day-picker + dropdown champ
  ViewToggle.tsx                # Deux icônes (List / LayoutGrid de lucide)
```

L'orchestrateur (`leads-client.tsx`) conserve :
- L'état global des filtres (search, statuses, sources, assigned_to, **date_from, date_to, date_field**)
- Le toggle vue (`'list' | 'kanban'`)
- Les modales partagées : `LeadForm`, `CallScheduleModal`, `ConfirmModal`, `ClosingModal`, `LeadSidePanel`
- Les handlers communs : `patchLead`, `onLeadCreated`, ouverture du side panel

Chaque vue reçoit en props les filtres + des callbacks (`onLeadClick`, `onStatusChange`, `onArchive`, etc.) — pas de fetch dans les vues elles-mêmes, elles consomment des données fournies par l'orchestrateur.

## 4. Vue Liste

Extraction pure : on déplace le JSX du `<table>` et sa pagination dans `LeadsListView.tsx`. Aucun changement fonctionnel à part la prise en compte des nouveaux filtres de date.

## 5. Vue Kanban

### 5.1 Colonnes

- 8 colonnes possibles (ordre pipeline par défaut) : `nouveau`, `scripte`, `setting_planifie`, `no_show_setting`, `closing_planifie`, `no_show_closing`, `clos`, `dead`.
- **Configurables** par l'utilisateur via une modale accessible par un bouton `⚙ Colonnes` en haut à droite de la vue kanban :
  - Case à cocher par statut (visibilité)
  - Drag handle pour réordonner
- Persistance : `localStorage`, clé `closrm.leads.kanban.columns`, forme :
  ```ts
  { visible: LeadStatus[], order: LeadStatus[] }
  ```
- Défaut (si pas de pref stockée) : les 8 colonnes dans l'ordre du pipeline.

### 5.2 En-tête de colonne

- Pastille de couleur (depuis `STATUS_CONFIG`) + label du statut
- Compteur `N opportunité(s)` (total **avant pagination**)
- Optionnel V2 : somme des `deal_amount` pour la colonne "Closé" (hors scope V1)

### 5.3 Carte lead (`KanbanCard`)

Contenu compact, pas d'actions inline :
- Ligne 1 : prénom + nom (bold)
- Ligne 2 : `SourceBadge` + téléphone ou email tronqué
- Ligne 3 : icône 📞 + nb tentatives, icône 🏷 + premier tag (+N), avatar assigné si défini

Interactions :
- **Clic** → ouvre `LeadSidePanel` (comportement identique à la vue liste)
- **Drag** → déplacer entre colonnes pour changer le statut

### 5.4 Drag & drop

Lib : `@dnd-kit/core` + `@dnd-kit/sortable` (déjà installées).

- `DndContext` au niveau `LeadsKanbanView`
- Chaque colonne = `droppable` ; chaque carte = `sortable` (permet réordonnancement visuel dans une colonne, même si le backend ne persiste pas d'ordre — on laisse le tri `created_at DESC`)
- Sensors : `PointerSensor` avec `activationConstraint: { distance: 6 }` → évite de bloquer le clic simple (seuil de déplacement avant de considérer un drag)
- **On drop sur une colonne différente :**
  1. Update optimiste local (retirer de la colonne source, insérer en tête de la colonne cible)
  2. **Cas spécial** : si cible = `clos` → ouvre `ClosingModal` (collecte `deal_amount`, `deal_installments`, `cash_collected`). Si l'utilisateur annule, rollback. Si confirme, `PATCH` avec les champs closing.
  3. Sinon : `PATCH /api/leads/:id { status }`
  4. Sur erreur réseau → rollback + toast d'erreur

### 5.5 Pagination par colonne

- Chargement initial : 25 leads par colonne visible, triés `created_at DESC`
- Compteur total affiché dans l'en-tête (non limité par la pagination)
- Si `total > leads.length`, bouton `Voir plus (+N)` en bas de la colonne → charge les 25 suivants
- Implémentation : state local `{ [status]: { leads: Lead[], total: number, loadedCount: number } }` ; le bouton fait un appel paginé sur l'endpoint liste classique avec `status=X&page=2&per_page=25`.

## 6. Date range picker (`DateRangePicker`)

### 6.1 Presets

- Aujourd'hui
- Hier
- 7 derniers jours (incluant aujourd'hui)
- 30 derniers jours (incluant aujourd'hui)
- Personnalisé → ouvre un calendrier range (`react-day-picker` mode `range`)
- Tout (reset : `date_from = undefined`, `date_to = undefined`)

### 6.2 Champ de date (dropdown à côté)

- Création (`created_at`) — défaut
- Mise à jour (`updated_at`)
- Clôture (`closed_at`)

Les options "Mise à jour" et "Clôture" sont toujours affichées ; pour "Clôture" avec des leads non closés, le résultat sera vide — comportement attendu.

### 6.3 Persistance

- `localStorage`, clé `closrm.leads.dateFilter`, forme :
  ```ts
  { preset: 'today' | 'yesterday' | '7d' | '30d' | 'custom' | 'all',
    from?: string, // ISO
    to?: string,   // ISO
    field: 'created_at' | 'updated_at' | 'closed_at' }
  ```
- Hydraté au mount de `leads-client.tsx` (avant le premier fetch pour éviter un double fetch).

### 6.4 UI

- Bouton compact affichant le preset actif (ex. `📅 7 derniers jours · Création ▾`)
- Clic → popover avec :
  - Liste verticale des presets
  - Dropdown champ en bas
  - Calendrier range (affiché uniquement si preset = Personnalisé)

### 6.5 Fuseau horaire

Les bornes `date_from`/`date_to` sont calculées dans le fuseau du navigateur, converties en ISO UTC avant envoi à l'API. "Aujourd'hui" = `[startOfDay(now), endOfDay(now)]` local → ISO.

## 7. API

### 7.1 Extension de `leadFiltersSchema`

Dans `src/lib/validations/leads.ts` :
```ts
date_from:  z.string().datetime().optional(),
date_to:    z.string().datetime().optional(),
date_field: z.enum(['created_at', 'updated_at', 'closed_at']).default('created_at'),
```

### 7.2 `/api/leads` (vue liste + pagination colonne kanban)

Dans `src/app/api/leads/route.ts`, après les filtres existants :
```ts
if (filters.date_from) query = query.gte(filters.date_field, filters.date_from)
if (filters.date_to)   query = query.lte(filters.date_field, filters.date_to)
```

### 7.3 Nouvel endpoint `/api/leads/grouped` (chargement initial kanban)

`GET /api/leads/grouped?limit_per_status=25&...filters communs`

Retourne :
```ts
{
  columns: {
    [status: LeadStatus]: {
      leads: Lead[],    // top N triés created_at DESC
      total: number,    // count complet pour cette colonne (après filtres)
    }
  }
}
```

Implémentation : appel RPC Supabase `supabase.rpc('leads_grouped_by_status', {...})`. L'endpoint Next se contente de :
1. Récupérer `workspace_id` via `getWorkspaceId()`
2. Transmettre les paramètres à la RPC (la RPC applique elle-même le filtrage par `workspace_id` + règles de rôle)
3. Retourner la réponse

### 7.4 Fonction RPC Supabase

Fichier de migration : `supabase/migrations/<timestamp>_leads_grouped_by_status.sql`

```sql
CREATE OR REPLACE FUNCTION leads_grouped_by_status(
  p_workspace_id uuid,
  p_limit        int    DEFAULT 25,
  p_date_from    timestamptz DEFAULT NULL,
  p_date_to      timestamptz DEFAULT NULL,
  p_date_field   text   DEFAULT 'created_at',     -- created_at | updated_at | closed_at
  p_statuses     text[] DEFAULT NULL,
  p_sources      text[] DEFAULT NULL,
  p_assigned_to  uuid   DEFAULT NULL,
  p_search       text   DEFAULT NULL,
  p_role         text   DEFAULT NULL,             -- pour reproduire la logique rôle
  p_user_id      uuid   DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER  -- respecte RLS
AS $$
DECLARE
  result jsonb;
BEGIN
  WITH filtered AS (
    SELECT l.*,
           ROW_NUMBER() OVER (PARTITION BY l.status ORDER BY l.created_at DESC) AS rn,
           COUNT(*)     OVER (PARTITION BY l.status)                            AS status_total
    FROM leads l
    WHERE l.workspace_id = p_workspace_id
      AND (p_statuses IS NULL OR l.status = ANY(p_statuses))
      AND (p_sources  IS NULL OR l.source = ANY(p_sources))
      AND (p_assigned_to IS NULL OR l.assigned_to = p_assigned_to)
      AND (
        p_date_from IS NULL OR
        (p_date_field = 'created_at' AND l.created_at >= p_date_from) OR
        (p_date_field = 'updated_at' AND l.updated_at >= p_date_from) OR
        (p_date_field = 'closed_at'  AND l.closed_at  >= p_date_from)
      )
      AND (
        p_date_to IS NULL OR
        (p_date_field = 'created_at' AND l.created_at <= p_date_to) OR
        (p_date_field = 'updated_at' AND l.updated_at <= p_date_to) OR
        (p_date_field = 'closed_at'  AND l.closed_at  <= p_date_to)
      )
      AND (
        p_search IS NULL OR
        l.first_name ILIKE '%' || p_search || '%' OR
        l.last_name  ILIKE '%' || p_search || '%' OR
        l.email      ILIKE '%' || p_search || '%' OR
        l.phone      ILIKE '%' || p_search || '%'
      )
      -- Filtrage par rôle (équivalent à la logique dans /api/leads)
      AND (
        p_role IS NULL OR p_role = 'admin' OR
        (p_role = 'setter' AND (l.assigned_to = p_user_id OR l.assigned_to IS NULL)) OR
        (p_role = 'closer' AND l.assigned_to = p_user_id
         AND l.status IN ('closing_planifie','no_show_closing','clos'))
      )
  )
  SELECT jsonb_object_agg(
    status,
    jsonb_build_object(
      'total', MAX(status_total),
      'leads', jsonb_agg(to_jsonb(filtered) - 'rn' - 'status_total' ORDER BY created_at DESC)
                 FILTER (WHERE rn <= p_limit)
    )
  )
  INTO result
  FROM filtered
  GROUP BY status;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;
```

Index à ajouter (si pas déjà présent) :
```sql
CREATE INDEX IF NOT EXISTS idx_leads_workspace_status_created
  ON leads (workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_workspace_updated
  ON leads (workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_workspace_closed
  ON leads (workspace_id, closed_at DESC) WHERE closed_at IS NOT NULL;
```

Pourquoi `SECURITY INVOKER` : la RPC s'exécute avec les droits de l'appelant, donc RLS s'applique sur la table `leads`. Défense en profondeur : on passe quand même `p_workspace_id` pour que le plan d'exécution utilise l'index composite.

## 8. Toggle vue (`ViewToggle`)

- Deux icônes `List` (lucide) et `LayoutGrid` (lucide) dans un groupe arrondi
- État actif : background `var(--border-primary)`, icône `var(--text-primary)`
- Placé en haut à droite, à gauche du bouton "Ajouter un lead"
- Persistance : `localStorage`, clé `closrm.leads.view` (`'list' | 'kanban'`), défaut `'list'`

## 9. Modales partagées

Aucun changement structurel. Le side panel, le form d'ajout, les modales closing/planification/confirmation restent au niveau `leads-client.tsx` et sont utilisées par les deux vues.

## 10. Error handling

- Fetch grouped échoué → état d'erreur dans la vue kanban avec bouton "Réessayer"
- Drag & drop PATCH échoué → rollback optimiste + toast d'erreur
- Modale closing annulée après drop → rollback (la carte retourne dans sa colonne d'origine)
- Date range invalide (from > to) → validation côté picker, bouton "Appliquer" désactivé

## 11. Tests / vérification

Manuel (pas de tests auto dans le projet actuel) :
1. Toggle liste ↔ kanban conserve les filtres appliqués
2. Drag d'un lead entre colonnes → statut mis à jour en base (vérif Supabase)
3. Drop sur "Closé" ouvre `ClosingModal`, annulation fait un rollback
4. Clic simple sur une carte ouvre le side panel (pas déclenché par un drag < 6px)
5. Presets de date : `Aujourd'hui` renvoie les leads créés aujourd'hui (vérif en base)
6. Changement de champ de date (création → clôture) refetch et met à jour les deux vues
7. Config colonnes : masquer "Dead" puis refresh → colonne toujours masquée
8. Preset de date + refresh → preset conservé
9. `Voir plus` dans une colonne charge les 25 suivants sans re-fetcher les autres colonnes
10. Multi-tenant : connexion avec un autre workspace → aucun lead d'un autre workspace visible (vérif RLS)

## 12. Hors scope (V2)

- Réordonnancement manuel des cartes dans une colonne (nécessiterait une colonne `position` en base)
- Somme `deal_amount` agrégée par colonne dans l'en-tête
- Sauvegarde DB des préférences UI (colonnes, vue, date) — pour l'instant `localStorage` seulement
- Filtre de date basé sur la table `calls` (date de RDV planifié)
- Bulk actions (sélection multiple de cartes, déplacement en masse)

## 13. Ordre d'implémentation suggéré

1. Migration SQL + RPC + index (testable isolément en SQL)
2. Extension `leadFiltersSchema` + filtres de date dans `/api/leads`
3. Endpoint `/api/leads/grouped`
4. Composant `DateRangePicker` (+ `npm i react-day-picker`)
5. Extraction `LeadsListView` depuis `leads-client.tsx`
6. Composant `ViewToggle` + logique de bascule
7. `KanbanCard` + `KanbanColumn` (sans drag, lecture seule)
8. `LeadsKanbanView` avec drag & drop + rollback optimiste
9. `KanbanColumnsConfigModal` + persistance localStorage
10. Intégration complète + test bout-en-bout
