// Editorial calendar: deleting a slot generated from the trame must stick.
// The generator deduplicates against existing slots, so a deleted slot came
// back at the next "Planifier". Its key is recorded in social_slot_skips
// (migration 120) and the generator skips it.
import type { SupabaseClient } from '@supabase/supabase-js'

export interface SlotKeyFields {
  plan_date: string | null
  content_kind: string | null
  slot_index: number | null
  pillar_id: string | null
}

/** Only slots generated from the trame have a key (date + position). */
export function isTrameSlot(s: SlotKeyFields): s is SlotKeyFields & { plan_date: string; content_kind: string; slot_index: number } {
  return !!s.plan_date && !!s.content_kind && s.slot_index !== null && s.slot_index !== undefined
}

export const slotKey = (s: { plan_date: string; content_kind: string; slot_index: number; pillar_id: string | null }) =>
  `${s.plan_date}|${s.content_kind}|${s.slot_index}|${s.pillar_id ?? ''}`

export interface SlotContentFields {
  status: string | null
  production_status?: string | null
  references_urls?: string[] | null
  title?: string | null
  hook?: string | null
  caption?: string | null
  script?: string | null
  notes?: string | null
  media_urls?: string[] | null
}

/** A slot nobody worked on yet: draft, still an idea, and no title, hook, caption, script, notes, links or media. */
export function isEmptySlot(s: SlotContentFields): boolean {
  const blank = (v: string | null | undefined) => !v || v.trim() === ''
  return (
    (s.status ?? 'draft') === 'draft' &&
    (s.production_status ?? 'idea') === 'idea' &&
    blank(s.title) &&
    blank(s.hook) &&
    blank(s.caption) &&
    blank(s.script) &&
    blank(s.notes) &&
    (s.media_urls?.length ?? 0) === 0 &&
    (s.references_urls?.length ?? 0) === 0
  )
}

const missingTable = (msg: string | undefined) => !!msg && /social_slot_skips|does not exist|schema cache/i.test(msg)

/** Remembers deleted trame slots (best effort: without migration 120, deletion still works). */
export async function recordSkips(supabase: SupabaseClient, workspaceId: string, slots: SlotKeyFields[]): Promise<void> {
  const rows = slots.filter(isTrameSlot).map((s) => ({
    workspace_id: workspaceId,
    plan_date: s.plan_date,
    content_kind: s.content_kind,
    slot_index: s.slot_index,
    pillar_id: s.pillar_id ?? '',
  }))
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase
      .from('social_slot_skips')
      .upsert(rows.slice(i, i + 500), { onConflict: 'workspace_id,plan_date,content_kind,slot_index,pillar_id', ignoreDuplicates: true })
    if (error && !missingTable(error.message)) console.error('[social_slot_skips] record failed:', error.message)
    if (error) return
  }
}

/** Keys of the slots the coach deleted on these dates. */
export async function loadSkipKeys(supabase: SupabaseClient, workspaceId: string, planDates: string[]): Promise<Set<string>> {
  const keys = new Set<string>()
  for (let i = 0; i < planDates.length; i += 200) {
    const { data, error } = await supabase
      .from('social_slot_skips')
      .select('plan_date, content_kind, slot_index, pillar_id')
      .eq('workspace_id', workspaceId)
      .in('plan_date', planDates.slice(i, i + 200))
    if (error) return keys // migration 120 not applied yet: nothing skipped
    for (const r of data ?? []) keys.add(slotKey({ ...r, pillar_id: r.pillar_id || null }))
  }
  return keys
}
