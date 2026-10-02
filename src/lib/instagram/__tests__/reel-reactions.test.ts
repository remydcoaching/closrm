import { describe, expect, it } from 'vitest'
import { splitReactions } from '../reel-reactions'
import { summarizeGestures, type PersonGesture } from '../person'
import type { ContentProfile } from '../content-data'

const profile = (o: Partial<ContentProfile>): ContentProfile => ({
  username: 'a',
  fullName: null,
  instagramUserId: null,
  profilePicUrl: null,
  isVerified: null,
  followsTarget: null,
  liked: true,
  commented: false,
  commentsCount: 0,
  commentText: null,
  totalLikes: null,
  totalComments: null,
  discoveryProfileId: null,
  runId: null,
  lead: null,
  ...o,
})

describe('Qui a réagi', () => {
  it('first gesture vs already seen (case-insensitive), commenters then leads first', () => {
    const { firstTime, returning } = splitReactions(
      [
        profile({ username: 'liker' }),
        profile({ username: 'Talker', commented: true, commentsCount: 2, commentText: 'top' }),
        profile({ username: 'lead', lead: { id: 'l1', firstName: 'L', lastName: '', status: 'nouveau' } }),
        profile({ username: 'old_fan' }),
      ],
      new Set(['old_fan']),
    )
    expect(firstTime.map((p) => p.username)).toEqual(['Talker', 'lead', 'liker'])
    expect(returning.map((p) => p.username)).toEqual(['old_fan'])
    expect(firstTime[0]).toMatchObject({ commentsCount: 2, commentText: 'top', follows: null })
  })
})

describe('Instagram person journey', () => {
  const g = (o: Partial<PersonGesture>): PersonGesture => ({ kind: 'like', at: null, contentId: null, storyPk: null, title: null, thumbnailUrl: null, url: null, text: null, ...o })
  it('newest first, first gesture = oldest dated one, counts per kind', () => {
    const s = summarizeGestures([
      g({ kind: 'like', at: '2026-08-01' }),
      g({ kind: 'comment', at: '2026-09-01', text: 'hi' }),
      g({ kind: 'story_like', at: '2026-07-15' }),
      g({ kind: 'story_view', at: null }),
    ])
    expect(s.gestures.map((x) => x.kind)).toEqual(['comment', 'like', 'story_like', 'story_view'])
    expect(s.firstGesture?.kind).toBe('story_like')
    expect(s.counts).toEqual({ likes: 1, comments: 1, storyViews: 2, storyLikes: 1 })
  })
})

describe('person: comment quality and score reasons', () => {
  it('comment level: question / sentence = fort, a few words = moyen, emoji only or empty = faible', async () => {
    const { commentLevel } = await import('../person')
    expect(commentLevel('Tu fais comment pour la séance du matin ?')).toBe('fort')
    expect(commentLevel('Je la trouve hyper bien moi, vraiment top')).toBe('fort')
    expect(commentLevel('Top 🔥')).toBe('moyen')
    expect(commentLevel('🔥🔥🙌')).toBe('faible')
    expect(commentLevel('')).toBe('faible')
  })
  it('factors are ratios of what was done vs what was possible, never above 1', async () => {
    const { scoreFactors } = await import('../person')
    const now = new Date('2026-10-01T12:00:00Z')
    const g = (kind: 'like' | 'comment' | 'story_view' | 'story_like', at: string, contentId: string | null, storyPk: string | null = null) => ({ kind, at, contentId, storyPk, title: null, thumbnailUrl: null, url: null, text: null })
    const f = scoreFactors(
      [g('like', '2026-09-28T00:00:00Z', 'r1'), g('comment', '2026-09-29T00:00:00Z', 'r2'), g('story_view', '2026-09-30T00:00:00Z', null, 's1'), g('story_like', '2026-09-30T00:00:00Z', null, 's2')],
      { follows: true, publicationsSinceFirst: 4, storiesSinceFirst: 2, now },
    )
    const v = Object.fromEntries(f.map((x) => [x.key, x.value]))
    expect(v.stories_seen).toBe(1)
    expect(v.share).toBe(0.5)
    expect(v.follows).toBe(1)
    expect(Math.max(...f.map((x) => x.value))).toBeLessThanOrEqual(1)
  })
})
