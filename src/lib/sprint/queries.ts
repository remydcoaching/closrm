import { createServiceClient } from '@/lib/supabase/service'
import type { SprintWeek, SprintDayKpi } from '@/types/sprint'

function client() {
  return createServiceClient()
}

export async function getSprintBySlug(slug: string): Promise<SprintWeek | null> {
  const { data, error } = await client().from('sprint_weeks').select('*').eq('slug', slug).maybeSingle()
  if (error) throw new Error(error.message)
  return data as SprintWeek | null
}

export async function getDayKpisForSprint(sprintId: string): Promise<SprintDayKpi[]> {
  const { data, error } = await client()
    .from('sprint_day_kpis')
    .select('*')
    .eq('sprint_id', sprintId)
    .order('date', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as SprintDayKpi[]
}

export interface UpsertDayKpiInput {
  ca_close?: number
  calls_booked?: number
  calls_done?: number
  dms_sent?: number
  reels_published?: number
  leads_ads?: number
  cpl?: number
  notes?: string
}

export async function upsertDayKpi(
  sprintId: string,
  date: string,
  input: UpsertDayKpiInput
): Promise<SprintDayKpi> {
  const { data, error } = await client()
    .from('sprint_day_kpis')
    .upsert(
      { sprint_id: sprintId, date, ...input, updated_at: new Date().toISOString() },
      { onConflict: 'sprint_id,date' }
    )
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as SprintDayKpi
}
