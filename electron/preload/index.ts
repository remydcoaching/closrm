// ClosRM Desktop — preload script.
//
// The ONLY bridge between the renderer and the main process. contextIsolation
// is on, so the renderer never sees Node or Electron internals directly —
// only what is explicitly exposed here. No secret, no provider API key, no
// filesystem access is exposed. Auth is handled entirely by the Supabase SDK
// running in the renderer (same library the mobile app already uses); this
// bridge only carries the deep-link URL the OS delivers to the main process.
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('closrm', {
  platform: process.platform,
  isDesktop: true,

  /** Registers a listener for the closrm://auth-callback deep link. Returns an unsubscribe function. */
  onDeepLink: (callback: (url: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, url: string) => callback(url)
    ipcRenderer.on('closrm:deep-link', listener)
    return () => ipcRenderer.removeListener('closrm:deep-link', listener)
  },

  /**
   * OS-backed encrypted storage for the Supabase session only (Keychain /
   * Credential Manager / libsecret via Electron's safeStorage in the main
   * process). Never used for provider secrets — none of those ever reach
   * the renderer in the first place.
   */
  /** Opens an http(s) URL in the default browser (validated in main). */
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('closrm:open-external', url),

  /** Coach's own Instagram session (story viewers). Cookies never leave the main process. */
  instagram: {
    status: () => ipcRenderer.invoke('closrm:ig:status'),
    login: () => ipcRenderer.invoke('closrm:ig:login'),
    logout: (): Promise<void> => ipcRenderer.invoke('closrm:ig:logout'),
    collectStories: () => ipcRenderer.invoke('closrm:ig:collect-stories'),
  },

  secureStorage: {
    set: (value: string): Promise<void> => ipcRenderer.invoke('closrm:secure-storage:set', value),
    get: (): Promise<string | null> => ipcRenderer.invoke('closrm:secure-storage:get'),
    clear: (): Promise<void> => ipcRenderer.invoke('closrm:secure-storage:clear'),
  },
})

export {}
