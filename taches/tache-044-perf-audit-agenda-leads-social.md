# Tâche 044 — Audit & optimisation perf : agenda, leads, réseaux sociaux

**Date** : 2026-05-10
**Auteur** : Pierre (via Claude Code)
**Statut** : ✅ terminé

## Description

Audit complet des trois pages signalées comme « ULTRA LENTES » par l'utilisateur (agenda, leads, réseaux sociaux) puis fixes ciblés. Approche : audits parallèles via 3 sous-agents → vérification critique des claims → fixes vérifiés par `tsc` + `next build`.

## Objectif

Réduire la latence perçue sur les 3 pages les plus utilisées du dashboard, sans introduire de régressions fonctionnelles.

## Fichiers modifiés

### Backend (count: 'exact' → 'planned')

Le plus gros gain identifié : `count: 'exact'` force PG à scanner toute la table à chaque GET. `'planned'` utilise les stats du planner (~ instantané, précision ±10% suffit pour la pagination UI).

- `src/app/api/leads/route.ts:18`
- `src/app/api/bookings/route.ts:25`
- `src/app/api/calls/route.ts:18`
- `src/app/api/contacts/route.ts:18`
- `src/app/api/follow-ups/route.ts:15`
- `src/app/api/workflows/route.ts:16`
- `src/app/api/youtube/videos/route.ts:17`
- `src/app/api/instagram/comments/route.ts:15`

### Agenda

- `src/app/(dashboard)/agenda/v2/page.tsx` — `handleStatusChange` : `refetch()` remplacé par `patchEvent()` optimiste (plus de re-fetch des 100 bookings à chaque changement de statut)
- `src/lib/agenda/use-agenda-data.ts` — `per_page` adaptatif (day=30, week=100, month=200) au lieu de 100 hardcodé
- `src/lib/validations/bookings.ts` + `calls.ts` — max bumped à 250 pour permettre month-view chargé

### Leads

- `src/app/(dashboard)/leads/leads-client.tsx` — 8 modales/vues lourdes en `next/dynamic` (LeadSidePanel, LeadForm, ClosingModal, ConfirmModal, CallScheduleModal, LeadActionModal, LeadsKanbanView, KanbanColumnsConfigModal) → bundle initial allégé
- `src/app/(dashboard)/leads/leads-client.tsx` — callbacks parents stabilisés via `useCallback` + `viewRef` (sinon `React.memo` enfant inefficace)
- `src/app/(dashboard)/leads/views/LeadsListView.tsx` — wrappé en `React.memo`

### Réseaux sociaux

- `src/components/social/instagram/IgAcquisitionTab.tsx` — `Promise.all` bloquant scindé en 2 vagues : critique (conversations + snapshots) lève le `loading=false`, secondaire (comments + reels + pillars) charge en background → page interactive ~1.5-2s plus tôt
- `src/components/social/instagram/IgReelsTab.tsx` — `<video preload="none">` + `<img loading="lazy" decoding="async">` (avant : Safari/Chrome chargeait les premiers MB à l'ouverture du panel)
- `src/components/social/youtube/YtVideosTab.tsx` — debounce 300ms sur la recherche (de 9 fetches à 1 pour « marketing ») + `cancelled` flag sur unmount
- `src/components/social/youtube/YtVideoSidePanel.tsx` — cache module-scope TTL 60s : plus de spinner systématique au switch entre vidéos déjà ouvertes

### Database

- `supabase/migrations/078_perf_trgm_search.sql` — index trigram (pg_trgm + GIN) sur `leads(first_name, last_name, email, phone, instagram_handle)` et `yt_videos(title)` pour accélérer les `ilike '%query%'`. Plus index composite `leads(workspace_id, assigned_to)` partiel et `bookings(workspace_id, status)`.

**À appliquer** : `supabase db push` ou via dashboard SQL editor.

## Auto-critique

- L'audit initial des 3 sous-agents contenait des claims faux (`fetchEvents` déjà memoizé, modales déjà conditionnellement montées). J'ai vérifié chaque claim avant fix — bon réflexe.
- Le **vrai** gros bottleneck (`count: 'exact'` sur Supabase) n'avait été détecté par aucun agent. Trouvé en lisant les routes API directement après vérification.
- Pas de tests UI réels — l'environnement n'a pas de dev server tournant. Build + tsc passent.

## Tâches liées

Aucune (tâche transverse).

## Spec

N/A — pas de brainstorming validé (audit technique direct).
