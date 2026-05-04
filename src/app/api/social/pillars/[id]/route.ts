import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { z } from 'zod'
import type { Weekday } from '@/types'

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

const deleteOptionsSchema = z.object({
  mode: z.enum(['detach', 'replace']).optional(),
  replacement_id: z.string().uuid().optional(),
}).optional()

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('ig_content_pillars')
      .update(parsed.data)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const url = new URL(request.url)
    const opts = deleteOptionsSchema.parse({
      mode: url.searchParams.get('mode') ?? undefined,
      replacement_id: url.searchParams.get('replacement_id') ?? undefined,
    })

    const supabase = await createClient()

    // Compter les usages
    const { count: postCount } = await supabase
      .from('social_posts')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('pillar_id', id)

    const { data: trame } = await supabase
      .from('content_trame')
      .select('stories_grid, posts_grid')
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    const countInGrid = (grid: Record<Weekday, (string | null)[]>) =>
      Object.values(grid).reduce(
        (acc, arr) => acc + (arr ?? []).filter((p) => p === id).length,
        0
      )

    const inTrameCount = trame
      ? countInGrid(trame.stories_grid as Record<Weekday, (string | null)[]>) +
        countInGrid(trame.posts_grid as Record<Weekday, (string | null)[]>)
      : 0

    const totalUsage = (postCount ?? 0) + inTrameCount

    // Si pas d'usages OU mode explicite fourni → procède
    if (totalUsage > 0 && !opts?.mode) {
      return NextResponse.json(
        {
          error: 'Pillar utilisé',
          usage_count: postCount ?? 0,
          in_trame_count: inTrameCount,
        },
        { status: 409 }
      )
    }

    if (opts?.mode === 'replace') {
      if (!opts.replacement_id) {
        return NextResponse.json({ error: 'replacement_id requis' }, { status: 400 })
      }
      // Update slots
      await supabase
        .from('social_posts')
        .update({ pillar_id: opts.replacement_id })
        .eq('workspace_id', workspaceId)
        .eq('pillar_id', id)
      // Update trame JSONB
      if (trame) {
        const replaceInGrid = (grid: Record<Weekday, (string | null)[]>) => {
          const out: Record<Weekday, (string | null)[]> = {} as Record<Weekday, (string | null)[]>
          for (const [k, v] of Object.entries(grid)) {
            out[k as Weekday] = (v ?? []).map((p) => (p === id ? opts.replacement_id! : p))
          }
          return out
        }
        await supabase
          .from('content_trame')
          .update({
            stories_grid: replaceInGrid(trame.stories_grid as Record<Weekday, (string | null)[]>),
            posts_grid: replaceInGrid(trame.posts_grid as Record<Weekday, (string | null)[]>),
          })
          .eq('workspace_id', workspaceId)
      }
    } else if (opts?.mode === 'detach') {
      // SET pillar_id NULL on slots
      await supabase
        .from('social_posts')
        .update({ pillar_id: null })
        .eq('workspace_id', workspaceId)
        .eq('pillar_id', id)
      // Null out trame cells
      if (trame) {
        const nullInGrid = (grid: Record<Weekday, (string | null)[]>) => {
          const out: Record<Weekday, (string | null)[]> = {} as Record<Weekday, (string | null)[]>
          for (const [k, v] of Object.entries(grid)) {
            out[k as Weekday] = (v ?? []).map((p) => (p === id ? null : p))
          }
          return out
        }
        await supabase
          .from('content_trame')
          .update({
            stories_grid: nullInGrid(trame.stories_grid as Record<Weekday, (string | null)[]>),
            posts_grid: nullInGrid(trame.posts_grid as Record<Weekday, (string | null)[]>),
          })
          .eq('workspace_id', workspaceId)
      }
    }

    const { error } = await supabase
      .from('ig_content_pillars')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
