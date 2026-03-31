import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createBookingCalendarSchema } from '@/lib/validations/booking-calendars'

export async function GET(_request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('booking_calendars')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const body = await request.json()
    const parsed = createBookingCalendarSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    // Check slug uniqueness within workspace
    const { data: existing } = await supabase
      .from('booking_calendars')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('slug', parsed.data.slug)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Ce slug est déjà utilisé.' }, { status: 409 })
    }

    const { data, error } = await supabase
      .from('booking_calendars')
      .insert({ ...parsed.data, workspace_id: workspaceId })
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
