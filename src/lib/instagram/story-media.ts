// Keeps a copy of the coach's own story media in Supabase Storage
// ('story-media', migration 116) while the Instagram CDN links still work,
// so a collected story stays viewable after Instagram expires them.
// Runs after the response (best effort): a failure only means the story
// keeps its CDN link.
import { randomUUID } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/service'

const MAX_BYTES = 60 * 1024 * 1024

async function copy(url: string, path: string): Promise<string | null> {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) return null
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length === 0 || buf.length > MAX_BYTES) return null
  const supabase = createServiceClient()
  const contentType = res.headers.get('content-type') ?? (path.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg')
  const { error } = await supabase.storage.from('story-media').upload(path, buf, { contentType, upsert: true })
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
    const base = `${workspaceId}/${st.pk}-${randomUUID().slice(0, 8)}`
    if (st.thumbnailUrl && !row?.image_url) {
      const u = await copy(st.thumbnailUrl, `${base}.jpg`).catch(() => null)
      if (u) patch.image_url = u
    }
    if (st.videoUrl && !row?.video_url) {
      const u = await copy(st.videoUrl, `${base}.mp4`).catch(() => null)
      if (u) patch.video_url = u
    }
    if (Object.keys(patch).length > 0) {
      await supabase.from('story_view_stories').update(patch).eq('workspace_id', workspaceId).eq('story_pk', st.pk)
    }
  }
}
