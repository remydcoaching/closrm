// The coach's own Instagram web session, used ONLY to read who viewed the
// coach's own live stories (Instagram exposes story viewers to the account
// owner only, and not through the official Graph API).
//
// - The coach logs in themselves in a dedicated window (isolated
//   'persist:instagram' partition, no preload, sandboxed): ClosRM never sees
//   the password, 2FA/challenges happen in that window.
// - Cookies stay in that partition on this machine. Nothing from the session
//   is ever sent to the ClosRM server — the renderer only receives the parsed
//   story/viewer list, which it pushes to POST /api/instagram/story-views.
// - Requests are few, sequential and spaced out (a normal person opening
//   their story viewers list), and collection stops at the first sign of a
//   challenge or rate limit.
import { BrowserWindow, net, session, type Session } from 'electron'
import { classifyFailure, parseOwnReel, parseViewersPage, type InstagramFailure, type OwnStory, type StoryViewer } from './instagram-parse'

const PARTITION = 'persist:instagram'
const IG = 'https://www.instagram.com'
// Public app id of Instagram's own web client (sent by instagram.com itself).
const IG_WEB_APP_ID = '936619743392459'
const MAX_VIEWER_PAGES_PER_STORY = 40

export interface InstagramSessionStatus {
  connected: boolean
  userId: string | null
  username: string | null
}

export type CollectResult =
  | { ok: true; accountUsername: string; stories: OwnStory[] }
  | { ok: false; reason: InstagramFailure; message: string }

let cachedUsername: { userId: string; username: string } | null = null
let collecting = false

function igSession(): Session {
  const ses = session.fromPartition(PARTITION)
  // Present as the regular Chrome build Electron embeds, without the
  // "Electron/x" and app tokens.
  const ua = ses.getUserAgent().replace(/\s(Electron|closrm-desktop|ClosRM)\/\S+/gi, '')
  ses.setUserAgent(ua)
  return ses
}

async function cookie(name: string): Promise<string | null> {
  const [c] = await igSession().cookies.get({ url: IG, name })
  return c?.value ?? null
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const humanPause = () => sleep(1500 + Math.random() * 2000)

class IgError extends Error {
  constructor(
    public reason: InstagramFailure,
    message: string,
  ) {
    super(message)
  }
}

async function igGet(path: string): Promise<unknown> {
  const csrf = (await cookie('csrftoken')) ?? ''
  return new Promise((resolve, reject) => {
    const req = net.request({ url: `${IG}${path}`, method: 'GET', session: igSession(), useSessionCookies: true })
    req.setHeader('X-IG-App-ID', IG_WEB_APP_ID)
    req.setHeader('X-CSRFToken', csrf)
    req.setHeader('X-Requested-With', 'XMLHttpRequest')
    req.setHeader('Accept', '*/*')
    req.setHeader('Referer', `${IG}/`)
    req.on('response', (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        let body: unknown = null
        try {
          body = JSON.parse(text)
        } catch {
          // An HTML page instead of JSON = redirected to login/challenge.
          reject(new IgError('not_connected', 'Session Instagram expirée'))
          return
        }
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(body)
        else reject(new IgError(classifyFailure(res.statusCode, body), `Instagram ${res.statusCode}`))
      })
    })
    req.on('error', (err) => reject(new IgError('error', err.message)))
    req.end()
  })
}

export async function getStatus(): Promise<InstagramSessionStatus> {
  const [sessionId, userId] = await Promise.all([cookie('sessionid'), cookie('ds_user_id')])
  if (!sessionId || !userId) return { connected: false, userId: null, username: null }
  if (cachedUsername?.userId === userId) return { connected: true, userId, username: cachedUsername.username }
  try {
    const info = (await igGet(`/api/v1/users/${userId}/info/`)) as { user?: { username?: string } }
    const username = info.user?.username ?? null
    if (username) cachedUsername = { userId, username }
    return { connected: true, userId, username }
  } catch (err) {
    if (err instanceof IgError && err.reason === 'not_connected') return { connected: false, userId: null, username: null }
    return { connected: true, userId, username: null }
  }
}

/** Opens instagram.com login in an isolated window; resolves when logged in or closed. */
export function login(parent: BrowserWindow | null): Promise<InstagramSessionStatus> {
  return new Promise((resolve) => {
    const ses = igSession()
    const win = new BrowserWindow({
      width: 480,
      height: 720,
      parent: parent ?? undefined,
      modal: false,
      title: 'Connexion Instagram — ClosRM',
      webPreferences: { partition: PARTITION, contextIsolation: true, nodeIntegration: false, sandbox: true },
    })
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    let done = false
    const finish = async () => {
      if (done) return
      done = true
      ses.cookies.removeListener('changed', onCookie)
      const status = await getStatus()
      if (!win.isDestroyed()) win.close()
      resolve(status)
    }
    const onCookie = (_e: Electron.Event, c: Electron.Cookie, _cause: string, removed: boolean) => {
      // sessionid appears once login (incl. 2FA) succeeded; give Instagram a
      // moment to set the remaining cookies before reading them.
      if (!removed && c.name === 'sessionid' && c.value) setTimeout(finish, 1500)
    }
    ses.cookies.on('changed', onCookie)
    win.on('closed', () => {
      if (!done) finish()
    })
    win.loadURL(`${IG}/accounts/login/`)
  })
}

export async function logout(): Promise<void> {
  cachedUsername = null
  await igSession().clearStorageData()
}

/** Reads the coach's live stories and every viewer of each. */
export async function collectStoryViewers(): Promise<CollectResult> {
  if (collecting) return { ok: false, reason: 'error', message: 'Collecte déjà en cours' }
  collecting = true
  try {
    const status = await getStatus()
    if (!status.connected || !status.userId) return { ok: false, reason: 'not_connected', message: 'Session Instagram non connectée' }

    const reel = await igGet(`/api/v1/feed/reels_media/?reel_ids=${status.userId}`)
    const items = parseOwnReel(reel, status.userId)
    const stories: OwnStory[] = []
    for (const item of items) {
      const viewers: StoryViewer[] = []
      let maxId: string | null = null
      for (let page = 0; page < MAX_VIEWER_PAGES_PER_STORY; page++) {
        await humanPause()
        const q: string = maxId ? `?max_id=${encodeURIComponent(maxId)}` : ''
        const parsed = parseViewersPage(await igGet(`/api/v1/media/${item.pk}/list_reel_media_viewer/${q}`))
        viewers.push(...parsed.viewers)
        if (!parsed.nextMaxId || parsed.viewers.length === 0) break
        maxId = parsed.nextMaxId
      }
      stories.push({ ...item, viewers })
    }
    return { ok: true, accountUsername: status.username ?? status.userId, stories }
  } catch (err) {
    if (err instanceof IgError) return { ok: false, reason: err.reason, message: err.message }
    return { ok: false, reason: 'error', message: err instanceof Error ? err.message : 'Erreur inconnue' }
  } finally {
    collecting = false
  }
}
