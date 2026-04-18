import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createMediaContainer, pollContainerStatus, publishContainer } from '@/lib/instagram/api'

export const maxDuration = 120

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date().toISOString()

  const { data: pubs, error } = await supabase
    .from('social_post_publications')
    .select('*, post:social_posts(*)')
    .eq('status', 'pending')
    .lte('scheduled_at', now)
    .limit(10)

  if (error) {
    console.error('[cron/social-posts] select error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!pubs?.length) return NextResponse.json({ published: 0, errors: 0 })

  let published = 0
  let errors = 0

  for (const pub of pubs) {
    const post = pub.post
    if (!post) {
      await markFailed(supabase, pub.id, 'Post introuvable')
      errors++
      continue
    }

    try {
      await supabase.from('social_post_publications').update({ status: 'publishing' }).eq('id', pub.id)

      if (pub.platform === 'instagram') {
        await publishToInstagram(supabase, { id: pub.id, workspace_id: pub.workspace_id }, post)
        published++
      } else if (pub.platform === 'youtube') {
        await publishToYoutube(
          supabase,
          { id: pub.id, workspace_id: pub.workspace_id, config: pub.config ?? {}, scheduled_at: pub.scheduled_at },
          post,
        )
        published++
      } else {
        await markFailed(supabase, pub.id, `Plateforme non supportée : ${pub.platform}`)
        errors++
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de publication'
      console.error(`[cron/social-posts] pub ${pub.id} failed:`, message)
      await markFailed(supabase, pub.id, message)
      errors++
    }
  }

  await refreshPostStatuses(supabase, pubs.map((p) => p.social_post_id))

  return NextResponse.json({ published, errors })
}

async function publishToInstagram(
  supabase: ReturnType<typeof createServiceClient>,
  pub: { id: string; workspace_id: string },
  post: { caption: string | null; hashtags: string[] | null; media_urls: string[] | null; media_type: string | null }
) {
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

  let mediaUrl = post.media_urls[0]
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  if (mediaUrl.includes(supabaseUrl) && mediaUrl.includes('/content-drafts/')) {
    const filePath = mediaUrl.split('/content-drafts/').pop()
    if (filePath) {
      const { data: signed } = await supabase.storage.from('content-drafts').createSignedUrl(filePath, 600)
      if (signed?.signedUrl) mediaUrl = signed.signedUrl
    }
  }

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
    const status = await pollContainerStatus(token, containerId)
    if (status === 'ERROR') throw new Error('Video processing failed')
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

async function publishToYoutube(
  supabase: ReturnType<typeof createServiceClient>,
  pub: { id: string; workspace_id: string; config: Record<string, unknown>; scheduled_at: string | null },
  post: { title: string | null; caption: string | null; hashtags: string[] | null; media_urls: string[] | null; media_type: string | null },
) {
  if (!post.media_urls?.length) throw new Error('Aucun média')

  const mt = (post.media_type ?? '').toUpperCase()
  const isVideo = mt === 'VIDEO' || mt === 'REEL' || mt === 'REELS' || mt === 'SHORT' || mt === 'LONG_VIDEO'
  if (!isVideo) throw new Error('YouTube accepte uniquement des vidéos')

  const token = await getValidYoutubeAccessToken(pub.workspace_id)
  if (!token) throw new Error('YouTube non connecté ou token invalide')

  let mediaUrl = post.media_urls[0]
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  if (mediaUrl.includes(supabaseUrl) && mediaUrl.includes('/content-drafts/')) {
    const filePath = mediaUrl.split('/content-drafts/').pop()
    if (filePath) {
      const { data: signed } = await supabase.storage.from('content-drafts').createSignedUrl(filePath, 1800)
      if (signed?.signedUrl) mediaUrl = signed.signedUrl
    }
  }

  const cfg = pub.config as {
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

async function markFailed(
  supabase: ReturnType<typeof createServiceClient>,
  pubId: string,
  message: string
) {
  await supabase.from('social_post_publications').update({
    status: 'failed',
    error_message: message,
  }).eq('id', pubId)
}

async function refreshPostStatuses(
  supabase: ReturnType<typeof createServiceClient>,
  postIds: string[]
) {
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
