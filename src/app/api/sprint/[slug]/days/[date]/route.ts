import { NextRequest, NextResponse } from 'next/server'
import { getSprintBySlug, upsertDayKpi } from '@/lib/sprint/queries'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; date: string }> }
) {
  const { slug, date } = await params
  const sprint = await getSprintBySlug(slug)
  if (!sprint) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const kpi = await upsertDayKpi(sprint.id, date, body)
  return NextResponse.json(kpi)
}
