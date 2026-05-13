import { createClient as createAdmin } from '@supabase/supabase-js'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

interface PushMessage {
  to: string
  title: string
  body: string
  data?: Record<string, unknown>
  sound?: 'default' | null
  badge?: number
  channelId?: string
}

export type PushType =
  | 'new_lead'
  | 'booking_created'
  | 'closing_assigned'
  | 'call_reminder_h1'
  | 'no_show'
  | 'deal_won'
  | 'dm_reply'
  | 'followup_due'

interface SendPushOptions {
  workspaceId: string
  type: PushType
  title: string
  body: string
  entityType?: 'lead' | 'call' | 'conversation' | 'deal'
  entityId?: string
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createAdmin(url, key)
}

export async function sendPushToWorkspace(opts: SendPushOptions): Promise<void> {
  const admin = getAdminClient()

  const { data: prefs } = await admin
    .from('notification_preferences')
    .select('user_id, enabled')
    .eq('workspace_id', opts.workspaceId)
    .eq('type', opts.type)

  const disabledUsers = new Set(
    (prefs ?? []).filter((p) => !p.enabled).map((p) => p.user_id),
  )

  const { data: tokens } = await admin
    .from('push_tokens')
    .select('token, user_id')
    .eq('workspace_id', opts.workspaceId)

  if (!tokens || tokens.length === 0) return

  const activeTokens = tokens.filter((t) => !disabledUsers.has(t.user_id))
  if (activeTokens.length === 0) return

  const messages: PushMessage[] = activeTokens.map((t) => ({
    to: t.token,
    title: opts.title,
    body: opts.body,
    sound: 'default',
    channelId: 'default',
    data: {
      type: opts.type,
      entity_type: opts.entityType,
      entity_id: opts.entityId,
    },
  }))

  const chunks = chunkArray(messages, 100)

  for (const chunk of chunks) {
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk),
      })

      if (res.ok) {
        const result = await res.json()
        const tickets = result.data ?? []
        const invalidTokens: string[] = []

        for (let i = 0; i < tickets.length; i++) {
          if (tickets[i].status === 'error' && tickets[i].details?.error === 'DeviceNotRegistered') {
            invalidTokens.push(chunk[i].to)
          }
        }

        if (invalidTokens.length > 0) {
          await admin.from('push_tokens').delete().in('token', invalidTokens)
        }
      }
    } catch {
      // Non-blocking: push failure should not break the main flow
    }
  }

  await admin.from('notifications').insert({
    workspace_id: opts.workspaceId,
    type: opts.type,
    title: opts.title,
    subtitle: opts.body,
    entity_type: opts.entityType ?? null,
    entity_id: opts.entityId ?? null,
  })
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size))
  }
  return result
}
