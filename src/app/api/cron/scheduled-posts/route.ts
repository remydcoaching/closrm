import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createMediaContainer, pollContainerStatus, publishContainer } from '@/lib/instagram/api'

export const maxDuration = 120 // Allow up to 2 minutes for video processing

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date().toISOString()

  // Find all scheduled drafts whose scheduled_at has passed
  const { data: drafts, error } = await supabase
    .from('ig_drafts')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)
    .limit(10)

  if (error || !drafts?.length) {
    return NextResponse.json({ published: 0, errors: 0 })
  }

  let published = 0
  let errors = 0

  for (const draft of drafts) {
    try {
      // Get the IG account for this workspace
      const { data: account } = await supabase
        .from('ig_accounts')
        .select('ig_user_id, access_token, page_access_token, is_connected')
        .eq('workspace_id', draft.workspace_id)
        .eq('is_connected', true)
        .maybeSingle()

      if (!account) {
        await supabase.from('ig_drafts').update({
          status: 'failed',
          error_message: 'Compte Instagram non connecté',
          updated_at: new Date().toISOString(),
        }).eq('id', draft.id)
        errors++
        continue
      }

      const publishToken = account.page_access_token || account.access_token
      if (!draft.media_urls?.length) {
        await supabase.from('ig_drafts').update({
          status: 'failed',
          error_message: 'Aucun média',
          updated_at: new Date().toISOString(),
        }).eq('id', draft.id)
        errors++
        continue
      }

      // Mark as publishing
      await supabase.from('ig_drafts').update({ status: 'publishing' }).eq('id', draft.id)

      // Build caption
      let fullCaption = draft.caption ?? ''
      if (draft.hashtags?.length) {
        fullCaption += '\n\n' + draft.hashtags.map((h: string) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
      }

      // Generate signed URL for private bucket
      let mediaUrl = draft.media_urls[0] as string
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
      if (mediaUrl.includes(supabaseUrl) && mediaUrl.includes('/content-drafts/')) {
        const filePath = mediaUrl.split('/content-drafts/').pop()
        if (filePath) {
          const { data: signedData } = await supabase.storage
            .from('content-drafts')
            .createSignedUrl(filePath, 600)
          if (signedData?.signedUrl) {
            mediaUrl = signedData.signedUrl
          }
        }
      }

      const isVideo = draft.media_type === 'VIDEO' || draft.media_type === 'REELS' || draft.media_type === 'STORY'
      const opts = {
        accessToken: publishToken,
        igUserId: account.ig_user_id,
        caption: fullCaption,
        ...(isVideo ? { videoUrl: mediaUrl, mediaType: draft.media_type } : { imageUrl: mediaUrl }),
      }

      // Create container
      const containerId = await createMediaContainer(opts)

      // Poll for video
      if (isVideo) {
        const status = await pollContainerStatus(publishToken, containerId)
        if (status === 'ERROR') throw new Error('Video processing failed')
      }

      // Publish
      const igMediaId = await publishContainer({
        accessToken: publishToken,
        igUserId: account.ig_user_id,
        containerId,
      })

      // Update draft
      await supabase.from('ig_drafts').update({
        status: 'published',
        published_at: new Date().toISOString(),
        ig_media_id: igMediaId,
        updated_at: new Date().toISOString(),
      }).eq('id', draft.id)

      published++
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de publication'
      console.error(`[Cron scheduled-posts] Failed draft ${draft.id}:`, message)
      await supabase.from('ig_drafts').update({
        status: 'failed',
        error_message: message,
        updated_at: new Date().toISOString(),
      }).eq('id', draft.id)
      errors++
    }
  }

  return NextResponse.json({ published, errors })
}
