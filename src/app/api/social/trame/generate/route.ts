import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { generateMonthSchema } from '@/lib/validations/content-trame'
import type { Weekday } from '@/types'

const WEEKDAY_FROM_JS: Record<number, Weekday> = {
  0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat',
}

interface SlotRow {
  workspace_id: string
  content_kind: 'post' | 'story'
  pillar_id: string | null
  plan_date: string
  slot_index: number
  production_status: 'idea'
  status: 'draft'
  created_by: string
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId, userId } = await getWorkspaceId()
    const body = await request.json()
    const parsed = generateMonthSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const { year, month, kinds, window, start_date, end_date } = parsed.data
    const includePosts = kinds.includes('post')
    const includeStories = kinds.includes('story')

    const supabase = await createClient()

    const { data: trame, error: trameErr } = await supabase
      .from('content_trame')
      .select('stories_grid, posts_grid')
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (trameErr) throw trameErr
    if (!trame) {
      return NextResponse.json(
        { error: 'Aucune trame définie pour ce workspace.' },
        { status: 404 }
      )
    }

    const storiesGrid = (trame.stories_grid ?? {}) as Record<Weekday, (string | null)[]>
    const postsGrid = (trame.posts_grid ?? {}) as Record<Weekday, (string | null)[]>

    // Détermine la liste des dates à générer selon window
    const datesToGenerate: { date: Date; planDate: string }[] = []
    const fmtDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

    if (window === 'range') {
      if (!start_date || !end_date) {
        return NextResponse.json({ error: 'start_date et end_date requis pour window=range' }, { status: 400 })
      }
      const start = new Date(start_date + 'T00:00:00')
      const end = new Date(end_date + 'T00:00:00')
      if (end < start) {
        return NextResponse.json({ error: 'end_date doit être après start_date' }, { status: 400 })
      }
      const cursor = new Date(start)
      while (cursor <= end) {
        datesToGenerate.push({ date: new Date(cursor), planDate: fmtDate(cursor) })
        cursor.setDate(cursor.getDate() + 1)
      }
    } else if (window === 'week') {
      const start = start_date ? new Date(start_date + 'T00:00:00') : new Date()
      for (let i = 0; i < 7; i++) {
        const d = new Date(start)
        d.setDate(start.getDate() + i)
        datesToGenerate.push({ date: d, planDate: fmtDate(d) })
      }
    } else {
      // window === 'month'
      if (!year || !month) {
        return NextResponse.json({ error: 'year et month requis pour window=month' }, { status: 400 })
      }
      const daysInMonth = new Date(year, month, 0).getDate()
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day)
        datesToGenerate.push({
          date,
          planDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        })
      }
    }

    const rows: SlotRow[] = []
    for (const { date, planDate } of datesToGenerate) {
      const wd = WEEKDAY_FROM_JS[date.getDay()]

      if (includeStories) {
        const storyCells = storiesGrid[wd] ?? []
        storyCells.forEach((pillar_id, slot_index) => {
          if (pillar_id) {
            rows.push({
              workspace_id: workspaceId,
              content_kind: 'story',
              pillar_id,
              plan_date: planDate,
              slot_index,
              production_status: 'idea',
              status: 'draft',
              created_by: userId,
            })
          }
        })
      }

      if (includePosts) {
        const postCells = postsGrid[wd] ?? []
        postCells.forEach((pillar_id, slot_index) => {
          if (pillar_id) {
            rows.push({
              workspace_id: workspaceId,
              content_kind: 'post',
              pillar_id,
              plan_date: planDate,
              slot_index,
              production_status: 'idea',
              status: 'draft',
              created_by: userId,
            })
          }
        })
      }
    }

    if (rows.length === 0) {
      return NextResponse.json({
        data: { slots_created: 0, message: 'Trame vide, rien à générer.' },
      })
    }

    // Idempotence : on vérifie quels slots existent déjà via la clé dédupe
    // (workspace_id, plan_date, content_kind, slot_index, pillar_id)
    const planDates = [...new Set(rows.map((r) => r.plan_date))]
    const { data: existing } = await supabase
      .from('social_posts')
      .select('plan_date, content_kind, slot_index, pillar_id')
      .eq('workspace_id', workspaceId)
      .in('plan_date', planDates)
      .not('slot_index', 'is', null)

    const existingKeys = new Set(
      (existing ?? []).map(
        (e) => `${e.plan_date}|${e.content_kind}|${e.slot_index}|${e.pillar_id ?? ''}`
      )
    )
    const toInsert = rows.filter(
      (r) =>
        !existingKeys.has(
          `${r.plan_date}|${r.content_kind}|${r.slot_index}|${r.pillar_id ?? ''}`
        )
    )

    let createdCount = 0
    if (toInsert.length > 0) {
      const { data: inserted, error: insErr } = await supabase
        .from('social_posts')
        .insert(toInsert)
        .select('id')
      if (insErr) throw insErr
      createdCount = inserted?.length ?? 0
    }

    if (year && month) {
      await supabase
        .from('content_trame_generations')
        .upsert(
          {
            workspace_id: workspaceId,
            year,
            month,
            generated_by: userId,
            generated_at: new Date().toISOString(),
            slots_created: createdCount,
          },
          { onConflict: 'workspace_id,year,month' }
        )
    }

    return NextResponse.json({
      data: {
        slots_created: createdCount,
        slots_skipped: rows.length - createdCount,
        slots_planned: rows.length,
      },
    })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
