# Content Trame & Planning Mensuel — Design

**Date** : 2026-05-04
**Auteur** : Pierre (via brainstorming Claude)
**Module** : Acquisition > Réseaux Sociaux

## Contexte & problème

ClosRM dispose déjà d'un scheduler de posts social (`SocialCalendarView` + `PostComposer` + table `social_posts`). Manque actuel :

1. **Pas de planification stratégique mensuelle** — impossible de pré-définir tous les contenus à filmer pour le mois suivant et de les suivre en production (idée → tourné → monté → prêt).
2. **Pas de système de "trame" récurrente** — le coach n'a pas d'outil pour formaliser son framework éditorial (ex : "chaque lundi je publie un post viral + 5 stories de types X/Y/Z").

Aujourd'hui ces deux besoins sont gérés via Google Sheets ou Notion (cf. screenshot référence : grilles hebdomadaires "stories quotidiennes" + "posts" avec types par cellule).

## Objectif

Construire un **système de production planning** intégré à ClosRM qui combine :
- Une **trame éditable** (2 grilles hebdo : stories × N slots/jour, posts × 1-2 slots/jour, chaque cellule = un *content pillar*)
- Une **génération mensuelle** de slots (= `social_posts` pré-créés en statut "idée")
- Une **vue board production** (kanban par statut production)
- Une **bascule automatique** vers le scheduler existant quand un slot est "prêt"

## Approche retenue

Single source of truth = `social_posts`. Un slot = une row, du brouillon "idée" jusqu'à la publication. Pas de table de drafts intermédiaire. Le scheduler existant devient une vue temporelle de la même base, le board = vue par statut production.

**Approches écartées** :
- "Tout calendrier" (sans board) : moins clair pour voir l'avancement de production
- "Extension légère" (sans trame ni génération) : ne résout pas le besoin de planifier le mois d'un coup

## Data model

### Réutilisé

- `social_posts` (table principale, étendue)
- `social_post_publications` (multi-plateforme, inchangé)
- `ig_content_pillars` (existant, **réutilisé tel quel** — voir section migration)

> **Décision révisée post-self-review** : on n'introduit PAS de nouvelle table `content_pillars`. On utilise directement `ig_content_pillars`. Renommage cosmétique différé pour éviter divergence de données entre 2 tables synchronisées. Audit des 2 consommateurs actuels confirmé (`api/instagram/pillars`, `api/instagram/reels`) — ils restent intacts, le Planning lit/écrit la même table.

### Nouvelles colonnes sur `social_posts`

| Colonne | Type | Description |
|---|---|---|
| `content_kind` | `TEXT` | `'post'` \| `'story'` \| `'reel'` (orthogonal au `media_type` technique) |
| `production_status` | `TEXT` | `'idea'` \| `'to_film'` \| `'filmed'` \| `'edited'` \| `'ready'` |
| `plan_date` | `DATE` | Date cible de publication (avant que `scheduled_at` soit fixé) |
| `slot_index` | `INT` | Rang dans la cellule de la trame (pour idempotence regénération) |
| `hook` | `TEXT` | Accroche / titre court |
| `script` | `TEXT` | Script complet |
| `references_urls` | `TEXT[]` | Liens rushs, refs visuelles, moodboard |
| `notes` | `TEXT` | Notes libres |

Le `status` existant (`draft`/`scheduled`/`published`...) reste intact = état **publication**. `production_status` = état **création**. Coexistence : un slot peut être `production_status='ready'` + `status='draft'` jusqu'au click "Programmer".

### Nouvelles tables

```sql
-- (content_pillars NON créée — on utilise ig_content_pillars existante)

content_trame (
  id UUID PK,
  workspace_id UUID UNIQUE NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stories_grid JSONB NOT NULL DEFAULT '{}',  -- { "mon": [pillar_id, pillar_id, null, ...], "tue": [...], ... }
  posts_grid JSONB NOT NULL DEFAULT '{}',     -- { "mon": [pillar_id, pillar_id?], ... }
  updated_at TIMESTAMPTZ DEFAULT now()
)
-- RLS : workspace_members standard

content_trame_generations (
  id UUID PK,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  year INT NOT NULL,
  month INT NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT now(),
  generated_by UUID REFERENCES auth.users(id),
  slots_created INT NOT NULL DEFAULT 0,
  UNIQUE (workspace_id, year, month)
)
-- RLS : workspace_members standard
```

### Index ajoutés

```sql
CREATE INDEX idx_social_posts_workspace_plan_date
  ON social_posts(workspace_id, plan_date)
  WHERE plan_date IS NOT NULL;

CREATE INDEX idx_social_posts_workspace_production
  ON social_posts(workspace_id, production_status)
  WHERE status = 'draft';

CREATE UNIQUE INDEX idx_social_posts_trame_slot_dedupe
  ON social_posts(workspace_id, plan_date, content_kind, slot_index, COALESCE(pillar_id::text, ''))
  WHERE plan_date IS NOT NULL AND slot_index IS NOT NULL;
-- Garantit l'idempotence du INSERT ... ON CONFLICT DO NOTHING lors de la regénération.
```

### Migration `063_content_trame_and_production.sql`

Plan :
1. Création `content_pillars` (nouvelle table à côté de `ig_content_pillars`, **non renommage**)
2. Copie initiale : `INSERT INTO content_pillars SELECT ... FROM ig_content_pillars`
3. `social_posts.pillar_id` re-FK vers `content_pillars(id)` (drop FK existante si présente vers `ig_content_pillars`)
4. Ajout colonnes sur `social_posts` (toutes nullable)
5. Création `content_trame`, `content_trame_generations`
6. Création des index
7. **Backfill des slots existants** :
   ```sql
   UPDATE social_posts
   SET content_kind = COALESCE(content_kind, 'post'),
       production_status = COALESCE(production_status,
         CASE WHEN status IN ('scheduled','published','publishing','partial') THEN 'ready'
              ELSE 'idea' END),
       plan_date = COALESCE(plan_date, scheduled_at::date)
   WHERE content_kind IS NULL OR production_status IS NULL;
   ```
8. RLS sur les 3 nouvelles tables (pattern `workspace_members`)
9. CHECK constraints sur `content_kind` et `production_status`

**`ig_content_pillars` reste en place** — sera décommissionnée dans une migration future quand plus aucun consommateur. À auditer dans le plan d'implémentation : où la table est lue/écrite (notamment `ig_reels.pillar_id`, composants instagram).

## Vues UI

Toutes intégrées dans `Acquisition > Réseaux Sociaux`. Nouveau sous-tab **Planning** à côté des tabs Instagram/YouTube actuels.

### Toggle de vue
Dans le header du Planning : `[Calendrier] [Board]` + icône `⚙️ Trame` (accès settings) + bouton primaire `Générer le mois prochain` (ou son état contextuel — voir workflow).

### 1. Écran Trame (settings)

Accès : icône `⚙️ Trame` dans le header Planning.

```
┌─────────────────────────────────────────────────────────┐
│  Ma trame de contenu                          [Sauver] │
├─────────────────────────────────────────────────────────┤
│  Bibliothèque de pillars                                │
│  [● Viral] [● Lead Magnet] [● Avant/Après] [+ Ajouter] │
├─────────────────────────────────────────────────────────┤
│  📱 Stories quotidiennes                                │
│         S1      S2       S3        S4       S5     [+] │
│  Lun  [Viral][Lead Mag][Av/Ap]  [Bénéf]  [CTA]         │
│  Mar  [Viral][Value]   [Preuve][Entrain][Sondage]      │
│  ...                                                     │
├─────────────────────────────────────────────────────────┤
│  📰 Posts quotidiens                                    │
│         P1            P2          [+]                   │
│  Lun  [Viral]        [—]                                │
│  Mar  [Viral]        [Av/Ap]                            │
│  ...                                                     │
└─────────────────────────────────────────────────────────┘
```

- Drag pillars de la bibliothèque dans les cellules, ou click → dropdown
- N slots stories/jour (par défaut 5, configurable via `[+]` dans l'en-tête colonnes)
- 0-2 posts/jour
- CRUD pillars : nom + couleur
- **Si IG non connecté** : grille `Stories` grisée avec tooltip "Connecte Instagram pour activer les stories quotidiennes" (la grille reste éditable, les données sont conservées)

### 2. Vue Calendrier mensuel (existant enrichi)

`SocialCalendarView` étendu. Chaque cellule jour affiche :
```
┌──────────┐
│ Lun 12   │
│ ━━━━━━   │
│ 📰 1/2   │
│ 📱 4/5   │
│          │
│ ●●●○●    │  ← pastilles colorées par pillar, opacité = production_status
└──────────┘
```

- Click cellule → ouvre **Slot detail panel** (side drawer)
- Pastille opaque = `ready` ou status >= scheduled, semi-transparente = production en cours
- Filtres en haut : par pillar, par statut, par content_kind
- Pas de filtre temporel (tout l'historique navigable via les flèches mois)

### 3. Vue Board production (nouveau)

```
┌──Idée──┐ ┌──À filmer──┐ ┌──Filmé──┐ ┌──Monté──┐ ┌──Prêt──┐
│ Card 1 │ │ Card 3     │ │ Card 5  │ │ Card 7  │ │ Card 9 │
│ Card 2 │ │ Card 4     │ │ Card 6  │ │ Card 8  │ │        │
└────────┘ └────────────┘ └─────────┘ └─────────┘ └────────┘
```

Card = slot. Affiche : pillar (chip color), `plan_date`, `hook` ou `title`, icône `content_kind`.

**Filtre par défaut du board** :
```
WHERE status IN ('draft', 'scheduled')
  AND (plan_date >= today - 7d OR plan_date IS NULL)
```
- Slot publié → sort du board (visible dans le calendrier)
- Slot dont `plan_date` est passée de >7j sans avoir été `ready` → sort du board (évite la pile de fantômes)
- Toggle "Afficher tout l'historique" pour override

Drag entre colonnes = update `production_status`. Sélection multi-cards (checkboxes) + bouton "Supprimer la sélection" (utile pour les jours OFF/vacances en V1).

### 4. Slot detail panel (side drawer)

Sections empilées éditables inline :

1. **Header** : pillar (chip color cliquable), content_kind, `plan_date` editable (date picker), `production_status` (chip cliquable → dropdown)
2. **Hook** (1 ligne)
3. **Title** (1 ligne)
4. **Script** (textarea)
5. **References** : liste de liens (rushs, moodboard) + bouton ajouter
6. **Media** : zone d'upload (vidéo/image) — utilise `media_urls` existant
7. **Caption + hashtags** : réutilise UI du `PostComposer` actuel
8. **Notes**
9. **Footer** : bouton **Programmer** :
   - Visible uniquement si `production_status='ready'` ET `media_urls` non vide
   - Click → modale légère : confirme `plan_date` + demande heure (HH:MM, défaut 18:00) + (pour `content_kind='post'`) picker plateformes
   - Set `scheduled_at = (plan_date + heure) AT TIME ZONE workspace_tz`, set `status='scheduled'`
   - Crée/upsert `social_post_publications` pour chaque plateforme cochée
   - À partir de là, le système de publication existant prend le relais
   - Bouton **Dé-programmer** si `status='scheduled'` → reset `status='draft'`, garde `production_status='ready'`

## Workflow

### Génération mensuelle

**Déclenchement** : bouton "Générer le mois prochain" dans le header du Planning.

**État du bouton** :
- Mois jamais généré → primaire actif "Générer juin"
- Mois déjà généré → désactivé "Juin déjà généré" + sous-bouton secondaire "Régénérer les slots manquants" (avec confirmation : "Cela recrée les slots manquants — les slots existants ne sont pas touchés")

**Logique** (`POST /api/social/trame/generate { year, month }`) :
1. Vérifier la trame du workspace (404 si vide)
2. Pour chaque jour du mois cible :
   - Pour chaque cellule non-null de `stories_grid[weekday]` (avec son `slot_index`) → INSERT `social_posts` avec `content_kind='story'`, `pillar_id=cell`, `slot_index`, `plan_date=date`, `production_status='idea'`, `status='draft'`
   - Idem pour `posts_grid[weekday]` avec `content_kind='post'`
3. Idempotence : `INSERT … ON CONFLICT (workspace_id, plan_date, content_kind, slot_index, pillar_id) DO NOTHING`
4. UPSERT `content_trame_generations(workspace_id, year, month)` avec count
5. Toast : "X stories + Y posts créés pour [Mois]"

**Implémentation** : insert via SQL (`INSERT ... SELECT FROM generate_series`) plutôt qu'une boucle JS pour perf (200+ rows attendus).

### Statuts production

```
idea → to_film → filmed → edited → ready
```

- Drag entre colonnes du board OU dropdown dans le slot detail
- Pas de blocage formel entre transitions (sauter `idea` → `ready` est permis)
- **Contrainte `ready`** : pour passer à `ready`, le slot doit avoir au minimum un media uploadé. Sinon toast d'erreur. Sécurise la bascule scheduler.

### Suppression d'un pillar

API `DELETE /api/social/pillars/:id` :
1. Compter usages : `social_posts WHERE pillar_id = ?` + parser `content_trame.{stories_grid,posts_grid}` pour les références
2. Si usage > 0 → HTTP 409 avec `{ usage_count, in_trame_count }`. UI propose 2 choix :
   - **Remplacer par autre pillar** (dropdown des pillars du workspace) → UPDATE social_posts + remplacement dans le JSONB
   - **Détacher** (slots restent, cellules trame vidées) → SET pillar_id NULL + cellules JSONB → null
3. Si usage = 0 → DELETE direct

Pas de cascade silencieuse. Toujours décision explicite.

## API endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/social/trame` | Lit la trame du workspace (404 si pas créée) |
| PUT | `/api/social/trame` | Sauvegarde la trame (UPSERT) |
| POST | `/api/social/trame/generate` | Body `{ year, month }` → crée les slots, retourne `{ slots_created }` |
| GET | `/api/social/pillars` | Liste pillars |
| POST | `/api/social/pillars` | Crée pillar |
| PATCH | `/api/social/pillars/:id` | Update nom/couleur |
| DELETE | `/api/social/pillars/:id` | Supprime (ou 409 si usages, voir ci-dessus) |

Slots eux-mêmes utilisent `/api/social/posts` existant (étendu pour les nouvelles colonnes).

## Hors-scope V1 (V2 explicites)

- **IA générative** : bouton "suggérer hook/script" spécialisé dans le domaine du coach avec base de connaissances perso
- **Volumes mensuels** : checklist "X reels viraux ce mois" en plus de la grille hebdo
- **Auto-cron** de génération du mois suivant (V1 = manuel)
- **`excluded_dates`** dans la trame (vacances/jours OFF) — workaround V1 = suppression multi-sélection sur le board
- **Stories sur TikTok/YouTube** quand l'API le supportera
- **Décommissionnement de `ig_content_pillars`** : migration séparée après audit complet

## Risques & points à valider en plan d'implémentation

1. **Workspace timezone** : vérifier que `workspaces.timezone` existe. Sinon V1 = `Europe/Paris` en dur.
2. **API publication Stories IG** : vérifier que l'infra `social_post_publications` existante gère les stories IG (différentes de Feed). Sinon = note explicite à brancher.
3. **Lib drag & drop** : à choisir (probablement `@dnd-kit` si déjà utilisé, sinon natif HTML5). Audit à faire.
4. **Onboarding trame vide** : premier accès → écran "Crée ta trame" + template par défaut suggéré (5 stories/j, 1 post/j avec pillars génériques pré-créés). UX critique.
5. **Audit consommateurs `ig_content_pillars`** : avant la migration, lister tous les fichiers qui lisent/écrivent cette table pour évaluer l'impact de la double-existence.
6. **Types TS stricts** : variantes par `content_kind` + helpers (`canSchedule(slot)`, `isProductionPhase(slot)`) pour éviter logique éparpillée vu la richesse de `social_posts`.

## Critères d'acceptation V1

- [ ] Coach peut éditer sa trame (2 grilles + pillars CRUD)
- [ ] Bouton "Générer le mois prochain" crée tous les slots vides en `idea`
- [ ] Regénération idempotente (ne duplique pas)
- [ ] Vue Board montre les slots par `production_status`, drag fonctionnel
- [ ] Vue Calendrier montre tous les slots avec compteurs et pastilles
- [ ] Slot detail panel permet d'enrichir hook/script/refs/media/caption
- [ ] Bouton "Programmer" bascule slot ready+media → scheduler avec `scheduled_at`
- [ ] Suppression pillar avec usages → flow remplacement/détachement
- [ ] Stories grisées si IG pas connecté
- [ ] Backfill propre des slots existants (defaults sains)
