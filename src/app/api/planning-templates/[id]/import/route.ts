import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { importTemplateSchema } from '@/lib/validations/planning-templates'
import { createGoogleCalendarEvent } from '@/lib/google/calendar'
import { addDays, parseISO } from 'date-fns'

const DAY_OFFSETS: Record<string, number> = {
  monday: 0, tuesday: 1, wednesday: 2, thursday: 3,
  friday: 4, saturday: 5, sunday: 6,
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const body = await request.json()
    const parsed = importTemplateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides.', details: parsed.error.flatten() }, { status: 400 })
    }

    // Get template
    const { data: template, error: templateError } = await supabase
      .from('planning_templates')
      .select('*')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (templateError || !template) {
      return NextResponse.json({ error: 'Template introuvable.' }, { status: 404 })
    }

    const weekStart = parseISO(parsed.data.week_start)
    const blocks = (template.blocks || []) as Array<{
      day: string; start: string; end: string; title: string; color: string
    }>

    // Create bookings for each block
    const bookings = blocks.map((block) => {
      const dayOffset = DAY_OFFSETS[block.day] ?? 0
      const blockDate = addDays(weekStart, dayOffset)
      const year = blockDate.getUTCFullYear()
      const month = String(blockDate.getUTCMonth() + 1).padStart(2, '0')
      const day = String(blockDate.getUTCDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`
      // Calculate duration from template times
      const [sH, sM] = block.start.split(':').map(Number)
      const [eH, eM] = block.end.split(':').map(Number)
      const duration_minutes = (eH * 60 + eM) - (sH * 60 + sM)

      // Convert local template time to UTC using client timezone offset
      const tzOffset = parsed.data.timezone_offset ?? 0  // minutes, e.g. -120 for GMT+2
      const localMinutes = sH * 60 + sM
      const utcMinutes = localMinutes + tzOffset
      const utcH = Math.floor(((utcMinutes % 1440) + 1440) % 1440 / 60)
      const utcM = ((utcMinutes % 1440) + 1440) % 1440 % 60
      const scheduled_at = `${dateStr}T${String(utcH).padStart(2, '0')}:${String(utcM).padStart(2, '0')}:00Z`

      return {
        workspace_id: workspaceId,
        title: block.title,
        scheduled_at,
        duration_minutes: duration_minutes > 0 ? duration_minutes : 30,
        is_personal: true,
        source: 'manual',
        status: 'confirmed',
        calendar_id: null,
        lead_id: null,
        location_id: null,
        notes: `Importé depuis template: ${template.name}`,
        form_data: { color: block.color || '#6b7280' },
      }
    })

    if (bookings.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from('bookings')
        .insert(bookings)
        .select('id, title, scheduled_at, duration_minutes, notes')

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }

      // Create Google Calendar events for each booking (non-blocking)
      for (const booking of inserted ?? []) {
        const start = new Date(booking.scheduled_at)
        const end = new Date(start.getTime() + (booking.duration_minutes ?? 30) * 60_000)
        createGoogleCalendarEvent(workspaceId, {
          summary: booking.title,
          description: booking.notes ?? undefined,
          start: { dateTime: start.toISOString() },
          end: { dateTime: end.toISOString() },
        })
          .then(async (googleEvent) => {
            if (googleEvent?.id) {
              const supa = await createClient()
              await supa
                .from('bookings')
                .update({ google_event_id: googleEvent.id })
                .eq('id', booking.id)
                .eq('workspace_id', workspaceId)
            }
          })
          .catch(() => {})
      }
    }

    return NextResponse.json({ imported: bookings.length }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
