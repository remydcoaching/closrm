# Refonte visuelle Agenda (style GHL) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refonte visuelle de l'agenda pour matcher le niveau de GoHighLevel — blocs RDV avec hauteur proportionnelle, panel filtres à droite, modale avec onglets, et lieux multiples.

**Architecture:** Refactorer les composants existants (BookingBlock, WeekView, DayView, AgendaSidebar, NewBookingModal, page.tsx) + créer FilterPanel + table booking_locations + API CRUD lieux. Pas de nouveaux patterns — on suit exactement les patterns existants.

**Tech Stack:** Next.js 14 App Router, Supabase, date-fns, Zod, Lucide, inline styles (CSS vars)

**Spec:** `docs/superpowers/specs/2026-03-31-agenda-visual-polish-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `supabase/migrations/004_booking_locations.sql` | Table booking_locations + migration booking_calendars (location→location_ids) + booking.location_id |
| `src/lib/validations/booking-locations.ts` | Zod schemas for location CRUD |
| `src/app/api/booking-locations/route.ts` | GET + POST locations |
| `src/app/api/booking-locations/[id]/route.ts` | GET + PATCH + DELETE single location |
| `src/components/agenda/FilterPanel.tsx` | Right-side collapsible filter panel |

### Modified Files

| File | Changes |
|------|---------|
| `src/types/index.ts` | Add BookingLocation, modify BookingCalendar (location→location_ids), modify Booking (add location_id), modify BookingWithCalendar (add location join) |
| `src/components/agenda/BookingBlock.tsx` | Complete rewrite — proportional height, time range, calendar name |
| `src/components/agenda/WeekView.tsx` | Absolute positioning of blocks, overlap handling |
| `src/components/agenda/DayView.tsx` | Same refactor as WeekView |
| `src/components/agenda/AgendaSidebar.tsx` | Simplify — remove calendar filters, keep only MiniCalendar |
| `src/components/agenda/NewBookingModal.tsx` | Tabs (RDV/Horaire bloqué), location dropdown |
| `src/app/(dashboard)/agenda/page.tsx` | Add FilterPanel, filterType state, "Gérer l'affichage" button |
| `src/app/api/bookings/route.ts` | Add location join in BOOKING_SELECT, accept location_id in POST |
| `src/lib/validations/bookings.ts` | Add location_id to createBookingSchema |

---

## Task 1: Database Migration — Booking Locations

**Files:**
- Create: `supabase/migrations/004_booking_locations.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/004_booking_locations.sql`:

```sql
-- Migration 004: Booking locations + calendar location_ids + booking location_id

-- ─── Booking Locations ───────────────────────────────────────────────────────
create table booking_locations (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  address text,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

alter table booking_locations enable row level security;
create policy "Workspace booking_locations" on booking_locations
  for all using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

-- ─── Migrate booking_calendars: location text → location_ids uuid[] ─────────
alter table booking_calendars add column location_ids uuid[] not null default '{}';
alter table booking_calendars drop column if exists location;

-- ─── Add location_id to bookings ────────────────────────────────────────────
alter table bookings add column location_id uuid references booking_locations(id) on delete set null;
```

- [ ] **Step 2: Add SQL to docs/sql-a-executer.md**

Append under a new section `## 4. Migration Booking Locations` with the SQL and a verification query.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/004_booking_locations.sql docs/sql-a-executer.md
git commit -m "feat: add booking_locations migration + location_ids on calendars"
```

---

## Task 2: Types + Validations for Locations

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/lib/validations/booking-locations.ts`
- Modify: `src/lib/validations/bookings.ts`

- [ ] **Step 1: Add BookingLocation type and update existing types**

In `src/types/index.ts`:

Add new type after BookingCalendar:
```typescript
export interface BookingLocation {
  id: string
  workspace_id: string
  name: string
  address: string | null
  is_active: boolean
  created_at: string
}
```

Modify `BookingCalendar` — replace `location: string | null` with `location_ids: string[]`:
```typescript
// BEFORE:
  location: string | null
// AFTER:
  location_ids: string[]
```

Modify `Booking` — add `location_id`:
```typescript
// ADD after google_event_id:
  location_id: string | null
```

Modify `BookingWithCalendar` — replace location in booking_calendar pick and add location join:
```typescript
// BEFORE:
export interface BookingWithCalendar extends Booking {
  booking_calendar: Pick<BookingCalendar, 'name' | 'color' | 'location'> | null
  lead: Pick<Lead, 'id' | 'first_name' | 'last_name' | 'phone' | 'email'> | null
}
// AFTER:
export interface BookingWithCalendar extends Booking {
  booking_calendar: Pick<BookingCalendar, 'name' | 'color'> | null
  lead: Pick<Lead, 'id' | 'first_name' | 'last_name' | 'phone' | 'email'> | null
  location: Pick<BookingLocation, 'id' | 'name' | 'address'> | null
}
```

- [ ] **Step 2: Create booking-locations validation**

Create `src/lib/validations/booking-locations.ts`:

```typescript
import { z } from 'zod'

export const createBookingLocationSchema = z.object({
  name: z.string().min(1, 'Le nom est requis.').max(100),
  address: z.string().max(300).optional().nullable(),
  is_active: z.boolean().default(true),
})

export const updateBookingLocationSchema = createBookingLocationSchema.partial()

export type CreateBookingLocationData = z.infer<typeof createBookingLocationSchema>
export type UpdateBookingLocationData = z.infer<typeof updateBookingLocationSchema>
```

- [ ] **Step 3: Update bookings validation — add location_id**

In `src/lib/validations/bookings.ts`, add `location_id` to `createBookingSchema`:

```typescript
// ADD after lead_id:
  location_id: z.string().uuid('ID lieu invalide.').optional().nullable(),
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/lib/validations/booking-locations.ts src/lib/validations/bookings.ts
git commit -m "feat: add BookingLocation type + update types for locations"
```

---

## Task 3: Booking Locations API

**Files:**
- Create: `src/app/api/booking-locations/route.ts`
- Create: `src/app/api/booking-locations/[id]/route.ts`

- [ ] **Step 1: Create list + create route**

Create `src/app/api/booking-locations/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createBookingLocationSchema } from '@/lib/validations/booking-locations'

export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('booking_locations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('name', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const body = await request.json()
    const parsed = createBookingLocationSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides.', details: parsed.error.flatten() }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('booking_locations')
      .insert({ ...parsed.data, workspace_id: workspaceId })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create single resource route**

Create `src/app/api/booking-locations/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { updateBookingLocationSchema } from '@/lib/validations/booking-locations'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('booking_locations')
      .select('*')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Lieu introuvable.' }, { status: 404 })
    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const body = await request.json()
    const parsed = updateBookingLocationSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides.', details: parsed.error.flatten() }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('booking_locations')
      .update(parsed.data)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error || !data) return NextResponse.json({ error: 'Lieu introuvable.' }, { status: 404 })
    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('booking_locations')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error || !data) return NextResponse.json({ error: 'Lieu introuvable.' }, { status: 404 })
    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Update bookings API — add location join + accept location_id**

In `src/app/api/bookings/route.ts`, update `BOOKING_SELECT`:

```typescript
// BEFORE:
const BOOKING_SELECT = '*, booking_calendar:booking_calendars(name, color, location), lead:leads(id, first_name, last_name, phone, email)'
// AFTER:
const BOOKING_SELECT = '*, booking_calendar:booking_calendars(name, color), lead:leads(id, first_name, last_name, phone, email), location:booking_locations(id, name, address)'
```

In the POST handler, add `location_id` to the insert object (after `is_personal`):

```typescript
location_id: parsed.data.location_id || null,
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/app/api/booking-locations/ src/app/api/bookings/route.ts
git commit -m "feat: add booking locations CRUD API + location join in bookings"
```

---

## Task 4: BookingBlock — Proportional Height Rewrite

**Files:**
- Modify: `src/components/agenda/BookingBlock.tsx`

- [ ] **Step 1: Rewrite BookingBlock**

Replace the entire content of `src/components/agenda/BookingBlock.tsx` with:

```typescript
'use client'

import { format, parseISO, addMinutes } from 'date-fns'
import { BookingWithCalendar } from '@/types'

interface BookingBlockProps {
  booking: BookingWithCalendar
  onClick: (booking: BookingWithCalendar) => void
  style?: React.CSSProperties
}

export function BookingBlock({ booking, onClick, style }: BookingBlockProps) {
  const color = booking.is_personal
    ? '#6b7280'
    : booking.booking_calendar?.color || '#3b82f6'

  const leadName = booking.lead
    ? `${booking.lead.first_name} ${booking.lead.last_name}`.trim()
    : null

  const displayTitle = booking.is_personal
    ? booking.title
    : leadName || booking.title

  const startTime = format(parseISO(booking.scheduled_at), 'HH:mm')
  const endTime = format(addMinutes(parseISO(booking.scheduled_at), booking.duration_minutes), 'HH:mm')

  const calendarName = booking.booking_calendar?.name || null
  const locationName = booking.location?.name || null

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(booking) }}
      style={{
        position: 'absolute',
        left: 2,
        right: 2,
        background: `${color}26`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 4,
        padding: '4px 6px',
        cursor: 'pointer',
        overflow: 'hidden',
        zIndex: 1,
        transition: 'opacity 0.1s',
        ...style,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.85' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
    >
      <div style={{
        fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {displayTitle}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
        {startTime} - {endTime}
      </div>
      {(calendarName || locationName) && (
        <div style={{
          fontSize: 9, color: 'var(--text-muted)', marginTop: 2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          opacity: 0.7,
        }}>
          {calendarName}{calendarName && locationName ? ' · ' : ''}{locationName}
        </div>
      )}
    </div>
  )
}
```

**Key changes from before:**
- Removed `compact` prop — now always uses the rich format
- Added `style` prop for position/height injection from parent
- Position: absolute (parent sets top + height)
- Shows time range (start - end) instead of just start
- Shows calendar name + location name
- Uses `e.stopPropagation()` to prevent slot click when clicking a block
- Hover opacity effect

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/components/agenda/BookingBlock.tsx
git commit -m "feat: rewrite BookingBlock with proportional height + time range"
```

---

## Task 5: WeekView — Absolute Positioning + Overlap

**Files:**
- Modify: `src/components/agenda/WeekView.tsx`

- [ ] **Step 1: Rewrite WeekView with absolute positioning**

Replace the entire content of `src/components/agenda/WeekView.tsx` with:

```typescript
'use client'

import { startOfWeek, addDays, isSameDay, isToday, parseISO, format, getHours, getMinutes } from 'date-fns'
import { fr } from 'date-fns/locale'
import { BookingWithCalendar } from '@/types'
import { BookingBlock } from './BookingBlock'

interface WeekViewProps {
  date: Date
  bookings: BookingWithCalendar[]
  onBookingClick: (booking: BookingWithCalendar) => void
  onSlotClick: (date: Date, hour: number) => void
}

const CELL_HEIGHT = 60
const START_HOUR = 7
const END_HOUR = 21
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR)

function getBookingPosition(booking: BookingWithCalendar) {
  const d = parseISO(booking.scheduled_at)
  const hour = getHours(d)
  const minutes = getMinutes(d)
  const top = (hour - START_HOUR) * CELL_HEIGHT + (minutes / 60) * CELL_HEIGHT
  const height = Math.max((booking.duration_minutes / 60) * CELL_HEIGHT, 20)
  return { top, height }
}

function resolveOverlaps(bookings: BookingWithCalendar[]): (BookingWithCalendar & { col: number; totalCols: number })[] {
  if (bookings.length === 0) return []
  const sorted = [...bookings].sort((a, b) =>
    new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  )
  const result: (BookingWithCalendar & { col: number; totalCols: number })[] = []
  const groups: BookingWithCalendar[][] = []

  for (const b of sorted) {
    const bStart = new Date(b.scheduled_at).getTime()
    let placed = false
    for (const group of groups) {
      const lastInGroup = group[group.length - 1]
      const lastEnd = new Date(lastInGroup.scheduled_at).getTime() + lastInGroup.duration_minutes * 60000
      if (bStart >= lastEnd) {
        group.push(b)
        placed = true
        break
      }
    }
    if (!placed) groups.push([b])
  }

  const totalCols = groups.length
  for (let col = 0; col < groups.length; col++) {
    for (const b of groups[col]) {
      result.push({ ...b, col, totalCols })
    }
  }
  return result
}

export function WeekView({ date, bookings, onBookingClick, onSlotClick }: WeekViewProps) {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 })
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      {/* Sticky header */}
      <div style={{
        display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)',
        borderBottom: '1px solid var(--border-secondary)', position: 'sticky', top: 0,
        zIndex: 5, background: 'var(--bg-primary)',
      }}>
        <div style={{ borderRight: '1px solid var(--border-secondary)' }} />
        {days.map((day) => (
          <div key={day.toISOString()} style={{
            textAlign: 'center', padding: '8px 0',
            borderRight: '1px solid var(--border-secondary)',
          }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: isToday(day) ? '#E53E3E' : 'var(--text-muted)' }}>
              {format(day, 'EEE', { locale: fr })}
            </div>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '2px auto 0', fontSize: 15, fontWeight: 600,
              background: isToday(day) ? '#E53E3E' : 'transparent',
              color: isToday(day) ? '#fff' : 'var(--text-primary)',
            }}>
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', flex: 1 }}>
        {/* Hour labels + day columns */}
        {HOURS.map((hour) => (
          <div key={hour} style={{ display: 'contents' }}>
            <div style={{
              height: CELL_HEIGHT, padding: '0 8px 0 0', textAlign: 'right', fontSize: 10,
              color: 'var(--text-muted)', borderRight: '1px solid var(--border-secondary)',
              borderBottom: '1px solid var(--border-secondary)',
              display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingTop: 2,
            }}>
              {String(hour).padStart(2, '0')}:00
            </div>
            {days.map((day) => (
              <div
                key={`${day.toISOString()}-${hour}`}
                onClick={() => onSlotClick(day, hour)}
                style={{
                  height: CELL_HEIGHT, position: 'relative', cursor: 'pointer',
                  borderRight: '1px solid var(--border-secondary)',
                  borderBottom: '1px solid var(--border-secondary)',
                  background: isToday(day) ? 'rgba(229,62,62,0.02)' : 'transparent',
                }}
              >
                {/* Bookings are rendered in the first hour cell only (hour === START_HOUR) via the overlay below */}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Booking overlay — positioned above the grid */}
      <div style={{
        position: 'absolute', top: 58, left: 60, right: 0, bottom: 0, pointerEvents: 'none',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', height: '100%' }}>
          {days.map((day) => {
            const dayBookings = bookings.filter((b) => isSameDay(parseISO(b.scheduled_at), day))
            const positioned = resolveOverlaps(dayBookings)
            return (
              <div key={day.toISOString()} style={{ position: 'relative', pointerEvents: 'auto' }}>
                {positioned.map((b) => {
                  const pos = getBookingPosition(b)
                  const width = 100 / b.totalCols
                  const left = width * b.col
                  return (
                    <BookingBlock
                      key={b.id}
                      booking={b}
                      onClick={onBookingClick}
                      style={{
                        top: pos.top,
                        height: pos.height,
                        left: `${left}%`,
                        width: `calc(${width}% - 4px)`,
                      }}
                    />
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

**Key changes:**
- Bookings positioned absolutely with `top` and `height` calculated from time/duration
- `resolveOverlaps` splits concurrent bookings into columns
- `CELL_HEIGHT = 60px`, `START_HOUR = 7`, `END_HOUR = 21`
- Booking overlay div sits above the grid with `pointer-events: none` (blocks have `auto`)
- No more compact BookingBlock — all blocks use the rich format

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/components/agenda/WeekView.tsx
git commit -m "feat: rewrite WeekView with absolute positioning + overlap handling"
```

---

## Task 6: DayView — Same Refactor

**Files:**
- Modify: `src/components/agenda/DayView.tsx`

- [ ] **Step 1: Rewrite DayView with absolute positioning**

Replace the entire content of `src/components/agenda/DayView.tsx` with:

```typescript
'use client'

import { isSameDay, parseISO, format, getHours, getMinutes } from 'date-fns'
import { fr } from 'date-fns/locale'
import { BookingWithCalendar } from '@/types'
import { BookingBlock } from './BookingBlock'

interface DayViewProps {
  date: Date
  bookings: BookingWithCalendar[]
  onBookingClick: (booking: BookingWithCalendar) => void
  onSlotClick: (date: Date, hour: number) => void
}

const CELL_HEIGHT = 60
const START_HOUR = 7
const END_HOUR = 21
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR)

function getBookingPosition(booking: BookingWithCalendar) {
  const d = parseISO(booking.scheduled_at)
  const hour = getHours(d)
  const minutes = getMinutes(d)
  const top = (hour - START_HOUR) * CELL_HEIGHT + (minutes / 60) * CELL_HEIGHT
  const height = Math.max((booking.duration_minutes / 60) * CELL_HEIGHT, 20)
  return { top, height }
}

export function DayView({ date, bookings, onBookingClick, onSlotClick }: DayViewProps) {
  const dayBookings = bookings.filter((b) => isSameDay(parseISO(b.scheduled_at), date))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      {/* Day header */}
      <div style={{
        textAlign: 'center', padding: '12px 0', fontSize: 14, fontWeight: 600,
        color: 'var(--text-primary)', borderBottom: '1px solid var(--border-secondary)',
        textTransform: 'capitalize', position: 'sticky', top: 0, zIndex: 5,
        background: 'var(--bg-primary)',
      }}>
        {format(date, 'EEEE d MMMM yyyy', { locale: fr })}
      </div>

      {/* Time grid */}
      <div style={{ position: 'relative', flex: 1 }}>
        {HOURS.map((hour) => (
          <div
            key={hour}
            onClick={() => onSlotClick(date, hour)}
            style={{
              display: 'flex', height: CELL_HEIGHT, cursor: 'pointer',
              borderBottom: '1px solid var(--border-secondary)',
            }}
          >
            <div style={{
              width: 60, flexShrink: 0, textAlign: 'right', paddingRight: 8, paddingTop: 2,
              fontSize: 10, color: 'var(--text-muted)',
              borderRight: '1px solid var(--border-secondary)',
            }}>
              {String(hour).padStart(2, '0')}:00
            </div>
            <div style={{ flex: 1 }} />
          </div>
        ))}

        {/* Bookings overlay */}
        <div style={{ position: 'absolute', top: 0, left: 60, right: 0, bottom: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'relative', height: '100%', pointerEvents: 'auto' }}>
            {dayBookings.map((b) => {
              const pos = getBookingPosition(b)
              return (
                <BookingBlock
                  key={b.id}
                  booking={b}
                  onClick={onBookingClick}
                  style={{ top: pos.top, height: pos.height, left: 4, right: 4 }}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/components/agenda/DayView.tsx
git commit -m "feat: rewrite DayView with absolute positioning"
```

---

## Task 7: FilterPanel + Simplified Sidebar + Page Integration

**Files:**
- Create: `src/components/agenda/FilterPanel.tsx`
- Modify: `src/components/agenda/AgendaSidebar.tsx`
- Modify: `src/app/(dashboard)/agenda/page.tsx`

- [ ] **Step 1: Create FilterPanel**

Create `src/components/agenda/FilterPanel.tsx`:

```typescript
'use client'

import { X } from 'lucide-react'
import { BookingCalendar } from '@/types'

type FilterType = 'all' | 'bookings' | 'blocked'

interface FilterPanelProps {
  isOpen: boolean
  onClose: () => void
  filterType: FilterType
  onFilterTypeChange: (type: FilterType) => void
  calendars: BookingCalendar[]
  visibleCalendarIds: Set<string>
  onToggleCalendar: (id: string) => void
  showPersonal: boolean
  onTogglePersonal: () => void
}

const FILTER_TYPES: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'bookings', label: 'Rendez-vous' },
  { value: 'blocked', label: 'Créneaux bloqués' },
]

export function FilterPanel({
  isOpen, onClose, filterType, onFilterTypeChange,
  calendars, visibleCalendarIds, onToggleCalendar,
  showPersonal, onTogglePersonal,
}: FilterPanelProps) {
  if (!isOpen) return null

  return (
    <div style={{
      width: 300, flexShrink: 0, borderLeft: '1px solid var(--border-secondary)',
      background: 'var(--bg-elevated)', padding: 20, overflowY: 'auto',
      display: 'flex', flexDirection: 'column', gap: 20,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 600 }}>
          Gérer l&apos;affichage
        </h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <X size={18} />
        </button>
      </div>

      {/* Filter by type */}
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 8 }}>
          Afficher par type
        </div>
        {FILTER_TYPES.map((ft) => (
          <label key={ft.value} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
            cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)',
          }}>
            <input
              type="radio"
              name="filterType"
              checked={filterType === ft.value}
              onChange={() => onFilterTypeChange(ft.value)}
              style={{ accentColor: '#E53E3E' }}
            />
            {ft.label}
          </label>
        ))}
      </div>

      {/* Calendars */}
      <div>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
        }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Calendriers</span>
        </div>
        {calendars.map((cal) => (
          <label key={cal.id} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0',
            cursor: 'pointer', fontSize: 13, color: visibleCalendarIds.has(cal.id) ? 'var(--text-primary)' : 'var(--text-muted)',
          }}>
            <div
              onClick={(e) => { e.preventDefault(); onToggleCalendar(cal.id) }}
              style={{
                width: 14, height: 14, borderRadius: 3, flexShrink: 0, cursor: 'pointer',
                border: `2px solid ${cal.color}`,
                background: visibleCalendarIds.has(cal.id) ? cal.color : 'transparent',
                transition: 'background 0.15s',
              }}
            />
            {cal.name}
          </label>
        ))}
        <label style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', marginTop: 4,
          cursor: 'pointer', fontSize: 13, color: showPersonal ? 'var(--text-primary)' : 'var(--text-muted)',
        }}>
          <div
            onClick={(e) => { e.preventDefault(); onTogglePersonal() }}
            style={{
              width: 14, height: 14, borderRadius: 3, flexShrink: 0, cursor: 'pointer',
              border: '2px solid #6b7280',
              background: showPersonal ? '#6b7280' : 'transparent',
              transition: 'background 0.15s',
            }}
          />
          Événements personnels
        </label>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Simplify AgendaSidebar**

Replace `src/components/agenda/AgendaSidebar.tsx` with:

```typescript
'use client'

import MiniCalendar from './MiniCalendar'

interface AgendaSidebarProps {
  selectedDate: Date
  onDateSelect: (date: Date) => void
}

export function AgendaSidebar({ selectedDate, onDateSelect }: AgendaSidebarProps) {
  return (
    <div style={{
      width: 220, flexShrink: 0, borderRight: '1px solid var(--border-secondary)',
      background: 'var(--bg-elevated)', padding: 16,
    }}>
      <MiniCalendar selectedDate={selectedDate} onDateSelect={onDateSelect} />
    </div>
  )
}
```

- [ ] **Step 3: Update Agenda page**

In `src/app/(dashboard)/agenda/page.tsx`, make these changes:

**Add imports:**
```typescript
import { FilterPanel } from '@/components/agenda/FilterPanel'
import { BookingLocation } from '@/types'
import { SlidersHorizontal } from 'lucide-react'
```

**Add state variables** (after existing state):
```typescript
const [showFilterPanel, setShowFilterPanel] = useState(false)
const [filterType, setFilterType] = useState<'all' | 'bookings' | 'blocked'>('all')
const [locations, setLocations] = useState<BookingLocation[]>([])
```

**Add locations fetch** in the existing `fetchCalendars` useEffect:
```typescript
// After the calendars fetch, add:
const locRes = await fetch('/api/booking-locations')
if (locRes.ok) {
  const locJson = await locRes.json()
  setLocations(locJson.data || [])
}
```

**Update the filtering logic** (replace existing `filteredBookings`):
```typescript
const filteredBookings = bookings.filter((b) => {
  // Filter by type
  if (filterType === 'bookings' && b.is_personal) return false
  if (filterType === 'blocked' && !b.is_personal) return false
  // Filter by calendar visibility
  if (b.is_personal) return showPersonal
  if (b.calendar_id) return visibleCalendarIds.has(b.calendar_id)
  return true
})
```

**Update AgendaSidebar props** (remove calendar-related props):
```typescript
<AgendaSidebar
  selectedDate={currentDate}
  onDateSelect={(d) => { setCurrentDate(d); setViewMode('day') }}
/>
```

**Add "Gérer l'affichage" button** in the header bar, before the "+ Nouveau RDV" button:
```typescript
<button
  onClick={() => setShowFilterPanel(!showFilterPanel)}
  style={{
    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
    background: showFilterPanel ? 'rgba(229,62,62,0.1)' : 'var(--bg-secondary)',
    color: showFilterPanel ? '#E53E3E' : 'var(--text-secondary)',
    border: `1px solid ${showFilterPanel ? '#E53E3E' : 'var(--border-secondary)'}`,
    borderRadius: 8, fontSize: 13, cursor: 'pointer',
  }}
>
  <SlidersHorizontal size={14} /> Gérer l&apos;affichage
</button>
```

**Add FilterPanel** after the calendar view container, at the same flex level:
```typescript
<FilterPanel
  isOpen={showFilterPanel}
  onClose={() => setShowFilterPanel(false)}
  filterType={filterType}
  onFilterTypeChange={setFilterType}
  calendars={calendars}
  visibleCalendarIds={visibleCalendarIds}
  onToggleCalendar={toggleCalendar}
  showPersonal={showPersonal}
  onTogglePersonal={() => setShowPersonal((p) => !p)}
/>
```

The layout is: `AgendaSidebar | CalendarViews | FilterPanel(optional)`

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/components/agenda/FilterPanel.tsx src/components/agenda/AgendaSidebar.tsx src/app/(dashboard)/agenda/page.tsx
git commit -m "feat: add filter panel, simplify sidebar, integrate into agenda page"
```

---

## Task 8: NewBookingModal — Tabs + Location Dropdown

**Files:**
- Modify: `src/components/agenda/NewBookingModal.tsx`

- [ ] **Step 1: Update NewBookingModal with tabs and location dropdown**

Make these changes to `src/components/agenda/NewBookingModal.tsx`:

**Update props interface** — add `locations`:
```typescript
import { BookingCalendar, Lead, BookingLocation } from '@/types'

interface NewBookingModalProps {
  calendars: BookingCalendar[]
  locations: BookingLocation[]
  prefillDate: string
  prefillTime: string
  onClose: () => void
  onCreated: () => void
}
```

**Replace `isPersonal` state** with `activeTab`:
```typescript
// BEFORE:
const [isPersonal, setIsPersonal] = useState(false)
// AFTER:
const [activeTab, setActiveTab] = useState<'booking' | 'blocked'>('booking')
```

**Add location state:**
```typescript
const [locationId, setLocationId] = useState<string>('')
```

**Add computed available locations:**
```typescript
const selectedCalendar = calendars.find((c) => c.id === calendarId)
const availableLocations = locations.filter((l) =>
  l.is_active && selectedCalendar?.location_ids?.includes(l.id)
)
```

**Update submit body** — replace `isPersonal` with `activeTab === 'blocked'` and add `location_id`:
```typescript
const body = activeTab === 'blocked'
  ? {
      is_personal: true,
      title,
      scheduled_at: scheduledAt,
      duration_minutes: duration,
      notes: notes || null,
    }
  : {
      is_personal: false,
      calendar_id: calendarId || null,
      lead_id: selectedLead?.id ?? null,
      location_id: locationId || null,
      title: selectedLead
        ? `${selectedLead.first_name} ${selectedLead.last_name}`.trim()
        : 'Rendez-vous',
      scheduled_at: scheduledAt,
      duration_minutes: duration,
      notes: notes || null,
    }
```

**Replace the mode toggle UI** with tabs:
```typescript
{/* Tabs */}
<div style={{ display: 'flex', borderBottom: '2px solid var(--border-secondary)', marginBottom: 16 }}>
  {[
    { key: 'booking' as const, label: 'Rendez-vous' },
    { key: 'blocked' as const, label: 'Horaire bloqué' },
  ].map((tab) => (
    <button
      key={tab.key}
      type="button"
      onClick={() => setActiveTab(tab.key)}
      style={{
        padding: '10px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
        background: 'none', border: 'none',
        color: activeTab === tab.key ? '#E53E3E' : 'var(--text-muted)',
        borderBottom: activeTab === tab.key ? '2px solid #E53E3E' : '2px solid transparent',
        marginBottom: -2,
      }}
    >
      {tab.label}
    </button>
  ))}
</div>
```

**Add location dropdown** in the booking tab, after the lead search:
```typescript
{/* Location dropdown — only if calendar has locations */}
{activeTab === 'booking' && availableLocations.length > 0 && (
  <div style={{ marginBottom: 12 }}>
    <label style={labelStyle}>Lieu de la réunion</label>
    <select
      value={locationId}
      onChange={(e) => setLocationId(e.target.value)}
      style={{ ...inputStyle, cursor: 'pointer' }}
    >
      <option value="">Sélectionnez un lieu</option>
      {availableLocations.map((l) => (
        <option key={l.id} value={l.id}>{l.name}</option>
      ))}
    </select>
  </div>
)}
```

**Update submit button label:**
```typescript
{activeTab === 'blocked' ? 'Bloquer le créneau' : 'Prendre rendez-vous'}
```

- [ ] **Step 2: Update page.tsx to pass locations to modal**

In `src/app/(dashboard)/agenda/page.tsx`, update the NewBookingModal call:

```typescript
<NewBookingModal
  calendars={calendars}
  locations={locations}
  prefillDate={modalPrefill.date}
  prefillTime={modalPrefill.time}
  onClose={() => setShowNewModal(false)}
  onCreated={fetchBookings}
/>
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/components/agenda/NewBookingModal.tsx src/app/(dashboard)/agenda/page.tsx
git commit -m "feat: add tabs (RDV/Horaire bloqué) + location dropdown to booking modal"
```

---

## Task 9: Update MonthView + BookingDetailPanel for location

**Files:**
- Modify: `src/components/agenda/MonthView.tsx`
- Modify: `src/components/agenda/BookingDetailPanel.tsx`

- [ ] **Step 1: Update MonthView to remove compact prop**

In `src/components/agenda/MonthView.tsx`, replace the `BookingBlock` usage. Since BookingBlock no longer takes `compact`, use a simple inline render for month cells instead:

Replace the booking rendering inside the day cell loop:
```typescript
{dayBookings.slice(0, 3).map((b) => {
  const color = b.is_personal ? '#6b7280' : b.booking_calendar?.color || '#3b82f6'
  const title = b.lead ? `${b.lead.first_name} ${b.lead.last_name}`.trim() : b.title
  return (
    <div
      key={b.id}
      onClick={(e) => { e.stopPropagation(); onBookingClick(b) }}
      style={{
        background: color, color: '#fff', padding: '1px 4px', borderRadius: 2,
        fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        marginBottom: 1, cursor: 'pointer',
      }}
    >
      {format(parseISO(b.scheduled_at), 'HH:mm')} {title}
    </div>
  )
})}
```

Remove the `BookingBlock` import if it was used in MonthView.

- [ ] **Step 2: Update BookingDetailPanel — show location**

In `src/components/agenda/BookingDetailPanel.tsx`, find the location display section (the one using `booking.booking_calendar?.location`). Replace it with:

```typescript
{booking.location && (
  <DetailRow icon={<MapPin size={14} />} label="Lieu">
    {booking.location.name}
    {booking.location.address && (
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
        {booking.location.address}
      </div>
    )}
  </DetailRow>
)}
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/components/agenda/MonthView.tsx src/components/agenda/BookingDetailPanel.tsx
git commit -m "feat: update MonthView and BookingDetailPanel for location support"
```

---

## Task 10: Final Build Verification

- [ ] **Step 1: Full TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors related to agenda components.

- [ ] **Step 2: Full Next.js build**

Run: `npm run build`
Expected: Build completes with no errors.

- [ ] **Step 3: Commit any remaining fixes**

If any issues found, fix and commit.

- [ ] **Step 4: Push**

```bash
git push origin feature/pierre-automations
```
