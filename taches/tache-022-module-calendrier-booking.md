# T-022 — Module Calendrier / Booking (type Calendly)

> **Priorité :** V1
> **Statut :** 🔄 En cours — code implémenté, migration SQL en attente d'exécution
> **Responsable :** Pierre
> **Branche :** `feature/pierre-automations`

---

## Spec

Fichier spec : `docs/superpowers/specs/2026-03-30-agenda-booking-design.md`

Décisions clés :
- Séparation `calls` (pipeline vente) vs `bookings` (RDV au sens large)
- Module Agenda dédié séparé de Closing
- Page de booking publique style Calendly (2 colonnes : calendrier + créneaux)
- Branding coach sur la page publique

## Plan d'implémentation

Fichier plan : `docs/superpowers/plans/2026-03-30-agenda-booking.md`

---

## Objectif

1. **Vue Agenda unifiée** dans le CRM (jour/semaine/mois) avec tous les RDV
2. **Système de booking type Calendly** — le coach crée des calendriers (types de prestation), chacun avec son propre lien public de prise de RDV

---

## Ce qui a été implémenté (2026-03-31)

### Base de données
- [x] Migration SQL : tables `workspace_slugs`, `booking_calendars`, `bookings` avec RLS
- [ ] **⚠️ BLOQUANT : Migration non exécutée dans Supabase** — Rémy doit exécuter la section 3 de `docs/sql-a-executer.md`

### Backend (API routes)
- [x] CRUD `/api/booking-calendars` (GET, POST, PATCH, DELETE)
- [x] CRUD `/api/bookings` (GET avec filtres, POST, PATCH, DELETE)
- [x] API publique `/api/public/book/[workspaceSlug]/[calendarSlug]` (GET créneaux + POST réservation)
- [x] API `/api/workspaces/slug` (GET + PUT pour le slug public)
- [x] Trigger workflow `booking_created` dans les deux routes (interne + public)

### Logique métier
- [x] Calcul de créneaux disponibles (`src/lib/bookings/availability.ts`)
- [x] Anti-double-booking (vérification overlap)
- [x] Création automatique de lead depuis la page de booking publique
- [x] Validations Zod complètes

### Frontend — Page Agenda (`/agenda`)
- [x] Vue Jour / Semaine / Mois avec toggle
- [x] Sidebar : mini-calendrier + légende des calendriers avec toggles
- [x] Navigation par date (◀ Aujourd'hui ▶)
- [x] Blocs RDV colorés par calendrier
- [x] Modale "Nouveau RDV" (calendrier ou événement perso)
- [x] Side panel détails avec changement de statut + suppression
- [x] Click sur créneau vide → nouveau RDV pré-rempli

### Frontend — Paramètres Calendriers (`/parametres/calendriers`)
- [x] Liste des calendriers avec cards (nom, durée, lieu, lien, toggle actif)
- [x] Éditeur de calendrier : général, disponibilités hebdo, champs formulaire
- [x] Lien de booking copiable

### Frontend — Page de booking publique (`/book/[slug]/[slug]`)
- [x] Page Calendly-style : branding coach + calendrier + créneaux
- [x] Formulaire dynamique (champs configurables)
- [x] Page de confirmation
- [x] Layout séparé (pas de sidebar/auth)

### Navigation
- [x] Sidebar : "Agenda" dans VENTES, "Calendriers" dans COMPTE

---

## Ce qui reste à faire

1. **⚠️ Exécuter la migration SQL dans Supabase** — BLOQUANT pour tester
2. Tester end-to-end une fois la migration exécutée
3. Configurer le slug du workspace dans les réglages (champ à ajouter dans la page réglages)
4. Connexion Google Agenda (V2 — dépend de T-015)

---

## Fichiers créés/modifiés

### Nouveaux fichiers (27)
- `supabase/migrations/002_booking_calendars.sql`
- `src/lib/validations/booking-calendars.ts`
- `src/lib/validations/bookings.ts`
- `src/lib/bookings/availability.ts`
- `src/app/api/booking-calendars/route.ts`
- `src/app/api/booking-calendars/[id]/route.ts`
- `src/app/api/bookings/route.ts`
- `src/app/api/bookings/[id]/route.ts`
- `src/app/api/public/book/[workspaceSlug]/[calendarSlug]/route.ts`
- `src/app/api/workspaces/slug/route.ts`
- `src/app/(dashboard)/agenda/page.tsx`
- `src/components/agenda/MiniCalendar.tsx`
- `src/components/agenda/AgendaSidebar.tsx`
- `src/components/agenda/DayView.tsx`
- `src/components/agenda/WeekView.tsx`
- `src/components/agenda/MonthView.tsx`
- `src/components/agenda/BookingBlock.tsx`
- `src/components/agenda/NewBookingModal.tsx`
- `src/components/agenda/BookingDetailPanel.tsx`
- `src/app/(dashboard)/parametres/calendriers/page.tsx`
- `src/app/(dashboard)/parametres/calendriers/[id]/page.tsx`
- `src/components/booking-calendars/CalendarCard.tsx`
- `src/components/booking-calendars/AvailabilityEditor.tsx`
- `src/components/booking-calendars/FormFieldsEditor.tsx`
- `src/app/book/layout.tsx`
- `src/app/book/[workspaceSlug]/[calendarSlug]/page.tsx`
- `src/app/book/[workspaceSlug]/[calendarSlug]/confirmation/page.tsx`

### Fichiers modifiés (3)
- `src/types/index.ts` — types BookingCalendar, Booking, etc.
- `src/components/layout/Sidebar.tsx` — ajout Agenda + Calendriers
- `src/lib/workflows/trigger.ts` — ajout trigger booking_created

---

*Mis à jour le 2026-03-31 — Pierre via Claude Code*
