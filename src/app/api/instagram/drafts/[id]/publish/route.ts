import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createMediaContainer, pollContainerStatus, publishContainer } from '@/lib/instagram/api'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { id } = await params

    // 1. Get draft
    const { data: draft, error: draftErr } = await supabase
      .from('ig_drafts').select('*').eq('id', id).eq('workspace_id', workspaceId).single()

    if (draftErr || !draft) return NextResponse.json({ error: 'Brouillon introuvable' }, { status: 404 })
    if (!draft.media_urls?.length) return NextResponse.json({ error: 'Au moins un média requis' }, { status: 400 })

    // 2. Get IG account — use page_access_token for publishing (required by Meta)
    const { data: account } = await supabase
      .from('ig_accounts').select('*').eq('workspace_id', workspaceId).eq('is_connected', true).maybeSingle()
    if (!account) return NextResponse.json({ error: 'Aucun compte Instagram connecté' }, { status: 400 })

    const publishToken = account.page_access_token || account.access_token

    // 3. Mark as publishing
    await supabase.from('ig_drafts').update({ status: 'publishing' }).eq('id', id)

    // 4. Build caption with hashtags
    let fullCaption = draft.caption ?? ''
    if (draft.hashtags?.length) {
      fullCaption += '\n\n' + draft.hashtags.map((h: string) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
    }
    if (fullCaption.length > 2200) {
      await supabase.from('ig_drafts').update({ status: 'draft' }).eq('id', id)
      return NextResponse.json({ error: 'La légende + hashtags dépasse 2200 caractères' }, { status: 400 })
    }

    try {
      const publishPromise = async () => {
        const isVideo = draft.media_type === 'VIDEO'
        const opts = {
          accessToken: publishToken,
          igUserId: account.ig_user_id,
          caption: fullCaption,
          ...(isVideo ? { videoUrl: draft.media_urls[0] } : { imageUrl: draft.media_urls[0] }),
        }

        // 5. Create container
        const containerId = await createMediaContainer(opts)

        // 6. Poll for video processing
        if (isVideo) {
          const status = await pollContainerStatus(publishToken, containerId)
          if (status === 'ERROR') throw new Error('Video processing failed')
        }

        // 7. Publish
        return publishContainer({
          accessToken: publishToken,
          igUserId: account.ig_user_id,
          containerId,
        })
      }

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Publication expirée (120s)')), 120_000)
      )

      const igMediaId = await Promise.race([publishPromise(), timeout])

      // 8. Update draft
      await supabase.from('ig_drafts').update({
        status: 'published',
        published_at: new Date().toISOString(),
        ig_media_id: igMediaId,
        updated_at: new Date().toISOString(),
      }).eq('id', id)

      return NextResponse.json({ data: { ig_media_id: igMediaId } })
    } catch (pubErr) {
      const message = pubErr instanceof Error ? pubErr.message : 'Publication échouée'
      await supabase.from('ig_drafts').update({
        status: 'failed',
        error_message: message,
        updated_at: new Date().toISOString(),
      }).eq('id', id)
      return NextResponse.json({ error: message }, { status: 500 })
    }
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated')
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    console.error('[API /instagram/drafts/publish] Error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
