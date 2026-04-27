# T-039 — Fix mail de confirmation RDV non envoyé (public booking)

**Auteur :** Pierre
**Date :** 2026-04-27
**Statut :** ✅ Terminé

## Problème

Quand un prospect réservait un RDV via un lien public ClosRM (`/api/public/book/[workspaceSlug]/[calendarSlug]` ou `/api/public/booking/[calendarId]`), il **ne recevait jamais le mail de confirmation**.

## Cause

Les 4 appels à `sendBookingConfirmationEmail()` côté public booking n'incluaient pas le champ `workspaceId`. Conséquence :
- `getWorkspaceSenderConfig()` n'était pas appelé → fallback sur `noreply@closrm.fr`
- Domaine `closrm.fr` non vérifié dans SES outbound → SES rejette l'envoi
- L'erreur était silencieusement avalée par `.catch(() => {})`

## Fix

1. Ajout de `workspaceId: calendar.workspace_id` dans les 4 call sites
2. Remplacement de `.catch(() => {})` par un `console.error` pour ne plus masquer les futures erreurs

## Fichiers modifiés

- `src/app/api/public/book/[workspaceSlug]/[calendarSlug]/route.ts` (2 call sites)
- `src/app/api/public/booking/[calendarId]/route.ts` (2 call sites)

## Tâches liées

- T-038 (fix navigation pages email)
