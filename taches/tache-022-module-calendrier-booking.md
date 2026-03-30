# T-022 — Module Calendrier / Booking (type Calendly)

> **Priorité :** Post-V1 (après toutes les implémentations en cours)
> **Statut :** ⬜ Non démarré
> **Responsable :** À assigner
> **Dépendances :** T-015 (Google Agenda), T-020 (Emails), T-014 (Automations)

---

## Objectif

Remplacer Calendly par un module intégré à ClosRM. Le coach crée des créneaux de disponibilité, génère un lien public, et les prospects/clients réservent eux-mêmes un RDV en choisissant date, heure et lieu.

---

## Fonctionnalités

### 1. Configuration côté coach

- **Créneaux de disponibilité** : définir ses plages horaires par jour de la semaine (ex : lundi 9h-12h, 14h-18h)
- **Durée des RDV** : configurable (30min, 45min, 1h, etc.)
- **Buffer entre RDV** : temps de pause entre deux bookings (ex : 15min)
- **Délai minimum de réservation** : ex. pas de booking à moins de 2h
- **Délai maximum** : ex. pas de booking à plus de 30 jours

### 2. Gestion des lieux

- **Créer plusieurs lieux** : nom + adresse (ex : "Fitness Park Bastille", "Fitness Park Nation", "Fitness Park Bercy")
- **Associer des lieux à un type de RDV** : le coach choisit quels lieux sont proposés pour quel créneau
- **Le prospect choisit le lieu** lors de la réservation
- **Lieu affiché dans l'agenda** du coach automatiquement

### 3. Page de réservation publique (lien partageable)

- **URL unique par coach** : ex. `app.closrm.com/book/pierre-dupont` ou lien avec token
- **Étapes pour le prospect :**
  1. Choisir le type de RDV (si plusieurs configurés)
  2. Choisir le lieu (si plusieurs lieux disponibles)
  3. Choisir la date (calendrier avec jours disponibles)
  4. Choisir l'heure (créneaux libres ce jour-là)
  5. Remplir ses infos (prénom, nom, email, téléphone)
  6. Confirmation
- **Responsive** (mobile-first, les prospects viennent souvent des ads sur mobile)
- **Design brandé** : couleurs du coach / nom du workspace

### 4. Intégrations automatiques

- **Google Agenda (T-015)** : le RDV apparaît automatiquement dans l'agenda du coach
- **Création lead automatique** : si le prospect n'existe pas dans la base → créé comme nouveau lead
- **Si lead existant** : rattacher le RDV au lead existant (match par email ou téléphone)
- **Emails de confirmation (T-020)** : email auto au prospect avec détails du RDV
- **Rappels automatiques (T-014)** : déclencher les automations de rappel RDV (WhatsApp/Email)
- **Statut lead** : passe automatiquement en `setting_planifie` ou `closing_planifie`

### 5. Gestion des réservations

- **Vue liste des bookings** dans le CRM (à venir, passés, annulés)
- **Annulation par le prospect** : lien dans l'email de confirmation
- **Reprogrammation** : le prospect peut changer de créneau
- **Notification au coach** : notification temps réel quand quelqu'un réserve (WhatsApp/Telegram)

---

## Tables Supabase (à créer)

```sql
-- Lieux de coaching
booking_locations (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  name TEXT NOT NULL,           -- "Fitness Park Bastille"
  address TEXT,                 -- adresse complète
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ
)

-- Types de RDV configurés par le coach
booking_types (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  name TEXT NOT NULL,           -- "Appel découverte", "Séance coaching"
  duration_minutes INT NOT NULL, -- 30, 45, 60
  buffer_minutes INT DEFAULT 0,
  min_notice_hours INT DEFAULT 2,
  max_advance_days INT DEFAULT 30,
  location_ids UUID[],          -- lieux disponibles pour ce type
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ
)

-- Disponibilités hebdomadaires
booking_availability (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  booking_type_id UUID REFERENCES booking_types(id),
  day_of_week INT NOT NULL,     -- 0=dimanche, 1=lundi, ...
  start_time TIME NOT NULL,
  end_time TIME NOT NULL
)

-- Réservations
bookings (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  booking_type_id UUID REFERENCES booking_types(id),
  location_id UUID REFERENCES booking_locations(id),
  lead_id UUID REFERENCES leads(id),
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'confirmed', -- confirmed, cancelled, rescheduled, completed
  cancel_token UUID DEFAULT gen_random_uuid(),
  google_event_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ
)
```

---

## Routes

```
app/
├── book/
│   └── [slug]/page.tsx         # Page publique de réservation (pas de layout dashboard)
├── (dashboard)/
│   ├── calendrier/
│   │   ├── page.tsx            # Vue des bookings + config
│   │   └── disponibilites/     # Config créneaux + lieux
└── api/
    ├── bookings/
    │   ├── route.ts            # GET (liste) + POST (créer depuis page publique)
    │   └── [id]/route.ts       # PATCH (modifier) + DELETE (annuler)
    ├── booking-types/
    │   └── route.ts            # CRUD types de RDV
    ├── booking-locations/
    │   └── route.ts            # CRUD lieux
    └── booking-availability/
        └── route.ts            # CRUD disponibilités
```

---

## Notes

- Ce module arrive **après** toutes les tâches V1 en cours
- Dépend fortement de Google Agenda (T-015), Emails (T-020) et Automations (T-014)
- La page publique `/book/[slug]` est hors du layout dashboard (accessible sans auth)
- RLS : les bookings sont liés au workspace_id du coach, la page publique utilise une API route avec le service role key

---

*Créé le 2026-03-30 — ClosRM*
