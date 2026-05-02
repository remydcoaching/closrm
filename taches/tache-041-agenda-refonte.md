# Tâche 041 — Refonte module agenda

## Objectif
Refondre le module agenda actuellement buggé et peu lisible.

## Contexte
Audit complet réalisé le 2026-05-02 (cf. conversation Claude). Bugs identifiés : overflow short events, z-index chaos, double fetch sur nav, sync GCal silencieuse, états vides absents, 0 mobile.

Recherche UX faite sur Notion Calendar, Linear, Cal.com, Vimcal, Amie, Fantastical → custom from scratch (`date-fns` + `dnd-kit`) plutôt que FullCalendar.

## Plan
13 phases. Phase 0 = quick fixes critiques déployables immédiatement.

| Phase | Quoi | Statut |
|---|---|---|
| 0 | Quick fixes (overflow, z-index, sync error toast, double fetch, empty state, +N click) | ✅ EN COURS |
| 1 | Wireframes + décision archi (custom vs Schedule-X) | À faire |
| 2 | Foundation (types/agenda.ts, lib/agenda/positioning.ts + tests, useAgendaData hook, design tokens) | À faire |
| 3a | Week view statique (route `agenda/v2`) | À faire |
| 3b | Week view interactif (click create, side panel détail) | À faire |
| 4 | Day + Month views | À faire |
| 5 | Sidebar mini-cal + filtres | À faire |
| 6 | Drag & drop (dnd-kit) | À faire |
| 7 | Mobile responsive | À faire |
| 8 | Cutover (renommer v2 → agenda, archive ancien) | À faire |

## Hors scope V1
- Cmd+K palette
- Natural language input
- Drag-to-resize
- GCal sync robuste (delete tracking, all-day, conflict resolution)

## Phase 0 — Bugs corrigés
- [x] BookingBlock : `min-width: 0` + `flex: 1` sur le titre short event → plus d'overflow
- [x] Z-index ladder centralisé dans `src/lib/agenda/z-index.ts`
- [x] Sync GCal : toast d'erreur visible (avant : `.catch(()=>{})` silencieux)
- [x] Double fetch sur nav : ref `didRefetchAfterSync` pour ne refetch qu'une fois post-sync
- [x] MonthView "+N autres" : devient un button qui ouvre la day view
- [x] Empty state si 0 calendrier connecté → CTA `/parametres/calendriers`
- [x] `tabular-nums` sur tous les affichages d'heures (lisibilité)

## Fichiers modifiés
- `src/components/agenda/BookingBlock.tsx`
- `src/components/agenda/MonthView.tsx`
- `src/app/(dashboard)/agenda/page.tsx`
- `src/lib/agenda/z-index.ts` (nouveau)
- `taches/tache-041-agenda-refonte.md` (nouveau)
