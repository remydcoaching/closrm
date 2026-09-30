import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isEmptySlot, isTrameSlot, loadSkipKeys, recordSkips, slotKey } from '../slot-skips'

describe('isEmptySlot (what "Vider les créneaux vides" deletes)', () => {
  it('a generated slot nobody touched is empty', () => {
    expect(isEmptySlot({ status: 'draft', production_status: 'idea', title: null, hook: '', media_urls: [], references_urls: [] })).toBe(true)
  })
  it('any work keeps the slot', () => {
    expect(isEmptySlot({ status: 'draft', hook: 'Mon accroche' })).toBe(false)
    expect(isEmptySlot({ status: 'draft', notes: 'tourner dehors' })).toBe(false)
    expect(isEmptySlot({ status: 'draft', media_urls: ['x.mp4'] })).toBe(false)
    expect(isEmptySlot({ status: 'draft', references_urls: ['https://…'] })).toBe(false)
    expect(isEmptySlot({ status: 'draft', production_status: 'to_film' })).toBe(false)
  })
  it('never a scheduled / published slot', () => {
    expect(isEmptySlot({ status: 'scheduled' })).toBe(false)
    expect(isEmptySlot({ status: 'published' })).toBe(false)
  })
})

describe('trame slot keys', () => {
  it('only slots placed by the trame have a key', () => {
    expect(isTrameSlot({ plan_date: '2026-10-01', content_kind: 'story', slot_index: 2, pillar_id: 'p' })).toBe(true)
    expect(isTrameSlot({ plan_date: '2026-10-01', content_kind: 'post', slot_index: null, pillar_id: null })).toBe(false)
  })
  it('same key format as the generator dedupe (pillar missing → empty)', () => {
    expect(slotKey({ plan_date: '2026-10-01', content_kind: 'story', slot_index: 0, pillar_id: null })).toBe('2026-10-01|story|0|')
  })
})

describe('recordSkips / loadSkipKeys', () => {
  it('records only trame slots, scoped to the workspace', async () => {
    const calls: { rows: Record<string, unknown>[]; opts: unknown }[] = []
    const fake = { from: () => ({ upsert: async (rows: Record<string, unknown>[], opts: unknown) => (calls.push({ rows, opts }), { error: null }) }) } as unknown as SupabaseClient
    await recordSkips(fake, 'ws-1', [
      { plan_date: '2026-10-01', content_kind: 'story', slot_index: 1, pillar_id: null },
      { plan_date: '2026-10-02', content_kind: 'post', slot_index: null, pillar_id: 'p' },
    ])
    expect(calls).toHaveLength(1)
    expect(calls[0].rows).toEqual([{ workspace_id: 'ws-1', plan_date: '2026-10-01', content_kind: 'story', slot_index: 1, pillar_id: '' }])
  })
  it('without migration 120, generation skips nothing (no crash)', async () => {
    const fake = { from: () => ({ select: () => ({ eq: () => ({ in: async () => ({ data: null, error: { message: 'relation "social_slot_skips" does not exist' } }) }) }) }) } as unknown as SupabaseClient
    expect((await loadSkipKeys(fake, 'ws', ['2026-10-01'])).size).toBe(0)
  })
  it('loads keys in the generator format', async () => {
    const fake = { from: () => ({ select: () => ({ eq: () => ({ in: async () => ({ data: [{ plan_date: '2026-10-01', content_kind: 'story', slot_index: 3, pillar_id: '' }], error: null }) }) }) }) } as unknown as SupabaseClient
    expect([...(await loadSkipKeys(fake, 'ws', ['2026-10-01']))]).toEqual(['2026-10-01|story|3|'])
  })
})
