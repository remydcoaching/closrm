import { describe, expect, it, vi } from 'vitest'
import { MetaTokenInvalidError } from '@/lib/meta/token-error'

vi.mock('../api', () => {
  const dead = () => Promise.reject(new MetaTokenInvalidError())
  return {
    fetchIgMedia: dead,
    fetchIgStories: dead,
    fetchIgProfile: dead,
    fetchIgConversations: dead,
    fetchReelInsights: () => Promise.resolve({}),
    fetchStoryInsights: () => Promise.resolve({}),
  }
})

describe('syncAll with a dead token', () => {
  it('reports tokenInvalid so the account is flagged for reconnection', async () => {
    const { syncAll } = await import('../sync')
    const supabase = { from: () => ({ select: () => ({ eq: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [] }) }) }) }) }) }
    const res = await syncAll({ supabase: supabase as never, workspaceId: 'ws', accessToken: 't', igUserId: '1', pageId: 'p', pageAccessToken: 'pt' })
    expect(res.tokenInvalid).toBe(true)
    expect(res.errors?.length).toBeGreaterThan(0)
  })
})
