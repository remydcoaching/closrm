# Spec — Relances calendrier (rappels avant RDV)

> Date : 2026-04-08
> Statut : Validé
> Tâche liée : T-033

## Problème

Les coaches doivent créer des workflows séparés pour envoyer des rappels avant les RDV. C'est peu intuitif. Il faudrait pouvoir configurer les rappels directement dans chaque calendrier de booking.

## Solution

Ajouter un champ `reminders` (JSONB) sur chaque calendrier. Le coach configure autant de rappels qu'il veut (délai + canal + message). À la création d'un booking, les rappels sont "matérialisés" dans une table `booking_reminders` avec la date d'envoi calculée. Un bloc cron envoie les rappels et notifie le coach si ça échoue.

## Types

### CalendarReminder (config sur le calendrier)

```typescript
interface CalendarReminder {
  id: string              // UUID, généré côté client à l'ajout
  delay_value: number     // ex: 1, 2, 24
  delay_unit: 'hours' | 'days'
  at_time: string | null  // "09:00" optionnel — si null, relatif à l'heure du RDV
  channel: 'email' | 'whatsapp' | 'instagram_dm'
  message: string         // template avec {{prenom}}, {{date_rdv}}, {{heure_rdv}}, {{nom_calendrier}}
}
```

### BookingReminder (instance matérialisée par booking)

```typescript
interface BookingReminder {
  id: string
  workspace_id: string
  booking_id: string
  lead_id: string
  channel: 'email' | 'whatsapp' | 'instagram_dm'
  message: string         // message résolu (variables remplacées)
  send_at: string         // ISO datetime — quand envoyer
  status: 'pending' | 'sent' | 'failed' | 'cancelled'
  error: string | null
  created_at: string
}
```

## Migration SQL

```sql
-- Champ reminders sur booking_calendars
ALTER TABLE booking_calendars
ADD COLUMN reminders jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Table des rappels matérialisés
CREATE TABLE booking_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp', 'instagram_dm')),
  message text NOT NULL,
  send_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  error text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_booking_reminders_pending ON booking_reminders (send_at)
  WHERE status = 'pending';

CREATE INDEX idx_booking_reminders_booking ON booking_reminders (booking_id);

-- RLS
ALTER TABLE booking_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their workspace booking_reminders"
  ON booking_reminders FOR ALL
  USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()));
```

## Calcul de send_at

Pour chaque reminder du calendrier, à la création d'un booking :

```
Si at_time est défini (ex: "09:00") :
  send_at = (date du RDV - delay_value jours) à at_time
  Exemple : RDV le 15/04 à 14:00, delay=1 day, at_time="09:00"
  → send_at = 14/04 à 09:00

Si at_time est null :
  send_at = scheduled_at du booking - delay (en heures ou jours)
  Exemple : RDV le 15/04 à 14:00, delay=2 hours
  → send_at = 15/04 à 12:00
```

Si `send_at` est dans le passé (booking créé trop tard), le rappel n'est PAS créé.

## Résolution des variables dans le message

Avant de stocker le `message` dans `booking_reminders`, les variables sont résolues :

| Variable | Valeur |
|----------|--------|
| `{{prenom}}` | lead.first_name |
| `{{nom}}` | lead.last_name |
| `{{date_rdv}}` | date formatée du booking (ex: "mardi 15 avril 2026") |
| `{{heure_rdv}}` | heure du booking (ex: "14:00") |
| `{{nom_calendrier}}` | nom du calendrier |

## Logique d'envoi (cron)

Nouveau bloc dans `workflow-scheduler/route.ts` :

1. Chercher les `booking_reminders` où `status = 'pending'` et `send_at <= now()`
2. Pour chaque rappel :
   a. Charger le lead (email, phone, instagram_handle)
   b. Envoyer via le canal :
      - `email` → `sendEmail()` avec le message
      - `whatsapp` → `sendWhatsAppMessage()` avec le message
      - `instagram_dm` → `sendIgMessage()` via la conversation liée au lead
   c. Si succès → `status = 'sent'`
   d. Si erreur → `status = 'failed'`, `error = message d'erreur`
      → Envoyer une notification au coach : "Rappel échoué pour {prenom} {nom} — {raison}"
3. Compteur `reminders_sent` dans la réponse du cron

## Annulation / Reprogrammation

### Booking annulé (status → cancelled)
Dans `PATCH /api/bookings/[id]` :
```sql
UPDATE booking_reminders SET status = 'cancelled'
WHERE booking_id = {id} AND status = 'pending'
```

### Booking reprogrammé (scheduled_at change)
Dans `PATCH /api/bookings/[id]` :
1. Supprimer les rappels `pending` existants
2. Recréer les rappels avec la nouvelle date (même logique que la création)

Pour recréer, il faut relire les `reminders` du calendrier lié au booking. Le `calendar_id` est sur le booking.

## UI — RemindersEditor

### Composant : `src/components/booking-calendars/RemindersEditor.tsx`

Props :
```typescript
interface RemindersEditorProps {
  reminders: CalendarReminder[]
  onChange: (reminders: CalendarReminder[]) => void
}
```

Affichage :
- Liste de cards, chaque card contient :
  - Ligne 1 : Délai (input number + select heures/jours) + heure optionnelle (input time, placeholder "Heure du RDV")
  - Ligne 2 : Canal (select email/whatsapp/instagram DM)
  - Ligne 3 : Message (textarea, pré-rempli par défaut)
  - Bouton supprimer (X)
- Bouton "+ Ajouter un rappel" en bas (style dashed border)
- Messages par défaut selon le canal :
  - Email : "Bonjour {{prenom}}, rappel : votre rendez-vous {{nom_calendrier}} est prévu le {{date_rdv}} à {{heure_rdv}}."
  - WhatsApp : "Bonjour {{prenom}}, petit rappel pour votre RDV de {{heure_rdv}} le {{date_rdv}}. À bientôt !"
  - Instagram DM : "Hey {{prenom}} ! Rappel pour ton RDV de {{heure_rdv}} le {{date_rdv}}."

### Section dans la page calendrier

Dans `src/app/(dashboard)/parametres/calendriers/[id]/page.tsx`, nouvelle section après "Objectif du calendrier" :

```tsx
<div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 14, padding: 24 }}>
  <h3>Rappels automatiques</h3>
  <RemindersEditor reminders={reminders} onChange={setReminders} />
</div>
```

## Validation Zod

Dans `src/lib/validations/booking-calendars.ts` :

```typescript
const calendarReminderSchema = z.object({
  id: z.string().uuid(),
  delay_value: z.number().int().min(1).max(365),
  delay_unit: z.enum(['hours', 'days']),
  at_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().default(null),
  channel: z.enum(['email', 'whatsapp', 'instagram_dm']),
  message: z.string().min(1).max(1000),
})

// Ajout dans createBookingCalendarSchema :
reminders: z.array(calendarReminderSchema).default([])
```

## Fichiers impactés

| Fichier | Changement |
|---------|-----------|
| `supabase/migrations/021_booking_reminders.sql` | JSONB reminders + table booking_reminders + indexes + RLS |
| `src/types/index.ts` | Types `CalendarReminder`, `BookingReminder` |
| `src/lib/validations/booking-calendars.ts` | Ajout `reminders` au schéma Zod |
| `src/components/booking-calendars/RemindersEditor.tsx` | Nouveau composant UI |
| `src/app/(dashboard)/parametres/calendriers/[id]/page.tsx` | Section rappels + state + save |
| `src/app/api/bookings/route.ts` | Créer booking_reminders à la création du booking |
| `src/app/api/public/book/.../route.ts` | Idem côté public |
| `src/app/api/bookings/[id]/route.ts` | Annuler/recalculer rappels (cancel + reschedule) |
| `src/app/api/cron/workflow-scheduler/route.ts` | Nouveau bloc envoi rappels + notif coach si échec |

## Hors scope

- Envoi de rappels par Telegram (pas un canal de communication avec les leads)
- Personnalisation des rappels par booking (c'est par calendrier)
- Historique des rappels envoyés dans l'UI (V2)
- Vérification de la fenêtre 24h Instagram (V2 — pour l'instant on tente et si ça échoue → notif coach)
