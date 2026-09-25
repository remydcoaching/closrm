export interface ClosRMBridge {
  platform: NodeJS.Platform
  isDesktop: true
  onDeepLink: (callback: (url: string) => void) => () => void
  openExternal: (url: string) => Promise<void>
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
