import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { aggregateViewers, groupTagsByHighlight, highlightTagsSchema, storyViewerState, tagHighlightStories, type ViewerRow } from '../highlight-viewers'

const row = (story: string, user: string, username: string, at: string, extra: Partial<ViewerRow> = {}): ViewerRow => ({
  story_pk: story,
  instagram_user_id: user,
  instagram_username: username,
  full_name: null,
  profile_pic_url: null,
  matched_lead_id: null,
  first_seen_at: at,
  ...extra,
})

describe('storyViewerState', () => {
  const base = { story_pk: '1', taken_at: '2026-09-01T10:00:00Z', viewers_collected: 0 }
  it('0 viewers read inside the 48 h window is a real zero', () => {
    expect(storyViewerState({ ...base, created_at: '2026-09-01T12:00:00Z', fetch_status: 'ok' })).toBe('collected')
  })
  it('0 viewers first stored after the window is "not provided by Instagram", never 0', () => {
    expect(storyViewerState({ ...base, created_at: '2026-09-27T06:00:00Z', fetch_status: null })).toBe('out_of_window')
  })
  it('an unreadable list is an error, whatever the count', () => {
    expect(storyViewerState({ ...base, created_at: '2026-09-01T12:00:00Z', fetch_status: 'error' })).toBe('error')
  })
  it('a story ClosRM never stored is unknown', () => {
    expect(storyViewerState(undefined)).toBe('unknown')
  })
  it('viewers collected in the window stay collected even if re-stored later', () => {
    expect(storyViewerState({ ...base, viewers_collected: 12, created_at: '2026-09-01T12:00:00Z' })).toBe('collected')
  })
})

describe('aggregateViewers', () => {
  it('one person on several stories = one entry, counted per distinct story, keyed by Instagram id', () => {
    const out = aggregateViewers([
      row('a', '1', 'pierre', '2026-09-20T10:00:00Z'),
      row('b', '1', 'pierre_new', '2026-09-24T10:00:00Z', { has_liked: true }),
      row('b', '1', 'pierre_new', '2026-09-24T10:00:00Z'),
      row('a', '2', 'marie', '2026-09-21T10:00:00Z', { matched_lead_id: 'lead-m' }),
    ])
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ instagramUserId: '1', storiesSeen: 2, storyPks: ['a', 'b'], username: 'pierre_new', liked: 1, lastObservedAt: '2026-09-24T10:00:00Z' })
    expect(out[1]).toMatchObject({ instagramUserId: '2', storiesSeen: 1, leadId: 'lead-m' })
  })
  it('empty input gives no viewers', () => {
    expect(aggregateViewers([])).toEqual([])
  })
})

describe('highlight tags', () => {
  it('rejects non-numeric story pks (no injection into filters)', () => {
    expect(highlightTagsSchema.safeParse({ items: [{ pk: '1,2', highlightId: 'highlight:1' }] }).success).toBe(false)
  })
  it('groups by highlight and keeps the first collection for a story in two', () => {
    const groups = groupTagsByHighlight({
      items: [
        { pk: '1', highlightId: 'highlight:a', highlightTitle: 'Transformation' },
        { pk: '2', highlightId: 'highlight:a', highlightTitle: 'Transformation' },
        { pk: '1', highlightId: 'highlight:b', highlightTitle: 'Lifestyle' },
        { pk: '3', highlightId: 'highlight:b', highlightTitle: 'Lifestyle' },
      ],
    })
    expect(groups).toEqual([
      { highlightId: 'highlight:a', highlightTitle: 'Transformation', pks: ['1', '2'] },
      { highlightId: 'highlight:b', highlightTitle: 'Lifestyle', pks: ['3'] },
    ])
  })
  it('only updates rows of the caller workspace', async () => {
    const calls: { table: string; patch: unknown; filters: [string, unknown][] }[] = []
    const fake = {
      from(table: string) {
        const call = { table, patch: null as unknown, filters: [] as [string, unknown][] }
        calls.push(call)
        const q = {
          update(p: unknown) {
            call.patch = p
            return q
          },
          eq(c: string, v: unknown) {
            call.filters.push([c, v])
            return q
          },
          in(c: string, v: unknown) {
            call.filters.push([c, v])
            return q
          },
          select: async () => ({ data: [{ story_pk: '1' }], error: null }),
        }
        return q
      },
    } as unknown as SupabaseClient
    const res = await tagHighlightStories(fake, 'ws-1', { items: [{ pk: '1', highlightId: 'highlight:a', highlightTitle: 'T' }] })
    expect(res).toEqual({ tagged: 1, errors: [] })
    expect(calls[0]).toMatchObject({ table: 'story_view_stories', patch: { highlight_id: 'highlight:a', highlight_title: 'T' } })
    expect(calls[0].filters).toContainEqual(['workspace_id', 'ws-1'])
  })
})
