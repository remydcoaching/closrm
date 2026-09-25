// Merges calls[] + follow_ups[] (GET /api/leads/:id) and journey events
// (GET /api/leads/:id/journey — funnel + instagram_like/instagram_comment)
// into one chronological timeline. Pure data transform, no fabricated
// events: every entry maps 1:1 to a row ClosRM already returns.
import type { Call, FollowUp, JourneyEvent } from './types'
import { callOutcomeLabel, callTypeLabel, followUpChannelLabel, followUpStatusLabel } from './status'
import type { ActivityEntry } from '../../design-system/ActivityTimeline'

const PHONE_ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
)

const CLOCK_ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
)

const INSTAGRAM_ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
  </svg>
)

const FUNNEL_ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
  </svg>
)

export function buildActivity(calls: Call[], followUps: FollowUp[], journeyEvents: JourneyEvent[]): ActivityEntry[] {
  const entries: ActivityEntry[] = []

  for (const call of calls) {
    entries.push({
      id: `call-${call.id}`,
      at: call.scheduled_at,
      icon: PHONE_ICON,
      title: `Appel ${callTypeLabel(call.type)} — ${callOutcomeLabel(call.outcome)}`,
      detail: `Tentative #${call.attempt_number}${call.notes ? ` · ${call.notes}` : ''}`,
    })
  }

  for (const fu of followUps) {
    entries.push({
      id: `followup-${fu.id}`,
      at: fu.scheduled_at,
      icon: CLOCK_ICON,
      title: `Relance ${followUpChannelLabel(fu.channel)} — ${followUpStatusLabel(fu.status)}`,
      detail: fu.reason,
    })
  }

  for (const event of journeyEvents) {
    if (event.event_type === 'instagram_like' || event.event_type === 'instagram_comment') {
      const username = event.metadata?.instagram_username as string | undefined
      entries.push({
        id: `ig-${event.id}`,
        at: event.created_at,
        icon: INSTAGRAM_ICON,
        title: event.event_type === 'instagram_like' ? 'Instagram — a liké un post' : 'Instagram — a commenté',
        detail: username ? `@${username}` : undefined,
      })
    } else if (event.event_type === 'view' || event.event_type === 'form_submit' || event.event_type === 'button_click') {
      const label: Record<string, string> = {
        view: 'Vue de page funnel',
        form_submit: 'Formulaire soumis',
        button_click: 'Clic sur un bouton',
      }
      entries.push({
        id: `funnel-${event.id}`,
        at: event.created_at,
        icon: FUNNEL_ICON,
        title: label[event.event_type] ?? event.event_type,
        detail: event.funnel_page_name ?? undefined,
      })
    }
  }

  return entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}
