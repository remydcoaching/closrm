# Tâche 033 — YouTube + Composer multi-plateforme (Metricool-like)

> Date : 2026-04-18
> Auteur : Pierre + Claude
> Branche : `feature/pierre-youtube-multi-plateforme` (à créer)

---

## 🎯 Objectif

Étendre le module **Réseaux sociaux** (`/acquisition/reseaux-sociaux`) pour ajouter **YouTube** comme 2ème onglet à côté d'**Instagram**, avec :

1. Toutes les stats YouTube importantes pour une entreprise (channel + per-video + revenu)
2. Un **composer unifié** dans le calendrier permettant de planifier *en une fois* : Reel IG + Short YouTube + Vidéo longue YouTube
3. Worker de publication automatique multi-plateforme

À terme : ajouter TikTok comme 3ème plateforme (hors-scope tâche 033).

---

## 📊 Audit de l'existant

### ✅ En place
| Composant | Fichier | Détails |
|---|---|---|
| OAuth Google (Calendar) | `src/app/api/integrations/google/{authorize,callback}/route.ts` | Scopes : `calendar`, `calendar.events`. Token refresh auto via `src/lib/google/calendar.ts:getValidAccessToken()` |
| Crypto AES-256-GCM | `src/lib/crypto.ts` | `encrypt()`/`decrypt()` sur `credentials_encrypted` |
| Table `integrations` | `supabase/schema.sql:154-171` | `type` CHECK enum, `credentials_encrypted` JSON, UNIQUE (workspace_id, type) |
| Helper credentials | `src/lib/integrations/get-credentials.ts` | `getIntegrationCredentials(workspaceId, type)` |
| Module Instagram complet | 12 tables (`ig_*`), 22 endpoints, OAuth Meta, sync engine, calendrier | Référence à imiter |
| Sidebar nav | `src/components/layout/Sidebar.tsx` | Section ACQUISITION → "Réseaux sociaux" |
| Bucket Supabase Storage | `content-drafts` (migration 009) | Réutilisable pour uploads vidéos YouTube |
| Cron Vercel | `vercel.json` (2 crons existants) | Faut ajouter le nouveau cron `scheduled-posts` |

### ⚠️ Manquant / à corriger
- Le worker `/api/cron/scheduled-posts/route.ts` existe mais **n'est pas déclaré dans `vercel.json`** → IG scheduling actuel est cassé
- CHECK constraint `integrations.type` n'inclut pas `youtube` → migration nécessaire
- Pas de table `social_posts` partagée → composer multi-plateforme impose un refactor d'architecture
- Pas d'env vars `YOUTUBE_*` (mais on peut réutiliser `GOOGLE_CLIENT_ID/SECRET` car YouTube = projet Google Cloud unique avec scopes différents)

---

## 🔑 Comprendre YouTube Data API v3 (recherche 2026)

### OAuth scopes nécessaires
| Scope | Usage |
|---|---|
| `https://www.googleapis.com/auth/youtube.readonly` | Lire channels, vidéos, playlists, stats publiques |
| `https://www.googleapis.com/auth/youtube.upload` | Upload vidéos (resumable, fichiers > 5MB) |
| `https://www.googleapis.com/auth/youtube` | Manage : update vidéo, delete, comments, thumbnails |
| `https://www.googleapis.com/auth/yt-analytics.readonly` | YouTube Analytics API v2 (watch time, retention, démographie) |
| `https://www.googleapis.com/auth/yt-analytics-monetary.readonly` | Revenu, CPM, ad performance (channels monétisés) |

### Quotas (CRUCIAL)
- **10 000 unités/jour** par projet Google Cloud (default)
- **Upload vidéo = 1 600 unités** → **6 uploads max/jour** sans extension de quota
- `videos.list = 1 unité`, `search.list = 100 unités`, `commentThreads.list = 1`
- Demande d'augmentation gratuite via Google Cloud Console (review case par cas)
- Stratégie : **mettre en cache les stats** (sync 1×/jour suffit pour un dashboard business)

### YouTube Reporting API vs Analytics API
- **Analytics API v2** : requêtes en temps réel, custom dashboards
- **Reporting API** : exports CSV programmés (rapport quotidien complet)
- **Décision** : on utilise **Analytics API v2** (plus flexible, suffit pour le besoin business)

### Métriques disponibles (les plus utiles)
**Channel-level :**
- `views`, `estimatedMinutesWatched`, `averageViewDuration`, `averageViewPercentage`
- `subscribersGained`, `subscribersLost`, `subscriberCount` (snapshot)
- `likes`, `comments`, `shares`, `videosAddedToPlaylists`
- `estimatedRevenue`, `grossRevenue`, `cpm`, `playbackBasedCpm`, `adImpressions`, `monetizedPlaybacks` *(monétisé uniquement)*

**Per-video :**
- Tout l'above + `cardClickRate`, `cardImpressions`, `annotationClickThroughRate`
- Démographie : `viewerAge`, `viewerGender`, `country` (via dimensions)
- Sources de trafic : `insightTrafficSourceType` (browse, suggested, search, external, etc.)
- Devices : `deviceType` (mobile, desktop, tv, tablet)

### Upload Shorts
- Pas d'API spéciale "Shorts" : c'est une vidéo standard avec `< 60s` et ratio vertical 9:16
- Hashtag `#Shorts` dans le titre/description aide la classification (mais auto-détecté par YouTube)

---

## 🏗️ Architecture cible

### Phase 1 — Refactor multi-plateforme (foundation)
Avant d'ajouter YouTube, on factorise IG pour préparer le composer unifié.

**Nouvelles tables :**
```sql
-- Post unifié, plateforme-agnostique
social_posts (
  id uuid PK,
  workspace_id uuid,
  status text CHECK (status IN ('draft','scheduled','publishing','published','partial','failed')),
  scheduled_at timestamptz,
  -- Contenu commun
  title text,                   -- titre principal (= titre YT, ignoré IG)
  caption text,                 -- légende/description
  hashtags text[],
  media_urls text[],            -- URLs Supabase Storage
  media_type text CHECK (...),  -- 'IMAGE'|'VIDEO'|'CAROUSEL'|'SHORT'|'LONG_VIDEO'
  -- Métadonnées
  pillar_id uuid REFERENCES content_pillars(id),
  thumbnail_url text,
  created_by uuid,
  created_at, updated_at
)

-- 1 ligne par (post × plateforme cible)
social_post_publications (
  id uuid PK,
  social_post_id uuid REFERENCES social_posts(id) ON DELETE CASCADE,
  platform text CHECK (platform IN ('instagram','youtube','tiktok')),
  -- Overrides per-platform (caption différente, hashtags spécifiques, etc.)
  config jsonb DEFAULT '{}',  -- ex: {title: "...", description: "...", visibility: "public", category_id: 22}
  -- Suivi publication
  status text CHECK (status IN ('pending','publishing','published','failed','skipped')),
  provider_post_id text,       -- ig_media_id ou youtube videoId
  public_url text,             -- URL publique du post
  published_at timestamptz,
  error_message text,
  retry_count int DEFAULT 0,
  UNIQUE (social_post_id, platform)
)

-- Index
CREATE INDEX idx_social_posts_scheduled ON social_posts(workspace_id, status, scheduled_at) WHERE status='scheduled';
CREATE INDEX idx_social_posts_workspace ON social_posts(workspace_id, created_at DESC);
```

**Migration des données IG existantes :**
- Script qui copie chaque ligne de `ig_drafts` → `social_posts` + `social_post_publications` (platform='instagram')
- On garde `ig_drafts` en lecture pendant 1 sprint (deprecation graduelle)

**Pillars factorisés :**
- Renommer `ig_content_pillars` → `content_pillars` (workspace-level, partagé entre plateformes)

### Phase 2 — YouTube backend
**Tables :**
```sql
yt_accounts (
  id, workspace_id (UNIQUE), 
  channel_id, channel_title, channel_handle (@xxx),
  thumbnail_url, subscribers_baseline,
  access_token, refresh_token, token_expires_at,  -- séparé d'integrations pour clarté
  created_at, updated_at
)

yt_videos (
  id uuid PK,
  workspace_id uuid,
  yt_account_id uuid,
  yt_video_id text UNIQUE,
  title text, description text,
  published_at timestamptz,
  duration_seconds int,
  format text CHECK (format IN ('short','long')),  -- short = <60s + vertical
  thumbnail_url text, video_url text,
  privacy_status text,  -- public|unlisted|private
  -- Stats lifetime (mises à jour par sync)
  views bigint, likes bigint, comments bigint, shares bigint,
  watch_time_minutes bigint, average_view_duration_sec int, average_view_percentage numeric,
  -- Stats monétisation (si dispo)
  estimated_revenue numeric, cpm numeric, monetized_playbacks bigint,
  last_synced_at timestamptz,
  created_at, updated_at
)

yt_video_daily_stats (
  yt_video_id uuid REFERENCES yt_videos(id) ON DELETE CASCADE,
  date date,
  views bigint, watch_time_minutes bigint,
  likes int, comments int, subscribers_gained int,
  estimated_revenue numeric,
  PRIMARY KEY (yt_video_id, date)
)

yt_traffic_sources (
  yt_video_id uuid REFERENCES yt_videos(id) ON DELETE CASCADE,
  date date,
  source_type text,  -- BROWSE|SEARCH|SUGGESTED|EXTERNAL|...
  views bigint, watch_time_minutes bigint,
  PRIMARY KEY (yt_video_id, date, source_type)
)

yt_demographics (
  yt_video_id uuid REFERENCES yt_videos(id) ON DELETE CASCADE,
  age_group text,  -- age13-17|age18-24|...
  gender text,     -- male|female|user_specified
  viewer_percentage numeric,
  PRIMARY KEY (yt_video_id, age_group, gender)
)

yt_snapshots (
  id uuid PK,
  workspace_id uuid,
  yt_account_id uuid,
  date date,
  subscribers int, total_views bigint, total_watch_time_minutes bigint,
  videos_count int,
  estimated_revenue_30d numeric,
  UNIQUE (workspace_id, date)
)

yt_comments (
  id uuid PK,
  workspace_id uuid,
  yt_video_id uuid,
  yt_comment_id text UNIQUE,
  parent_id uuid,  -- pour threads
  author_name text, author_channel_id text, author_avatar_url text,
  text text, like_count int,
  is_hidden boolean DEFAULT false,
  published_at timestamptz, updated_at timestamptz
)
```

**Cap quota :** sync 1×/jour (cron 03h00 UTC) :
- 1 channel.list (1u) + N videos.list (N×1) + analytics queries (~10u/vidéo)
- 100 vidéos = ~1100 units → ok pour 9 channels max sur quota par défaut

**Routes API :**
```
src/app/api/integrations/youtube/
├── authorize/route.ts          # Lance OAuth Google avec scopes YouTube
├── callback/route.ts           # Reçoit code, échange tokens, crée yt_account
└── route.ts                    # DELETE pour déconnecter

src/app/api/youtube/
├── account/route.ts            # GET infos channel
├── videos/route.ts             # GET liste paginée
├── videos/[id]/route.ts        # GET détails + stats
├── videos/[id]/comments/route.ts  # GET comments
├── analytics/channel/route.ts  # GET stats channel (range)
├── analytics/video/[id]/route.ts  # GET stats vidéo (range)
├── snapshots/route.ts          # GET historique snapshots
└── sync/route.ts               # POST sync manuel (full|incremental)
```

**Lib YouTube :**
```
src/lib/youtube/
├── api.ts          # Client HTTP avec auto-refresh (mirror lib/google/calendar.ts)
├── sync.ts         # syncChannel(), syncVideos(), syncAnalytics(), syncDemographics(), syncTraffic()
├── upload.ts       # uploadVideo() — resumable upload protocol
└── publish.ts      # publishScheduledPost() pour le worker cron
```

### Phase 3 — UI YouTube (analytics)
**Page** : `/acquisition/reseaux-sociaux` — ajouter YouTube comme 2ème onglet via `SocialPlatformTabs`.

**Sous-onglets YouTube :**
1. **Vue d'ensemble (`YtOverviewTab`)**
   - KPIs : Abonnés (avec delta 30j), Vues totales, Watch time, Revenu estimé
   - Graphique : abonnés/jour (30j, 90j, 1an)
   - Top 5 vidéos du mois (par vues / par watch time / par revenu)

2. **Vidéos (`YtVideosTab`)**
   - Liste paginée + filtres (Shorts / Long, période, recherche)
   - Colonnes : thumbnail, titre, publication, vues, watch time, likes, comments, revenu, durée moyenne, % vu
   - Click → détail vidéo : 
     - Stats détaillées + graphique daily
     - Sources de trafic (donut)
     - Démographie (barres)
     - Liste comments avec actions (épingler, masquer, répondre)

3. **Calendrier (`YtCalendarTab`)** *(uniquement si l'utilisateur veut un calendrier YT-only — sinon redirect vers calendrier unifié)*

4. **Comments (`YtCommentsTab`)**
   - Inbox unifiée (tous comments toutes vidéos)
   - Actions modération : approve/hide/delete + reply

5. **Insights (`YtInsightsTab`)**
   - Best time to post (basé sur historique)
   - Top sources de trafic du mois
   - Suggestions IA (à brancher plus tard)

### Phase 4 — Composer unifié + Calendrier multi-plateforme
**Page** : `/acquisition/reseaux-sociaux/composer` (nouvelle).

**Flow utilisateur :**
1. Clic "Nouveau post" depuis le calendrier ou l'overview
2. Choix des plateformes cibles (toggles : Instagram ☑️ / YouTube ☑️ / TikTok ☐ disabled)
3. Upload média (image, carousel, vidéo)
4. **Auto-détection format** :
   - Vidéo verticale 9:16 < 60s → propose **Reel IG + Short YouTube**
   - Vidéo horizontale 16:9 ou > 60s → propose **Long YouTube** (greyé pour IG)
   - Image → IG Feed seul
5. **Champs par plateforme dans tabs :**
   - Tab IG : caption + hashtags + sélection pillar
   - Tab YouTube : titre (req.) + description + tags + thumbnail custom + visibility + category
6. **Validation cross-plateforme :**
   - Titre obligatoire si YouTube actif
   - Caption max 2200 chars IG
   - Tags max 500 chars total YT
7. **Schedule :** date + heure unique (= toutes plateformes publient au même moment) OU heures différentes par plateforme (toggle "horaires distincts")
8. **Submit :**
   - Crée 1 `social_posts` + N `social_post_publications` (1 par plateforme cochée)
   - Médias uploadés vers `content-drafts` bucket (URLs publiques)
   - Status = `scheduled` ou `draft`

**Calendrier unifié (`SocialCalendarView`)** *(remplace `IgCalendarView`)* :
- Vue mois/semaine/jour
- Chaque case affiche les posts plannifiés avec **badges plateformes** (icônes IG/YT)
- Drag & drop pour reschedule (PATCH `scheduled_at`)
- Click sur un post → modale de preview/edit
- Filtre par plateforme (afficher seulement IG, ou YT, ou tout)
- Code couleur par pillar

### Phase 5 — Worker de publication
**Cron Vercel `0 */5 * * * *`** (toutes les 5 min) :
```
src/app/api/cron/social-publisher/route.ts
```

**Logique :**
1. Query `social_post_publications` JOIN `social_posts` WHERE status='pending' AND scheduled_at <= now() LIMIT 50
2. Pour chaque publication :
   - Lock optimiste (`UPDATE status='publishing' WHERE status='pending'`)
   - Switch sur `platform` :
     - `instagram` → existing flow (createMediaContainer → poll → publish)
     - `youtube` → `lib/youtube/upload.ts:uploadVideo(post)` (resumable upload)
   - Sur succès : `status='published', provider_post_id, public_url`
   - Sur échec : `status='failed', error_message, retry_count++`
3. Si toutes les publications d'un `social_posts` sont published → `social_posts.status='published'`
4. Si certaines failed → `status='partial'` (UI affiche un warning)

**Retry policy :** max 3 retries, backoff exponentiel (5min, 30min, 2h)

---

## 📁 Fichiers à créer / modifier

### Migrations DB (3 nouvelles)
- `supabase/migrations/033_social_posts.sql` — tables `social_posts`, `social_post_publications`, migration depuis `ig_drafts`
- `supabase/migrations/034_youtube_module.sql` — toutes les tables `yt_*` + ajout `'youtube'` au CHECK `integrations.type`
- `supabase/migrations/035_content_pillars_shared.sql` — renomme `ig_content_pillars` → `content_pillars`

### Backend (lib + API)
- `src/lib/youtube/api.ts` (nouveau) — client HTTP YouTube Data API v3 avec refresh token
- `src/lib/youtube/sync.ts` (nouveau) — sync engine
- `src/lib/youtube/upload.ts` (nouveau) — resumable upload
- `src/lib/youtube/publish.ts` (nouveau) — publication d'un `social_posts` sur YouTube
- `src/lib/social/publisher.ts` (nouveau) — dispatcher multi-plateforme
- `src/app/api/integrations/youtube/{authorize,callback}/route.ts` (nouveau)
- `src/app/api/integrations/youtube/route.ts` (DELETE)
- `src/app/api/youtube/{account,videos,videos/[id],videos/[id]/comments,analytics/channel,analytics/video/[id],snapshots,sync}/route.ts` (8 routes)
- `src/app/api/social/posts/route.ts` (CRUD posts unifié)
- `src/app/api/social/posts/[id]/route.ts`
- `src/app/api/social/posts/[id]/publish/route.ts` (publish immédiat)
- `src/app/api/cron/social-publisher/route.ts` (nouveau worker)

### Frontend
- `src/components/social/SocialPlatformTabs.tsx` — ajouter YouTube
- `src/components/social/youtube/YtOverviewTab.tsx`
- `src/components/social/youtube/YtVideosTab.tsx`
- `src/components/social/youtube/YtVideoDetail.tsx`
- `src/components/social/youtube/YtCommentsTab.tsx`
- `src/components/social/youtube/YtInsightsTab.tsx`
- `src/components/social/youtube/YtNotConnected.tsx`
- `src/components/social/calendar/SocialCalendarView.tsx` — calendrier unifié
- `src/components/social/composer/PostComposer.tsx` — modale de création multi-plateforme
- `src/components/social/composer/PlatformTabs.tsx` (sub : IG / YT)
- `src/components/social/composer/MediaUploader.tsx` — drag/drop + détection format
- `src/components/social/composer/SchedulePicker.tsx` — date/heure (uni ou par plateforme)
- `src/app/(dashboard)/acquisition/reseaux-sociaux/composer/page.tsx`

### Settings
- `src/app/(dashboard)/parametres/integrations/page.tsx` — ajouter card YouTube (Connecter / Déconnecter)

### Types
- `src/types/index.ts` — ajouter :
  - `SocialPlatform = 'instagram' | 'youtube' | 'tiktok'`
  - `SocialPost`, `SocialPostPublication`
  - `YtAccount`, `YtVideo`, `YtVideoDailyStats`, `YtTrafficSource`, `YtDemographics`, `YtSnapshot`, `YtComment`

### Validation
- `src/lib/validations/social-posts.ts` — schémas Zod
- `src/lib/validations/youtube.ts` — schémas Zod

### Config
- `vercel.json` — ajouter cron `/api/cron/social-publisher` toutes les 5min ET `/api/cron/youtube-sync` quotidien
- `.env.local.example` — ajouter `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` (peuvent = `GOOGLE_*`)

---

## 🚀 Phasing & estimation

| Phase | Contenu | Estimation | Livrable utilisateur |
|---|---|---|---|
| **Phase 0** | Setup Google Cloud Console : projet YouTube Data API + scopes + OAuth credentials prod/preview | 30 min (par toi) | — |
| **Phase 1** | Refactor `social_posts` + migration depuis `ig_drafts`. Aucun changement UI utilisateur. Compat. | 2j | IG continue de marcher, fondations posées |
| **Phase 2** | Backend YouTube complet (OAuth, sync, tables) | 3j | Connecter compte YouTube → données présentes en DB |
| **Phase 3** | UI YouTube (5 sous-onglets) | 3j | **Onglet YouTube fonctionnel à côté d'IG** ✨ |
| **Phase 4** | Composer unifié + calendrier multi-plateforme | 3j | **Création multi-plateforme dans 1 modale** ✨ |
| **Phase 5** | Worker publication automatique + retry | 1j | **Posts planifiés → publiés auto sur IG + YT** ✨ |

**Total : ~12 jours** (2-3 semaines calendaires).

---

## ⚠️ Risques & décisions à prendre

### Risque 1 — Quota YouTube (CRITIQUE)
- 10 000 units/jour = **6 uploads max/jour**
- Si tu prévois > 6 vidéos/jour ou > 9 channels connectés, il faut **demander une augmentation** dès maintenant (review Google = ~1 semaine, parfois plus)
- **Mitigation** : pour le sync, agréger requests + cache 24h
- **Décision** : tu fais la demande maintenant ?

### Risque 2 — Approbation OAuth
- App OAuth en mode "Testing" = limitée à 100 utilisateurs
- Pour multi-tenant SaaS : passer en "Production" (review Google ~1 sem)
- Scope `youtube.upload` = **scope sensible** → review obligatoire
- **Décision** : on prévoit la review dès Phase 2

### Risque 3 — Resumable upload
- Vidéos > 5MB obligatoirement en chunked upload
- Process : POST initial (URL signée) → PUT chunks → PUT final
- Côté frontend : faut un uploader qui gère reprise si déco
- **Mitigation** : utiliser `tus-js-client` ou implémenter manuellement (estimation : +0,5j)

### Risque 4 — Format vidéo IG vs YouTube
- IG Reel : 9:16, ≤ 90s, MP4 H.264
- YouTube Short : 9:16, ≤ 60s
- → contrainte la plus stricte = **60s + 9:16** pour cross-post Reel+Short
- Vidéo > 60s ou horizontale = YouTube long uniquement
- UI doit clairement indiquer pourquoi telle plateforme est greyée

### Risque 5 — Workspace multi-channel YouTube
- 1 utilisateur peut avoir plusieurs channels YouTube (perso + business)
- → la table `yt_accounts` doit supporter N channels par workspace (suppression du `UNIQUE workspace_id`)
- Ou : on impose 1 channel/workspace pour V1
- **Décision** : on commence avec 1 channel/workspace (V1), extensible plus tard

### Risque 6 — Coexistence avec IG actuel
- Refactor `ig_drafts` → `social_posts` = risque de casser le flow IG existant
- **Mitigation** : Phase 1 fait le refactor en mode "miroir" (les 2 tables existent en parallèle) puis bascule du worker avec un feature flag

### Décision — Cron Vercel ou Edge Function ?
- Vercel cron = simple, suffisant pour < 50 posts/min
- Edge Function = mieux pour upload chunked
- **Choix** : Vercel cron + Vercel Function classique (Node runtime) pour upload

---

## 🧪 Stratégie de test

1. **OAuth flow** : connecter un channel test (compte personnel YouTube) → vérifier `yt_accounts` créé + tokens stockés chiffrés
2. **Sync** : déclencher sync manuel → vérifier `yt_videos` rempli avec stats
3. **Composer** : créer un post Reel+Short avec vidéo 30s 9:16 → vérifier `social_posts` + 2× `social_post_publications`
4. **Worker** : forcer un post à `scheduled_at = now() - 1min` → cron publie sur IG ET YouTube → URLs publiques sauvées
5. **Refresh token** : forcer expiration token → next API call refresh auto
6. **Quota guard** : simuler 429 from API → retry avec backoff
7. **Edge cases** : vidéo upload échoue côté YouTube mais réussit IG → `status='partial'` + UI affiche détail

---

## 📚 Sources / Documentation
- [YouTube Data API v3 — API Reference](https://developers.google.com/youtube/v3/docs)
- [Quota Calculator](https://developers.google.com/youtube/v3/determine_quota_cost)
- [OAuth 2.0 Web Server Apps](https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps)
- [Resumable Upload](https://developers.google.com/youtube/v3/guides/uploading_a_video)
- [YouTube Analytics API v2 Metrics](https://developers.google.com/youtube/analytics/metrics)
- [YouTube Analytics Sample Requests](https://developers.google.com/youtube/analytics/sample-requests)
- [YouTube API Quota 10K Breakdown](https://www.contentstats.io/blog/youtube-api-quota-tracking)

---

## ✅ Checklist exécution (à cocher au fur et à mesure)

### Phase 0 — Prérequis (toi)
- [ ] Créer projet Google Cloud "ClosRM-Production"
- [ ] Activer **YouTube Data API v3** + **YouTube Analytics API**
- [ ] Créer OAuth 2.0 credentials (Web Application)
- [ ] Configurer Authorized redirect URIs : `https://closrm.vercel.app/api/integrations/youtube/callback` + variants preview
- [ ] Demander la review pour le scope `youtube.upload` (consent screen → Submit for verification)
- [ ] Demander une **augmentation de quota** si > 9 channels prévus
- [ ] Ajouter `YOUTUBE_CLIENT_ID` et `YOUTUBE_CLIENT_SECRET` dans Vercel env vars (peuvent = `GOOGLE_*`)

### Phase 1 — Refactor
- [ ] Migration 033_social_posts.sql + script migration data
- [ ] Types `SocialPost`, `SocialPostPublication`
- [ ] API `/api/social/posts` CRUD
- [ ] Adapter le cron IG existant pour utiliser `social_posts`
- [ ] Tester non-régression IG

### Phase 2 — YouTube backend
- [ ] Migration 034_youtube_module.sql
- [ ] `lib/youtube/api.ts` + `sync.ts`
- [ ] OAuth `/api/integrations/youtube/{authorize,callback}`
- [ ] Routes `/api/youtube/*`
- [ ] Cron sync quotidien

### Phase 3 — UI YouTube
- [ ] `SocialPlatformTabs` étendu
- [ ] `YtOverviewTab` (KPIs + charts)
- [ ] `YtVideosTab` + détail vidéo
- [ ] `YtCommentsTab`
- [ ] `YtInsightsTab`
- [ ] `YtNotConnected` + bouton connexion dans Paramètres > Intégrations

### Phase 4 — Composer + Calendrier
- [ ] `PostComposer` modale avec upload + tabs plateformes
- [ ] `MediaUploader` avec auto-détection format
- [ ] `SchedulePicker`
- [ ] `SocialCalendarView` unifié
- [ ] Validation cross-plateforme

### Phase 5 — Publisher
- [ ] `lib/social/publisher.ts` dispatcher
- [ ] `lib/youtube/upload.ts` resumable
- [ ] `lib/youtube/publish.ts`
- [ ] Cron `/api/cron/social-publisher` (toutes les 5min)
- [ ] Retry policy
- [ ] Logs + monitoring

---

*Fin tâche 033 — à valider avant exécution.*
