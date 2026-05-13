import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

// Endpoint d'envoi de push notifications via Expo HTTP API.
// Pas de package expo-server-sdk : un simple POST vers exp.host suffit
// pour < 100 destinataires (au-delà, il faudrait batcher + gérer les
// tickets/receipts).
//
// https://docs.expo.dev/push-notifications/sending-notifications/

const sendSchema = z.object({
  // Cibles : liste d'user_ids du workspace courant (on récupère leurs tokens)
  // OU liste de tokens Expo bruts (pour test direct).
  user_ids: z.array(z.string().uuid()).optional(),
  tokens: z.array(z.string().min(10).max(200)).optional(),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(500),
  data: z.record(z.string(), z.unknown()).optional(),
  sound: z.enum(['default']).optional().default('default'),
  badge: z.number().int().nonnegative().optional(),
})

interface ExpoMessage {
  to: string
  title: string
  body: string
  data?: Record<string, unknown>
  sound?: 'default'
  badge?: number
  priority?: 'default' | 'high'
}

interface ExpoResponse {
  data?: Array<{ status: 'ok' | 'error'; id?: string; message?: string }>
  errors?: Array<{ message: string }>
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const body = await request.json()
    const parsed = sendSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const { user_ids, tokens: rawTokens, title, body: msgBody, data, sound, badge } = parsed.data

    // Récupère les tokens — soit via user_ids (filtré au workspace pour éviter
    // de pinger les devices d'un autre workspace), soit directement.
    let tokens: string[] = []
    if (user_ids && user_ids.length > 0) {
      const supabase = await createClient()
      const { data: rows, error } = await supabase
        .from('push_tokens')
        .select('token')
        .eq('workspace_id', workspaceId)
        .in('user_id', user_ids)
      if (error) throw error
      tokens.push(...((rows ?? []) as { token: string }[]).map((r) => r.token))
    }
    if (rawTokens) {
      tokens.push(...rawTokens)
    }
    tokens = Array.from(new Set(tokens))

    if (tokens.length === 0) {
      return NextResponse.json(
        { sent: 0, error: 'Aucun token à cibler' },
        { status: 200 },
      )
    }

    const messages: ExpoMessage[] = tokens.map((to) => ({
      to,
      title,
      body: msgBody,
      data,
      sound,
      badge,
      priority: 'high',
    }))

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    })
    const json = (await res.json()) as ExpoResponse

    return NextResponse.json({
      sent: tokens.length,
      result: json,
    })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
