import * as Notifications from 'expo-notifications'
import * as SecureStore from 'expo-secure-store'

const STORAGE_KEY = 'agenda_reminder_minutes_v1'
// Tag dans les notifs locales pour pouvoir les annuler/recompter sans toucher
// aux push notifs venant du serveur.
const REMINDER_TAG = 'agenda_local_reminder'

export const REMINDER_OPTIONS = [5, 10, 15, 30, 60] as const
export type ReminderMinutes = (typeof REMINDER_OPTIONS)[number]

const DEFAULT_MINUTES: ReminderMinutes[] = [10]

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
 * Annule tous les rappels locaux d'agenda précédemment schedulés. Utiliser avant
 * de re-schedule pour rester idempotent (sinon doublons à chaque fetch).
 */
export async function cancelAllAgendaReminders(): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync()
  const toCancel = all.filter(
    (n) => (n.content.data as { _tag?: string } | null)?._tag === REMINDER_TAG
  )
  await Promise.all(
    toCancel.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  )
}

/**
 * Schedule une notif locale pour CHAQUE event × CHAQUE lead-time configuré.
 * Skip silencieusement les rappels dont le déclenchement est dans le passé.
 */
export async function scheduleAgendaReminders(
  events: ScheduleableEvent[]
): Promise<{ scheduled: number; skipped: number }> {
  const minutes = await getReminderMinutes()
  if (minutes.length === 0 || events.length === 0) {
    return { scheduled: 0, skipped: 0 }
  }
  const now = Date.now()
  let scheduled = 0
  let skipped = 0
  for (const ev of events) {
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
            body: ev.body,
            data: { ...(ev.data ?? {}), _tag: REMINDER_TAG, event_id: ev.id, minutes_before: min },
            sound: 'default',
          },
          // Trigger absolu via Date.
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
  return { scheduled, skipped }
}
