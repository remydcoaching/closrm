# Etat du projet — ClosRM

> Fichier mis a jour obligatoirement a la fin de chaque tache.
> Derniere mise a jour : 2026-06-09

---

## Etat de référence — Versions & runtimes (au 2026-05-17 22h30)

### Mobile (Expo)
- **App version** : `1.0.0` (pinned, voir PR #501)
- **iOS buildNumber** : `3` (bumped pour build local AirDrop)
- **Runtime version policy** : `appVersion` → runtime = `1.0.0`
- **Channel OTA** : `preview`
- **Builds installés Pierre iPhone** : runtime 1.0.0 build 2 (build 3 en cours)

### Web
- **Branche prod** : `develop` (Vercel déploie develop → closrm.fr)
- **Branche main** : reçoit uniquement les releases validées (pas auto-deploy)

### Branches actives (au moment du commit)
- `develop` : prod
- `main` : releases
- `feature/pierre-mobile-app` : mergée, à supprimer côté local (worktree nettoyé)
- Toutes les anciennes branches merged en local ont été supprimées (commande `git branch --merged develop | xargs git branch -d`)
- Branches unmerged conservées (potentielles WIP) — voir `git branch --no-merged develop`

---

## Session 2026-05-17 (soir) — Cleanup tournage + agenda UX + résurrection mobile-app

Suite de l'après-midi (PR #494 + #495 + #496 + #497 déjà mergés). Pierre signale que :
1. Brief encore présent sur mobile dans Jour J malgré le PR précédent
2. Jour J encore présent sur web (dans Prep, Brief)
3. Agenda v2 web : click direct ouvre panel (devrait être 2 clics), granularité 30min seulement, latence création
4. App mobile : plus d'agenda alors qu'il y en avait un avant + bug "1h s'affiche sur toute la journée"

### Découverte clé
La branche `feature/pierre-mobile-app` (worktree `/Users/pierrerebmann/closrm-mobile`) contenait **228 commits locaux jamais pushés** entre le 10 et le 15 mai, incluant :
- AgendaTimeline complet + fixes itératifs du bug "1h sur toute la journée"
- BookingFormSheet, EventDetailSheet, AgendaList
- useAgenda hook, useAgendaReminders, agenda-reminders service
- AgendaStack navigation
- Accent color custom, alarme klaxon, Branding screen, RDV add/edit

C'est pour ça que la prod mobile n'avait pas l'agenda — branche jamais mergée. Pierre l'avait oublié (worktree séparé).

### PRs créées et mergées dans cette session (toutes sur develop)
| PR | Titre | Statut |
|----|-------|--------|
| #498 | chore(tournage): cleanup Brief mobile + Jour J web | Mergée |
| #499 | fix(agenda): click 2-stage, granularité 15min, latence création | Mergée |
| #500 | feat(mobile): agenda timeline + RDV edit + alarmes + accent color | Mergée (~4500 lignes) |
| #501 | chore(mobile): pin version 1.0.0 | Mergée |

### Détails PR #498 (tournage cleanup final)
- Mobile : suppression bouton "Brief →" header Jour J, route `ReelsBrief` + écran + types supprimés
- Web : `PrepView` "🎬 Jour J →" devient "📄 Brief →"
- Web : `BriefView` "← Jour J" devient "← Prep", empty state pointe vers prep
- Web : `TournagesModal` retire le case `view.kind === 'jour-j'` + import `JourJView`
- **Effet** : web = Prep + Brief uniquement, mobile = Prep + Jour J uniquement (cohérent avec décision plateforme)

### Détails PR #499 (agenda v2 web)
- `handleEventClick` (page.tsx) : si event déjà highlighted → ouvre panel, sinon → highlight seul + ferme panel précédent
- `snapToHalf` → `snapToQuarter` dans WeekView + DayView (drag/move/resize/preview)
- Min duration drag 30min → 15min, `+0.5` → `+0.25` sur dragEnd
- `NewBookingModal.handleSubmit` : `onClose()` immédiat + fetch en background + refetch via onCreated dans finally. UX instantanée, `alert()` si POST échoue.

### Détails PR #500 (résurrection mobile-app)
- Push de `feature/pierre-mobile-app` sur origin (228 commits)
- Merge `origin/develop` dedans pour intégrer les fixes récents (tournage cleanup + agenda v2)
- Conflit résolu : `MoreMenuScreen.tsx` subtitle "prep & jour J" (côté develop)
- Doublon résolu : ancien `app/more/TournageSessionsScreen.tsx` supprimé (gardé `app/social/` de develop)
- Dédup `MoreStackParamList.TournageSessions` + import dans MoreStack
- TypeScript check passe

### Détails PR #501 (pin version mobile)
- `app.json` version `1.1.0` → `1.0.0` pour matcher le build installé iPhone Pierre
- Évite le swap manuel à chaque push OTA

### OTAs publiés (preview channel)
| Group ID | Runtime | Message | Commit |
|----------|---------|---------|--------|
| `72ea465f-ddaf-486a-8d8f-43131ce3a6f6` | 1.0.0 | tournage Brief retiré du Jour J | ca3fcb9 |
| `7d824a01-72c6-4ead-adf0-d8badd99569a` | 1.1.0 | agenda timeline + RDV edit + alarmes (PR #500) | 8e19e33 |
| `cb2d3c92-9191-4546-b237-18fa6444350b` | 1.0.0 | agenda timeline + RDV edit + alarmes (PR #500, rt 1.0.0) | 8e19e33 |

### Build local iOS en cours (au moment de l'écriture)
- Profile `preview`, buildNumber 3
- Sortie : `/tmp/closrm-build.ipa`
- À AirDrop sur iPhone Pierre pour récupérer l'agenda (l'OTA seul ne descendait pas — peut-être plugin `expo-notifications` qui nécessite un rebuild natif à cause des sons ajoutés)

### Problème connu
- Pierre voit encore "Call" dans le tab bar mobile au lieu de "Agenda" → l'OTA n'a pas appliqué malgré force-quit. Hypothèse : ajout de `sounds: ["./assets/sounds/alarm.wav"]` dans `expo-notifications` plugin → nécessite build natif. D'où le rebuild local en cours.

### Branches locales nettoyées
Toutes les branches mergées dans develop ont été supprimées en local (~40 branches). Liste des unmerged conservées : voir `git branch --no-merged develop`.

---

## Session 2026-05-17 — Fix bugs tournage (Pierre)

Pierre signale deux bugs côté tournage (web + mobile) :

1. **Session de tournage vide alors que les reels existent** : la session « Tournage 1 Geoffrey » ne montrait aucun reel dans Prep/Jour J alors qu'elle en contient. Root cause : `PrepView`/`JourJView`/`BriefView` (web) et `useReelShots` (mobile) chargeaient `/api/social/posts?content_kind=reel&per_page=100` puis filtraient en JS par les IDs de la session. Au-delà de 100 reels OU si un post avait changé de `content_kind`, la session apparaissait vide. Pire, en Jour J la liste filtrée vide faisait un fallback vers `/api/reel-shots` sans filtre → tous les shots du workspace s'affichaient mélangés.

   **Fix** : ajout d'un filtre `ids` au schéma `socialPostFiltersSchema` + handling dans `/api/social/posts`. Les vues fetchent désormais par IDs quand une session est ciblée (`?ids=a,b,c&per_page=500`). Le fallback "pas de filtre social_post_ids" sur l'API reel-shots est neutralisé (on retourne `[]` au lieu de fetcher tout le workspace).

2. **Clic « ✓ Tournée » change le lieu** : marquer la dernière phrase d'un lieu faisait disparaître le lieu (le filtre `byPlace` excluait `done`) → `safeIdx` sautait vers un autre lieu pendant le tournage. Pierre veut juste voir la phrase barrée + un undo, pas qu'elle disparaisse.

   **Fix** : suppression de l'exclusion `s.done` dans `byPlace` (web `jour-j/page.tsx` + mobile `useReelShots.ts`). Les phrases tournées restent visibles (opacité 55% + line-through + badge « ✓ Tournée »). Bouton « ↻ Annuler » remplace « Tournée/Reporter » sur les phrases déjà tournées. Le tri des lieux est fait par nombre de phrases **restantes** (skip + done exclus) → stable jusqu'à ce que tout soit fini.

**Fichiers modifiés** :
- `src/lib/validations/social-posts.ts` — schéma : ajout `ids` (CSV)
- `src/app/api/social/posts/route.ts` — handle filtre `ids`
- `src/app/(dashboard)/acquisition/reels/tournage/prep/page.tsx` — fetch par IDs + 2 queries parallèles (session + picker)
- `src/app/(dashboard)/acquisition/reels/tournage/jour-j/page.tsx` — fetch par IDs, `done` visible, bouton Annuler, header recompté
- `src/app/(dashboard)/acquisition/reels/tournage/brief/page.tsx` — fetch par IDs
- `mobile/src/hooks/useReelShots.ts` — fetch par IDs + `done` exposé dans byPlace
- `mobile/src/types/reel-shots.ts` — `ShotInfo.done`
- `mobile/src/app/social/ReelsTournageJourJScreen.tsx` — render done + bouton Annuler

Branche : `feature/pierre-fix-tournage-sessions` (depuis develop). Non commité, pas de PR ouverte.

---

## Session 2026-05-10 — Audit & optimisation perf (T-044)

L'utilisateur signale agenda, leads, et réseaux sociaux comme « ULTRA LENTS ». Audit complet via 3 sous-agents parallèles, vérification critique des claims, fixes ciblés.

**Le vrai goulot trouvé** : `count: 'exact'` côté Supabase force un scan complet de chaque table à chaque requête paginée. Remplacé par `count: 'planned'` (stats du planner, ~ instantané) sur 8 routes API principales — gain probable 200-500ms par requête sur grosses tables.

**Autres fixes** :
- Agenda : `handleStatusChange` optimiste (plus de refetch des 100 bookings au clic), `per_page` adaptatif day/week/month
- Leads : 8 modales en `next/dynamic`, `LeadsListView` `React.memo` + callbacks parents stabilisés
- IG Acquisition : `Promise.all` bloquant scindé en 2 vagues (critique vs secondaire)
- IG Reels : `<video preload="none">` + `<img loading="lazy">`
- YT Videos : debounce 300ms search, cache module-scope TTL 60s sur le panel détail
- Migration 078 : index trigram (pg_trgm + GIN) sur `leads.first_name/last_name/email/phone/instagram_handle` et `yt_videos.title`

**À appliquer en prod** : `supabase db push` pour la migration 078.

Détail dans `taches/tache-044-perf-audit-agenda-leads-social.md`.

---

## Session 2026-05-03 → 04 — Récap (T-043)

20 PRs cascadées en prod (#345 → #374). Détail complet dans `taches/tache-043-session-2026-05-03-04.md`. Highlights :

- **Sidebar+Tabs** : 4 sections équilibrées, pill-style segmented control
- **Dashboard v2 command center** : refonte complète après brainstorming + analyse de 24 dashboards (Stripe, Linear, Attio, GHL, iClosed…). Hero adaptatif, KPIs Stripe-style, listes algo, funnel cohorte horizontal, recent bookings. Pre-call brief IA sur bouton manuel. Spec + plan dans `docs/superpowers/`.
- **Agenda** : resize RDV en drag (Google Calendar style) + perf throttle GCal sync 5min
- **Booking type Téléphone** : 4ᵉ option (Présentiel/Meet/Visio/Téléphone). Email block dédié, CTA `tel:` agenda, no Meet auto. Form fields select avec éditeur d'options.
- **Funnel** : SSR direct (plus de flash blanc), safe-area iOS, redirect après booking, URL canonique window.location.origin, middleware /f public, calendrier lisible, fix migration 062 source=funnel
- **Lead add booking** : bouton "Planifier un RDV" depuis side panel + fiche lead

**Migrations prod appliquées :** 061 (ai_call_briefs), 062 (bookings.source funnel idempotente)

---

## Statut global

**Phase actuelle :** Developpement V1 (finalisation) + features avancees (IA) + UX deep polish
**Version :** 0.6 (post-session marathon 04/05)
**Branche principale active :** `develop`

---

## Modules — Etat d'avancement

| Module | Responsable | Statut | Tache(s) |
|--------|-------------|--------|----------|
| Setup projet (Next.js + Supabase + Auth + Layout) | Remy | ✅ Termine | — |
| Auth (login, register, reset, middleware, hooks) | Pierre | ✅ Termine | T-002 |
| Landing page | Pierre | ✅ Termine | T-002 |
| Module Leads — Liste + API | Remy | ✅ Termine | T-004 |
| Module Leads — Fiche lead | Remy | ✅ Termine | T-004 |
| **Lead++ (pseudo IG, relances directes, saisie chaine, Messages tab)** | **Pierre** | **✅ Termine** | **T-027** |
| Dashboard d'accueil (vraies donnees) | Remy | ✅ Termine | T-003 |
| Module Closing — API + Frontend | Pierre | ✅ Termine | T-007 |
| Module Follow-ups — API + Frontend | Pierre | ✅ Termine | T-008 |
| Module Statistiques | Remy | ✅ Termine | T-011 |
| Base de donnees (vue globale) | Remy | ✅ Termine | T-012 |
| Module Automations v1 (Workflows) | Pierre | ✅ Termine | T-014 |
| **Module Automations v2 (4 triggers, 6 actions, dry-run, historique)** | **Pierre** | **✅ Termine** | **T-029** |
| **Refonte visuelle Automations** | **Pierre** | **✅ Termine** | **2026-04-07** |
| Notifications WhatsApp/Telegram/Email | Pierre | ✅ Termine | T-016 |
| Parametres Reglages | Pierre | ✅ Termine | T-018 |
| Parametres Integrations | Pierre | ✅ Termine | T-019 |
| Dark/Light Mode + Branding dynamique | Pierre | ✅ Termine | — |
| Integration Meta Ads (OAuth + webhook + UI) | Remy | ✅ Termine | T-013 |
| Integration Google Calendar | Pierre | ✅ Termine | T-022 |
| Module Publicites (Meta Ads dashboard) | Remy | ✅ Termine | T-017 |
| Module Publicites v2 — Leadform/Follow Ads + sante | Remy | ✅ Termine | T-025 |
| Source `follow_ads` + channel `instagram_dm` | Remy | ✅ Termine | A-007 |
| Module Emails (sequences + broadcast) | Pierre | ✅ Termine | T-020 |
| Module Calendrier / Booking | Pierre | ✅ Termine | T-022 |
| **Booking → auto Google Meet + 3 types de lieu** | **Pierre** | **✅ Termine** | **T-030** |
| Module Reseaux Sociaux (Instagram) | Pierre | ✅ Termine | T-023, T-024 |
| Module Messages (DMs Instagram) | Pierre | ✅ Termine | T-023, T-024 |
| Module Commentaires (Instagram) | Pierre | ✅ Termine | T-024 |
| Publication Instagram (Post/Reel/Story) | Pierre | ✅ Termine | T-024 |
| Planification auto Instagram (cron) | Pierre | ✅ Termine | T-024 |
| **Assistant IA de Relance (Guidance + Convert + Brief + Self-learning)** | **Pierre** | **✅ Termine** | **T-032** |
| **Lead magnets structures (titre + lien) dans Assistant IA** | **Pierre** | **✅ Termine** | **A-011** |
| **Funnels v2 — Direction artistique (presets + 9 effets)** | **Remy** | **✅ Termine** | **T-028a** |
| **Funnels v2 — Migration des 13 blocs** | **Remy** | **✅ Termine** | **T-028c** |
| **Funnels v2 — Refonte builder UX** | **Remy** | **✅ Termine** | **T-028b** |
| **Funnels — BookingBlock fonctionnel (calendrier integre)** | **Remy** | **✅ Termine** | **A-028a-01** |
| **Funnels — FormBlock fonctionnel (creation lead + workflows)** | **Remy** | **✅ Termine** | **A-028a-02** |
| **Funnels — RedirectPicker unifie + templates enrichis** | **Remy** | **✅ Termine** | **A-028a-01/02** |
| **Module Automations (v1+v2)** | **Pierre** | **⚠️ Code OK, APIs manquantes** | **T-014, T-029** |
| Instagram Automations (trigger comment_keyword) | Pierre | ⬜ Non demarre | T-021 |
| **Import portefeuille leads (CSV wizard 5 etapes + historique)** | **Remy** | **✅ Termine** | **T-031** |
| Linktree interne (liens trackables par lead) | Pierre | ✅ Termine (2026-04-17) | A-010 |
| → Post-process IA : remplace URLs par short links dans suggestions | Pierre | ⚠️ Code en place, **non testable en E2E** tant que Meta Graph API non validée (pas de vraies convos IG). À valider post-soumission Meta. | A-010 |
| Followers-as-prospects (V2) | Remy | ❌ Abandonne (API IG) | T-026 |

---

## Session du 2026-04-07/08 — Resume des travaux Pierre

### Taches planifiees par Remy (T-027, T-029, T-030)

| Tache | Demande Remy | Resultat |
|-------|-------------|----------|
| **T-027 Lead++** | Pseudo IG, workflow inline, saisie chaine, onglet Messages | ✅ Fait — pseudo IG auto-source, relances directes (pas workflow), presets J+1→J+30, onglet Messages read-only, liaison auto ig_conversations |
| **T-029 Automations v2** | Nouveaux triggers/actions, observability | ✅ Fait — 4 triggers (lead_imported, lead_with_ig_handle, booking_no_show, lead_inactive), 6 actions (send_dm_ig, create_meet, update_lead_field, add_note, set_reached, schedule_call), dry-run, historique executions, re-run, alertes echec |
| **T-030 Booking Google Meet** | Distinguer presentiel/en ligne, Meet auto | ✅ Fait — 3 types de lieu (presentiel/Google Meet/visio custom), Meet auto via conferenceData, email confirmation, bouton "Rejoindre le Meet" |

### Travaux supplementaires (session)

| Travail | Detail |
|---------|--------|
| Refonte visuelle Automations | Page liste (cartes, filtres, recherche), page workflow [id] (3 onglets), modale creation, composants polish |
| LeadForm ameliore | Source auto IG, prenom optionnel, section relances toujours visible, presets + nurturing |
| Follow-up action modal | Presets relance (demain→1 mois) + nurturing (1-3 mois) + raison optionnelle |
| Page Leads UX | Clic ligne → side panel (plus de bouton "Voir"), bouton supprimer lead (hard delete) |
| Calendar locations | 3 types dans edition calendrier (presentiel/Meet/visio) |
| **T-032 Assistant IA** | Spec + plan + implementation complete — brief coach (wizard 7 etapes), suggestion IA (guidance + convert), self-learning, cle API par coach, lead magnets structures |

### Coordination avec Remy — Points a communiquer

1. **Migrations 015-020 appliquees** : `leads.instagram_handle`, `booking_locations.location_type`, `bookings.meet_url`, `leads.last_activity_at`, `workflows.notify_on_failure`, `ai_coach_briefs`, `ai_conversation_outcomes`, `ai_coach_briefs.api_key`, `ai_coach_briefs.lead_magnets`
2. **LeadForm.tsx modifie** : champ pseudo IG, section relances, saisie en chaine — risque de conflit avec T-031
3. **API leads modifiee** : POST accepte instagram_handle + inline_workflow, DELETE = hard delete
4. **types/index.ts modifie** : Lead += instagram_handle, nouveaux types IA, nouveaux triggers/actions workflow
5. **Trigger `lead_imported`** expose dans T-029 — Remy peut le fire dans T-031

---

## Blocages APIs — a resoudre avant mise en prod

| Action workflow | API requise | Statut |
|---|---|---|
| `send_whatsapp` | Meta WhatsApp Business API (token + phone number ID) | ⬜ Pas configure |
| `send_dm_instagram` | Meta Instagram Messaging API (page access token) | ⬜ Pas configure |
| `send_email` | Resend API (webhook en prod) | ⬜ Webhook pas configure |
| `create_google_meet` | Google Calendar API (OAuth) | ⚠️ OAuth OK, pas teste en prod |
| `send_notification` (Telegram) | Telegram Bot Token | ⬜ Pas configure |
| Cron workflow-scheduler | Vercel Cron | ⬜ Pas configure en prod |

> Les automations sont **fonctionnelles au niveau code** mais les actions qui envoient des messages (WhatsApp, DM IG, email, Telegram) ne marcheront qu'une fois les APIs configurees dans Parametres > Integrations.

---

## Session du 2026-04-15 — Resume des travaux Remy

### T-031 — Import portefeuille leads (CSV)

| Element | Detail |
|---------|--------|
| **Wizard 5 etapes** | Upload & Preview → Mapping & Config → Preview Diff → Import → Recap |
| **Auto-mapping** | Heuristique FR/EN avec confiance (vert/orange/rouge) |
| **Deduplication** | Configurable (email / phone / les deux / aucune), action au choix (ignorer / MAJ / creer) |
| **Import chunked** | Par lots de 100, max 5000 leads / 5 Mo |
| **Correction inline** | Lignes en erreur editables + reimport des corrections |
| **Historique** | Page dediee + annulation de batch (soft-delete si pas de calls/follow-ups) |
| **Trigger workflow** | Fire `lead_imported` (expose par Pierre en T-029) a la fin du batch |
| **Migration** | 023 — table `lead_import_batches` + colonne `leads.import_batch_id` |
| **Lib installee** | PapaParse (parsing CSV client-side) |

---

## Session du 2026-04-29 — Resume des travaux Remy

### T-040 — Fix RLS billing_plans + optimisation Disk IO automations

| Element | Detail |
|---------|--------|
| **RLS billing_plans** | Migration 051 — active RLS + policy SELECT publique. Corrige alerte securite Supabase. |
| **Index workflows** | Migration 052 — 5 index sur workflow_executions, workflow_execution_logs, leads(last_activity_at). |
| **Refactor cron N+1** | workflow-scheduler/route.ts — 4 sections refactorees : anti-doublon batch query + .limit(500). Reduction estimee ~80-90% Disk IO. |

---

## Session du 2026-05-02/03 — Resume des travaux Pierre

### T-042 — Refonte email confirmation RDV + pg_cron Supabase

| Element | Detail |
|---------|--------|
| **3 templates email** | premium / minimal / plain — choix par calendrier |
| **Couleur d'accent custom** | color picker hex par calendrier, propage partout (header, accents, bulle message) |
| **Apercu live** | iframe srcDoc qui se met a jour pendant l'edition (debounce 400ms) |
| **Page publique de gestion** | `/booking/manage/[id]?token=xxx` — annuler ou rebook sans auth |
| **Booking horizon** | `max_advance_days` par calendrier — bloque les reservations trop loin |
| **Historique des envois** | Section dans la page calendrier, scrollable, filtres par status |
| **pg_cron Supabase** | Contourne Vercel Hobby (1x/jour). Schedule `* * * * *` qui ping `/api/cron/booking-reminders`. Secrets dans Vault. |
| **Migrations** | 056-060 (max_advance_days, email_template, manage_token, pg_cron, vault secrets) |
| **PR mergees** | #322, #324, #326, #328, #330, #332, #334, #336, #338, #340, #342 |

> Detail complet : `taches/tache-042-email-rdv-refonte.md`.

---

## Session du 2026-06-01 — Resume des travaux Remy

### T-045 — Funnel : Upload d'images depuis l'ordinateur

| Element | Detail |
|---------|--------|
| **hook useImageUpload** | Validation format/taille, compression WebP (browser-image-compression), upload R2 via presigned URL PUT, progress XHR 0-100% |
| **composant ImageUploadField** | 4 etats (vide, uploading, rempli, erreur), drag & drop + URL fallback, CSS variables exclusivement |
| **API /api/storage/upload-url** | Nouveau type `funnel_image` : path `workspaces/{wsId}/funnels/{funnelId}/{uuid}.webp`, retourne `public_url` |
| **HeroConfig** | Input URL image de fond remplace par ImageUploadField |
| **ImageConfig** | Input URL par slot photo remplace par ImageUploadField, limite 10 images enforced |
| **Propagation funnelId** | FunnelBuilderV2 → FunnelBlockConfig → HeroConfig / ImageConfig |
| **package.json** | `browser-image-compression@^2.0.2` ajoute |

**Prerequis production :** activer R2 Public Access dans Cloudflare dashboard + ajouter `R2_PUBLIC_URL` dans `.env.local` et Vercel.

> Detail complet : `taches/tache-045-funnel-image-upload.md`.

---

## Session 2026-06-09 — Meta Pixel par funnel (Rémy)

### T-046 · Intégration Meta Pixel par funnel

**Statut :** Implémenté. PR ouverte sur `feature/remy-meta-pixel-funnel`.

**Pourquoi :**
Les tunnels de vente de ClosRM sont liés aux campagnes Meta Ads. Sans pixel, Meta ne peut pas retargeter les visiteurs, optimiser les campagnes ni mesurer le coût par lead réel.

**Ce qui a été livré :**
- Colonne `meta_pixel_id TEXT` sur la table `funnels` (migration 083)
- Section "Tracking & Pixels" dans la sidebar du builder — champ Pixel ID + guide intégré
- Injection du script fbq sur les pages publiques via `<Script strategy="afterInteractive">`
- Events automatiques : `PageView` (chargement), `Lead` (FormBlock soumis), `Schedule` (BookingBlock confirmé)
- Couleurs du panel liées à `var(--color-primary)` (accent du workspace)

**⚠️ Action manuelle requise :** exécuter la migration SQL dans Supabase dashboard avant de déployer.

> Detail complet : `taches/tache-046-meta-pixel-funnel.md`
> Spec : `docs/superpowers/specs/2026-06-09-meta-pixel-funnel-design.md`

---

*Mis a jour le 2026-06-09 par Claude Code — ClosRM*
