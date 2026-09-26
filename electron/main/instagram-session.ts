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
import { classifyFailure, parseArchiveDayShells, parseOwnReel, parseReelsMediaItems, parseViewersPage, reelOwnerUsername, type ArchivedStory, type InstagramFailure, type OwnStory, type StoryViewer } from './instagram-parse'

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
          // HTML instead of JSON: login page, challenge or an endpoint change.
          console.error(`[instagram] ${path} → ${res.statusCode} non-JSON: ${text.slice(0, 200).replace(/\s+/g, ' ')}`)
          reject(
            new IgError(
              res.statusCode === 429 ? 'rate_limited' : res.statusCode === 401 || res.statusCode === 403 ? 'not_connected' : 'error',
              `Réponse inattendue d'Instagram (${res.statusCode})`,
            ),
          )
          return
        }
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(body)
        else {
          console.error(`[instagram] ${path} → ${res.statusCode}: ${text.slice(0, 200)}`)
          reject(new IgError(classifyFailure(res.statusCode, body), `Instagram ${res.statusCode}`))
        }
      })
    })
    // Instagram drops the connection when it throttles (net::ERR_FAILED):
    // back off like a 429 rather than retrying.
    req.on('error', (err) => {
      console.error(`[instagram] ${path} → ${err.message}`)
      reject(new IgError(/ERR_FAILED|ERR_CONNECTION|ERR_EMPTY_RESPONSE/.test(err.message) ? 'rate_limited' : 'error', err.message))
    })
    req.end()
  })
}

// No network call here: status is read from the session cookies only (a
// profile lookup on every check got the account rate-limited). The username
// comes from the stories response during collection.
export async function getStatus(): Promise<InstagramSessionStatus> {
  const [sessionId, userId] = await Promise.all([cookie('sessionid'), cookie('ds_user_id')])
  if (!sessionId || !userId) return { connected: false, userId: null, username: null }
  return { connected: true, userId, username: cachedUsername?.userId === userId ? cachedUsername.username : null }
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
      backgroundColor: '#ffffff',
      webPreferences: { partition: PARTITION, contextIsolation: true, nodeIntegration: false, sandbox: true },
    })
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    let done = false
    let poll: ReturnType<typeof setInterval> | null = null

    const finish = async () => {
      if (done) return
      done = true
      if (poll) clearInterval(poll)
      ses.cookies.removeListener('changed', onCookie)
      // Close first: once logged in Instagram shows its own (dark) home /
      // "save login info" screens, which must not stay on screen.
      if (!win.isDestroyed()) win.close()
      resolve(await getStatus())
    }

    // Logged in = sessionid + ds_user_id cookies present. Checked on cookie
    // change, on every navigation and every second (cookie events alone
    // are not reliable across Instagram's redirects).
    const check = async () => {
      if (done) return
      const [sid, uid] = await Promise.all([cookie('sessionid'), cookie('ds_user_id')])
      if (sid && uid) finish()
    }
    const onCookie = (_e: Electron.Event, c: Electron.Cookie, _cause: string, removed: boolean) => {
      if (!removed && (c.name === 'sessionid' || c.name === 'ds_user_id')) check()
    }
    ses.cookies.on('changed', onCookie)
    win.webContents.on('did-navigate', check)
    win.webContents.on('did-navigate-in-page', check)
    poll = setInterval(check, 1000)
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
    const owner = reelOwnerUsername(reel, status.userId)
    if (owner) cachedUsername = { userId: status.userId, username: owner }
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
    return { ok: true, accountUsername: owner ?? status.username ?? status.userId, stories }
  } catch (err) {
    if (err instanceof IgError) return { ok: false, reason: err.reason, message: err.message }
    return { ok: false, reason: 'error', message: err instanceof Error ? err.message : 'Erreur inconnue' }
  } finally {
    collecting = false
  }
}


export type ArchiveResult = { ok: true; stories: ArchivedStory[] } | { ok: false; reason: InstagramFailure; message: string }

let archiveCache: { at: number; stories: ArchivedStory[] } | null = null
const ARCHIVE_TTL_MS = 30 * 60_000
const ARCHIVE_DAYS = 12
const REELS_PER_REQUEST = 4

/**
 * The coach's story archive (last ARCHIVE_DAYS days with a story) with
 * fresh media URLs, to display stories whose stored links have expired.
 * On demand only, cached 30 min, a handful of spaced requests.
 */
export async function storyArchive(force = false): Promise<ArchiveResult> {
  if (!force && archiveCache && Date.now() - archiveCache.at < ARCHIVE_TTL_MS) return { ok: true, stories: archiveCache.stories }
  try {
    const status = await getStatus()
    if (!status.connected) return { ok: false, reason: 'not_connected', message: 'Session Instagram non connectée' }
    const shells = parseArchiveDayShells(await igGet('/api/v1/archive/reel/day_shells/?timezone_offset=' + -new Date().getTimezoneOffset() * 60))
    const ids = shells.ids.slice(0, ARCHIVE_DAYS)
    const stories: ArchivedStory[] = []
    for (let i = 0; i < ids.length; i += REELS_PER_REQUEST) {
      await humanPause()
      const q = ids
        .slice(i, i + REELS_PER_REQUEST)
        .map((id) => `reel_ids=${encodeURIComponent(id)}`)
        .join('&')
      stories.push(...parseReelsMediaItems(await igGet(`/api/v1/feed/reels_media/?${q}`)))
    }
    stories.sort((a, b) => b.takenAt.localeCompare(a.takenAt))
    archiveCache = { at: Date.now(), stories }
    return { ok: true, stories }
  } catch (err) {
    if (err instanceof IgError) return { ok: false, reason: err.reason, message: err.message }
    return { ok: false, reason: 'error', message: err instanceof Error ? err.message : 'Erreur inconnue' }
  }
}
