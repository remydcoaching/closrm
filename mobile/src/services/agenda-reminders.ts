import * as Notifications from 'expo-notifications'
import * as SecureStore from 'expo-secure-store'

const STORAGE_KEY = 'agenda_reminder_minutes_v1'
const ALARM_KEY = 'agenda_alarm_enabled_v1'
// Tag dans les notifs locales pour pouvoir les annuler/recompter sans toucher
// aux push notifs venant du serveur.
const REMINDER_TAG = 'agenda_local_reminder'
const ALARM_TAG = 'agenda_local_alarm'

export const REMINDER_OPTIONS = [5, 10, 15, 30, 60] as const
export type ReminderMinutes = (typeof REMINDER_OPTIONS)[number]

const DEFAULT_MINUTES: ReminderMinutes[] = [10]

export async function getAlarmEnabled(): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(ALARM_KEY)
    return raw === '1'
  } catch {
    return false
  }
}

export async function setAlarmEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(ALARM_KEY, enabled ? '1' : '0')
}

/** Lit les rappels stockés. Renvoie [] si désactivé, default sinon. */
export async function getReminderMinutes(): Promise<ReminderMinutes[]> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY)
    if (raw == null) return DEFAULT_MINUTES
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return DEFAULT_MINUTES
    return parsed.filter((m): m is ReminderMinutes =>
      (REMINDER_OPTIONS as readonly number[]).includes(m as number)
    )
  } catch {
    return DEFAULT_MINUTES
  }
}

export async function setReminderMinutes(minutes: ReminderMinutes[]): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(minutes))
}

interface ScheduleableEvent {
  /** Identifiant stable de l'event (pour idempotence). */
  id: string
  /** Date du déclenchement de l'event (pas du rappel). */
  scheduledAt: Date
  title: string
  body: string
  /** Payload pour le tap → routing. */
  data?: Record<string, unknown>
}

/**
 * Annule tous les rappels locaux d'agenda précédemment schedulés (rappels
 * lead-time + alarmes). Utiliser avant de re-schedule pour rester idempotent
 * (sinon doublons à chaque fetch).
 */
export async function cancelAllAgendaReminders(): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync()
  const toCancel = all.filter((n) => {
    const tag = (n.content.data as { _tag?: string } | null)?._tag
    return tag === REMINDER_TAG || tag === ALARM_TAG
  })
  await Promise.all(
    toCancel.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  )
}

/**
 * Schedule une notif locale pour CHAQUE event × CHAQUE lead-time configuré.
 * Si l'alarme est activée, schedule en plus une notif "alarm" AU moment de
 * l'event avec presentation `time-sensitive` + son par défaut (cf limites
 * iOS plus bas).
 *
 * ⚠️ iOS ne permet pas aux apps tiers de déclencher une vraie alarme système
 * (privilège réservé à Clock.app). Le mieux qu'on puisse faire :
 *  - `interruptionLevel: 'timeSensitive'` qui bypass Focus mode et reste
 *    visible jusqu'à interaction
 *  - son `default` (un son court)
 *  - badge pour signaler une notif active
 *
 * Skip silencieusement les rappels dont le déclenchement est dans le passé.
 */
export async function scheduleAgendaReminders(
  events: ScheduleableEvent[]
): Promise<{ scheduled: number; skipped: number }> {
  const [minutes, alarmEnabled] = await Promise.all([getReminderMinutes(), getAlarmEnabled()])
  if (events.length === 0) return { scheduled: 0, skipped: 0 }
  const now = Date.now()
  let scheduled = 0
  let skipped = 0
  for (const ev of events) {
    // ── Lead-time reminders (5min, 10min, etc) ────────────────────────────
    for (const min of minutes) {
      const triggerMs = ev.scheduledAt.getTime() - min * 60_000
      if (triggerMs <= now + 5_000) {
        skipped++
        continue
      }
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: ev.title,
            body: `Dans ${min}min · ${ev.body}`,
            data: { ...(ev.data ?? {}), _tag: REMINDER_TAG, event_id: ev.id, minutes_before: min },
            sound: 'default',
            // iOS 15+ : passe en mode "rappel" (apparaît même en focus DND).
            interruptionLevel: 'timeSensitive',
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(triggerMs),
          },
        })
        scheduled++
      } catch {
        skipped++
      }
    }
    // ── Alarme à l'heure exacte de l'event ────────────────────────────────
    if (alarmEnabled) {
      const triggerMs = ev.scheduledAt.getTime()
      if (triggerMs <= now + 5_000) {
        skipped++
      } else {
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `⏰ ${ev.title}`,
              body: `C'est maintenant · ${ev.body}`,
              data: { ...(ev.data ?? {}), _tag: ALARM_TAG, event_id: ev.id, alarm: true },
              sound: 'default',
              // critical bypasse silent + DND mais nécessite entitlement
              // Apple. timeSensitive est le niveau le plus haut sans
              // entitlement spécial — bypasse Focus mode automatiquement.
              interruptionLevel: 'timeSensitive',
              // Badge le push pour signaler "événement maintenant" jusqu'à
              // ce que l'utilisateur swipe.
              badge: 1,
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: new Date(triggerMs),
            },
          })
          scheduled++
        } catch {
          skipped++
        }
      }
    }
  }
  return { scheduled, skipped }
}
