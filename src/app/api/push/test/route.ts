import { NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createClient as createServiceClient } from '@supabase/supabase-js'

/**
 * Test push : envoie une notification push DIRECTEMENT à tous les
 * tokens de l'utilisateur courant (pas via sendPushToWorkspace qui
 * filtre par préférences). Retourne un diagnostic complet :
 *
 *   - tokensFound : nombre de tokens enregistrés pour cet user
 *   - tokens : preview de chaque token (device_name, platform, créé)
 *   - expoResponse : retour brut d'Expo (status + erreurs détaillées
 *     comme DeviceNotRegistered si le token est expiré)
 *
 * Permet de diagnostiquer "j'reçois pas les notifs" en 1 clic :
 *   - 0 tokens → la registration n'a pas eu lieu (permission refusée,
 *     simulateur, install pas finie). Réinstaller l'app + accepter
 *     la permission.
 *   - tokens présents + DeviceNotRegistered → token expiré, à purger.
 *   - tokens + ok → device problem (Réglages iOS, mode focus, etc.)
 */
export async function POST() {
  try {
    const { userId } = await getWorkspaceId()

    const sb = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const { data: tokens } = await sb
      .from('push_tokens')
      .select('token, device_name, platform, created_at')
      .eq('user_id', userId)

    const tokenList = (tokens ?? []) as Array<{
      token: string
      device_name: string | null
      platform: string
      created_at: string
    }>

    const list = tokenList.map((t) => t.token).filter((t) => !!t)

    if (list.length === 0) {
      return NextResponse.json({
        ok: false,
        tokensFound: 0,
        diagnosis:
          'Aucun token push enregistré. Cause probable : permission iOS refusée, ou app installée en simulator, ou registration jamais déclenchée. Désinstalle l\'app, réinstalle, et accepte la permission Notifications quand iOS la demande.',
      })
    }

    const messages = list.map((to) => ({
      to,
      title: '🔔 Test push ClosRM',
      body: 'Si tu vois cette notif, ton device reçoit bien les pushes.',
      sound: 'default',
      priority: 'high',
      data: { type: 'test', _test: true },
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

    const expoBody = (await res.json().catch(() => ({}))) as {
      data?: Array<{ status: 'ok' | 'error'; id?: string; message?: string; details?: { error?: string } }>
    }

    const tickets = expoBody.data ?? []
    const errors = tickets.filter((t) => t.status === 'error')
    const oks = tickets.filter((t) => t.status === 'ok').length

    let diagnosis: string
    if (!res.ok) {
      diagnosis = `Expo a refusé l'envoi (HTTP ${res.status}). Voir expoResponse pour le détail.`
    } else if (errors.length === tickets.length && errors.length > 0) {
      const firstErr = errors[0]?.details?.error ?? errors[0]?.message ?? 'unknown'
      diagnosis =
        firstErr === 'DeviceNotRegistered'
          ? 'Tous tes tokens sont invalidés par Expo (DeviceNotRegistered). Désinstalle + réinstalle l\'app pour générer un nouveau token.'
          : `Tous les envois ont échoué : ${firstErr}`
    } else if (errors.length > 0) {
      diagnosis = `${oks}/${tickets.length} push envoyés OK, ${errors.length} en erreur. Voir expoResponse.`
    } else {
      diagnosis = `${oks} push envoyé${oks > 1 ? 's' : ''} avec succès. Si tu reçois rien : check Réglages iOS → ClosRM → Notifications activées, et le mode Focus / Ne pas déranger.`
    }

    return NextResponse.json({
      ok: res.ok && errors.length === 0,
      tokensFound: list.length,
      tokens: tokenList.map((t) => ({
        device_name: t.device_name,
        platform: t.platform,
        token_preview: t.token.slice(0, 28) + '…',
        created_at: t.created_at,
      })),
      expoResponse: expoBody,
      diagnosis,
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    console.error('[push/test] error', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}
