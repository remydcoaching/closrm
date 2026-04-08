# Calendar Reminders (Rappels avant RDV) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let coaches configure automated reminders per calendar — the system sends messages (email/WhatsApp/Instagram DM) before each booking and notifies the coach if delivery fails.

**Architecture:** Reminder config stored as JSONB `reminders` on `booking_calendars`. When a booking is created, reminders are materialized into `booking_reminders` table with computed `send_at`. A cron block sends pending reminders and updates status.

**Tech Stack:** Supabase (PostgreSQL), Next.js API Routes, React, TypeScript, Zod, Resend (email), Meta Cloud API (WhatsApp), Meta Graph API (Instagram DM)

**Spec:** `docs/superpowers/specs/2026-04-08-calendar-reminders-design.md`

---

### Task 1: Migration SQL

**Files:**
- Create: `supabase/migrations/021_booking_reminders.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Add reminders config to booking_calendars
ALTER TABLE booking_calendars
ADD COLUMN reminders jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Table for materialized reminder instances
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

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/021_booking_reminders.sql
git commit -m "feat: migration for booking_reminders table + reminders JSONB"
```

---

### Task 2: Types & Validation

**Files:**
- Modify: `src/types/index.ts` (after BookingCalendar interface, ~line 290)
- Modify: `src/lib/validations/booking-calendars.ts`

- [ ] **Step 1: Add types to src/types/index.ts**

Add after the `BookingCalendar` interface (after line 290), before the `BookingLocation` interface:

```typescript
// ── Calendar Reminders ──────────────────────────────────────────────────────

export type ReminderChannel = 'email' | 'whatsapp' | 'instagram_dm'
export type ReminderStatus = 'pending' | 'sent' | 'failed' | 'cancelled'

export interface CalendarReminder {
  id: string
  delay_value: number
  delay_unit: 'hours' | 'days'
  at_time: string | null
  channel: ReminderChannel
  message: string
}

export interface BookingReminder {
  id: string
  workspace_id: string
  booking_id: string
  lead_id: string
  channel: ReminderChannel
  message: string
  send_at: string
  status: ReminderStatus
  error: string | null
  created_at: string
}
```

Add `reminders` field to the `BookingCalendar` interface, after `purpose: CalendarPurpose`:

```typescript
  reminders: CalendarReminder[]
```

- [ ] **Step 2: Add Zod validation**

In `src/lib/validations/booking-calendars.ts`, add the reminder schema before `createBookingCalendarSchema`:

```typescript
const calendarReminderSchema = z.object({
  id: z.string().uuid(),
  delay_value: z.number().int().min(1).max(365),
  delay_unit: z.enum(['hours', 'days']),
  at_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().default(null),
  channel: z.enum(['email', 'whatsapp', 'instagram_dm']),
  message: z.string().min(1).max(1000),
})
```

Then add `reminders` to the `createBookingCalendarSchema`, after the `purpose` line:

```typescript
  reminders: z.array(calendarReminderSchema).default([]),
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/lib/validations/booking-calendars.ts
git commit -m "feat: CalendarReminder/BookingReminder types + Zod validation"
```

---

### Task 3: Reminder helper — compute send_at + resolve message

**Files:**
- Create: `src/lib/bookings/reminders.ts`

- [ ] **Step 1: Create the helper module**

```typescript
import { createServiceClient } from '@/lib/supabase/service'
import type { CalendarReminder } from '@/types'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

/**
 * Compute the send_at datetime for a reminder relative to a booking.
 * Returns null if the computed time is in the past (too late to send).
 */
export function computeSendAt(
  reminder: CalendarReminder,
  bookingScheduledAt: string
): Date | null {
  const bookingDate = parseISO(bookingScheduledAt)

  let sendAt: Date

  if (reminder.at_time) {
    // Specific time: X days before at HH:MM
    const [hours, minutes] = reminder.at_time.split(':').map(Number)
    const daysToSubtract = reminder.delay_unit === 'days'
      ? reminder.delay_value
      : Math.ceil(reminder.delay_value / 24)
    sendAt = new Date(bookingDate)
    sendAt.setDate(sendAt.getDate() - daysToSubtract)
    sendAt.setHours(hours, minutes, 0, 0)
  } else {
    // Relative: subtract delay from booking time
    sendAt = new Date(bookingDate)
    if (reminder.delay_unit === 'days') {
      sendAt.setDate(sendAt.getDate() - reminder.delay_value)
    } else {
      sendAt.setTime(sendAt.getTime() - reminder.delay_value * 60 * 60 * 1000)
    }
  }

  // Don't create if send time is already past
  if (sendAt <= new Date()) return null

  return sendAt
}

/**
 * Resolve template variables in a reminder message.
 */
export function resolveMessage(
  template: string,
  lead: { first_name: string; last_name: string },
  bookingScheduledAt: string,
  calendarName: string
): string {
  const bookingDate = parseISO(bookingScheduledAt)
  const dateStr = format(bookingDate, 'EEEE d MMMM yyyy', { locale: fr })
  const timeStr = format(bookingDate, 'HH:mm')

  return template
    .replace(/\{\{prenom\}\}/g, lead.first_name)
    .replace(/\{\{nom\}\}/g, lead.last_name)
    .replace(/\{\{date_rdv\}\}/g, dateStr)
    .replace(/\{\{heure_rdv\}\}/g, timeStr)
    .replace(/\{\{nom_calendrier\}\}/g, calendarName)
}

/**
 * Create booking_reminders rows for a newly created booking.
 * Reads the calendar's reminders config, computes send_at for each,
 * resolves the message template, and inserts into booking_reminders.
 */
export async function createBookingReminders(params: {
  workspaceId: string
  bookingId: string
  leadId: string
  bookingScheduledAt: string
  calendarReminders: CalendarReminder[]
  calendarName: string
  lead: { first_name: string; last_name: string }
}): Promise<number> {
  const { workspaceId, bookingId, leadId, bookingScheduledAt, calendarReminders, calendarName, lead } = params

  if (calendarReminders.length === 0) return 0

  const rows: Array<{
    workspace_id: string
    booking_id: string
    lead_id: string
    channel: string
    message: string
    send_at: string
    status: string
  }> = []

  for (const reminder of calendarReminders) {
    const sendAt = computeSendAt(reminder, bookingScheduledAt)
    if (!sendAt) continue // Too late to send

    const message = resolveMessage(reminder.message, lead, bookingScheduledAt, calendarName)

    rows.push({
      workspace_id: workspaceId,
      booking_id: bookingId,
      lead_id: leadId,
      channel: reminder.channel,
      message,
      send_at: sendAt.toISOString(),
      status: 'pending',
    })
  }

  if (rows.length === 0) return 0

  const supabase = createServiceClient()
  await supabase.from('booking_reminders').insert(rows)

  return rows.length
}

/**
 * Cancel all pending reminders for a booking.
 */
export async function cancelBookingReminders(bookingId: string): Promise<void> {
  const supabase = createServiceClient()
  await supabase
    .from('booking_reminders')
    .update({ status: 'cancelled' })
    .eq('booking_id', bookingId)
    .eq('status', 'pending')
}

/**
 * Recalculate reminders after a booking is rescheduled.
 * Deletes pending reminders and re-creates them with the new date.
 */
export async function rescheduleBookingReminders(params: {
  workspaceId: string
  bookingId: string
  leadId: string
  newScheduledAt: string
  calendarId: string
  lead: { first_name: string; last_name: string }
}): Promise<void> {
  const { workspaceId, bookingId, leadId, newScheduledAt, calendarId, lead } = params
  const supabase = createServiceClient()

  // Delete pending reminders
  await supabase
    .from('booking_reminders')
    .delete()
    .eq('booking_id', bookingId)
    .eq('status', 'pending')

  // Fetch calendar config
  const { data: calendar } = await supabase
    .from('booking_calendars')
    .select('name, reminders')
    .eq('id', calendarId)
    .single()

  if (!calendar) return

  const reminders = (calendar.reminders ?? []) as CalendarReminder[]
  if (reminders.length === 0) return

  await createBookingReminders({
    workspaceId,
    bookingId,
    leadId,
    bookingScheduledAt: newScheduledAt,
    calendarReminders: reminders,
    calendarName: calendar.name,
    lead,
  })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/bookings/reminders.ts
git commit -m "feat: reminder helpers — computeSendAt, resolveMessage, create/cancel/reschedule"
```

---

### Task 4: RemindersEditor component

**Files:**
- Create: `src/components/booking-calendars/RemindersEditor.tsx`

- [ ] **Step 1: Create the component**

```typescript
'use client'

import { Plus, X, Mail, MessageCircle, Instagram } from 'lucide-react'
import type { CalendarReminder, ReminderChannel } from '@/types'

interface RemindersEditorProps {
  reminders: CalendarReminder[]
  onChange: (reminders: CalendarReminder[]) => void
}

const CHANNEL_OPTIONS: { value: ReminderChannel; label: string; icon: typeof Mail }[] = [
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { value: 'instagram_dm', label: 'Instagram DM', icon: Instagram },
]

const DEFAULT_MESSAGES: Record<ReminderChannel, string> = {
  email: 'Bonjour {{prenom}}, rappel : votre rendez-vous {{nom_calendrier}} est prévu le {{date_rdv}} à {{heure_rdv}}.',
  whatsapp: 'Bonjour {{prenom}}, petit rappel pour votre RDV de {{heure_rdv}} le {{date_rdv}}. À bientôt !',
  instagram_dm: 'Hey {{prenom}} ! Rappel pour ton RDV de {{heure_rdv}} le {{date_rdv}}.',
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-input)',
  border: '1px solid var(--border-primary)',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 13,
  color: 'var(--text-primary)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

export default function RemindersEditor({ reminders, onChange }: RemindersEditorProps) {
  function addReminder() {
    const newReminder: CalendarReminder = {
      id: crypto.randomUUID(),
      delay_value: 24,
      delay_unit: 'hours',
      at_time: null,
      channel: 'whatsapp',
      message: DEFAULT_MESSAGES.whatsapp,
    }
    onChange([...reminders, newReminder])
  }

  function updateReminder(id: string, updates: Partial<CalendarReminder>) {
    onChange(reminders.map(r => r.id === id ? { ...r, ...updates } : r))
  }

  function removeReminder(id: string) {
    onChange(reminders.filter(r => r.id !== id))
  }

  function handleChannelChange(id: string, channel: ReminderChannel) {
    const existing = reminders.find(r => r.id === id)
    const updates: Partial<CalendarReminder> = { channel }
    // Pre-fill message if current message is a default
    if (existing && Object.values(DEFAULT_MESSAGES).includes(existing.message)) {
      updates.message = DEFAULT_MESSAGES[channel]
    }
    updateReminder(id, updates)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
        Configurez les rappels envoyés automatiquement avant chaque rendez-vous.
      </p>

      {reminders.map((reminder, index) => (
        <div
          key={reminder.id}
          style={{
            padding: 16,
            borderRadius: 10,
            border: '1px solid var(--border-primary)',
            background: 'var(--bg-input)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {/* Header: number + delete */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>
              Rappel {index + 1}
            </span>
            <button
              type="button"
              onClick={() => removeReminder(reminder.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Row 1: Delay + optional time */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="number"
              min={1}
              value={reminder.delay_value}
              onChange={(e) => updateReminder(reminder.id, { delay_value: parseInt(e.target.value) || 1 })}
              style={{ ...inputStyle, width: 70 }}
            />
            <select
              value={reminder.delay_unit}
              onChange={(e) => updateReminder(reminder.id, { delay_unit: e.target.value as 'hours' | 'days' })}
              style={{ ...inputStyle, width: 110 }}
            >
              <option value="hours">heures avant</option>
              <option value="days">jours avant</option>
            </select>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>à</span>
            <input
              type="time"
              value={reminder.at_time ?? ''}
              onChange={(e) => updateReminder(reminder.id, { at_time: e.target.value || null })}
              placeholder="Heure du RDV"
              style={{ ...inputStyle, width: 110, colorScheme: 'dark' }}
            />
          </div>

          {/* Row 2: Channel */}
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Canal</label>
            <select
              value={reminder.channel}
              onChange={(e) => handleChannelChange(reminder.id, e.target.value as ReminderChannel)}
              style={inputStyle}
            >
              {CHANNEL_OPTIONS.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Row 3: Message */}
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Message <span style={{ fontWeight: 400 }}>— variables : {'{{prenom}}'}, {'{{date_rdv}}'}, {'{{heure_rdv}}'}, {'{{nom_calendrier}}'}</span>
            </label>
            <textarea
              value={reminder.message}
              onChange={(e) => updateReminder(reminder.id, { message: e.target.value })}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>
        </div>
      ))}

      {/* Add button */}
      <button
        type="button"
        onClick={addReminder}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '10px 14px',
          borderRadius: 8,
          border: '1px dashed var(--border-primary)',
          background: 'transparent',
          color: 'var(--text-tertiary)',
          cursor: 'pointer',
          fontSize: 12,
          transition: 'all 0.15s',
        }}
      >
        <Plus size={14} />
        Ajouter un rappel
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/booking-calendars/RemindersEditor.tsx
git commit -m "feat: RemindersEditor component"
```

---

### Task 5: Wire RemindersEditor into calendar edit page

**Files:**
- Modify: `src/app/(dashboard)/parametres/calendriers/[id]/page.tsx`

- [ ] **Step 1: Add import and state**

Add imports at top:

```typescript
import RemindersEditor from '@/components/booking-calendars/RemindersEditor'
import type { CalendarReminder } from '@/types'
```

Add state after the `purpose` state (after line 43):

```typescript
const [reminders, setReminders] = useState<CalendarReminder[]>([])
```

- [ ] **Step 2: Load reminders from fetched calendar**

In `fetchCalendar`, after `setPurpose(...)` (around line 64), add:

```typescript
setReminders((cal as unknown as { reminders?: CalendarReminder[] }).reminders ?? [])
```

- [ ] **Step 3: Send reminders in save payload**

In `handleSave`, add `reminders,` to the JSON body after `purpose,`.

- [ ] **Step 4: Add RemindersEditor section in JSX**

Add a new section after the "Objectif du calendrier" section (after line ~359) and before the "Lieux" section:

```tsx
        {/* Rappels automatiques */}
        <div style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
          borderRadius: 14, padding: 24,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
            Rappels automatiques
          </h3>
          <RemindersEditor reminders={reminders} onChange={setReminders} />
        </div>
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/parametres/calendriers/[id]/page.tsx"
git commit -m "feat: wire RemindersEditor into calendar edit page"
```

---

### Task 6: Create reminders on booking creation (internal API)

**Files:**
- Modify: `src/app/api/bookings/route.ts`

- [ ] **Step 1: Add import**

Add at top:

```typescript
import { createBookingReminders } from '@/lib/bookings/reminders'
```

- [ ] **Step 2: Add BOOKING_SELECT update**

Update `BOOKING_SELECT` to also fetch `reminders` from calendar. Change:

```
booking_calendar:booking_calendars(name, color, purpose, location_ids)
```
To:
```
booking_calendar:booking_calendars(name, color, purpose, location_ids, reminders)
```

- [ ] **Step 3: Add reminder creation after auto-call block**

After the auto-call creation block (after line ~134, before the `// Fire workflow triggers` comment), add:

```typescript
    // Create booking reminders if calendar has reminders configured
    if (data.lead_id && data.calendar_id) {
      const calReminders = ((data.booking_calendar as { reminders?: unknown[] } | null)?.reminders ?? []) as CalendarReminder[]
      const calName = (data.booking_calendar as { name?: string } | null)?.name ?? ''
      const leadData = data.lead as { first_name?: string; last_name?: string } | null
      if (calReminders.length > 0 && leadData) {
        createBookingReminders({
          workspaceId,
          bookingId: data.id,
          leadId: data.lead_id,
          bookingScheduledAt: data.scheduled_at,
          calendarReminders: calReminders,
          calendarName: calName,
          lead: { first_name: leadData.first_name ?? '', last_name: leadData.last_name ?? '' },
        }).catch((err) => {
          console.error('[booking] Failed to create reminders:', err)
        })
      }
    }
```

Add the CalendarReminder import at top:

```typescript
import type { CalendarReminder } from '@/types'
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/app/api/bookings/route.ts
git commit -m "feat: create booking reminders on internal booking creation"
```

---

### Task 7: Create reminders on public booking

**Files:**
- Modify: `src/app/api/public/book/[workspaceSlug]/[calendarSlug]/route.ts`

- [ ] **Step 1: Add import**

Add at top:

```typescript
import { createBookingReminders } from '@/lib/bookings/reminders'
```

- [ ] **Step 2: Add reminders to CalendarRow interface**

In the `CalendarRow` interface, add after `purpose: string`:

```typescript
  reminders: unknown[]
```

- [ ] **Step 3: Add reminders to select query**

In `getCalendarBySlug`, add `reminders` to the `.select(...)` string.

- [ ] **Step 4: Add reminder creation after auto-call block**

After the auto-call creation block (after line ~337, before the `// Fire workflow trigger` comment), add:

```typescript
  // Create booking reminders if calendar has reminders configured
  if (leadId && calendar.reminders && calendar.reminders.length > 0) {
    createBookingReminders({
      workspaceId: calendar.workspace_id,
      bookingId: booking.id,
      leadId,
      bookingScheduledAt: scheduled_at,
      calendarReminders: calendar.reminders as CalendarReminder[],
      calendarName: calendar.name,
      lead: { first_name: firstName, last_name: lastName },
    }).catch((err) => {
      console.error('[public-booking] Failed to create reminders:', err)
    })
  }
```

Add the CalendarReminder import at top:

```typescript
import type { CalendarReminder } from '@/types'
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/public/book/[workspaceSlug]/[calendarSlug]/route.ts"
git commit -m "feat: create booking reminders on public booking"
```

---

### Task 8: Cancel/reschedule reminders on booking update

**Files:**
- Modify: `src/app/api/bookings/[id]/route.ts`

- [ ] **Step 1: Add imports**

Add at top:

```typescript
import { cancelBookingReminders, rescheduleBookingReminders } from '@/lib/bookings/reminders'
```

- [ ] **Step 2: Add cancel/reschedule logic**

In the PATCH handler, after the existing Google Calendar event handling and BEFORE the `// Sync booking status to linked call` block (~line 96), add:

```typescript
    // Cancel reminders if booking cancelled
    if (parsed.data.status === 'cancelled' && existing.status !== 'cancelled') {
      cancelBookingReminders(id).catch((err) => {
        console.error('[booking] Failed to cancel reminders:', err)
      })
    }

    // Cancel reminders if booking is no_show
    if (parsed.data.status === 'no_show' && existing.status !== 'no_show') {
      cancelBookingReminders(id).catch((err) => {
        console.error('[booking] Failed to cancel reminders:', err)
      })
    }

    // Reschedule reminders if booking time changed
    if (
      parsed.data.scheduled_at &&
      parsed.data.scheduled_at !== existing.scheduled_at &&
      parsed.data.status !== 'cancelled' &&
      existing.status !== 'cancelled' &&
      data.lead_id &&
      existing.calendar_id
    ) {
      const leadData = data.lead as { first_name?: string; last_name?: string } | null
      if (leadData) {
        rescheduleBookingReminders({
          workspaceId,
          bookingId: id,
          leadId: data.lead_id,
          newScheduledAt: parsed.data.scheduled_at,
          calendarId: existing.calendar_id,
          lead: { first_name: leadData.first_name ?? '', last_name: leadData.last_name ?? '' },
        }).catch((err) => {
          console.error('[booking] Failed to reschedule reminders:', err)
        })
      }
    }
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/bookings/[id]/route.ts"
git commit -m "feat: cancel/reschedule reminders on booking update"
```

---

### Task 9: Cron block — send pending reminders

**Files:**
- Modify: `src/app/api/cron/workflow-scheduler/route.ts`

- [ ] **Step 1: Add counter to results object**

Add after `booking_reminders_fired: 0,` (line ~19):

```typescript
    calendar_reminders_sent: 0,
```

- [ ] **Step 2: Add imports**

Add at top:

```typescript
import { sendEmail } from '@/lib/email/client'
import { sendWhatsAppMessage } from '@/lib/whatsapp/client'
import { sendIgMessage } from '@/lib/instagram/api'
import { getIntegrationCredentials } from '@/lib/integrations/get-credentials'
```

Check if these are already imported — only add the ones that are missing.

- [ ] **Step 3: Add the reminder sending block**

Before the final `} catch (err) {` (around line ~314), add a new section:

```typescript
    // ─── 6. Send pending booking reminders ────────────────────────────────
    {
      const { data: pendingReminders } = await supabase
        .from('booking_reminders')
        .select('id, workspace_id, booking_id, lead_id, channel, message')
        .eq('status', 'pending')
        .lte('send_at', new Date().toISOString())
        .limit(100)

      if (pendingReminders) {
        for (const reminder of pendingReminders) {
          try {
            // Fetch lead contact info
            const { data: lead } = await supabase
              .from('leads')
              .select('email, phone, first_name, last_name')
              .eq('id', reminder.lead_id)
              .single()

            if (!lead) {
              await supabase.from('booking_reminders')
                .update({ status: 'failed', error: 'Lead introuvable' })
                .eq('id', reminder.id)
              continue
            }

            let sendError: string | null = null

            if (reminder.channel === 'email') {
              if (!lead.email) {
                sendError = 'Pas d\'adresse email'
              } else {
                const apiKey = process.env.RESEND_API_KEY
                if (!apiKey) {
                  sendError = 'RESEND_API_KEY non configurée'
                } else {
                  const result = await sendEmail(
                    { apiKey },
                    lead.email,
                    'Rappel de votre rendez-vous',
                    `<p>${reminder.message.replace(/\n/g, '<br>')}</p>`
                  )
                  if (!result.ok) sendError = result.error ?? 'Erreur envoi email'
                }
              }
            } else if (reminder.channel === 'whatsapp') {
              if (!lead.phone) {
                sendError = 'Pas de numéro de téléphone'
              } else {
                const creds = await getIntegrationCredentials(reminder.workspace_id, 'whatsapp')
                if (!creds) {
                  sendError = 'WhatsApp non connecté'
                } else {
                  const phone = lead.phone.replace(/[\s\-\.]/g, '').replace(/^0/, '33')
                  const result = await sendWhatsAppMessage(
                    { phoneNumberId: creds.phone_number_id, accessToken: creds.access_token },
                    phone,
                    reminder.message
                  )
                  if (!result.ok) sendError = result.error ?? 'Erreur envoi WhatsApp'
                }
              }
            } else if (reminder.channel === 'instagram_dm') {
              // Find IG conversation linked to this lead
              const { data: conv } = await supabase
                .from('ig_conversations')
                .select('participant_ig_id')
                .eq('lead_id', reminder.lead_id)
                .eq('workspace_id', reminder.workspace_id)
                .maybeSingle()

              if (!conv?.participant_ig_id) {
                sendError = 'Pas de conversation Instagram liée'
              } else {
                const { data: igAccount } = await supabase
                  .from('ig_accounts')
                  .select('page_access_token, ig_page_id')
                  .eq('workspace_id', reminder.workspace_id)
                  .maybeSingle()

                if (!igAccount) {
                  sendError = 'Compte Instagram non connecté'
                } else {
                  try {
                    await sendIgMessage(
                      igAccount.page_access_token,
                      igAccount.ig_page_id,
                      conv.participant_ig_id,
                      reminder.message
                    )
                  } catch (err) {
                    sendError = err instanceof Error ? err.message : 'Erreur envoi DM Instagram'
                  }
                }
              }
            }

            if (sendError) {
              await supabase.from('booking_reminders')
                .update({ status: 'failed', error: sendError })
                .eq('id', reminder.id)

              // Notify coach
              const { data: owner } = await supabase
                .from('users')
                .select('full_name')
                .eq('workspace_id', reminder.workspace_id)
                .eq('role', 'coach')
                .maybeSingle()

              const notifCreds = await getIntegrationCredentials(reminder.workspace_id, 'telegram')
              if (notifCreds?.bot_token && notifCreds?.chat_id) {
                const msg = `⚠️ Rappel échoué pour ${lead.first_name} ${lead.last_name} : ${sendError}`
                fetch(`https://api.telegram.org/bot${notifCreds.bot_token}/sendMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ chat_id: notifCreds.chat_id, text: msg }),
                }).catch(() => {})
              }

              results.errors.push(`Reminder ${reminder.id}: ${sendError}`)
            } else {
              await supabase.from('booking_reminders')
                .update({ status: 'sent' })
                .eq('id', reminder.id)
              results.calendar_reminders_sent++
            }
          } catch (err) {
            await supabase.from('booking_reminders')
              .update({ status: 'failed', error: err instanceof Error ? err.message : 'Unknown' })
              .eq('id', reminder.id)
            results.errors.push(`Reminder ${reminder.id}: ${err instanceof Error ? err.message : 'Unknown'}`)
          }
        }
      }
    }
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/workflow-scheduler/route.ts
git commit -m "feat: cron block to send pending booking reminders"
```

---

### Task 10: Cron no-show — also cancel reminders

**Files:**
- Modify: `src/app/api/cron/workflow-scheduler/route.ts` (section 4, booking no-show block)

- [ ] **Step 1: Add cancelBookingReminders import**

Add at top (if not already imported):

```typescript
import { cancelBookingReminders } from '@/lib/bookings/reminders'
```

- [ ] **Step 2: Cancel reminders in the no-show loop**

In the no-show block, after `await supabase.from('bookings').update({ status: 'no_show' }).eq('id', booking.id)` and before the `if (booking.lead_id)` check, add:

```typescript
            // Cancel any pending reminders
            cancelBookingReminders(booking.id).catch(() => {})
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/workflow-scheduler/route.ts
git commit -m "feat: cancel reminders on cron no-show detection"
```

---

### Task 11: Manual E2E verification

- [ ] **Step 1: Apply migration**

Run in Supabase SQL editor:
```sql
ALTER TABLE booking_calendars ADD COLUMN reminders jsonb NOT NULL DEFAULT '[]'::jsonb;
```
Then create the `booking_reminders` table (full SQL from migration file).

- [ ] **Step 2: Configure reminders on a calendar**

Edit a calendar → add 2 reminders:
- 24h avant, WhatsApp, message par défaut
- 1 jour avant à 09:00, Email, message par défaut

Save and verify the config persists.

- [ ] **Step 3: Create a booking via public link**

Book a slot. Verify in Supabase that `booking_reminders` rows were created with correct `send_at` values.

- [ ] **Step 4: Cancel a booking**

Cancel the booking. Verify all `booking_reminders` are now `status = 'cancelled'`.

- [ ] **Step 5: Test reminder sending**

Create a booking with a reminder set to 0.1 hours (6 min) from now. Wait for cron or call the cron endpoint manually. Verify the reminder is sent and status is `sent`.
