// Fixtures modeled on the REAL response shapes confirmed during the POC
// (scripts/hiker-poc/, see HIKER_POC_REPORT.md §16). Usernames/ids here are
// synthetic — no real Hiker API key or live data is used in tests.
import type {
  HikerUserProfile,
  HikerChunkResponse,
  HikerMediaItem,
  HikerLikersResponse,
  HikerComment,
  HikerCommentsResponse,
  HikerPageIdResponse,
  HikerUserShort,
  HikerStoriesResponse,
} from '../../types'

export const fixtureProfile: HikerUserProfile = {
  pk: 1000000001,
  username: 'test_account',
  full_name: 'Test Account',
  is_private: false,
  is_verified: false,
  media_count: 2,
  follower_count: 2,
  following_count: 10,
  profile_pic_url: 'https://example.com/pic.jpg',
}

export function makeMediaItem(overrides: Partial<HikerMediaItem> = {}): HikerMediaItem {
  return {
    pk: 5000000001,
    id: '5000000001_1000000001',
    code: 'AbCdEfGhIj',
    taken_at: 1700000000,
    media_type: 1,
    product_type: 'feed',
    like_count: 3, // mirrors the POC finding: this field was observed unreliable
    comment_count: 2,
    ...overrides,
  }
}

// [items, cursor|null] — confirmed shape for /v1/user/medias/chunk and clips.
export function fixtureMediaChunkPage(items: HikerMediaItem[], nextCursor: string | null): HikerChunkResponse<HikerMediaItem> {
  return [items, nextCursor]
}

export const fixtureLiker: HikerUserShort = {
  pk: 2000000001,
  username: 'liker_one',
  full_name: 'Liker One',
  is_private: false,
  is_verified: false,
}

export function fixtureLikersResponse(users: HikerUserShort[]): HikerLikersResponse {
  return { users, user_count: users.length, status: 'ok' }
}

export function fixtureCommentsResponse(comments: HikerComment[], nextPageId: string | null = null): HikerCommentsResponse {
  return {
    response: { comments, comment_count: comments.length },
    next_page_id: nextPageId,
  }
}

export function fixtureFollowersResponse(users: HikerUserShort[], nextPageId: string | null = null): HikerPageIdResponse<'users', HikerUserShort> {
  return { response: { users }, next_page_id: nextPageId }
}

export const fixtureStoriesWithOneActive: HikerStoriesResponse = {
  broadcast: null,
  reel: {
    id: '1000000001',
    is_archived: false,
    items: [{ pk: 9000000001, id: '9000000001_1000000001', taken_at: 1700000000, media_type: 2 }],
  },
  status: 'ok',
}

export const fixtureStoriesNoneActive: HikerStoriesResponse = {
  broadcast: null,
  reel: null,
  status: 'ok',
}

export const fixtureInsufficientFundsBody = { state: false, error: 'Top up your account', exc_type: 'InsufficientFunds' }
export const fixtureNotFoundBody = { detail: 'Entries not found', exc_type: 'NotFoundError' }
