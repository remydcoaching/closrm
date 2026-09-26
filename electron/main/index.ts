// ClosRM Desktop — main process.
//
// Scope M1: window lifecycle, deep-link handling for the auth callback
// (closrm://auth-callback), and a strict CSP on the renderer. No secrets,
// no provider (Hiker/Apify/Meta) is ever called from this process — the
// renderer talks HTTP to the existing ClosRM API, exactly like the mobile
// app already does.
import { app, BrowserWindow, ipcMain, safeStorage, session, shell } from 'electron'
import path from 'node:path'
import { readFile, writeFile, unlink } from 'node:fs/promises'
import * as instagramSession from './instagram-session'

// This file compiles to CommonJS (see vite.config.ts) — Electron's native
// `electron` module import does not interoperate correctly with Node's ESM
// translator for the main process entry point (reproduced directly:
// `electron dist-electron/main/index.js` throws "Cannot read properties of
// undefined (reading 'exports')" inside cjsPreparseModuleExports). CJS gives
// us the plain __dirname below instead of fileURLToPath(import.meta.url).


const DEEP_LINK_SCHEME = 'closrm'
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

let mainWindow: BrowserWindow | null = null
/** A deep link received before the window exists (cold start) — replayed once the renderer is ready. */
let pendingDeepLink: string | null = null

function forwardDeepLink(url: string) {
  if (!mainWindow) {
    pendingDeepLink = url
    return
  }
  mainWindow.webContents.send('closrm:deep-link', url)
  mainWindow.show()
  mainWindow.focus()
}

// macOS: single-instance lock so a second launch (e.g. from a deep link)
// hands off to the already-running instance instead of opening a duplicate.
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

app.on('second-instance', (_event, argv) => {
  const link = argv.find((a) => a.startsWith(`${DEEP_LINK_SCHEME}://`))
  if (link) forwardDeepLink(link)
  else if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

// macOS delivers the deep link via this event, even before `ready` on cold start.
app.on('open-url', (event, url) => {
  event.preventDefault()
  forwardDeepLink(url)
})

if (app.isPackaged) {
  app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME)
} else if (process.platform !== 'darwin' && process.argv.length >= 2) {
  app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME, process.execPath, [path.resolve(process.argv[1])])
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: '#ffffff',
    title: 'ClosRM',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  // Links to real websites belong in the user's default browser, never in a
  // chromeless Electron window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:$/.test(new URL(url).protocol)) shell.openExternal(url)
    return { action: 'deny' }
  })

  win.once('ready-to-show', () => {
    win.show()
    if (pendingDeepLink) {
      forwardDeepLink(pendingDeepLink)
      pendingDeepLink = null
    }
  })

  // Surfaces a renderer-side load failure in the main process's own log —
  // a blank window otherwise gives no Electron-side symptom at all (see
  // vite.config.ts envDir comment for the M3-A bug this caught).
  win.webContents.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL) => {
    console.error('[closrm] renderer failed to load', { errorCode, errorDescription, validatedURL })
  })
  // Dev: mirror renderer console warnings/errors into the terminal so a
  // blank window always comes with its cause.
  if (DEV_SERVER_URL) {
    win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
      if (level >= 2) console.error(`[renderer] ${message} (${sourceId}:${line})`)
    })
    win.webContents.on('preload-error', (_e, preloadPath, error) => {
      console.error('[closrm] preload failed', preloadPath, error)
    })
  }
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[closrm] renderer process gone', details)
    // Never leave a blank window behind: reload the renderer.
    if (!win.isDestroyed()) setTimeout(() => !win.isDestroyed() && win.webContents.reload(), 500)
  })
  if (DEV_SERVER_URL) win.webContents.openDevTools({ mode: 'detach' })

  if (DEV_SERVER_URL) {
    win.loadURL(DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })

  mainWindow = win
}

// Secure session storage: the Supabase session (access + refresh token) is
// encrypted via OS-backed safeStorage (Keychain on macOS, DPAPI on Windows,
// libsecret on Linux) and written to a file only this app's main process can
// reach — never plain localStorage in the renderer, never logged.
const SESSION_FILE = path.join(app.getPath('userData'), 'session.enc')

// Opens a web page in the user's default browser (e.g. the ClosRM web
// editors that are not rebuilt in the desktop app). http(s) only — never
// file:, javascript: or custom schemes.
// Coach's own Instagram session — story viewers only (see instagram-session.ts).
ipcMain.handle('closrm:ig:status', () => instagramSession.getStatus())
ipcMain.handle('closrm:ig:login', () => instagramSession.login(mainWindow))
ipcMain.handle('closrm:ig:logout', () => instagramSession.logout())
ipcMain.handle('closrm:ig:collect-stories', () => instagramSession.collectStoryViewers())
ipcMain.handle('closrm:ig:highlights', (_e, force?: boolean) => instagramSession.highlightsTray(!!force))
ipcMain.handle('closrm:ig:highlight-items', (_e, ids: string[]) => instagramSession.highlightItems(Array.isArray(ids) ? ids.slice(0, 40).map(String) : []))
ipcMain.handle('closrm:ig:story-archive', (_e, force?: boolean) => instagramSession.storyArchive(!!force))

ipcMain.handle('closrm:open-external', async (_event, url: string) => {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('URL invalide')
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('Protocole non autorisé')
  await shell.openExternal(parsed.toString())
})

ipcMain.handle('closrm:secure-storage:set', async (_event, plaintext: string) => {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS-backed encryption is not available on this machine')
  }
  const encrypted = safeStorage.encryptString(plaintext)
  await writeFile(SESSION_FILE, encrypted)
})

ipcMain.handle('closrm:secure-storage:get', async () => {
  try {
    const encrypted = await readFile(SESSION_FILE)
    if (!safeStorage.isEncryptionAvailable()) return null
    return safeStorage.decryptString(encrypted)
  } catch {
    return null
  }
})

ipcMain.handle('closrm:secure-storage:clear', async () => {
  try {
    await unlink(SESSION_FILE)
  } catch {
    // Nothing to clear — fine.
  }
})

app.whenReady().then(() => {
  // Strict CSP on the renderer — no inline scripts beyond what Vite's dev
  // server requires, no remote script sources besides the ClosRM API/Supabase.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline'; " + // 'unsafe-inline' relaxed only for Vite HMR in dev; tighten before production build
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            "font-src 'self' https://fonts.gstatic.com; " +
            "img-src 'self' data: https:; " +
            // Story videos are played straight from Instagram's CDN.
            "media-src 'self' https: blob:; " +
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co " +
            (process.env.CLOSRM_API_BASE_URL ?? 'http://localhost:3000'),
        ],
      },
    })
  })

  createWindow()

  // Cold start on Windows/Linux: the deep link is in our own argv.
  const startupLink = process.argv.find((a) => a.startsWith(`${DEEP_LINK_SCHEME}://`))
  if (startupLink) forwardDeepLink(startupLink)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
