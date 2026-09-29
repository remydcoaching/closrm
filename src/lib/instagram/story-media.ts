// Keeps a copy of the coach's own story media in Supabase Storage
// ('story-media', migration 116) while the Instagram CDN links still work,
// so a collected story stays viewable after Instagram expires them.
// Runs after the response (best effort): a failure only means the story
// keeps its CDN link.
import { randomUUID } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/service'

const MAX_BYTES = 60 * 1024 * 1024

// Only Instagram's own CDNs over https (the URLs come from the client).
const ALLOWED_HOST = /(^|\.)(cdninstagram\.com|fbcdn\.net)$/i
const ALLOWED_TYPES: Record<'image' | 'video', RegExp> = {
  image: /^image\/(jpeg|png|webp|heic)$/i,
  video: /^video\/mp4$/i,
}

export function isAllowedMediaUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    return u.protocol === 'https:' && ALLOWED_HOST.test(u.hostname) && !u.username && !u.password && (u.port === '' || u.port === '443')
  } catch {
    return false
  }
}

async function copy(url: string, path: string, kind: 'image' | 'video'): Promise<string | null> {
  if (!isAllowedMediaUrl(url)) return null
  // No redirects: a redirect could point outside the allowed hosts.
  const res = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) return null
  const contentType = (res.headers.get('content-type') ?? '').split(';')[0].trim()
  if (!ALLOWED_TYPES[kind].test(contentType)) return null
  const declared = Number(res.headers.get('content-length'))
  if (declared > MAX_BYTES) return null
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length === 0 || buf.length > MAX_BYTES) return null
  const supabase = createServiceClient()
  const { error } = await supabase.storage.from('story-media').upload(path, buf, { contentType, upsert: false })
  if (error) return null
  return supabase.storage.from('story-media').getPublicUrl(path).data.publicUrl
}

export async function storeStoryMedia(
  workspaceId: string,
  stories: { pk: string; thumbnailUrl?: string | null; videoUrl?: string | null }[],
) {
  const supabase = createServiceClient()
  const pks = stories.map((s) => s.pk)
  const { data: existing, error } = await supabase
    .from('story_view_stories')
    .select('story_pk, image_url, video_url')
    .eq('workspace_id', workspaceId)
    .in('story_pk', pks)
  if (error) return // migration 116 not applied yet
  const have = new Map((existing ?? []).map((e) => [e.story_pk as string, e]))
  for (const st of stories) {
    const row = have.get(st.pk)
    const patch: Record<string, string> = {}
    // Story pks are numeric; anything else is ignored (no path injection).
    if (!/^\d{1,30}$/.test(st.pk)) continue
    const base = `${workspaceId}/${st.pk}-${randomUUID()}`
    if (st.thumbnailUrl && !row?.image_url) {
      const u = await copy(st.thumbnailUrl, `${base}.jpg`, 'image').catch(() => null)
      if (u) patch.image_url = u
    }
    if (st.videoUrl && !row?.video_url) {
      const u = await copy(st.videoUrl, `${base}.mp4`, 'video').catch(() => null)
      if (u) patch.video_url = u
    }
    if (Object.keys(patch).length > 0) {
      await supabase.from('story_view_stories').update(patch).eq('workspace_id', workspaceId).eq('story_pk', st.pk)
    }
  }
}
