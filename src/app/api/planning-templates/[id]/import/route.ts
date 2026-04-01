import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { importTemplateSchema } from '@/lib/validations/planning-templates'
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
      const dateStr = blockDate.toISOString().split('T')[0]
      const scheduled_at = new Date(`${dateStr}T${block.start}:00`).toISOString()

      const [startH, startM] = block.start.split(':').map(Number)
      const [endH, endM] = block.end.split(':').map(Number)
      const duration_minutes = (endH * 60 + endM) - (startH * 60 + startM)

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
        form_data: {},
      }
    })

    if (bookings.length > 0) {
      const { error: insertError } = await supabase
        .from('bookings')
        .insert(bookings)

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
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
