# Agenda — Décisions architecturales Phase 1

> Décisions tranchées maintenant pour ne pas y revenir pendant les phases d'implémentation.

---

## D1 — Lib calendrier : custom from scratch

**Décision : custom rendering** avec `date-fns` + `@dnd-kit/*` + Radix primitives. Pas de FullCalendar, pas de Schedule-X.

**Pourquoi :**
- ClosRM vise un look Notion Calendar / Linear (dark dense, fill 10% + barre 3px). Aucune lib off-the-shelf ne donne ça sans 80% de surcharge CSS.
- Le scope du module est **simple** : week view + day view + month overview. Pas de gantt, pas de resources, pas de timeline. FullCalendar = 200kb pour 10× ce qu'on a besoin.
- `@dnd-kit/*` est déjà installé (utilisé dans le module PM Kanban) → DnD gratuit.
- `date-fns` déjà installé partout dans le repo.
- Pas de framer-motion : un re-render `setInterval(60s)` suffit pour le now-indicator. Les transitions panel/sidebar sont CSS pures.

**Risque :** ~3-4j de plus qu'avec Schedule-X, mais on a la cohérence design avec le reste de ClosRM (UpTrainer/Linear vibe, inline styles + CSS vars).

---

## D2 — Calls et bookings : fusion runtime, pas de migration DB

**Décision : on garde la fusion `calls → BookingWithCalendar` côté client**, isolée dans un hook `useAgendaData` au lieu d'être inline dans la page.

**Pourquoi :**
- Migrer `calls` dans `bookings` casserait le module Closing (qui utilise calls comme entité métier distincte avec `outcome`, `attempt_number`, `reached`, etc.)
- Bookings = RDV planifiés (acquisition / inbound). Calls = appels internes du pipeline (setting/closing). Sémantiquement différents.
- La fusion à l'affichage est légitime : "afficher tout ce qui occupe un créneau du coach". Mais elle doit être **isolée** dans une couche qui s'appelle clairement (hook ou util), pas mélangée avec le state UI.

**Implémentation Phase 2 :**
```ts
// src/lib/agenda/use-agenda-data.ts
useAgendaData({ viewMode, currentDate, visibleCalendarIds, showPersonal, showCalls })
  → { events: AgendaEvent[], loading, error, refetch }

// src/types/agenda.ts
type AgendaEvent =
  | { kind: 'booking', booking: BookingWithCalendar }
  | { kind: 'call', call: Call }
  | { kind: 'gcal_external', event: GoogleEvent }   // V2

// type discriminé → UI gère chaque kind explicitement, pas de coercion
```

**Bénéfice secondaire :** plus de bug `id: 'call-' + call.id` parsé à la main dans `confirmMove` pour split entre `/api/calls/[id]` vs `/api/bookings/[id]`. Le kind suffit.

---

## D3 — Pas de feature flag, route séparée temporaire

**Décision : implémenter dans `src/app/(dashboard)/agenda/v2/` pendant les phases 3-7. Au cutover (phase 8), renommer `agenda/` → `agenda/_old/` et `agenda/v2/` → `agenda/`.**

**Pourquoi :**
- Pas de double maintenance pendant 12j (fix d'un bug en deux endroits si feature flag).
- Permet à Pierre/Rémy de tester en parallèle sur l'URL `/agenda/v2` avant le swap.
- Pas de query param `?v=2` à laisser traîner.

**Sécurité du cutover :**
- Le dossier `_old/` reste 1-2 semaines après le swap pour rollback rapide si bug critique.
- Suppression définitive dans une PR séparée à J+14.

---

## D4 — Stack libs UI complémentaires

**À installer (Phase 2) :**
- `@radix-ui/react-popover` — pour le popover "+N autres" en MonthView, le mini-cal navigation, le quick create inline
- `cmdk` — pour la palette Cmd+K (V2, hors scope V1, mais on installe pour pas refaire le yak)

**Pas besoin :**
- `sonner` — on a déjà un toast inline simple (cf. Phase 0 syncError). Si on monte en charge sur les toasts, on installera plus tard.
- `framer-motion` — pas justifié pour un module CRM.
- `react-hotkeys-hook` — `addEventListener('keydown')` direct suffit, déjà utilisé dans la page actuelle.

---

## D5 — Design tokens CSS

**Décision : ajouter un bloc dédié dans `src/app/globals.css` pour les tokens agenda, sous le préfixe `--agenda-*`.**

```css
:root {
  /* Agenda — grid */
  --agenda-grid-line: rgba(255, 255, 255, 0.08);
  --agenda-grid-line-strong: rgba(255, 255, 255, 0.12);
  --agenda-today-bg: rgba(255, 255, 255, 0.02);

  /* Agenda — events */
  --agenda-event-fill-opacity: 0.10;       /* Notion Cal style */
  --agenda-event-bar-width: 3px;
  --agenda-event-radius: 4px;

  /* Agenda — now indicator */
  --agenda-now-color: var(--color-primary);
  --agenda-now-thickness: 2px;

  /* Agenda — slot dimensions */
  --agenda-slot-height: 32px;              /* 30min */
  --agenda-gutter-width: 56px;
  --agenda-allday-height: 24px;

  /* Agenda — z-index ladder (en complément de src/lib/agenda/z-index.ts) */
}
```

Les valeurs ci-dessus sont indicatives — à ajuster en Phase 3a sur le rendu réel.

---

## D6 — Pas de tests unitaires Vitest setup. Tests pures en `.test.ts` exécutés ad-hoc.

**Décision : pour les fonctions pures critiques (`computeOverlaps`, `slotToTime`, `eventToGridPosition`), un fichier `*.test.ts` co-localisé qui se lance manuellement avec `npx tsx file.test.ts`. Pas de framework.**

**Pourquoi :** ajouter Vitest = config Next.js 14 + jsdom + transformers + 30 min de yak. Pour 6-8 fonctions pures testables, un fichier qui assert + console.log + exit(1) on fail suffit. Si la dette de test grandit en V2, on installera Vitest à ce moment-là.

---

## D7 — Performance : pas de virtualization

**Décision : pas de react-window / react-virtual pour la V1.**

**Pourquoi :**
- Week view = 24h × 7j × ~3 events max par slot = ~500 events max théorique. En pratique <50.
- Month view = 42 cellules × max 4 events affichés (slice + overflow popover) = ~170 nodes. Aucun problème.
- Si un workspace dépasse 200 events sur la semaine visible, on virtualise à ce moment-là.

---

## D8 — Bookings ↔ GCal sync : V2

**Décision : la sync robuste GCal (delete tracking, all-day events, conflict resolution) reste hors scope V1.**

**Pourquoi :**
- Le but de la refonte est **lisibilité et stabilité d'affichage**, pas la fiabilité de sync.
- La sync actuelle marche pour les use cases courants (création/déplacement bookings). Les bugs identifiés (all-day skip, orphans) sont nuisance, pas blocage.
- Phase 0 a déjà ajouté un toast d'erreur visible — l'utilisateur sait au moins quand ça plante.

**À traiter en V1.5/V2** : tâche dédiée avec migration `gcal_event_tombstones` + reconciliation strategy.

---

## Récap : ce que la refonte va modifier vs garder

| Élément | Sort |
|---|---|
| `src/app/(dashboard)/agenda/page.tsx` | **Réécrit** (Phase 3-7) en orchestrant `useAgendaData` |
| `src/components/agenda/{Day,Week,Month}View.tsx` | **Réécrits** (Phase 3-4) |
| `src/components/agenda/BookingBlock.tsx` | **Remplacé** par `EventCard` générique (gère tous les `kind`) |
| `src/components/agenda/FilterPanel.tsx` | **Remplacé** par sidebar fixe gauche |
| `src/components/agenda/AgendaSidebar.tsx` | **Réécrit** (devient sidebar gauche complète avec mini-cal) |
| `src/components/agenda/BookingDetailPanel.tsx` | **Réécrit** en `EventDetailPanel` (multi-kind) |
| `src/components/agenda/NewBookingModal.tsx` | **Gardé tel quel V1** — réécriture en V1.5 si lisibilité demandée |
| `src/app/api/bookings/route.ts` | **Pas touché** |
| `src/app/api/integrations/google/sync/route.ts` | **Pas touché V1**, robustification V2 |
| Migrations Supabase | **Aucune** pour V1 |
