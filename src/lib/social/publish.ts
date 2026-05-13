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
  // 1. SELECT les ids pending dont l'heure est passee.
  const { data: candidates, error: selErr } = await supabase
    .from('social_post_publications')
    .select('id')
    .eq('status', 'pending')
    .lte('scheduled_at', now)
    .limit(limit)
  if (selErr) throw new Error(selErr.message)
  if (!candidates?.length) return { published: 0, errors: 0 }

  // 2. Atomic claim: UPDATE ... WHERE status='pending' RETURNING.
  //    Si 2 invocations de cron se chevauchent (cron toutes les 5min,
  //    une iteration prend >5min sur une grosse video), seule la premiere
  //    qui passe le UPDATE recupere les lignes — la 2e voit status='publishing'
  //    et son WHERE filtre. Pas de double-publication.
  const ids = candidates.map((c) => c.id as string)
  const { data: claimed, error: claimErr } = await supabase
    .from('social_post_publications')
    .update({ status: 'publishing' })
    .in('id', ids)
    .eq('status', 'pending') // re-check pour gagner la course
    .select('*, post:social_posts(*)')
  if (claimErr) throw new Error(claimErr.message)
  if (!claimed?.length) return { published: 0, errors: 0 }

  let published = 0
  let errors = 0
  for (const pub of claimed) {
    const post = (pub as unknown as { post: Post | null }).post
    const ok = await publishOne(supabase, pub as unknown as Pub, post)
    if (ok) published++
    else errors++
  }
  await refreshPostStatuses(supabase, claimed.map((p) => (p as unknown as Pub).social_post_id))
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

/** Detecte image vs video depuis l'URL (fallback quand media_type DB est null). */
function inferIsVideo(url: string, mediaTypeRaw: string | null | undefined): boolean {
  const mt = (mediaTypeRaw ?? '').toUpperCase()
  if (mt === 'VIDEO' || mt === 'REEL' || mt === 'REELS' || mt === 'SHORT' || mt === 'LONG_VIDEO') return true
  if (mt === 'IMAGE' || mt === 'CAROUSEL') return false
  // Fallback: extension du fichier (avant le ? si query string).
  const cleaned = url.split('?')[0].toLowerCase()
  if (/\.(mp4|mov|m4v|webm|avi|mkv)$/.test(cleaned)) return true
  if (/\.(jpg|jpeg|png|gif|webp|heic|avif)$/.test(cleaned)) return false
  // Default conservatively: assume video (la plupart des contenus social sont video).
  return true
}

async function publishOne(supabase: Supabase, pub: Pub, post: Post | null): Promise<boolean> {
  console.log(`[publish] start pub ${pub.id} platform=${pub.platform} post=${pub.social_post_id}`)
  if (!post) {
    console.error(`[publish] pub ${pub.id} no post`)
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
    console.log(`[publish] ✅ pub ${pub.id} (${pub.platform}) success`)
    return true
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur de publication'
    console.error(`[publish] ❌ pub ${pub.id} (${pub.platform}) failed:`, message)
    await markFailed(supabase, pub.id, message)
    return false
  }
}

async function publishToInstagram(supabase: Supabase, pub: Pub, post: Post) {
  console.log(`[publish/IG] pub=${pub.social_post_id} media_urls=${post.media_urls?.length ?? 0} media_type=${post.media_type}`)
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

  const rawMedia = post.media_urls[0]
  const mediaUrl = await resolveMediaUrl(supabase, rawMedia, 600)
  const isVideo = inferIsVideo(rawMedia, post.media_type)
  const igMediaType = isVideo ? 'REELS' : undefined
  console.log(`[publish/IG] raw=${rawMedia.slice(0, 80)} signed=${mediaUrl.slice(0, 80)}... isVideo=${isVideo}`)

  const containerId = await createMediaContainer({
    accessToken: token,
    igUserId: account.ig_user_id,
    caption,
    ...(isVideo ? { videoUrl: mediaUrl, mediaType: igMediaType } : { imageUrl: mediaUrl }),
  })
  console.log(`[publish/IG] container=${containerId}`)

  if (isVideo) {
    await pollContainerStatus(token, containerId)
    console.log(`[publish/IG] container ready, publishing`)
  }

  const igMediaId = await publishContainer({
    accessToken: token,
    igUserId: account.ig_user_id,
    containerId,
  })
  console.log(`[publish/IG] published media_id=${igMediaId}`)

  await supabase.from('social_post_publications').update({
    status: 'published',
    published_at: new Date().toISOString(),
    provider_post_id: igMediaId,
    error_message: null,
    last_attempt_at: new Date().toISOString(),
  }).eq('id', pub.id)
}

async function publishToYoutube(supabase: Supabase, pub: Pub, post: Post) {
  console.log(`[publish/YT] pub=${pub.social_post_id} media_urls=${post.media_urls?.length ?? 0} media_type=${post.media_type}`)
  if (!post.media_urls?.length) throw new Error('Aucun média')
  const isVideo = inferIsVideo(post.media_urls[0], post.media_type)
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
  // 1. Path R2 brut (workspaces/.../posts/.../filename.mp4) — sign via R2.
  //    Sans ca, Meta/YouTube essaient de fetch le path comme URL → fail.
  if (!url.startsWith('http')) {
    try {
      const { isR2Configured } = await import('@/lib/storage/r2-client')
      if (isR2Configured()) {
        const { signRead } = await import('@/lib/storage/signing')
        const signed = await signRead(url, expiresSec)
        console.log(`[resolveMediaUrl] R2 path signed: ${url.slice(0, 60)}...`)
        return signed
      } else {
        console.warn('[resolveMediaUrl] R2 path detected but R2 not configured — returning as-is, will fail')
      }
    } catch (err) {
      console.error('[resolveMediaUrl] R2 sign failed:', (err as Error).message)
    }
  }
  // 2. Supabase Storage url (content-drafts bucket).
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  if (url.includes(supabaseUrl) && url.includes('/content-drafts/')) {
    const filePath = url.split('/content-drafts/').pop()
    if (filePath) {
      const { data: signed } = await supabase.storage.from('content-drafts').createSignedUrl(filePath, expiresSec)
      if (signed?.signedUrl) return signed.signedUrl
    }
  }
  // 3. URL publique deja signee — passthrough.
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
