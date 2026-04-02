import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { updateSequenceItemsSchema } from '@/lib/validations/instagram'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getWorkspaceId()
    const supabase = await createClient()
    const { id } = await params
    const { data, error } = await supabase
      .from('story_sequence_items')
      .select('*, story:ig_stories(*)')
      .eq('sequence_id', id)
      .order('position', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated')
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { id } = await params
    const body = await request.json()
    const parsed = updateSequenceItemsSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    // Delete existing items
    await supabase.from('story_sequence_items').delete().eq('sequence_id', id)

    // Insert new items
    if (parsed.data.items.length > 0) {
      const rows = parsed.data.items.map(item => ({
        sequence_id: id,
        story_id: item.story_id,
        position: item.position,
      }))
      const { error: insertError } = await supabase.from('story_sequence_items').insert(rows)
      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Recalculate sequence aggregates
    const { data: items } = await supabase
      .from('story_sequence_items')
      .select('*, story:ig_stories(impressions, replies, exits)')
      .eq('sequence_id', id)
      .order('position', { ascending: true })

    const totalImpressions = (items ?? []).reduce((s, i: any) => s + (i.story?.impressions ?? 0), 0)
    const totalReplies = (items ?? []).reduce((s, i: any) => s + (i.story?.replies ?? 0), 0)
    const first = (items as any)?.[0]?.story?.impressions ?? 0
    const last = (items as any)?.[items!.length - 1]?.story?.impressions ?? 0
    const dropoff = first > 0 ? Math.round((1 - last / first) * 100) : 0

    await supabase.from('story_sequences').update({
      total_impressions: totalImpressions,
      total_replies: totalReplies,
      overall_dropoff_rate: dropoff,
    }).eq('id', id).eq('workspace_id', workspaceId)

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated')
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
