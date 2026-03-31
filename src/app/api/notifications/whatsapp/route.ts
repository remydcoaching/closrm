import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { getIntegrationCredentials } from '@/lib/integrations/get-credentials'
import { sendWhatsAppMessage } from '@/lib/whatsapp/client'

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()

    const creds = await getIntegrationCredentials(workspaceId, 'whatsapp')
    if (!creds) {
      return NextResponse.json(
        { error: 'WhatsApp non connecté' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const to = body.to as string
    const message = body.message as string

    if (!to || !message) {
      return NextResponse.json(
        { error: 'Les champs "to" et "message" sont requis' },
        { status: 400 }
      )
    }

    const result = await sendWhatsAppMessage(
      { phoneNumberId: creds.phoneNumberId, accessToken: creds.accessToken },
      to,
      message
    )

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 })
    }

    return NextResponse.json({ data: { sent: true, messageId: result.messageId } })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
