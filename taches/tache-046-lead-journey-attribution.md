# Tâche 046 — Lead Journey : dédup + attribution + parcours

**Statut** : implémenté, en attente de test utilisateur sur localhost:3100
**Branche** : `feature/pierre-lead-journey`
**Worktree** : `/Users/pierrerebmann/closrm-lead-journey`

## Contexte

Le coach voyait **2 leads** créés pour la même personne :
1. Lead form Meta (via webhook Meta) → premier prospect
2. Page calendrier publique → deuxième prospect

De plus :
- Les réponses aux questions personnalisées du Lead Form Meta étaient **jetées** par `parseLeadFields`.
- Les réponses aux questions du calendrier (`bookings.form_data`) étaient **invisibles** sur la fiche lead.
- Pas de tracking first-touch / last-touch (attribution publicitaire). Le `meta_ad_id` stocké correspondait uniquement à la pub qui a déclenché l'ouverture du formulaire.

## Décisions

- **Dédup normalisée** : helper `findExistingLeadId` qui matche par email lowercase (ilike) puis par téléphone normalisé E.164 (last 9 digits + filtre mémoire). Utilisé partout : webhook Meta, 2 endpoints booking, funnel submit.
- **`leads.visitor_id`** : colonne nouvelle, remplie au `form_submit` funnel. Sert de pont entre les events anonymes (cookie) et le lead identifié.
- **`leads.form_answers`** : JSONB qui stocke toutes les réponses Meta + funnel custom (pas que les 4 standards).
- **Capture URL params** : `FunnelTracker` + `tracking.ts` lisent `fbclid`, `gclid`, `utm_*`, `ad_id`, `referrer`, `landing_path` à chaque `view` event et les rangent dans `funnel_events.metadata`.
- **First/last touch dérivés** : pas de colonne dédiée. L'API journey calcule à la volée le premier et le dernier event qui contient une clé d'attribution.

## Fichiers créés / modifiés

- `supabase/migrations/083_lead_journey_tracking.sql` — ajoute `leads.visitor_id`, `leads.form_answers`, index.
- `src/lib/leads/identity.ts` — `normalizeEmail`, `normalizePhone`, `findExistingLeadId`.
- `src/app/api/webhooks/meta/route.ts` — dédup + stockage `form_answers` + notes custom Q/A.
- `src/app/api/public/booking/[calendarId]/route.ts` — dédup via helper.
- `src/app/api/public/book/[workspaceSlug]/[calendarSlug]/route.ts` — dédup via helper.
- `src/app/api/public/f/submit/route.ts` — dédup via helper, `visitor_id` rempli à la création.
- `src/components/funnels/FunnelTracker.tsx` — capture `fbclid`/`utm_*`/`referrer` au view.
- `src/lib/funnels/tracking.ts` — idem côté script embarqué.
- `src/app/api/leads/[id]/journey/route.ts` — nouvel endpoint qui agrège lead + bookings + funnel_events + first/last touch.
- `src/components/leads/LeadJourneyBlock.tsx` — UI : pavés attribution + réponses Meta + réponses bookings + timeline.
- `src/app/(dashboard)/leads/[id]/page.tsx` — branchement du bloc parcours.
- `TEST_LEAD_JOURNEY.md` — guide de test (à la racine du worktree).

## Tâches liées

- Tâche 045 — Multi-day events agenda (en cours, branche séparée)
- Tâche 026 — Followers as prospects

## À tester avant de merger

Voir `TEST_LEAD_JOURNEY.md` à la racine du worktree.

## Limites connues

- Le path Meta Instant Lead Form ne déclenche pas le cookie funnel (le formulaire est hébergé chez Meta). Pour ces leads, l'attribution reste celle du webhook (1 seul `meta_ad_id`).
- La dédup est best-effort : si l'utilisateur soumet 2 emails *réellement* différents, on ne peut pas merger automatiquement. Prévoir un merge manuel UI plus tard.
- Le helper de matching téléphone est calibré pour la France (heuristique `0X… → +33X…`). Étendre aux autres pays = ouvrir un champ `country_code` ou utiliser `libphonenumber-js`.
