const IG_API_VERSION = 'v25.0'
const IG_BASE = `https://graph.instagram.com/${IG_API_VERSION}`
const FB_BASE = `https://graph.facebook.com/${IG_API_VERSION}`

interface IgApiOptions {
  accessToken: string
  igUserId: string
}

// ── Profile ──

export async function fetchIgProfile(token: string, igUserId?: string) {
  // Use Facebook Graph API with IG user ID (works with Facebook Login tokens)
  const base = igUserId ? FB_BASE : IG_BASE
  const id = igUserId ?? 'me'
  const url = `${base}/${id}?fields=username,name,followers_count,follows_count,media_count,profile_picture_url&access_token=${token}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`IG profile fetch failed: ${res.status}`)
  return res.json() as Promise<{
    id: string
    username: string
    name: string
    followers_count: number
    follows_count: number
    media_count: number
    profile_picture_url: string
  }>
}

// ── Reels ──

interface IgMediaItem {
  id: string
  caption?: string
  media_type: string
  media_url?: string
  thumbnail_url?: string
  timestamp: string
  like_count?: number
  comments_count?: number
}

export async function fetchIgMedia(token: string, limit = 50, igUserId?: string): Promise<IgMediaItem[]> {
  const base = igUserId ? FB_BASE : IG_BASE
  const id = igUserId ?? 'me'
  const url = `${base}/${id}/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count&limit=${limit}&access_token=${token}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`IG media fetch failed: ${res.status}`)
  const json = await res.json()
  return json.data ?? []
}

interface IgInsights {
  views?: number
  reach?: number
  saved?: number
  shares?: number
}

export async function fetchReelInsights(token: string, mediaId: string): Promise<IgInsights> {
  const url = `${FB_BASE}/${mediaId}/insights?metric=views,reach,saved,shares&access_token=${token}`
  const res = await fetch(url)
  if (!res.ok) return {}
  const json = await res.json()
  const result: IgInsights = {}
  for (const item of json.data ?? []) {
    if (item.name === 'views') result.views = item.values?.[0]?.value ?? 0
    if (item.name === 'reach') result.reach = item.values?.[0]?.value ?? 0
    if (item.name === 'saved') result.saved = item.values?.[0]?.value ?? 0
    if (item.name === 'shares') result.shares = item.values?.[0]?.value ?? 0
  }
  return result
}

// ── Stories ──

interface IgStoryItem {
  id: string
  media_url?: string
  thumbnail_url?: string
  caption?: string
  media_type: string
  timestamp: string
}

export async function fetchIgStories(token: string, igUserId?: string): Promise<IgStoryItem[]> {
  const base = igUserId ? FB_BASE : IG_BASE
  const id = igUserId ?? 'me'
  const url = `${base}/${id}/stories?fields=id,media_url,thumbnail_url,caption,media_type,timestamp&access_token=${token}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`IG stories fetch failed: ${res.status}`)
  const json = await res.json()
  return json.data ?? []
}

interface IgStoryInsights {
  impressions?: number
  reach?: number
  replies?: number
  exits?: number
  taps_forward?: number
  taps_back?: number
}

export async function fetchStoryInsights(token: string, storyId: string): Promise<IgStoryInsights> {
  const url = `${FB_BASE}/${storyId}/insights?metric=impressions,reach,replies,shares,total_interactions,navigation&access_token=${token}`
  const res = await fetch(url)
  if (!res.ok) return {}
  const json = await res.json()
  const result: IgStoryInsights = {}
  for (const item of json.data ?? []) {
    if (item.name === 'impressions') result.impressions = item.values?.[0]?.value ?? 0
    if (item.name === 'reach') result.reach = item.values?.[0]?.value ?? 0
    if (item.name === 'replies') result.replies = item.values?.[0]?.value ?? 0
    if (item.name === 'navigation') result.exits = item.values?.[0]?.value ?? 0
    if (item.name === 'total_interactions') result.taps_forward = item.values?.[0]?.value ?? 0
    if (item.name === 'shares') result.taps_back = item.values?.[0]?.value ?? 0
  }
  return result
}

// ── Publishing ──

export async function createMediaContainer(
  opts: IgApiOptions & { imageUrl?: string; videoUrl?: string; caption: string }
): Promise<string> {
  const { accessToken, igUserId, imageUrl, videoUrl, caption } = opts
  const params = new URLSearchParams({ caption, access_token: accessToken })
  if (videoUrl) {
    params.set('video_url', videoUrl)
    params.set('media_type', 'REELS')
  } else if (imageUrl) {
    params.set('image_url', imageUrl)
  }

  // Meta Content Publishing API expects params as query string, not body
  const url = `${FB_BASE}/${igUserId}/media?${params.toString()}`
  const res = await fetch(url, { method: 'POST' })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Create container failed: ${JSON.stringify(err)}`)
  }
  const json = await res.json()
  return json.id as string
}

export async function pollContainerStatus(
  token: string,
  containerId: string,
  maxAttempts = 30,
  intervalMs = 2000
): Promise<'FINISHED' | 'ERROR'> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(
      `${FB_BASE}/${containerId}?fields=status_code&access_token=${token}`
    )
    if (res.ok) {
      const json = await res.json()
      if (json.status_code === 'FINISHED') return 'FINISHED'
      if (json.status_code === 'ERROR') return 'ERROR'
    }
    await new Promise(r => setTimeout(r, intervalMs))
  }
  throw new Error('Container processing timeout (60s)')
}

export async function publishContainer(
  opts: IgApiOptions & { containerId: string }
): Promise<string> {
  const { accessToken, igUserId, containerId } = opts
  const params = new URLSearchParams({
    creation_id: containerId,
    access_token: accessToken,
  })
  // Meta expects params as query string
  const url = `${FB_BASE}/${igUserId}/media_publish?${params.toString()}`
  const res = await fetch(url, { method: 'POST' })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Publish failed: ${JSON.stringify(err)}`)
  }
  const json = await res.json()
  return json.id as string
}

// ── Conversations / Messages ──

interface IgConversationRaw {
  id: string
  participants: { data: Array<{ id: string; username: string; name?: string }> }
  messages: { data: Array<{ id: string; message: string; from: { id: string }; created_time: string }> }
}

export async function fetchIgConversations(token: string, pageId: string): Promise<IgConversationRaw[]> {
  const url = `${FB_BASE}/${pageId}/conversations?platform=instagram&fields=id,participants,messages.limit(1){id,message,from,created_time}&access_token=${token}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`IG conversations fetch failed: ${res.status}`)
  const json = await res.json()
  return json.data ?? []
}

interface IgMessageRaw {
  id: string
  message?: string
  from: { id: string }
  created_time: string
  attachments?: { data: Array<{ mime_type: string; image_data?: { url: string }; video_data?: { url: string } }> }
}

export async function fetchConversationMessages(
  token: string,
  conversationId: string,
  limit = 50
): Promise<IgMessageRaw[]> {
  const url = `${FB_BASE}/${conversationId}/messages?fields=id,message,from,created_time,attachments&limit=${limit}&access_token=${token}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`IG messages fetch failed: ${res.status}`)
  const json = await res.json()
  return json.data ?? []
}

export async function sendIgMessage(
  token: string,
  pageId: string,
  recipientId: string,
  text: string
): Promise<string> {
  const res = await fetch(`${FB_BASE}/${pageId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
      access_token: token,
    }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Send DM failed: ${JSON.stringify(err)}`)
  }
  const json = await res.json()
  return json.message_id as string
}
