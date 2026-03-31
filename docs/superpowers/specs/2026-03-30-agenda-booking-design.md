# Agenda & Système de Booking — Spec Design

> Date : 2026-03-30
> Auteur : Pierre
> Statut : Draft

---

## Contexte

ClosRM a un module Closing existant (pipeline d'appels setting/closing) avec une vue calendrier basique par semaine. Le besoin est double :

1. **Vue Agenda unifiée** — une vraie page calendrier (jour/semaine/mois) montrant TOUS les RDV de tous types, incluant les événements Google Agenda synchronisés. Prévu pour se connecter à Google Agenda à terme.
2. **Système de booking (type Calendly)** — le coach peut créer plusieurs "calendriers" (= types de prestation), chacun avec son propre lien public de prise de RDV, ses disponibilités, et son formulaire configurable.

---

## Architecture

### Approche retenue : Module Agenda dédié

- **Agenda** = vue calendrier unifiée (interne, dans le CRM)
- **Closing** = reste focalisé sur le pipeline de vente (appels setting/closing)
- **Booking Calendars** = configuration des types de prestation (dans Paramètres)
- **Pages de booking** = pages publiques pour la prise de RDV client

La séparation `calls` / `bookings` est maintenue :
- `calls` → pipeline de vente (attempt_number, reached, outcome, transitions de statut lead)
- `bookings` → RDV au sens large (coaching, événements perso, etc.)
- Pont : un booking de type setting/closing crée aussi un `call` dans le pipeline

---

## Modèle de données

### Table `booking_calendars`

```sql
create table booking_calendars (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,                    -- "Coaching présentiel Schiltigheim"
  slug text not null,                    -- "coaching-schiltigheim" (unique par workspace)
  description text,                      -- Description affichée au client
  duration_minutes integer not null default 60,
  location text,                         -- Adresse ou "Visio"
  color text not null default '#3b82f6', -- Couleur dans l'agenda
  form_fields jsonb not null default '[]',
  availability jsonb not null default '{}',
  buffer_minutes integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(workspace_id, slug)
);
```

**`form_fields` format :**
```json
[
  { "key": "first_name", "label": "Prénom", "type": "text", "required": true },
  { "key": "last_name", "label": "Nom", "type": "text", "required": true },
  { "key": "phone", "label": "Téléphone", "type": "tel", "required": true },
  { "key": "email", "label": "Email", "type": "email", "required": true },
  { "key": "message", "label": "Message", "type": "textarea", "required": false }
]
```

**`availability` format :**
```json
{
  "monday": [{ "start": "09:00", "end": "12:00" }, { "start": "14:00", "end": "18:00" }],
  "tuesday": [{ "start": "10:00", "end": "17:00" }],
  "wednesday": [],
  "thursday": [{ "start": "09:00", "end": "18:00" }],
  "friday": [{ "start": "09:00", "end": "16:00" }],
  "saturday": [],
  "sunday": []
}
```

### Table `bookings`

```sql
create table bookings (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  calendar_id uuid references booking_calendars(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  call_id uuid references calls(id) on delete set null,
  title text not null,                   -- Auto-généré ou personnalisé
  scheduled_at timestamptz not null,
  duration_minutes integer not null,
  status text not null default 'confirmed'
    check (status in ('confirmed', 'cancelled', 'no_show', 'completed')),
  source text not null default 'manual'
    check (source in ('booking_page', 'manual', 'google_sync')),
  form_data jsonb default '{}',          -- Réponses formulaire client
  notes text,
  google_event_id text,                  -- Pour sync Google Agenda
  is_personal boolean not null default false,
  created_at timestamptz default now()
);
```

### Table `workspace_slugs` (pour les URLs publiques)

```sql
create table workspace_slugs (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  slug text not null unique              -- "pierre-rebmann" pour /book/pierre-rebmann/...
);
```

### RLS Policies

Toutes les nouvelles tables suivent le pattern existant :
```sql
-- booking_calendars & bookings
for all using (
  workspace_id in (select id from workspaces where owner_id = auth.uid())
);

-- workspace_slugs
for all using (
  workspace_id in (select id from workspaces where owner_id = auth.uid())
);
```

Les routes publiques (`/api/public/book/*`) utilisent le service role key (pas d'auth client).

---

## Routes

### Pages internes (dashboard)

| Route | Description |
|-------|-------------|
| `/agenda` | Vue calendrier unifiée (jour/semaine/mois) avec sidebar |
| `/parametres/calendriers` | CRUD des types de prestation |
| `/parametres/calendriers/[id]` | Édition d'un calendrier |

### Pages publiques (booking) — layout séparé, sans sidebar, sans auth

| Route | Description |
|-------|-------------|
| `/book/[workspace-slug]/[calendar-slug]` | Page de prise de RDV publique |
| `/book/[workspace-slug]/[calendar-slug]/confirmation` | Confirmation après réservation |

### API routes (authentifiées)

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/booking-calendars` | GET | Liste des calendriers du workspace |
| `/api/booking-calendars` | POST | Créer un calendrier |
| `/api/booking-calendars/[id]` | GET | Détails d'un calendrier |
| `/api/booking-calendars/[id]` | PATCH | Modifier un calendrier |
| `/api/booking-calendars/[id]` | DELETE | Supprimer un calendrier |
| `/api/bookings` | GET | Liste des bookings (filtres : date_range, calendar_id, status) |
| `/api/bookings` | POST | Créer un booking manuellement |
| `/api/bookings/[id]` | PATCH | Modifier un booking |
| `/api/bookings/[id]` | DELETE | Supprimer un booking |

### API routes (publiques, sans auth)

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/public/book/[workspace-slug]/[calendar-slug]` | GET | Créneaux disponibles pour un mois donné |
| `/api/public/book/[workspace-slug]/[calendar-slug]` | POST | Créer une réservation |

---

## Sidebar — Navigation

```
VENTES
├── Dashboard
├── Agenda              ← NOUVEAU
├── Leads
├── Closing
├── Follow-ups
├── Statistiques
└── Base de données

ACQUISITION
├── Automations
└── Publicités

COMPTE
├── Paramètres
├── Intégrations
└── Calendriers         ← NOUVEAU
```

---

## Page Agenda (`/agenda`)

### Layout

Sidebar gauche (240px) + zone principale calendrier.

**Sidebar gauche :**
- Mini-calendrier mensuel cliquable (cliquer un jour → vue jour)
- Liste des booking_calendars avec pastille couleur + checkbox toggle (filtrer)
- Section "Google Agenda" si connecté (toggle pour afficher/masquer)

**Zone principale :**
- Header : toggle Jour / Semaine / Mois + navigation date (◀ Aujourd'hui ▶) + bouton "+ Nouveau RDV"
- Grille horaire : blocs colorés par calendrier

### Vues

**Vue Jour :** Grille horaire verticale (8h-21h), une colonne. Blocs de RDV avec couleur du calendrier.

**Vue Semaine :** 7 colonnes (lun-dim), grille horaire. Comme Google Agenda.

**Vue Mois :** Grille de cases, chaque case montre les RDV du jour (résumé). Click sur un jour → bascule en vue jour.

### Données affichées par bloc RDV

- Couleur du calendrier (ou gris pour événements perso/Google)
- Nom du lead (ou titre si événement perso)
- Nom du calendrier en petit
- Icône lieu si lieu défini

### Interactions

- **Click créneau vide** → Modale "Nouveau RDV"
- **Click sur un booking** → Side panel détails (lead, calendrier, statut, notes, actions)
- **Drag & drop** → V2 (déplacer un RDV)

### Modale "Nouveau RDV"

Champs :
- **Type** : dropdown des booking_calendars + option "Événement personnel"
- Si calendrier → **Lead** : recherche/sélection lead existant ou création rapide (nom + tél)
- Si événement perso → **Titre** : champ texte libre
- **Date/heure** : pré-remplie avec le créneau cliqué
- **Durée** : pré-remplie depuis le calendrier, modifiable
- **Notes** : textarea optionnel

Comportement à la création :
- Crée un `booking` dans la base
- Si le calendrier correspond à un type setting/closing → crée aussi un `call` et met à jour le statut du lead
- Fire les workflow triggers (`booking_created`)

---

## Page Calendriers (`/parametres/calendriers`)

### Liste

Cards avec :
- Nom + pastille couleur
- Durée + lieu
- Lien de booking (bouton copier)
- Toggle actif/inactif
- Bouton modifier / supprimer

Bouton "+ Nouveau calendrier" en haut.

### Édition d'un calendrier (`/parametres/calendriers/[id]`)

**Section 1 — Général :**
- Nom, slug (auto-généré depuis le nom, éditable), description
- Durée (minutes), lieu (texte libre), couleur (color picker)
- Buffer entre RDV (minutes)

**Section 2 — Disponibilités :**
- Grille semaine : pour chaque jour, liste de plages horaires
- Bouton "+ Ajouter une plage" par jour
- Toggle "Fermé" par jour

**Section 3 — Formulaire :**
- Liste des champs avec label, type (text/tel/email/textarea), requis (toggle)
- Champs par défaut : Prénom, Nom, Téléphone, Email
- Bouton "+ Ajouter un champ" pour des champs custom

**Section 4 — Lien de booking :**
- URL publique affichée : `closrm.app/book/[workspace-slug]/[calendar-slug]`
- Bouton copier
- Aperçu en miniature de la page

---

## Page de Booking Publique (`/book/[workspace-slug]/[calendar-slug]`)

### Branding

- Logo ou initiales du coach (depuis `avatar_url` ou fallback initiales)
- Nom du workspace
- Couleur d'accent du workspace (à ajouter dans workspaces si besoin)

### Layout — Style Calendly

**Header :** Logo/initiales + nom coach + nom de la prestation + durée + lieu

**Corps (2 colonnes) :**
- **Gauche :** Calendrier mensuel. Jours avec créneaux dispos en blanc, jours complets en gris. Navigation mois ◀ ▶.
- **Droite :** Liste des créneaux horaires pour le jour sélectionné. Click sur un créneau → sélectionné (highlight rouge).

**Après sélection d'un créneau :**
- Le formulaire apparaît (champs configurés dans le calendrier)
- Bouton "Confirmer le rendez-vous"

**Après confirmation :**
- Page de confirmation avec récap (date, heure, lieu, prestation)
- Message "Vous recevrez un email de confirmation" (si email dans le formulaire)

### Calcul des créneaux disponibles

1. Récupérer les plages horaires du jour depuis `availability`
2. Générer des créneaux selon la durée du calendrier (ex: toutes les 60min)
3. Soustraire les bookings existants du même workspace qui chevauchent
4. Soustraire les événements Google Agenda (si connecté, V2)
5. Appliquer le buffer_minutes entre chaque créneau
6. Ne pas afficher les créneaux dans le passé

### Anti-double-booking

Lors de la création d'un booking via la page publique :
1. Vérifier en base qu'aucun booking ne chevauche le créneau demandé (workspace-wide)
2. Si conflit → erreur "Ce créneau n'est plus disponible"
3. Transaction SQL pour éviter les race conditions

---

## Intégration avec l'existant

### Lien Booking → Call

Quand un booking est créé avec un calendrier de type setting/closing :
- Créer automatiquement un `call` correspondant
- Stocker `call_id` dans le booking
- Mettre à jour le statut du lead (`setting_planifie` ou `closing_planifie`)
- Le booking et le call restent synchronisés (annuler l'un annule l'autre)

### Nouveau trigger workflow

Ajouter `booking_created` comme trigger dans le système de workflows existant :
- Données context : lead, calendrier, date, lieu
- Permet de configurer des emails/WhatsApp de confirmation automatiques

### Workspace slug

Ajouter une table `workspace_slugs` pour les URLs publiques. Le slug est configuré par le coach dans Paramètres > Réglages (champ existant à ajouter).

---

## Types TypeScript à ajouter

```typescript
type BookingCalendar = {
  id: string
  workspace_id: string
  name: string
  slug: string
  description: string | null
  duration_minutes: number
  location: string | null
  color: string
  form_fields: FormField[]
  availability: WeekAvailability
  buffer_minutes: number
  is_active: boolean
  created_at: string
  updated_at: string
}

type FormField = {
  key: string
  label: string
  type: 'text' | 'tel' | 'email' | 'textarea' | 'select'
  required: boolean
  options?: string[] // pour type 'select'
}

type WeekAvailability = {
  monday: TimeSlot[]
  tuesday: TimeSlot[]
  wednesday: TimeSlot[]
  thursday: TimeSlot[]
  friday: TimeSlot[]
  saturday: TimeSlot[]
  sunday: TimeSlot[]
}

type TimeSlot = {
  start: string // "09:00"
  end: string   // "12:00"
}

type Booking = {
  id: string
  workspace_id: string
  calendar_id: string | null
  lead_id: string | null
  call_id: string | null
  title: string
  scheduled_at: string
  duration_minutes: number
  status: 'confirmed' | 'cancelled' | 'no_show' | 'completed'
  source: 'booking_page' | 'manual' | 'google_sync'
  form_data: Record<string, string>
  notes: string | null
  google_event_id: string | null
  is_personal: boolean
  created_at: string
}

type BookingStatus = 'confirmed' | 'cancelled' | 'no_show' | 'completed'
type BookingSource = 'booking_page' | 'manual' | 'google_sync'
```

---

## Fichiers à créer/modifier

### Nouveaux fichiers

- `supabase/migrations/002_booking_calendars.sql` — migration DB
- `src/types/index.ts` — ajouter types BookingCalendar, Booking, etc.
- `src/lib/validations/booking-calendars.ts` — schemas Zod
- `src/lib/validations/bookings.ts` — schemas Zod
- `src/lib/bookings/availability.ts` — calcul des créneaux dispos
- `src/app/api/booking-calendars/route.ts` — CRUD calendriers
- `src/app/api/booking-calendars/[id]/route.ts` — CRUD calendrier
- `src/app/api/bookings/route.ts` — CRUD bookings
- `src/app/api/bookings/[id]/route.ts` — CRUD booking
- `src/app/api/public/book/[workspaceSlug]/[calendarSlug]/route.ts` — API publique
- `src/app/(dashboard)/agenda/page.tsx` — page Agenda
- `src/app/(dashboard)/parametres/calendriers/page.tsx` — liste calendriers
- `src/app/(dashboard)/parametres/calendriers/[id]/page.tsx` — édition calendrier
- `src/app/book/[workspaceSlug]/[calendarSlug]/page.tsx` — page booking publique
- `src/app/book/[workspaceSlug]/[calendarSlug]/confirmation/page.tsx` — confirmation
- `src/components/agenda/AgendaCalendar.tsx` — composant calendrier principal
- `src/components/agenda/AgendaSidebar.tsx` — sidebar mini-cal + légende
- `src/components/agenda/MiniCalendar.tsx` — mini calendrier mensuel
- `src/components/agenda/BookingBlock.tsx` — bloc RDV dans la grille
- `src/components/agenda/NewBookingModal.tsx` — modale nouveau RDV
- `src/components/agenda/BookingDetailPanel.tsx` — side panel détails
- `src/components/booking-calendars/CalendarCard.tsx` — card dans la liste
- `src/components/booking-calendars/CalendarForm.tsx` — formulaire édition
- `src/components/booking-calendars/AvailabilityEditor.tsx` — éditeur dispo semaine
- `src/components/booking-calendars/FormFieldsEditor.tsx` — éditeur champs formulaire
- `src/components/booking/BookingPage.tsx` — page publique composant
- `src/components/booking/SlotPicker.tsx` — sélecteur de créneaux
- `src/components/booking/BookingForm.tsx` — formulaire client

### Fichiers existants à modifier

- `src/components/layout/Sidebar.tsx` — ajouter Agenda + Calendriers
- `src/types/index.ts` — ajouter les nouveaux types
- `src/lib/workflows/trigger.ts` — ajouter trigger `booking_created`

---

## Vérification

### Tests manuels

1. Créer un calendrier "Coaching Schiltigheim" avec dispo lundi-vendredi 9h-18h
2. Vérifier que le lien public fonctionne et montre les bons créneaux
3. Réserver un RDV en tant que client → vérifier qu'il apparaît dans l'Agenda
4. Créer un RDV manuellement depuis l'Agenda → vérifier qu'il apparaît
5. Créer un événement perso → vérifier qu'il apparaît en gris
6. Vérifier l'anti-double-booking : réserver le même créneau 2 fois → erreur
7. Vérifier les vues jour/semaine/mois
8. Vérifier que le mini-calendrier navigue correctement
9. Tester le toggle des calendriers dans la sidebar (filtrage)

### Build

```bash
npm run build
```
Pas d'erreur TypeScript, pas de warnings.
