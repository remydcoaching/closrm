# Spec — Type de calendrier (Setting / Closing / Autre)

> Date : 2026-04-08
> Statut : Validé
> Tâche liée : T-032 (booking-location-types) — extension

## Problème

Les calendriers de booking sont génériques. Quand un prospect réserve un créneau, le système ne sait pas si c'est un appel de setting, de closing, ou une séance coaching. Résultat : le lead ne change pas de statut dans le pipeline, et le RDV n'apparaît pas dans la vue Closing.

## Solution

Ajouter un champ `purpose` sur chaque calendrier de booking. Quand un booking est créé sur un calendrier de type "setting" ou "closing", un call est automatiquement créé et lié, le statut du lead avance dans le pipeline, et le RDV apparaît dans Closing.

## Changements

### 1. Migration SQL

Ajout du champ `purpose` sur `booking_calendars` :

```sql
ALTER TABLE booking_calendars
ADD COLUMN purpose text NOT NULL DEFAULT 'other'
CHECK (purpose IN ('setting', 'closing', 'other'));
```

### 2. Types TypeScript

```typescript
// Ajout dans src/types/index.ts
export type CalendarPurpose = 'setting' | 'closing' | 'other'

// Modification de BookingCalendar — ajout du champ :
purpose: CalendarPurpose
```

### 3. Validation Zod

Dans `src/lib/validations/booking-calendars.ts`, ajout :

```typescript
purpose: z.enum(['setting', 'closing', 'other']).default('other')
```

### 4. UI — Section "Objectif du calendrier"

Page : `src/app/(dashboard)/parametres/calendriers/[id]/page.tsx`

Nouvelle section dans la page d'édition du calendrier, avec 3 cards sélectionnables (même pattern visuel que le LocationEditor) :

| Valeur | Label | Description | Icône |
|--------|-------|-------------|-------|
| `setting` | Appel découverte | Qualification du prospect, premier contact | Phone |
| `closing` | Appel de closing | Appel de vente, conversion | PhoneCall |
| `other` | Autre | Coaching, suivi, mentoring... | Calendar |

Composant : `src/components/booking-calendars/PurposeEditor.tsx`

### 5. Logique — Création automatique de call

Quand un booking est créé (POST `/api/bookings` ou POST `/api/public/book/...`) et que le calendrier a `purpose = 'setting'` ou `'closing'` :

1. Créer un `call` dans la table `calls` :
   - `lead_id` = le lead lié au booking
   - `type` = `purpose` du calendrier (`'setting'` ou `'closing'`)
   - `scheduled_at` = `scheduled_at` du booking
   - `outcome` = `'pending'`
   - `attempt_number` = auto-incrémenté (logique existante)
   - `notes` = `"Via calendrier : {nom_du_calendrier}"`
2. Lier le call au booking : `UPDATE bookings SET call_id = {call.id}`
3. Mettre à jour le statut du lead :
   - `setting` → `setting_planifie`
   - `closing` → `closing_planifie`
4. Fire le trigger workflow `call_scheduled`

Si `purpose = 'other'` : aucune action supplémentaire.

Routes impactées :
- `src/app/api/bookings/route.ts` (POST)
- `src/app/api/public/book/[workspaceSlug]/[calendarSlug]/route.ts` (POST)

### 6. Synchro booking → call (annulation / no-show)

Quand le statut d'un booking change (PATCH `/api/bookings/[id]` et cron no-show) et que le booking a un `call_id` :

**Booking → no_show :**
- Call outcome → `no_show`
- Lead statut → `no_show_setting` ou `no_show_closing` (selon le type du call)
- Créer un follow-up automatique : raison "No-show RDV", date J+1, canal existant du workspace
- Fire trigger `call_no_show`

**Booking → cancelled :**
- Call outcome → `cancelled`
- Lead statut → **inchangé** (le prospect a annulé, il n'est pas absent)
- Créer un follow-up automatique : raison "RDV annulé — à relancer", date J+1
- Fire trigger `booking_cancelled`

**Booking re-créé (prospect re-réserve) :**
- Nouveau call créé (pas de réutilisation de l'ancien)
- Lead statut repasse à `setting_planifie` / `closing_planifie`

Routes impactées :
- `src/app/api/bookings/[id]/route.ts` (PATCH)
- `src/app/api/cron/workflow-scheduler/route.ts` (bloc no-show)

### 7. Closing — Affichage du nom du calendrier

Dans `src/app/(dashboard)/closing/closing-client.tsx`, afficher le nom du calendrier d'origine quand le call a été créé via un booking.

Pour récupérer cette info : joindre `calls → bookings (via call_id) → booking_calendars (via calendar_id)`.

Affichage sous le nom du lead :
```
Julie Petit
via Appel découverte
```

### 8. API publique — Retourner le purpose

Le GET `/api/public/book/[workspaceSlug]/[calendarSlug]` retourne déjà les infos du calendrier. Pas besoin d'exposer le `purpose` au prospect (c'est interne).

## Fichiers impactés (résumé)

| Fichier | Changement |
|---------|-----------|
| `supabase/migrations/0XX_calendar_purpose.sql` | Nouveau champ `purpose` |
| `src/types/index.ts` | Type `CalendarPurpose` + champ sur `BookingCalendar` |
| `src/lib/validations/booking-calendars.ts` | Ajout `purpose` au schéma Zod |
| `src/components/booking-calendars/PurposeEditor.tsx` | Nouveau composant — 3 cards |
| `src/app/(dashboard)/parametres/calendriers/[id]/page.tsx` | Section "Objectif" + state + save |
| `src/app/api/bookings/route.ts` | POST : créer call si setting/closing |
| `src/app/api/public/book/.../route.ts` | POST : créer call si setting/closing |
| `src/app/api/bookings/[id]/route.ts` | PATCH : synchro booking→call + follow-up |
| `src/app/api/cron/workflow-scheduler/route.ts` | No-show : synchro vers call + follow-up |
| `src/app/(dashboard)/closing/closing-client.tsx` | Afficher nom calendrier |
| `src/app/(dashboard)/closing/page.tsx` | Adapter query pour joindre booking/calendar |

## Hors scope

- Modification de la page Closing pour afficher des bookings au lieu des calls (potentiel V2)
- Création d'un calendrier directement depuis la page Closing
- Notifications push pour les no-show
