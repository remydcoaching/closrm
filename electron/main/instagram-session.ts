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
import { app, BrowserWindow, session, type Session } from 'electron'
import path from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { parseWebProfilePicture, reelOwnerPicture, classifyFailure, parseGraphqlHighlights, parseHighlightItems, type HighlightCollection, parseOwnReel, parseReelsMediaItems, parseViewersPage, reelOwnerUsername, type ArchivedStory, type InstagramFailure, type OwnStory, type StoryViewer } from './instagram-parse'

const PARTITION = 'persist:instagram'
// Profile query of Instagram's web client (returns edge_highlight_reels).
const HIGHLIGHTS_QUERY_HASH = 'd4d88dc1500312af6f937f7b804c68c3'

/** Viewer list of one of the owner's stories (the web client's own request). */
function viewersPath(storyPk: string, maxId: string | null): string {
  return `/api/v1/media/${encodeURIComponent(storyPk)}/list_reel_media_viewer/?supported_capabilities_new=%5B%5D${maxId ? `&max_id=${encodeURIComponent(maxId)}` : ''}`
}
const IG = 'https://www.instagram.com'
// Public app id of Instagram's own web client (sent by instagram.com itself).
const IG_WEB_APP_ID = '936619743392459'
const MAX_VIEWER_PAGES_PER_STORY = 40
// Instagram lists a story's viewers during its first 48 h only (verified
// live: older stories answer 0 users / viewer_count null).
const VIEWER_WINDOW_MS = 48 * 3_600_000

export interface InstagramSessionStatus {
  connected: boolean
  userId: string | null
  username: string | null
}

/** A live story (full media) or a re-read expired one (pk + viewers only: the rest stays as stored). */
export type CollectedStory = (Omit<OwnStory, 'viewers' | 'likeCount'> | { pk: string; takenAt: string }) & {
  likeCount?: number | null
  viewers: StoryViewer[]
  status: 'ok' | 'error'
  error?: string
}

export type CollectResult =
  | { ok: true; accountUsername: string; stories: CollectedStory[]; stoppedEarly: InstagramFailure | null }
  | { ok: false; reason: InstagramFailure; message: string }

let cachedUsername: { userId: string; username: string } | null = null
let collecting = false

// A plain desktop Chrome user agent (same approach as Insyder): Instagram
// serves its web API to regular browsers, not to "Electron/…" clients.
const DESKTOP_UA = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`
const ACCEPT_LANGUAGE = 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'

function igSession(): Session {
  const ses = session.fromPartition(PARTITION)
  ses.setUserAgent(DESKTOP_UA, ACCEPT_LANGUAGE)
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


// Account-wide cooldown: once Instagram throttles (429 / dropped
// connection) or asks for a checkpoint, EVERY Instagram call from this app
// is refused for a while — whichever page asked — so retries from several
// places can't make things worse.
const COOLDOWN_MS = 30 * 60_000
let cooldownUntil = 0

export function cooldownRemainingMs(): number {
  return Math.max(0, cooldownUntil - Date.now())
}

async function igGet(path: string): Promise<unknown> {
  if (Date.now() < cooldownUntil) {
    throw new IgError('rate_limited', `Pause Instagram encore ${Math.ceil(cooldownRemainingMs() / 60_000)} min`)
  }
  try {
    return await igGetOn(IG, path)
  } catch (err) {
    if (err instanceof IgError && (err.reason === 'rate_limited' || err.reason === 'checkpoint')) {
      cooldownUntil = Date.now() + COOLDOWN_MS
      console.error(`[instagram] cooldown ${COOLDOWN_MS / 60_000} min after: ${err.message}`)
    }
    throw err
  }
}

// ─── Transport: same-origin fetch from an Instagram page ─────────────────
// Requests are made from inside a hidden instagram.com page (same approach
// as Insyder): same origin, same cookies and the headers Instagram's own web
// client sends. Requests from the main process (net.request) were answered
// with empty bodies / dropped connections for owner-only endpoints. The
// page lives in the isolated 'persist:instagram' partition; nothing but the
// JSON response comes back to the main process, cookies never do.
let pageWin: BrowserWindow | null = null
let pageReady: Promise<BrowserWindow> | null = null

function instagramPage(): Promise<BrowserWindow> {
  if (pageWin && !pageWin.isDestroyed() && pageReady) return pageReady
  pageWin = new BrowserWindow({
    show: false,
    width: 800,
    height: 600,
    webPreferences: { partition: PARTITION, contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  const win = pageWin
  igSession()
  win.webContents.setUserAgent(DESKTOP_UA)
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.on('closed', () => {
    if (pageWin === win) {
      pageWin = null
      pageReady = null
    }
  })
  pageReady = win.loadURL(`${IG}/`).then(() => win)
  pageReady.catch(() => {
    pageReady = null
  })
  return pageReady
}

export function closeInstagramPage() {
  if (pageWin && !pageWin.isDestroyed()) pageWin.close()
  pageWin = null
  pageReady = null
}

async function igGetOn(_host: string, path: string): Promise<unknown> {
  let win: BrowserWindow
  try {
    win = await instagramPage()
  } catch (err) {
    throw new IgError('error', `Page Instagram indisponible: ${err instanceof Error ? err.message : err}`)
  }
  // Only the path is interpolated (JSON-encoded); the page reads its own
  // csrftoken cookie itself.
  const script = `(async () => {
    const csrf = (document.cookie.match(/(?:^|; )csrftoken=([^;]+)/) || [])[1] || '';
    try {
      const r = await fetch(${JSON.stringify(path)}, {
        credentials: 'include',
        headers: { 'X-IG-App-ID': ${JSON.stringify(IG_WEB_APP_ID)}, 'X-Requested-With': 'XMLHttpRequest', 'X-CSRFToken': csrf },
      });
      return { status: r.status, text: await r.text() };
    } catch (e) {
      return { status: 0, text: '', networkError: String(e && e.message || e) };
    }
  })()`
  let res = (await win.webContents.executeJavaScript(script, true)) as { status: number; text: string; networkError?: string }
  if (res.networkError) {
    // A failed fetch is usually a stale hidden page (not a throttle): reload
    // the page once and retry before giving up.
    console.error(`[instagram] ${path.split('?')[0]} → network error, retrying with a fresh page`)
    closeInstagramPage()
    try {
      win = await instagramPage()
      res = (await win.webContents.executeJavaScript(script, true)) as typeof res
    } catch {
      // fall through
    }
    if (res.networkError) throw new IgError('error', 'Instagram injoignable pour le moment')
  }
  let body: unknown = null
  try {
    body = JSON.parse(res.text)
  } catch {
    console.error(`[instagram] ${path.split('?')[0]} → ${res.status} non-JSON`)
    throw new IgError(res.status === 429 ? 'rate_limited' : res.status === 401 || res.status === 403 ? 'not_connected' : 'error', `Réponse inattendue d'Instagram (${res.status})`)
  }
  if (res.status >= 200 && res.status < 300) return body
  const reason = classifyFailure(res.status, body)
  console.error(`[instagram] ${path.split('?')[0]} → ${res.status} (${reason})`)
  throw new IgError(reason, `Instagram ${res.status}`)
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
    win.webContents.setUserAgent(DESKTOP_UA)
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
  closeInstagramPage()
  await igSession().clearStorageData()
}

/** Every page of one story's viewer list (pages stay sequential). */
async function readViewers(storyPk: string, pauseFirst: boolean): Promise<StoryViewer[]> {
  const viewers: StoryViewer[] = []
  let maxId: string | null = null
  for (let page = 0; page < MAX_VIEWER_PAGES_PER_STORY; page++) {
    if (page > 0 || pauseFirst) await humanPause()
    const parsed = parseViewersPage(await igGet(viewersPath(storyPk, maxId)))
    viewers.push(...parsed.viewers)
    if (!parsed.nextMaxId || parsed.viewers.length === 0) break
    maxId = parsed.nextMaxId
  }
  return viewers
}

/**
 * Reads the coach's live stories and every viewer of each, plus `recheck`:
 * stories ClosRM already stores that are no longer live (> 24 h) but still
 * inside Instagram's 48 h viewer window — their list keeps growing until
 * then. A story whose list can't be read comes back with status 'error'
 * (never as 0 viewers); a throttle/checkpoint stops the run.
 */
export async function collectStoryViewers(recheck: { pk: string; takenAt: string }[] = []): Promise<CollectResult> {
  if (collecting) return { ok: false, reason: 'error', message: 'Collecte déjà en cours' }
  collecting = true
  try {
    const status = await getStatus()
    if (!status.connected || !status.userId) return { ok: false, reason: 'not_connected', message: 'Session Instagram non connectée' }

    const reel = await igGet(`/api/v1/feed/reels_media/?reel_ids=${status.userId}`)
    const owner = reelOwnerUsername(reel, status.userId)
    if (owner) cachedUsername = { userId: status.userId, username: owner }
    const pic = reelOwnerPicture(reel, status.userId)
    if (pic) await saveOwnProfile({ userId: status.userId, username: owner ?? null, picUrl: pic, at: Date.now() })
    const live = parseOwnReel(reel, status.userId)
    const livePks = new Set(live.map((s) => s.pk))
    const queue: (Omit<OwnStory, 'viewers'> | { pk: string; takenAt: string })[] = [
      ...live,
      ...recheck.filter((r) => !livePks.has(r.pk) && Date.now() - new Date(r.takenAt).getTime() < VIEWER_WINDOW_MS),
    ]
    const stories: CollectedStory[] = []
    let stoppedEarly: InstagramFailure | null = null
    let next = 0
    // Two stories at a time.
    const worker = async () => {
      while (next < queue.length && !stoppedEarly) {
        const i = next++
        const item = queue[i]
        try {
          const viewers = await readViewers(item.pk, i > 1)
          stories.push({ ...item, likeCount: viewers.filter((v) => v.hasLiked).length, viewers, status: 'ok' })
        } catch (err) {
          const reason = err instanceof IgError ? err.reason : 'error'
          stories.push({ ...item, viewers: [], status: 'error', error: err instanceof Error ? err.message : String(err) })
          if (reason === 'rate_limited' || reason === 'checkpoint' || reason === 'not_connected') stoppedEarly = reason
        }
      }
    }
    await Promise.all([worker(), worker()])
    if (stoppedEarly && !stories.some((s) => s.status === 'ok')) {
      return { ok: false, reason: stoppedEarly, message: stories.find((s) => s.error)?.error ?? 'Instagram a interrompu la collecte' }
    }
    return { ok: true, accountUsername: owner ?? status.username ?? status.userId, stories, stoppedEarly }
  } catch (err) {
    if (err instanceof IgError) return { ok: false, reason: err.reason, message: err.message }
    return { ok: false, reason: 'error', message: err instanceof Error ? err.message : 'Erreur inconnue' }
  } finally {
    collecting = false
  }
}


export type ArchiveResult = { ok: true; stories: ArchivedStory[] } | { ok: false; reason: InstagramFailure; message: string }

let archiveCache: { at: number; stories: ArchivedStory[] } | null = null
let archiveInFlight: Promise<ArchiveResult> | null = null
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
  if (archiveInFlight) return archiveInFlight
  archiveInFlight = (async (): Promise<ArchiveResult> => {
    try {
      const status = await getStatus()
      if (!status.connected || !status.userId) return { ok: false, reason: 'not_connected', message: 'Session Instagram non connectée' }
      // 1. Live stories — the same endpoint the viewer collection uses.
      const byPk = new Map<string, ArchivedStory>()
      for (const s of parseReelsMediaItems(await igGet(`/api/v1/feed/reels_media/?reel_ids=${status.userId}`))) byPk.set(s.pk, s)
      // (The story archive endpoint isn't served to the web client: only live
      // stories are read; past ones come from what ClosRM collected.)
      const stories = [...byPk.values()].sort((a, b) => b.takenAt.localeCompare(a.takenAt))
      archiveCache = { at: Date.now(), stories }
      return { ok: true, stories }
    } catch (err) {
      if (err instanceof IgError) return { ok: false, reason: err.reason, message: err.message }
      return { ok: false, reason: 'error', message: err instanceof Error ? err.message : 'Erreur inconnue' }
    } finally {
      archiveInFlight = null
    }
  })()
  return archiveInFlight
}


// ─── Highlights ("à la une") ──────────────────────────────────────────────
export type HighlightsResult = { ok: true; collections: HighlightCollection[] } | { ok: false; reason: InstagramFailure; message: string }
export type HighlightItemsResult = { ok: true; items: Record<string, ArchivedStory[]> } | { ok: false; reason: InstagramFailure; message: string }

const HIGHLIGHTS_TTL_MS = 6 * 60 * 60_000
let trayCache: { at: number; collections: HighlightCollection[] } | null = null
const itemsCache = new Map<string, { at: number; items: ArchivedStory[] }>()

function failure(err: unknown): { ok: false; reason: InstagramFailure; message: string } {
  if (err instanceof IgError) return { ok: false, reason: err.reason, message: err.message }
  return { ok: false, reason: 'error', message: err instanceof Error ? err.message : 'Erreur inconnue' }
}

/** The coach's highlight collections (1 request, cached 6 h). */
export async function highlightsTray(force = false): Promise<HighlightsResult> {
  if (!force && trayCache && Date.now() - trayCache.at < HIGHLIGHTS_TTL_MS) return { ok: true, collections: trayCache.collections }
  try {
    const status = await getStatus()
    if (!status.connected || !status.userId) return { ok: false, reason: 'not_connected', message: 'Session Instagram non connectée' }
    const variables = { user_id: status.userId, include_chaining: false, include_reel: false, include_suggested_users: false, include_logged_out_extras: false, include_highlight_reels: true, include_live_status: false }
    // highlights_tray isn't served to the web client; the profile GraphQL query is.
    const collections = parseGraphqlHighlights(await igGet(`/graphql/query/?query_hash=${HIGHLIGHTS_QUERY_HASH}&variables=${encodeURIComponent(JSON.stringify(variables))}`))
    trayCache = { at: Date.now(), collections }
    return { ok: true, collections }
  } catch (err) {
    return failure(err)
  }
}

/** Stories of the given collections (≤ 4 per request, spaced, cached 6 h each). */
export async function highlightItems(ids: string[]): Promise<HighlightItemsResult> {
  const items: Record<string, ArchivedStory[]> = {}
  const missing: string[] = []
  for (const id of ids) {
    const c = itemsCache.get(id)
    if (c && Date.now() - c.at < HIGHLIGHTS_TTL_MS) items[id] = c.items
    else missing.push(id)
  }
  try {
    for (let i = 0; i < missing.length; i += REELS_PER_REQUEST) {
      if (i > 0) await humanPause()
      const q = missing
        .slice(i, i + REELS_PER_REQUEST)
        .map((id) => `reel_ids=${encodeURIComponent(id)}`)
        .join('&')
      for (const [id, list] of parseHighlightItems(await igGet(`/api/v1/feed/reels_media/?${q}`))) {
        itemsCache.set(id, { at: Date.now(), items: list })
        items[id] = list
      }
    }
    return { ok: true, items }
  } catch (err) {
    // Return what we have; the caller shows partial results.
    return Object.keys(items).length > 0 ? { ok: true, items } : failure(err)
  }
}

// ─── Highlight viewers ────────────────────────────────────────────────────
export interface HighlightStoryResult {
  pk: string
  highlightId: string
  highlightTitle: string
  takenAt: string
  mediaType: 'image' | 'video' | null
  thumbnailUrl: string | null
  viewerCount: number | null
  likeCount: number | null
  /** 'ok' even with 0 viewers; 'error' = the list could not be read (never "0"). */
  status: 'ok' | 'error'
  error: string | null
  viewers: StoryViewer[]
}

export type HighlightViewersResult =
  | { ok: true; accountUsername: string; stories: HighlightStoryResult[]; skipped: number; tooOld: number; stoppedEarly: InstagramFailure | null }
  | { ok: false; reason: InstagramFailure; message: string }

const VIEWER_CONCURRENCY = 2

/**
 * Viewers of every story in the coach's highlights. Incremental: stories in
 * `skipPks` (already collected, no longer changing) are not fetched again.
 * Two stories at a time, spaced; stops at the first throttle/checkpoint and
 * returns what it has (the rest stays for the next run).
 */
export async function collectHighlightViewers(skipPks: string[]): Promise<HighlightViewersResult> {
  const status = await getStatus()
  if (!status.connected || !status.userId) return { ok: false, reason: 'not_connected', message: 'Session Instagram non connectée' }
  const tray = await highlightsTray()
  if (!tray.ok) return tray
  const items = await highlightItems(tray.collections.map((c) => c.id))
  if (!items.ok) return items

  const skip = new Set(skipPks)
  const queue: Omit<HighlightStoryResult, 'status' | 'error' | 'viewers'>[] = []
  const seen = new Set<string>()
  let skipped = 0
  let tooOld = 0
  for (const c of tray.collections) {
    for (const st of items.items[c.id] ?? []) {
      if (seen.has(st.pk)) continue // same story in two collections
      seen.add(st.pk)
      if (skip.has(st.pk)) {
        skipped += 1
        continue
      }
      // Instagram only lists viewers during the first 48 h (verified: older
      // highlight stories answer 0 users / viewer_count null) — don't ask.
      if (Date.now() - new Date(st.takenAt).getTime() > VIEWER_WINDOW_MS) {
        tooOld += 1
        continue
      }
      queue.push({
        pk: st.pk,
        highlightId: c.id,
        highlightTitle: c.title,
        takenAt: st.takenAt,
        mediaType: st.mediaType,
        thumbnailUrl: st.imageUrl,
        viewerCount: st.viewerCount,
        likeCount: st.likeCount,
      })
    }
  }

  const results: HighlightStoryResult[] = []
  let stoppedEarly: InstagramFailure | null = null
  let next = 0
  const worker = async () => {
    while (next < queue.length && !stoppedEarly) {
      const story = queue[next++]
      let viewers: StoryViewer[] = []
      try {
        viewers = await readViewers(story.pk, true)
        results.push({ ...story, likeCount: story.likeCount ?? viewers.filter((v) => v.hasLiked).length, status: 'ok', error: null, viewers })
      } catch (err) {
        const reason = err instanceof IgError ? err.reason : 'error'
        results.push({ ...story, status: 'error', error: err instanceof Error ? err.message : String(err), viewers })
        if (reason === 'rate_limited' || reason === 'checkpoint' || reason === 'not_connected') stoppedEarly = reason
      }
    }
  }
  await Promise.all(Array.from({ length: VIEWER_CONCURRENCY }, worker))
  return { ok: true, accountUsername: status.username ?? status.userId, stories: results, skipped, tooOld, stoppedEarly }
}


// ─── The coach's own profile picture (top bar) ───────────────────────────
// Read once a day at most (one request) or for free from the stories
// response; kept on disk (not a secret: a public CDN URL) so the top bar
// shows it on launch without any Instagram call.
interface OwnProfile {
  userId: string
  username: string | null
  picUrl: string
  at: number
}
const OWN_PROFILE_TTL_MS = 24 * 3_600_000
const ownProfileFile = () => path.join(app.getPath('userData'), 'instagram-profile.json')
let ownProfileMem: OwnProfile | null = null
let ownProfileInFlight: Promise<string | null> | null = null

async function loadOwnProfile(): Promise<OwnProfile | null> {
  if (ownProfileMem) return ownProfileMem
  try {
    ownProfileMem = JSON.parse(await readFile(ownProfileFile(), 'utf8')) as OwnProfile
  } catch {
    ownProfileMem = null
  }
  return ownProfileMem
}

async function saveOwnProfile(p: OwnProfile) {
  ownProfileMem = p
  await writeFile(ownProfileFile(), JSON.stringify(p)).catch(() => {})
}

/** Picture of the connected account; `username` (from ClosRM) is only used when nothing fresh is cached. */
export async function ownProfilePicture(username: string | null): Promise<string | null> {
  const status = await getStatus()
  if (!status.connected || !status.userId) return null
  const cached = await loadOwnProfile()
  const sameAccount = cached?.userId === status.userId
  if (cached && sameAccount && Date.now() - cached.at < OWN_PROFILE_TTL_MS) return cached.picUrl
  const handle = status.username ?? (sameAccount ? cached?.username : null) ?? username
  if (!handle || !/^[A-Za-z0-9._]{1,30}$/.test(handle) || cooldownRemainingMs() > 0) return sameAccount ? (cached?.picUrl ?? null) : null
  if (ownProfileInFlight) return ownProfileInFlight
  ownProfileInFlight = (async () => {
    try {
      const pic = parseWebProfilePicture(await igGet(`/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`))
      if (pic) await saveOwnProfile({ userId: status.userId as string, username: handle, picUrl: pic, at: Date.now() })
      return pic ?? (sameAccount ? (cached?.picUrl ?? null) : null)
    } catch {
      return sameAccount ? (cached?.picUrl ?? null) : null
    } finally {
      ownProfileInFlight = null
    }
  })()
  return ownProfileInFlight
}
