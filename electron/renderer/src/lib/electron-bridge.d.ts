export interface InstagramSessionStatus {
  connected: boolean
  userId: string | null
  username: string | null
}

export interface CollectedStory {
  pk: string
  takenAt: string
  expiringAt: string | null
  mediaType: 'image' | 'video' | null
  thumbnailUrl: string | null
  viewerCount: number | null
  viewers: { pk: string; username: string; fullName: string | null; profilePicUrl: string | null; isVerified: boolean | null }[]
}

export type CollectStoriesResult =
  | { ok: true; accountUsername: string; stories: CollectedStory[] }
  | { ok: false; reason: 'not_connected' | 'checkpoint' | 'rate_limited' | 'error'; message: string }

export interface ClosRMBridge {
  platform: NodeJS.Platform
  isDesktop: true
  onDeepLink: (callback: (url: string) => void) => () => void
  openExternal: (url: string) => Promise<void>
  instagram: {
    status: () => Promise<InstagramSessionStatus>
    login: () => Promise<InstagramSessionStatus>
    logout: () => Promise<void>
    collectStories: () => Promise<CollectStoriesResult>
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
