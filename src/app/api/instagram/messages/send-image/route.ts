import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { sendIgImage } from '@/lib/instagram/api'

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const formData = await request.formData()
    const conversationId = formData.get('conversation_id') as string
    const file = formData.get('image') as File

    if (!conversationId || !file) {
      return NextResponse.json({ error: 'conversation_id et image requis' }, { status: 400 })
    }

    // Get account
    const { data: account } = await supabase
      .from('ig_accounts').select('*').eq('workspace_id', workspaceId).eq('is_connected', true).single()

    if (!account?.page_id || !account?.page_access_token) {
      return NextResponse.json({ error: 'Compte Instagram non configuré' }, { status: 400 })
    }

    // Get conversation
    const { data: convo } = await supabase
      .from('ig_conversations').select('participant_ig_id')
      .eq('id', conversationId).eq('workspace_id', workspaceId).single()

    if (!convo?.participant_ig_id) {
      return NextResponse.json({ error: 'Conversation introuvable' }, { status: 404 })
    }

    // Upload image to Supabase Storage
    const ext = file.name.split('.').pop() ?? 'jpg'
    const fileName = `msg-${Date.now()}.${ext}`
    const filePath = `${workspaceId}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('content-drafts')
      .upload(filePath, file, { contentType: file.type })

    if (uploadError) {
      return NextResponse.json({ error: `Upload échoué: ${uploadError.message}` }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from('content-drafts').getPublicUrl(filePath)
    const imageUrl = urlData.publicUrl

    // Send via IG API
    const messageId = await sendIgImage(
      account.page_access_token,
      account.page_id,
      convo.participant_ig_id,
      imageUrl
    )

    // Save to DB
    const { data: msg, error: dbError } = await supabase
      .from('ig_messages')
      .insert({
        workspace_id: workspaceId,
        conversation_id: conversationId,
        ig_message_id: messageId,
        sender_type: 'user',
        text: null,
        media_url: imageUrl,
        media_type: 'image',
        sent_at: new Date().toISOString(),
        is_read: true,
      })
      .select()
      .single()

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

    // Update conversation
    await supabase
      .from('ig_conversations')
      .update({ last_message_text: '📷 Photo', last_message_at: new Date().toISOString() })
      .eq('id', conversationId)

    return NextResponse.json({ data: msg }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated')
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    console.error('[API /instagram/messages/send-image] Error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
