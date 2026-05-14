// Helper push notifications côté serveur.
// Récupère les push_tokens de tous les users du workspace, filtre selon
// leurs préférences (notification_preferences), et envoie via l'HTTP API
// publique d'Expo (pas besoin du package expo-server-sdk pour < 100
// destinataires).

import { createClient } from '@supabase/supabase-js'

export type PushType =
  | 'new_lead'
  | 'booking_created'
  | 'closing_assigned'
  | 'call_reminder_h1'
  | 'no_show'
  | 'deal_won'
  | 'dm_reply'
  | 'followup_due'

interface PushArgs {
  workspaceId: string
  type: PushType
  title: string
  body: string
  data?: Record<string, unknown>
  // Cibler des user_ids spécifiques. Si null → tous les users du
  // workspace (utile pour les events globaux comme deal_won).
  userIds?: string[] | null
}

interface ExpoMessage {
  to: string
  title: string
  body: string
  data?: Record<string, unknown>
  sound?: 'default'
  priority?: 'high' | 'default'
}

// Service-role client (bypass RLS pour cross-user query).
function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

/** Fire & forget — envoie une push aux users du workspace dont la
 *  préférence pour `type` est activée (true par défaut si pas de row).
 *  Erreurs loguées mais non-bloquantes (la route appelante doit
 *  toujours réussir même si le push échoue). */
export async function sendPushToWorkspace(args: PushArgs): Promise<void> {
  try {
    const sb = admin()

    // 1. Liste les users actifs du workspace (filtre éventuel par userIds)
    let usersQuery = sb
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', args.workspaceId)
      .eq('status', 'active')
    if (args.userIds && args.userIds.length > 0) {
      usersQuery = usersQuery.in('user_id', args.userIds)
    }
    const { data: members } = await usersQuery
    const memberIds = (members ?? []).map((m: { user_id: string }) => m.user_id)
    if (memberIds.length === 0) return

    // 2. Filtre les users qui ont DÉSACTIVÉ ce type (default = enabled)
    const { data: prefs } = await sb
      .from('notification_preferences')
      .select('user_id, enabled')
      .in('user_id', memberIds)
      .eq('type', args.type)
    const disabled = new Set(
      (prefs ?? [])
        .filter((p: { enabled: boolean }) => !p.enabled)
        .map((p: { user_id: string }) => p.user_id),
    )
    const targets = memberIds.filter((id) => !disabled.has(id))
    if (targets.length === 0) return

    // 3. Récupère les push_tokens de ces users
    const { data: tokens } = await sb
      .from('push_tokens')
      .select('token')
      .in('user_id', targets)
    const list = (tokens ?? [])
      .map((t: { token: string }) => t.token)
      .filter((t: string) => !!t)
    if (list.length === 0) return

    // 4. Balance via Expo HTTP API
    const messages: ExpoMessage[] = list.map((to: string) => ({
      to,
      title: args.title,
      body: args.body,
      data: { type: args.type, ...(args.data ?? {}) },
      sound: 'default',
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
    if (!res.ok && process.env.NODE_ENV !== 'production') {
      const txt = await res.text().catch(() => '')
      console.warn('[push] Expo non-2xx', res.status, txt)
    }
  } catch (e) {
    // Non-bloquant — la route caller continue.
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[push] sendPushToWorkspace failed', e)
    }
  }
}

/** Constantes pour la page de réglages mobile et le wire des events. */
export const PUSH_TYPES: { type: PushType; label: string; description: string }[] = [
  { type: 'new_lead', label: 'Nouveau prospect', description: 'Un nouveau lead arrive (Meta Ads, formulaire, manuel).' },
  { type: 'booking_created', label: 'Booking créé', description: 'Un lead a réservé un créneau sur ton lien de booking.' },
  { type: 'closing_assigned', label: 'Closing assigné', description: 'Un setter te passe un closing.' },
  { type: 'call_reminder_h1', label: 'Rappel RDV H-1', description: 'Un de tes RDV démarre dans 1h.' },
  { type: 'no_show', label: 'No-show', description: 'Un lead ne s\'est pas présenté à un appel.' },
  { type: 'deal_won', label: 'Deal closé', description: 'Un membre de l\'équipe ferme un deal.' },
  { type: 'dm_reply', label: 'Réponse Instagram', description: 'Un lead a répondu à un DM Instagram.' },
  { type: 'followup_due', label: 'Follow-up à faire', description: 'Un follow-up est planifié pour aujourd\'hui.' },
]
