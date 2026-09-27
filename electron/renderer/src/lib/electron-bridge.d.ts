export interface InstagramSessionStatus {
  connected: boolean
  userId: string | null
  username: string | null
}

export interface StoryViewerData {
  pk: string
  username: string
  fullName: string | null
  profilePicUrl: string | null
  isVerified: boolean | null
  hasLiked: boolean | null
  isPrivate: boolean | null
}

export interface HighlightStoryResult {
  pk: string
  highlightId: string
  highlightTitle: string
  takenAt: string
  mediaType: 'image' | 'video' | null
  thumbnailUrl: string | null
  viewerCount: number | null
  likeCount: number | null
  status: 'ok' | 'error'
  error: string | null
  viewers: StoryViewerData[]
}

export type HighlightViewersResult =
  | { ok: true; accountUsername: string; stories: HighlightStoryResult[]; skipped: number; tooOld: number; stoppedEarly: 'not_connected' | 'checkpoint' | 'rate_limited' | 'error' | null }
  | { ok: false; reason: 'not_connected' | 'checkpoint' | 'rate_limited' | 'error'; message: string }

/** A live story (full media) or a re-read expired one (pk + viewers only). */
export interface CollectedStory {
  pk: string
  takenAt: string
  expiringAt?: string | null
  mediaType?: 'image' | 'video' | null
  thumbnailUrl?: string | null
  videoUrl?: string | null
  viewerCount?: number | null
  likeCount?: number | null
  viewers: StoryViewerData[]
  /** 'error' = the list could not be read (never shown as 0 viewers). */
  status: 'ok' | 'error'
  error?: string
}

export type CollectStoriesResult =
  | { ok: true; accountUsername: string; stories: CollectedStory[]; stoppedEarly: 'not_connected' | 'checkpoint' | 'rate_limited' | 'error' | null }
  | { ok: false; reason: 'not_connected' | 'checkpoint' | 'rate_limited' | 'error'; message: string }

export interface ArchivedStory {
  pk: string
  takenAt: string
  mediaType: 'image' | 'video' | null
  imageUrl: string | null
  videoUrl: string | null
  viewerCount: number | null
  likeCount: number | null
}

export type StoryArchiveResult =
  | { ok: true; stories: ArchivedStory[] }
  | { ok: false; reason: 'not_connected' | 'checkpoint' | 'rate_limited' | 'error'; message: string }

export interface HighlightCollection {
  id: string
  title: string
  coverUrl: string | null
  mediaCount: number | null
}

type IgFailure = { ok: false; reason: 'not_connected' | 'checkpoint' | 'rate_limited' | 'error'; message: string }
export type HighlightsResult = { ok: true; collections: HighlightCollection[] } | IgFailure
export type HighlightItemsResult = { ok: true; items: Record<string, ArchivedStory[]> } | IgFailure

export interface ClosRMBridge {
  platform: NodeJS.Platform
  isDesktop: true
  onDeepLink: (callback: (url: string) => void) => () => void
  openExternal: (url: string) => Promise<void>
  instagram: {
    status: () => Promise<InstagramSessionStatus>
    login: () => Promise<InstagramSessionStatus>
    logout: () => Promise<void>
    /** Live stories + `recheck` (expired stories still inside the 48 h viewer window). */
    collectStories: (recheck?: { pk: string; takenAt: string }[]) => Promise<CollectStoriesResult>
    storyArchive: (force?: boolean) => Promise<StoryArchiveResult>
    /** Profile picture of the connected Instagram account (cached a day, null when not connected). */
    ownPicture: (username?: string | null) => Promise<string | null>
    highlights: (force?: boolean) => Promise<HighlightsResult>
    collectHighlightViewers: (skipPks: string[]) => Promise<HighlightViewersResult>
    highlightItems: (ids: string[]) => Promise<HighlightItemsResult>
  }
  secureStorage: {
    set: (value: string) => Promise<void>
    get: () => Promise<string | null>
    clear: () => Promise<void>
  }
}

declare global {
  interface Window {
    closrm: ClosRMBridge
  }
}
