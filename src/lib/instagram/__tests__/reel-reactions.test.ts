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
