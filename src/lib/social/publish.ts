import { createServiceClient } from '@/lib/supabase/service'
import { createMediaContainer, pollContainerStatus, publishContainer } from '@/lib/instagram/api'
import { getValidYoutubeAccessToken } from '@/lib/youtube/api'
import { uploadYoutubeVideo } from '@/lib/youtube/upload'

type Supabase = ReturnType<typeof createServiceClient>

interface Post {
  title: string | null
  caption: string | null
  hashtags: string[] | null
  media_urls: string[] | null
  media_type: string | null
}

interface Pub {
  id: string
  workspace_id: string
  social_post_id: string
  platform: string
  config: Record<string, unknown> | null
  scheduled_at: string | null
}

export async function publishPendingBatch(supabase: Supabase, limit = 10) {
  const now = new Date().toISOString()
  const { data: pubs, error } = await supabase
    .from('social_post_publications')
    .select('*, post:social_posts(*)')
    .eq('status', 'pending')
    .lte('scheduled_at', now)
    .limit(limit)

  if (error) throw new Error(error.message)
  if (!pubs?.length) return { published: 0, errors: 0 }

  let published = 0
  let errors = 0
  for (const pub of pubs) {
    const post = (pub as unknown as { post: Post | null }).post
    const ok = await publishOne(supabase, pub as unknown as Pub, post)
    if (ok) published++
    else errors++
  }
  await refreshPostStatuses(supabase, pubs.map((p) => (p as unknown as Pub).social_post_id))
  return { published, errors }
}

export async function publishPostNow(supabase: Supabase, postId: string) {
  const { data: pubs, error } = await supabase
    .from('social_post_publications')
    .select('*, post:social_posts(*)')
    .eq('social_post_id', postId)
    .in('status', ['pending', 'failed'])

  if (error) throw new Error(error.message)
  if (!pubs?.length) return { published: 0, errors: 0 }

  let published = 0
  let errors = 0
  for (const pub of pubs) {
    const post = (pub as unknown as { post: Post | null }).post
    const ok = await publishOne(supabase, pub as unknown as Pub, post)
    if (ok) published++
    else errors++
  }
  await refreshPostStatuses(supabase, [postId])
  return { published, errors }
}

async function publishOne(supabase: Supabase, pub: Pub, post: Post | null): Promise<boolean> {
  if (!post) {
    await markFailed(supabase, pub.id, 'Post introuvable')
    return false
  }
  try {
    await supabase.from('social_post_publications').update({ status: 'publishing' }).eq('id', pub.id)
    if (pub.platform === 'instagram') {
      await publishToInstagram(supabase, pub, post)
    } else if (pub.platform === 'youtube') {
      await publishToYoutube(supabase, pub, post)
    } else {
      throw new Error(`Plateforme non supportée : ${pub.platform}`)
    }
    return true
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur de publication'
    console.error(`[publish] pub ${pub.id} failed:`, message)
    await markFailed(supabase, pub.id, message)
    return false
  }
}

async function publishToInstagram(supabase: Supabase, pub: Pub, post: Post) {
  const { data: account } = await supabase
    .from('ig_accounts')
    .select('ig_user_id, access_token, page_access_token, is_connected')
    .eq('workspace_id', pub.workspace_id)
    .eq('is_connected', true)
    .maybeSingle()

  if (!account) throw new Error('Compte Instagram non connecté')
  if (!post.media_urls?.length) throw new Error('Aucun média')

  const token = account.page_access_token || account.access_token
  let caption = post.caption ?? ''
  if (post.hashtags?.length) {
    caption += '\n\n' + post.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
  }

  const mediaUrl = await resolveMediaUrl(supabase, post.media_urls[0], 600)
  const mt = (post.media_type ?? '').toUpperCase()
  const isVideo = mt === 'VIDEO' || mt === 'REEL' || mt === 'REELS' || mt === 'SHORT'
  const igMediaType = isVideo ? 'REELS' : undefined

  const containerId = await createMediaContainer({
    accessToken: token,
    igUserId: account.ig_user_id,
    caption,
    ...(isVideo ? { videoUrl: mediaUrl, mediaType: igMediaType } : { imageUrl: mediaUrl }),
  })

  if (isVideo) {
    await pollContainerStatus(token, containerId)
  }

  const igMediaId = await publishContainer({
    accessToken: token,
    igUserId: account.ig_user_id,
    containerId,
  })

  await supabase.from('social_post_publications').update({
    status: 'published',
    published_at: new Date().toISOString(),
    provider_post_id: igMediaId,
    error_message: null,
    last_attempt_at: new Date().toISOString(),
  }).eq('id', pub.id)
}

async function publishToYoutube(supabase: Supabase, pub: Pub, post: Post) {
  if (!post.media_urls?.length) throw new Error('Aucun média')
  const mt = (post.media_type ?? '').toUpperCase()
  const isVideo = mt === 'VIDEO' || mt === 'REEL' || mt === 'REELS' || mt === 'SHORT' || mt === 'LONG_VIDEO'
  if (!isVideo) throw new Error('YouTube accepte uniquement des vidéos')

  const token = await getValidYoutubeAccessToken(pub.workspace_id)
  if (!token) throw new Error('YouTube non connecté ou token invalide')

  const mediaUrl = await resolveMediaUrl(supabase, post.media_urls[0], 1800)
  const cfg = (pub.config ?? {}) as {
    title?: string
    description?: string
    privacy_status?: 'public' | 'unlisted' | 'private'
    tags?: string[]
  }
  const title = cfg.title || post.title || (post.caption ?? '').slice(0, 90) || 'Untitled'
  const description = cfg.description ?? post.caption ?? ''
  const privacy = cfg.privacy_status ?? 'private'
  const tags = cfg.tags ?? post.hashtags ?? undefined

  const result = await uploadYoutubeVideo(token, mediaUrl, {
    title,
    description,
    tags,
    privacyStatus: privacy,
  })

  await supabase.from('social_post_publications').update({
    status: 'published',
    published_at: new Date().toISOString(),
    provider_post_id: result.id,
    public_url: result.url,
    error_message: null,
    last_attempt_at: new Date().toISOString(),
  }).eq('id', pub.id)
}

async function resolveMediaUrl(supabase: Supabase, url: string, expiresSec: number): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  if (url.includes(supabaseUrl) && url.includes('/content-drafts/')) {
    const filePath = url.split('/content-drafts/').pop()
    if (filePath) {
      const { data: signed } = await supabase.storage.from('content-drafts').createSignedUrl(filePath, expiresSec)
      if (signed?.signedUrl) return signed.signedUrl
    }
  }
  return url
}

async function markFailed(supabase: Supabase, pubId: string, message: string) {
  await supabase.from('social_post_publications').update({
    status: 'failed',
    error_message: message,
    last_attempt_at: new Date().toISOString(),
  }).eq('id', pubId)
}

async function refreshPostStatuses(supabase: Supabase, postIds: string[]) {
  const unique = [...new Set(postIds)]
  for (const postId of unique) {
    const { data: pubs } = await supabase
      .from('social_post_publications')
      .select('status')
      .eq('social_post_id', postId)
    if (!pubs?.length) continue
    const statuses = pubs.map((p) => p.status)
    let newStatus: string
    if (statuses.every((s) => s === 'published')) newStatus = 'published'
    else if (statuses.every((s) => s === 'failed')) newStatus = 'failed'
    else if (statuses.some((s) => s === 'published')) newStatus = 'partial'
    else if (statuses.some((s) => s === 'publishing')) newStatus = 'publishing'
    else newStatus = 'scheduled'
    await supabase.from('social_posts').update({
      status: newStatus,
      published_at: newStatus === 'published' ? new Date().toISOString() : null,
    }).eq('id', postId)
  }
}
