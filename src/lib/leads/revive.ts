/**
 * "Revive on resubmit" — when an existing lead is matched by dedup AND
 * their CRM status is one we'd already given up on (dead, no_show…),
 * we treat the new submission as a fresh interest signal and bring them
 * back into the active pipeline.
 *
 * Without this, a prospect who came in months ago, was marked dead, and
 * fills a Meta Lead Form (or books a slot) again would silently update
 * the dead row — the coach would never know.
 */

import type { LeadStatus } from '@/types'

/** Statuses we consider "given up on" — any resubmission revives them. */
const REVIVED_FROM: readonly LeadStatus[] = [
  'dead',
  'pas_qualifie',
  'no_show_setting',
  'no_show_closing',
]

export type ReviveSource = 'meta_lead_form' | 'funnel_form' | 'booking_direct' | 'booking_funnel'

const SOURCE_LABELS: Record<ReviveSource, string> = {
  meta_lead_form: 'Lead Form Meta',
  funnel_form: 'Formulaire funnel',
  booking_direct: 'Lien direct calendrier',
  booking_funnel: 'Calendrier dans funnel',
}

export interface ReviveDecision {
  shouldRevive: boolean
  /** Status to set on the revived lead. Always `'nouveau'` for now. */
  newStatus?: LeadStatus
  /** Tags to set (existing tags + 'relance' + previous status as a memo). */
  newTags?: string[]
  /** Text to append to the lead's notes column. */
  noteAppend?: string
}

/**
 * Decides if a re-submission from an existing lead should bring them back
 * from dead/no-show to "nouveau". The caller applies the resulting fields
 * inside its `update` statement.
 */
export function planRevive(
  currentStatus: LeadStatus,
  currentTags: string[] | null | undefined,
  source: ReviveSource,
): ReviveDecision {
  if (!REVIVED_FROM.includes(currentStatus)) {
    return { shouldRevive: false }
  }

  const dateStr = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
  const tagsSet = new Set(Array.isArray(currentTags) ? currentTags : [])
  tagsSet.add('relance')
  // Memo of where they were before, in case the coach wants to filter on it.
  tagsSet.add(`relance-from:${currentStatus}`)

  const noteAppend =
    `\n\n[Relance ${dateStr}] Le lead s'est ré-engagé via ${SOURCE_LABELS[source]} ` +
    `alors qu'il était en « ${currentStatus} ». Statut remis à « nouveau ».`

  return {
    shouldRevive: true,
    newStatus: 'nouveau',
    newTags: Array.from(tagsSet),
    noteAppend,
  }
}
