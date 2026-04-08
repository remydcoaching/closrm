# Design Spec : Module Reseaux Sociaux (Instagram) + Messages

> Date : 2026-04-01
> Auteur : Pierre
> Statut : Valide

---

## 1. Vue d'ensemble

Ajout de deux nouveaux modules dans la section ACQUISITION du dashboard ClosRM :

1. **Reseaux sociaux** — page unique avec tabs par plateforme (Instagram pour V1, TikTok/YouTube/LinkedIn a venir). Sous Instagram : General, Stories, Reels, Calendrier (Content Planner).
2. **Messages** — conversations DM Instagram (extensible a d'autres plateformes).

Les deux modules reutilisent l'integration Meta existante (table `integrations` type `meta`) pour l'authentification et les tokens d'acces.

---

## 2. Navigation

### Sidebar (ACQUISITION)

```
ACQUISITION
├── Funnels
├── Automations
├── Emails
├── Reseaux sociaux    ← NOUVEAU
├── Messages           ← NOUVEAU
├── Publicites
```

### Structure interne Reseaux sociaux

```
Reseaux sociaux (page)
├── [Tab plateforme] Instagram
│   ├── [Sous-tab] General
│   ├── [Sous-tab] Stories
│   ├── [Sous-tab] Reels
│   └── [Sous-tab] Calendrier
├── [Tab plateforme] TikTok (a venir)
├── [Tab plateforme] YouTube (a venir)
└── [Tab plateforme] LinkedIn (a venir)
```

### Routes Next.js

```
app/(dashboard)/acquisition/
├── reseaux-sociaux/
│   └── page.tsx
├── messages/
│   └── page.tsx
```

---

## 3. Base de donnees

### Nouvelles tables

Toutes avec `workspace_id UUID FK`, RLS active, politique `USING (workspace_id = (SELECT workspace_id FROM users WHERE id = auth.uid()))`.

#### ig_accounts

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID PK | |
| workspace_id | UUID FK | |
| ig_user_id | TEXT | ID Instagram de l'utilisateur |
| ig_username | TEXT | |
| access_token | TEXT | Token Meta API longue duree |
| token_expires_at | TIMESTAMPTZ | |
| page_id | TEXT | Facebook Page ID |
| page_access_token | TEXT | |
| is_connected | BOOLEAN DEFAULT true | |
| starting_followers | INTEGER | Point de depart croissance |
| starting_date | DATE | |
| starting_monthly_views | BIGINT | |
| starting_engagement | NUMERIC | |
| starting_best_reel | BIGINT | |
| created_at | TIMESTAMPTZ DEFAULT now() | |

#### ig_stories

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID PK | |
| workspace_id | UUID FK | |
| ig_story_id | TEXT UNIQUE | ID Instagram de la story |
| ig_media_url | TEXT | |
| thumbnail_url | TEXT | |
| caption | TEXT | |
| story_type | TEXT | 'video' ou 'image' |
| impressions | INTEGER | Nombre de vues |
| reach | INTEGER | |
| replies | INTEGER | Reponses DM |
| exits | INTEGER | Sorties |
| taps_forward | INTEGER | |
| taps_back | INTEGER | |
| published_at | TIMESTAMPTZ | |
| expires_at | TIMESTAMPTZ | published_at + 24h |

#### story_sequences

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID PK | |
| workspace_id | UUID FK | |
| name | TEXT | Nom de la sequence |
| sequence_type | TEXT | Cle parmi IG_SEQ_TYPES |
| objective | TEXT | Objectif libre |
| notes | TEXT | |
| status | TEXT DEFAULT 'draft' | |
| total_impressions | INTEGER | Agrege |
| overall_dropoff_rate | NUMERIC | % perte premiere → derniere |
| total_replies | INTEGER | |
| created_at | TIMESTAMPTZ DEFAULT now() | |
| published_at | TIMESTAMPTZ | |

#### story_sequence_items

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID PK | |
| sequence_id | UUID FK → story_sequences | |
| story_id | UUID FK → ig_stories | |
| position | INTEGER | Ordre (1, 2, 3...) |
| impressions | INTEGER | Cache local |
| replies | INTEGER | |
| exits | INTEGER | |

#### ig_reels

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID PK | |
| workspace_id | UUID FK | |
| ig_media_id | TEXT UNIQUE | ID Instagram du reel |
| caption | TEXT | |
| thumbnail_url | TEXT | |
| video_url | TEXT | |
| views | BIGINT | |
| likes | INTEGER | |
| comments | INTEGER | |
| shares | INTEGER | |
| saves | INTEGER | |
| reach | INTEGER | |
| plays | INTEGER | |
| engagement_rate | NUMERIC | (likes+comments+saves+shares)/reach*100 |
| format | TEXT | 'talking_head', 'text_overlay', 'raw_documentary' |
| pillar_id | UUID FK → ig_content_pillars | |
| published_at | TIMESTAMPTZ | |

#### ig_content_pillars

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID PK | |
| workspace_id | UUID FK | |
| name | TEXT | |
| color | TEXT | Hex color |
| created_at | TIMESTAMPTZ DEFAULT now() | |

#### ig_drafts

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID PK | |
| workspace_id | UUID FK | |
| ig_account_id | UUID FK → ig_accounts (nullable) | |
| caption | TEXT | Max 2200 chars |
| hashtags | TEXT[] | Tableau PostgreSQL |
| media_urls | TEXT[] | URLs medias uploades |
| media_type | TEXT CHECK ('IMAGE','VIDEO','CAROUSEL') | |
| status | TEXT CHECK ('draft','scheduled','publishing','published','failed') | |
| scheduled_at | TIMESTAMPTZ | Date/heure publication programmee |
| published_at | TIMESTAMPTZ | |
| ig_media_id | TEXT | ID Instagram apres publication |
| error_message | TEXT | |
| created_at | TIMESTAMPTZ DEFAULT now() | |
| updated_at | TIMESTAMPTZ DEFAULT now() | |

#### ig_hashtag_groups

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID PK | |
| workspace_id | UUID FK | |
| name | TEXT | |
| hashtags | TEXT[] | |
| created_at | TIMESTAMPTZ DEFAULT now() | |

#### ig_caption_templates

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID PK | |
| workspace_id | UUID FK | |
| title | TEXT | |
| body | TEXT | |
| category | TEXT DEFAULT 'general' | general, education, storytelling, offre, preuve_sociale, motivation, behind_the_scenes |
| hashtags | TEXT[] | |
| created_at | TIMESTAMPTZ DEFAULT now() | |

#### ig_snapshots

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID PK | |
| workspace_id | UUID FK | |
| snapshot_date | DATE | |
| followers | INTEGER | |
| total_views | BIGINT | |
| total_reach | BIGINT | |
| new_followers | INTEGER | |
| UNIQUE(workspace_id, snapshot_date) | | Max 10 par workspace |

#### ig_goals

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID PK | |
| workspace_id | UUID FK | |
| quarter | TEXT | Ex: '2026-Q1' |
| metric | TEXT | followers, monthly_views, engagement_rate, weekly_output, dms_month, viral_reels |
| target_value | NUMERIC | |
| UNIQUE(workspace_id, quarter, metric) | | |

#### ig_conversations

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID PK | |
| workspace_id | UUID FK | |
| ig_conversation_id | TEXT UNIQUE | ID conversation Instagram |
| participant_ig_id | TEXT | ID IG du participant |
| participant_username | TEXT | |
| participant_name | TEXT | |
| participant_avatar_url | TEXT | |
| lead_id | UUID FK → leads (nullable) | Lien vers lead si match |
| last_message_text | TEXT | Preview dernier message |
| last_message_at | TIMESTAMPTZ | |
| unread_count | INTEGER DEFAULT 0 | |
| created_at | TIMESTAMPTZ DEFAULT now() | |

#### ig_messages

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID PK | |
| workspace_id | UUID FK | |
| conversation_id | UUID FK → ig_conversations | |
| ig_message_id | TEXT UNIQUE | ID message Instagram |
| sender_type | TEXT CHECK ('user','participant') | user = le coach, participant = le contact |
| text | TEXT | |
| media_url | TEXT | Si message contient un media |
| media_type | TEXT | image, video, audio, sticker |
| sent_at | TIMESTAMPTZ | |
| is_read | BOOLEAN DEFAULT false | |

---

## 4. Types de sequences (constante)

```typescript
const IG_SEQ_TYPES = {
  confiance:      { label: 'Confiance',      color: '#3b82f6' },
  peur:           { label: 'Peur',           color: '#ef4444' },
  preuve_sociale: { label: 'Preuve sociale', color: '#22c55e' },
  urgence:        { label: 'Urgence',        color: '#f97316' },
  autorite:       { label: 'Autorite',       color: '#8b5cf6' },
  storytelling:   { label: 'Storytelling',   color: '#ec4899' },
  offre:          { label: 'Offre',          color: '#eab308' },
  education:      { label: 'Education',      color: '#06b6d4' },
} as const
```

---

## 5. API Routes

```
app/api/instagram/
├── account/route.ts              # GET compte IG, POST lier compte
├── sync/route.ts                 # POST sync complete (reels + stories + snapshot)
├── stories/route.ts              # GET stories sync
├── sequences/route.ts            # GET/POST sequences
├── sequences/[id]/route.ts       # PUT/DELETE sequence
├── sequences/[id]/items/route.ts # GET/PUT items d'une sequence
├── reels/route.ts                # GET reels sync
├── pillars/route.ts              # GET/POST/PUT/DELETE content pillars
├── drafts/route.ts               # GET/POST drafts
├── drafts/[id]/route.ts          # PUT/DELETE draft
├── drafts/[id]/publish/route.ts  # POST publication immediate
├── hashtag-groups/route.ts       # GET/POST/PUT/DELETE
├── caption-templates/route.ts    # GET/POST/PUT/DELETE
├── snapshots/route.ts            # GET snapshots historiques
├── goals/route.ts                # GET/POST/PUT goals trimestriels
├── conversations/route.ts        # GET conversations DM
├── messages/route.ts             # GET messages d'une conversation
├── messages/send/route.ts        # POST envoyer un DM
```

### Sync flow (POST /api/instagram/sync)

1. Recupere le token Meta depuis `integrations` (type 'meta') pour le workspace
2. **Reels** : `GET /v25.0/me/media` → filtre VIDEO/REELS → insights par reel → upsert `ig_reels`
3. **Stories** : `GET /v25.0/me/stories` → insights par story → upsert `ig_stories`
4. **Snapshot** : `GET /v25.0/me?fields=followers_count` + somme views → insert `ig_snapshots` (max 10)
5. **Conversations** : `GET /v25.0/me/conversations` → upsert `ig_conversations` + derniers messages

### Publication flow (POST /api/instagram/drafts/[id]/publish)

1. Recupere le draft + compte IG (token)
2. `POST /v25.0/{ig_user_id}/media` avec image_url/video_url + caption + hashtags
3. Si VIDEO : poll `/v25.0/{creation_id}?fields=status_code` toutes les 2s (max 30 tentatives)
4. `POST /v25.0/{ig_user_id}/media_publish` → publication effective
5. Met a jour le draft : `status='published'`, `published_at=now()`, `ig_media_id`
6. En cas d'erreur : `status='failed'`, `error_message`

### Envoi DM (POST /api/instagram/messages/send)

1. Recupere le token Meta
2. `POST /v25.0/me/messages` avec `recipient.id` + `message.text`
3. Insert dans `ig_messages` avec `sender_type='user'`
4. Met a jour `ig_conversations.last_message_text` et `last_message_at`

---

## 6. Composants UI

### Structure fichiers

```
src/components/social/
├── SocialPlatformTabs.tsx          # Tabs plateforme (Instagram, TikTok...)
├── instagram/
│   ├── IgSubTabs.tsx               # Sous-tabs (General, Stories, Reels, Calendrier)
│   ├── IgGeneralTab.tsx            # KPIs, growth chart, top reels, goals
│   ├── IgStoriesTab.tsx            # Navigation semaine, sequences, funnel
│   ├── IgSequenceDetail.tsx        # Vue detail sequence + funnel retention
│   ├── IgSequenceModal.tsx         # Modal creation/edition sequence
│   ├── IgStoriesSelector.tsx       # Modal selection stories pour sequence
│   ├── IgReelsTab.tsx              # Table reels, pillars, modal detail
│   ├── IgCalendarTab.tsx           # Sous-tabs calendrier (calendar, drafts, scheduled, hashtags, templates, besttime)
│   ├── IgCalendarView.tsx          # Vue calendrier mensuelle
│   ├── IgDraftModal.tsx            # Modal 2 colonnes creation/edition post
│   ├── IgDraftsList.tsx            # Liste brouillons ou programmes
│   ├── IgHashtagGroups.tsx         # CRUD groupes hashtags
│   ├── IgCaptionTemplates.tsx      # CRUD templates legendes
│   ├── IgBestTime.tsx              # Heatmap jour/heure engagement
│   └── constants.ts                # IG_SEQ_TYPES, categories, etc.

src/components/messages/
├── ConversationList.tsx            # Liste conversations avec preview
├── ConversationThread.tsx          # Fil de messages
└── MessageInput.tsx                # Input envoi message
```

### Pattern UI

- Inline styles avec CSS variables (`var(--bg-primary)`, `var(--text-primary)`, etc.)
- Icones : lucide-react
- Charts : recharts (deja installe)
- Modals : pattern existant du projet (overlay + fermeture clic outside)

---

## 7. Detail fonctionnel par sous-module

### 7.1 General (IgGeneralTab)

- **Selecteur de periode** : 7j, 30j, 90j, 6 mois, 1 an
- **KPI Row** : Followers, New followers, Views, Reach, Posts published
- **Growth Trend** : line chart (recharts) avec datasets Followers, Views, Reach depuis snapshots
- **Performance par format** : bar chart horizontal (avg views par format)
- **Evolution periode** : comparaison avant/apres
- **Goals trimestriels** : barres de progression par metrique + modal edition
- **Top Performing Reels** : tableau trie par views
- **Content Pillars Distribution** : doughnut chart

### 7.2 Stories (IgStoriesTab)

- **Navigation semaine** : `weekOffset` (0 = semaine courante), boutons ← →, label "3 mars — 9 mars 2026"
- **7 boutons jour** (Lun→Dim) avec point vert si sequences existent ce jour
- **Par sequence du jour selectionne** :
  - Nom + badge type (couleur IG_SEQ_TYPES)
  - Objectif si defini
  - Cartes stories grand format (200px, ratio 9:16) : thumbnail, label "Story N", metriques (Vues, Reach, DMs, Exits, Next, Back)
  - Fleches drop-off entre stories : rouge >30%, orange 15-30%, vert <15%
- **KPI cards** : nb stories, impressions totales, drop-off %, replies
- **Funnel retention** : barres horizontales proportionnelles aux impressions
- **Stories hors sequence** : miniatures 130px des stories du jour non assignees
- **Tableau "Toutes les sequences"** : colonnes Nom, Type, Stories, Impressions, Drop-off, Date

### 7.3 Reels (IgReelsTab)

- **KPI cards** : Total Views, Avg Engagement %, Total Reels, Avg Reach
- **Table complete** : thumbnail, caption, pillar (badge couleur), views, saves, shares, comments
- **Modal detail reel** : video player + stats detaillees
- **Content Pillars** : liste + CRUD (nom + couleur hex) + doughnut chart distribution

### 7.4 Calendrier (IgCalendarTab)

Sous-tabs internes : Calendrier, Brouillons, Programmes, Hashtags, Templates, Best Time

#### Calendrier (IgCalendarView)
- Navigation mois ← →
- Grille 7 colonnes (Lun→Dim)
- Events colores : publie (vert), programme (bleu), brouillon (gris), echoue (rouge)
- Max 3 events par jour, "+N autres" si plus
- Clic jour → ouvre modal creation
- Clic event → ouvre modal edition

#### Modal post (IgDraftModal)
- **2 colonnes** (950px) :
  - Gauche (320px) : preview media 9:16, zone drag & drop upload, input URL manuelle
  - Droite : caption textarea (compteur /2200), dropdown template, hashtags input (compteur /30), dropdown groupe, type toggle (IMAGE/VIDEO/CAROUSEL), date picker + time picker
- **3 boutons** : Brouillon (gris), Programmer (bleu), Publier maintenant (vert)
- **Overlay publication** : spinner pendant envoi, check vert succes, croix rouge erreur

#### Upload media
- Images 10MB max, videos 200MB max
- Upload vers Supabase Storage bucket `content-drafts`, path `{workspace_id}/{timestamp}.{ext}`
- URL publique stockee dans `media_urls`

#### Brouillons / Programmes (IgDraftsList)
- Filtre par status ('draft' ou 'scheduled')
- Cartes : thumbnail, caption (120 chars), hashtags (5 premiers), date, type media
- Boutons Modifier / Supprimer

#### Hashtags (IgHashtagGroups)
- Grille cards : nom + badges hashtags
- CRUD via modal (nom + textarea virgules)

#### Templates (IgCaptionTemplates)
- Grille cards : titre + preview body + hashtags + categorie
- Categories : general, education, storytelling, offre, preuve_sociale, motivation, behind_the_scenes
- CRUD via modal

#### Best Time (IgBestTime)
- Necessite min 5 reels
- Heatmap jour (Lun→Dim) x heure (6h→23h)
- Intensite couleur = avg engagement / max avg
- Top 5 creneaux : cards jour, heure, % engagement, nb posts

### 7.5 Messages (page separee)

- **Layout 2 panneaux** : liste conversations (gauche, 350px) + thread (droite)
- **ConversationList** : avatar, nom/username, preview dernier message, timestamp relatif, badge non-lu
- **ConversationThread** : bulles messages (envoi a droite, recu a gauche), media inline, timestamps
- **MessageInput** : textarea + bouton envoyer
- **Lien lead** : si `lead_id` renseigne sur la conversation, bouton "Voir la fiche lead"
- **Recherche** : barre de recherche par nom/username dans la liste

---

## 8. Sync Instagram

### Sync manuelle (bouton dans General)
- Reels : `GET /v25.0/me/media` → insights par reel → upsert
- Stories : `GET /v25.0/me/stories` → insights par story → upsert
- Snapshot : followers_count + somme views → insert (max 10 par workspace)
- Conversations : `GET /v25.0/me/conversations` → upsert + derniers messages

### Auto-sync silencieux
- Se declenche a l'ouverture de l'onglet Instagram
- Throttle : 1 fois par 30 minutes
- Sync stories seulement (capture avant expiration 24h)

### Token
- Reutilise le token de `integrations` (type 'meta', `credentials_encrypted` contient access_token)
- Scopes requis : `instagram_business_basic`, `instagram_business_manage_messages`, `instagram_business_content_publish`, `instagram_business_manage_insights`

---

## 9. Etat "non connecte"

Si aucun compte Instagram n'est lie (pas d'entree dans `ig_accounts` ou `integrations` type meta) :
- Affichage d'un ecran vide avec icone Instagram + message "Connectez votre compte Instagram"
- Bouton qui redirige vers Parametres > Integrations
- Meme pattern pour la page Messages

---

## 10. Decisions techniques

- **Pas de nouveau framework** : suit les patterns existants (inline styles, CSS variables, recharts)
- **Migration SQL unique** : toutes les tables dans une seule migration `009_instagram_module.sql`
- **Validation Zod** : schemas dans `src/lib/validations/instagram.ts`
- **Types TypeScript** : ajout dans `src/types/index.ts`
- **Storage bucket** : `content-drafts` pour les medias des posts
- **Pas de cron pour la publication programmee** : a implementer via le systeme cron existant (`/api/cron/`)
