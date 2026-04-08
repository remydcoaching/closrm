# Calendar Purpose (Setting / Closing / Autre) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow coaches to assign a purpose (setting, closing, other) to booking calendars so bookings auto-create calls, advance lead pipeline status, and appear in Closing.

**Architecture:** New `purpose` column on `booking_calendars`. When a booking is created on a setting/closing calendar, a call is auto-created and linked via the existing `call_id` FK on bookings. Booking status changes (cancel/no-show) sync to the linked call and create follow-ups.

**Tech Stack:** Supabase (PostgreSQL migration), Next.js API Routes, React components, TypeScript, Zod

**Spec:** `docs/superpowers/specs/2026-04-08-calendar-purpose-design.md`

---

### Task 1: Migration SQL

**Files:**
- Create: `supabase/migrations/019_calendar_purpose.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Add purpose column to booking_calendars
ALTER TABLE booking_calendars
ADD COLUMN purpose text NOT NULL DEFAULT 'other'
CHECK (purpose IN ('setting', 'closing', 'other'));
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push` or apply manually in the Supabase SQL editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/019_calendar_purpose.sql
git commit -m "feat: add purpose column to booking_calendars"
```

---

### Task 2: Types & Validation

**Files:**
- Modify: `src/types/index.ts` (lines 272-287, BookingCalendar interface)
- Modify: `src/lib/validations/booking-calendars.ts` (line 47, before `is_active`)

- [ ] **Step 1: Add CalendarPurpose type and update BookingCalendar**

In `src/types/index.ts`, add above the BookingCalendar interface:

```typescript
export type CalendarPurpose = 'setting' | 'closing' | 'other'
```

Add the `purpose` field to the `BookingCalendar` interface, after `buffer_minutes`:

```typescript
  purpose: CalendarPurpose
```

- [ ] **Step 2: Add purpose to Zod schema**

In `src/lib/validations/booking-calendars.ts`, add after the `location_ids` line:

```typescript
  purpose: z.enum(['setting', 'closing', 'other']).default('other'),
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/lib/validations/booking-calendars.ts
git commit -m "feat: add CalendarPurpose type and Zod validation"
```

---

### Task 3: PurposeEditor component

**Files:**
- Create: `src/components/booking-calendars/PurposeEditor.tsx`

- [ ] **Step 1: Create the component**

```typescript
'use client'

import { useState } from 'react'
import { Phone, PhoneCall, Calendar } from 'lucide-react'
import type { CalendarPurpose } from '@/types'

interface PurposeEditorProps {
  value: CalendarPurpose
  onChange: (purpose: CalendarPurpose) => void
}

const PURPOSES: { value: CalendarPurpose; label: string; description: string; icon: typeof Phone }[] = [
  {
    value: 'setting',
    label: 'Appel découverte',
    description: 'Qualification du prospect, premier contact',
    icon: Phone,
  },
  {
    value: 'closing',
    label: 'Appel de closing',
    description: 'Appel de vente, conversion du prospect',
    icon: PhoneCall,
  },
  {
    value: 'other',
    label: 'Autre',
    description: 'Coaching, suivi, mentoring...',
    icon: Calendar,
  },
]

export default function PurposeEditor({ value, onChange }: PurposeEditorProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
        Quel est l&apos;objectif de ce calendrier ?
      </p>
      {PURPOSES.map((p) => {
        const isSelected = value === p.value
        const Icon = p.icon
        return (
          <button
            key={p.value}
            type="button"
            onClick={() => onChange(p.value)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 16px',
              borderRadius: 10,
              border: `1.5px solid ${isSelected ? 'var(--color-primary)' : 'var(--border-primary)'}`,
              background: isSelected ? 'rgba(var(--color-primary-rgb, 0,200,83), 0.06)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.15s',
              textAlign: 'left',
              width: '100%',
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              background: isSelected ? 'rgba(var(--color-primary-rgb, 0,200,83), 0.12)' : 'var(--bg-active, rgba(255,255,255,0.04))',
              color: isSelected ? 'var(--color-primary)' : 'var(--text-secondary)',
              transition: 'all 0.15s',
            }}>
              <Icon size={20} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 14, fontWeight: 600,
                color: isSelected ? 'var(--color-primary)' : 'var(--text-primary)',
                marginBottom: 2,
              }}>
                {p.label}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                {p.description}
              </div>
            </div>
            <div style={{
              width: 18, height: 18, borderRadius: '50%',
              border: `2px solid ${isSelected ? 'var(--color-primary)' : 'var(--border-primary)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              transition: 'all 0.15s',
            }}>
              {isSelected && (
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)' }} />
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/booking-calendars/PurposeEditor.tsx
git commit -m "feat: add PurposeEditor component"
```

---

### Task 4: Wire PurposeEditor into calendar edit page

**Files:**
- Modify: `src/app/(dashboard)/parametres/calendriers/[id]/page.tsx`

- [ ] **Step 1: Add import and state**

Add import at top:

```typescript
import PurposeEditor from '@/components/booking-calendars/PurposeEditor'
import type { CalendarPurpose } from '@/types'
```

Add state after the `locationIds` state declaration (after line 41):

```typescript
const [purpose, setPurpose] = useState<CalendarPurpose>('other')
```

- [ ] **Step 2: Load purpose from fetched calendar**

In the `fetchCalendar` function, after `setLocationIds(cal.location_ids ?? [])` (after line 60), add:

```typescript
setPurpose((cal as unknown as { purpose?: CalendarPurpose }).purpose ?? 'other')
```

- [ ] **Step 3: Send purpose in save payload**

In the `handleSave` function, add `purpose` to the JSON body (after `location_ids: locationIds,`):

```typescript
        purpose,
```

- [ ] **Step 4: Add PurposeEditor section in JSX**

Add a new section before the "Type de rendez-vous" section (before the LocationEditor section). Find the section with label "Type de rendez-vous" and add before it:

```tsx
        {/* Objectif du calendrier */}
        <div style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
          borderRadius: 14, padding: 24,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
            Objectif du calendrier
          </h3>
          <PurposeEditor value={purpose} onChange={setPurpose} />
        </div>
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/app/(dashboard)/parametres/calendriers/[id]/page.tsx
git commit -m "feat: wire PurposeEditor into calendar edit page"
```

---

### Task 5: Auto-create call on booking creation (internal API)

**Files:**
- Modify: `src/app/api/bookings/route.ts` (POST handler, after booking insert ~line 80)

- [ ] **Step 1: Fetch calendar purpose after booking is created**

After the booking insert succeeds (after `if (error) return ...` on line 81) and before the workflow trigger block, add:

```typescript
    // Auto-create call if calendar has purpose setting/closing
    if (data.lead_id && data.calendar_id) {
      const calPurpose = (data.booking_calendar as { purpose?: string } | null)?.purpose
      if (calPurpose === 'setting' || calPurpose === 'closing') {
        // Count existing calls for attempt_number
        const { count: callCount } = await supabase
          .from('calls')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .eq('lead_id', data.lead_id)
          .eq('type', calPurpose)

        const calName = (data.booking_calendar as { name?: string } | null)?.name ?? ''
        const { data: newCall } = await supabase
          .from('calls')
          .insert({
            workspace_id: workspaceId,
            lead_id: data.lead_id,
            type: calPurpose,
            scheduled_at: data.scheduled_at,
            outcome: 'pending',
            attempt_number: (callCount ?? 0) + 1,
            reached: false,
            notes: `Via calendrier : ${calName}`,
          })
          .select('id')
          .single()

        if (newCall) {
          // Link call to booking
          await supabase
            .from('bookings')
            .update({ call_id: newCall.id })
            .eq('id', data.id)

          // Update lead status
          const newStatus = calPurpose === 'setting' ? 'setting_planifie' : 'closing_planifie'
          await supabase
            .from('leads')
            .update({ status: newStatus })
            .eq('id', data.lead_id)
            .eq('workspace_id', workspaceId)

          // Fire call_scheduled trigger
          fireTriggersForEvent(workspaceId, 'call_scheduled', {
            lead_id: data.lead_id,
            call_id: newCall.id,
            call_type: calPurpose,
          }).catch(() => {})
        }
      }
    }
```

- [ ] **Step 2: Ensure the BOOKING_SELECT includes purpose**

Find the `BOOKING_SELECT` constant in the file (it's the Supabase select string). It should already join `booking_calendar`. Verify it includes `booking_calendar:booking_calendars(name, color)`. If so, update it to also fetch `purpose`:

Change:
```typescript
booking_calendar:booking_calendars(name, color)
```
To:
```typescript
booking_calendar:booking_calendars(name, color, purpose)
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/api/bookings/route.ts
git commit -m "feat: auto-create call on setting/closing booking (internal API)"
```

---

### Task 6: Auto-create call on public booking

**Files:**
- Modify: `src/app/api/public/book/[workspaceSlug]/[calendarSlug]/route.ts`

- [ ] **Step 1: Add purpose to CalendarRow interface**

In the `CalendarRow` interface (lines 12-23), add after `buffer_minutes`:

```typescript
  purpose: string
```

- [ ] **Step 2: Add purpose to the Supabase select query**

In the `getCalendarBySlug` function (line 43), the `.select(...)` string should include `purpose`. Add it:

Change:
```
'id, workspace_id, name, description, duration_minutes, location_ids, color, form_fields, availability, buffer_minutes'
```
To:
```
'id, workspace_id, name, description, duration_minutes, location_ids, color, form_fields, availability, buffer_minutes, purpose'
```

- [ ] **Step 3: Auto-create call after booking insert**

After the booking insert succeeds (after line 287 `if (bookingError || !booking)` check) and before the workflow trigger block, add:

```typescript
  // Auto-create call if calendar has purpose setting/closing
  if (leadId && (calendar.purpose === 'setting' || calendar.purpose === 'closing')) {
    const supabaseService = createServiceClient()

    // Count existing calls for attempt_number
    const { count: callCount } = await supabaseService
      .from('calls')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', calendar.workspace_id)
      .eq('lead_id', leadId)
      .eq('type', calendar.purpose)

    const { data: newCall } = await supabaseService
      .from('calls')
      .insert({
        workspace_id: calendar.workspace_id,
        lead_id: leadId,
        type: calendar.purpose,
        scheduled_at: scheduled_at,
        outcome: 'pending',
        attempt_number: (callCount ?? 0) + 1,
        reached: false,
        notes: `Via calendrier : ${calendar.name}`,
      })
      .select('id')
      .single()

    if (newCall) {
      // Link call to booking
      await supabaseService
        .from('bookings')
        .update({ call_id: newCall.id })
        .eq('id', booking.id)

      // Update lead status
      const newStatus = calendar.purpose === 'setting' ? 'setting_planifie' : 'closing_planifie'
      await supabaseService
        .from('leads')
        .update({ status: newStatus })
        .eq('id', leadId)
        .eq('workspace_id', calendar.workspace_id)

      // Fire call_scheduled trigger
      fireTriggersForEvent(calendar.workspace_id, 'call_scheduled', {
        lead_id: leadId,
        call_id: newCall.id,
        call_type: calendar.purpose,
      }).catch(() => {})
    }
  }
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/app/api/public/book/\[workspaceSlug\]/\[calendarSlug\]/route.ts
git commit -m "feat: auto-create call on setting/closing booking (public API)"
```

---

### Task 7: Synchro booking status → call + follow-up

**Files:**
- Modify: `src/app/api/bookings/[id]/route.ts` (PATCH handler)

- [ ] **Step 1: Fetch call_id and calendar purpose in the existing query**

Update the existing select on line 48 to also fetch `call_id` and `lead_id`:

Change:
```typescript
.select('id, google_event_id, status, scheduled_at, duration_minutes')
```
To:
```typescript
.select('id, google_event_id, status, scheduled_at, duration_minutes, call_id, lead_id, calendar_id')
```

- [ ] **Step 2: Add synchro logic after the booking update**

After the existing Google Calendar event handling and before the no_show trigger block (~line 95), add:

```typescript
    // Sync booking status to linked call + create follow-up
    if (existing.call_id && data.lead_id) {
      // Fetch the call to know its type
      const { data: linkedCall } = await supabase
        .from('calls')
        .select('id, type')
        .eq('id', existing.call_id)
        .single()

      if (linkedCall) {
        if (parsed.data.status === 'no_show' && existing.status !== 'no_show') {
          // Call → no_show
          await supabase
            .from('calls')
            .update({ outcome: 'no_show' })
            .eq('id', linkedCall.id)

          // Lead → no_show_setting or no_show_closing
          const noShowStatus = linkedCall.type === 'setting' ? 'no_show_setting' : 'no_show_closing'
          await supabase
            .from('leads')
            .update({ status: noShowStatus })
            .eq('id', data.lead_id)
            .eq('workspace_id', workspaceId)

          // Create follow-up
          const tomorrow = new Date()
          tomorrow.setDate(tomorrow.getDate() + 1)
          tomorrow.setHours(9, 0, 0, 0)
          await supabase
            .from('follow_ups')
            .insert({
              workspace_id: workspaceId,
              lead_id: data.lead_id,
              reason: 'No-show RDV — à relancer',
              scheduled_at: tomorrow.toISOString(),
              channel: 'whatsapp',
              status: 'en_attente',
            })

          // Fire call_no_show trigger
          fireTriggersForEvent(workspaceId, 'call_no_show', {
            lead_id: data.lead_id,
            call_id: linkedCall.id,
            call_type: linkedCall.type,
          }).catch(() => {})
        }

        if (parsed.data.status === 'cancelled' && existing.status !== 'cancelled') {
          // Call → cancelled (lead status unchanged)
          await supabase
            .from('calls')
            .update({ outcome: 'cancelled' })
            .eq('id', linkedCall.id)

          // Create follow-up
          const tomorrow = new Date()
          tomorrow.setDate(tomorrow.getDate() + 1)
          tomorrow.setHours(9, 0, 0, 0)
          await supabase
            .from('follow_ups')
            .insert({
              workspace_id: workspaceId,
              lead_id: data.lead_id,
              reason: 'RDV annulé — à relancer',
              scheduled_at: tomorrow.toISOString(),
              channel: 'whatsapp',
              status: 'en_attente',
            })
        }
      }
    }
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/api/bookings/\[id\]/route.ts
git commit -m "feat: sync booking status to linked call + auto follow-up"
```

---

### Task 8: Cron no-show → synchro call + follow-up

**Files:**
- Modify: `src/app/api/cron/workflow-scheduler/route.ts` (section 4, booking no-show block)

- [ ] **Step 1: Extend the no-show block to also fetch call_id**

Update the select on the overdueBookings query:

Change:
```typescript
.select('id, lead_id, workspace_id, calendar_id')
```
To:
```typescript
.select('id, lead_id, workspace_id, calendar_id, call_id')
```

- [ ] **Step 2: Add call synchro + follow-up inside the no-show loop**

After `results.booking_no_show_fired++` and before the catch block, add:

```typescript
              // Sync to linked call if exists
              if (booking.call_id) {
                const { data: linkedCall } = await supabase
                  .from('calls')
                  .select('id, type')
                  .eq('id', booking.call_id)
                  .single()

                if (linkedCall) {
                  await supabase
                    .from('calls')
                    .update({ outcome: 'no_show' })
                    .eq('id', linkedCall.id)

                  const noShowStatus = linkedCall.type === 'setting' ? 'no_show_setting' : 'no_show_closing'
                  await supabase
                    .from('leads')
                    .update({ status: noShowStatus })
                    .eq('id', booking.lead_id)
                    .eq('workspace_id', booking.workspace_id)

                  // Create follow-up
                  const tomorrow = new Date()
                  tomorrow.setDate(tomorrow.getDate() + 1)
                  tomorrow.setHours(9, 0, 0, 0)
                  await supabase
                    .from('follow_ups')
                    .insert({
                      workspace_id: booking.workspace_id,
                      lead_id: booking.lead_id,
                      reason: 'No-show RDV — à relancer',
                      scheduled_at: tomorrow.toISOString(),
                      channel: 'whatsapp',
                      status: 'en_attente',
                    })
                }
              }
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/workflow-scheduler/route.ts
git commit -m "feat: sync cron no-show detection to linked call + follow-up"
```

---

### Task 9: Show calendar name in Closing

**Files:**
- Modify: `src/app/(dashboard)/closing/page.tsx` (server component queries)
- Modify: `src/components/closing/CallTable.tsx` (row rendering)

- [ ] **Step 1: Update the Closing page query to join booking → calendar**

In `src/app/(dashboard)/closing/page.tsx`, update the initial calls select (the first Promise.all entry). Change the select string:

From:
```typescript
.select('*, lead:leads!inner(id, first_name, last_name, phone, email, status)', { count: 'exact' })
```
To:
```typescript
.select('*, lead:leads!inner(id, first_name, last_name, phone, email, status), booking:bookings(id, booking_calendar:booking_calendars(name))', { count: 'exact' })
```

This joins `calls → bookings (via call_id match) → booking_calendars`. Note: this is a reverse FK join — Supabase can do `bookings` from `calls` because `bookings.call_id` references `calls.id`.

- [ ] **Step 2: Update CallWithLead type in closing-client.tsx**

In `src/app/(dashboard)/closing/closing-client.tsx`, update the type on line 14:

From:
```typescript
type CallWithLead = Call & { lead: Pick<Lead, 'id' | 'first_name' | 'last_name' | 'phone' | 'email' | 'status'> }
```
To:
```typescript
type CallWithLead = Call & {
  lead: Pick<Lead, 'id' | 'first_name' | 'last_name' | 'phone' | 'email' | 'status'>
  booking?: { id: string; booking_calendar: { name: string } | null }[] | null
}
```

- [ ] **Step 3: Update CallWithLead type in CallTable.tsx**

In `src/components/closing/CallTable.tsx`, update the matching type on line 10:

From:
```typescript
type CallWithLead = Call & { lead: Pick<Lead, 'id' | 'first_name' | 'last_name' | 'phone' | 'email' | 'status'> }
```
To:
```typescript
type CallWithLead = Call & {
  lead: Pick<Lead, 'id' | 'first_name' | 'last_name' | 'phone' | 'email' | 'status'>
  booking?: { id: string; booking_calendar: { name: string } | null }[] | null
}
```

- [ ] **Step 4: Display calendar name in CallTable row**

In the call row rendering (after the lead name display ~line 63-66), add below the lead name:

```tsx
{call.booking?.[0]?.booking_calendar?.name && (
  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
    via {call.booking[0].booking_calendar.name}
  </div>
)}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/app/(dashboard)/closing/page.tsx src/app/(dashboard)/closing/closing-client.tsx src/components/closing/CallTable.tsx
git commit -m "feat: show calendar name in Closing view"
```

---

### Task 10: Manual test & verify end-to-end

- [ ] **Step 1: Create a test calendar with purpose "setting"**

Go to Paramètres > Calendriers, edit a calendar, set purpose to "Appel découverte", save.

- [ ] **Step 2: Book via public link**

Open the public booking page, book a slot. Verify:
- A call is created in the `calls` table with `type = 'setting'`
- The booking has `call_id` linked to the new call
- The lead status is `setting_planifie`
- The call appears in the Closing view with "via {calendar name}"

- [ ] **Step 3: Test cancellation**

Cancel the booking. Verify:
- The linked call has `outcome = 'cancelled'`
- The lead status is **unchanged** (still `setting_planifie`)
- A follow-up is created with reason "RDV annulé — à relancer"

- [ ] **Step 4: Test no-show**

Create another booking, wait or manually set status to `no_show`. Verify:
- The linked call has `outcome = 'no_show'`
- The lead status is `no_show_setting`
- A follow-up is created with reason "No-show RDV — à relancer"

- [ ] **Step 5: Test "other" calendar**

Book on a calendar with purpose "other". Verify:
- No call is created
- Lead status doesn't change
- Nothing appears in Closing

- [ ] **Step 6: Final commit (task file update)**

Update `taches/tache-032-booking-location-types.md` to reference this feature, then commit.
