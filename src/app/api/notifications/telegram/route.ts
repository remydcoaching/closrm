import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { getIntegrationCredentials } from '@/lib/integrations/get-credentials'
import { sendTelegramMessage } from '@/lib/telegram/client'

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()

    const creds = await getIntegrationCredentials(workspaceId, 'telegram')
    if (!creds) {
      return NextResponse.json(
        { error: 'Telegram non connecté' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const message = body.message as string
    if (!message) {
      return NextResponse.json(
        { error: 'Le champ "message" est requis' },
        { status: 400 }
      )
    }

    const result = await sendTelegramMessage(
      { botToken: creds.botToken, chatId: creds.chatId },
      message
    )

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 })
    }

    return NextResponse.json({ data: { sent: true } })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
