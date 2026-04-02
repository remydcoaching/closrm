# T-023 · Module Réseaux Sociaux (Instagram) + Messages

**Responsable :** Pierre
**Statut :** ✅ Terminé (2026-04-02)
**Branche :** `feature/pierre-funnel-builder`

---

## Objectif

Ajouter le module Instagram complet au CRM : Stories & Séquences, Reels & Content Pillars, Content Planner (calendrier de publication, brouillons, hashtags, templates, best time), et Messages (DMs Instagram).

## Spec

`docs/superpowers/specs/2026-04-01-instagram-social-module-design.md`
- 3 sous-modules : Stories/Reels/Général sous "Réseaux sociaux", Content Planner sous l'onglet Calendrier, Messages comme page séparée
- Réutilisation de l'intégration Meta existante (OAuth, tokens)
- Structure préparée pour TikTok/YouTube/LinkedIn à terme

## Plan d'implémentation

`docs/superpowers/plans/2026-04-01-instagram-social-module.md` — 20 tâches

## Fichiers créés

### Base de données
- `supabase/migrations/009_instagram_module.sql` — 13 tables + storage bucket

### Types & Validation
- `src/types/index.ts` (modifié) — 17 interfaces Instagram ajoutées
- `src/lib/instagram/constants.ts` — IG_SEQ_TYPES, périodes, catégories, formats, métriques
- `src/lib/validations/instagram.ts` — Zod schemas (séquences, piliers, drafts, hashtags, templates, goals, filtres, messages)

### Instagram API & Sync
- `src/lib/instagram/api.ts` — Graph API v25.0 wrapper (profil, reels, stories, publish, DMs)
- `src/lib/instagram/sync.ts` — Orchestration sync (reels, stories, snapshots, conversations)

### API Routes (18 fichiers sous `src/app/api/instagram/`)
- `account/route.ts` — GET/POST compte IG
- `sync/route.ts` — POST sync complète ou stories seules
- `stories/route.ts` — GET stories avec filtres
- `sequences/route.ts` — GET/POST séquences
- `sequences/[id]/route.ts` — PUT/DELETE séquence
- `sequences/[id]/items/route.ts` — GET/PUT items séquence
- `reels/route.ts` — GET/PATCH reels
- `pillars/route.ts` — CRUD content pillars
- `drafts/route.ts` — GET/POST drafts
- `drafts/[id]/route.ts` — PUT/DELETE draft
- `drafts/[id]/publish/route.ts` — POST publication Instagram
- `hashtag-groups/route.ts` — CRUD groupes hashtags
- `caption-templates/route.ts` — CRUD templates
- `snapshots/route.ts` — GET snapshots
- `goals/route.ts` — GET/POST goals
- `conversations/route.ts` — GET conversations
- `messages/route.ts` — GET messages
- `messages/send/route.ts` — POST envoyer DM

### Navigation
- `src/components/layout/Sidebar.tsx` (modifié) — ajout Réseaux sociaux + Messages

### Pages
- `src/app/(dashboard)/acquisition/reseaux-sociaux/page.tsx`
- `src/app/(dashboard)/acquisition/messages/page.tsx`

### Composants (18 fichiers)
- `src/components/social/SocialPlatformTabs.tsx`
- `src/components/social/instagram/IgSubTabs.tsx`
- `src/components/social/instagram/IgNotConnected.tsx`
- `src/components/social/instagram/constants.ts`
- `src/components/social/instagram/IgGeneralTab.tsx`
- `src/components/social/instagram/IgStoriesTab.tsx`
- `src/components/social/instagram/IgSequenceModal.tsx`
- `src/components/social/instagram/IgSequenceDetail.tsx`
- `src/components/social/instagram/IgStoriesSelector.tsx`
- `src/components/social/instagram/IgReelsTab.tsx`
- `src/components/social/instagram/IgCalendarTab.tsx`
- `src/components/social/instagram/IgCalendarView.tsx`
- `src/components/social/instagram/IgDraftModal.tsx`
- `src/components/social/instagram/IgDraftsList.tsx`
- `src/components/social/instagram/IgHashtagGroups.tsx`
- `src/components/social/instagram/IgCaptionTemplates.tsx`
- `src/components/social/instagram/IgBestTime.tsx`
- `src/components/messages/ConversationList.tsx`
- `src/components/messages/ConversationThread.tsx`
- `src/components/messages/MessageInput.tsx`

## Tâches liées
- T-021 : Instagram DM integration (complétée par ce module)
- Intégration Meta existante (Paramètres > Intégrations)
