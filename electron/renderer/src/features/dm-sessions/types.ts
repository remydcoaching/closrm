// Mirrors the EXISTING dm-sessions backend (ported from closrm-session-dm
// into the main repo — same routes, same tables, same buildPriorityQueue
// logic). No new logic here, just the desktop UI.
export type PriorityCategory = 'relance_du_jour' | 'relance_en_retard' | 'engagement_instagram' | 'jamais_recontacte' | 'premier_message'
export type DmSessionItemOutcome = 'relaunched' | 'archived' | 'skipped' | 'replied'
export type DmSessionStatus = 'active' | 'completed' | 'abandoned'

export interface DmSessionLead {
  id: string
  first_name: string
  last_name: string
  instagram_handle: string | null
  instagram_user_id: string | null
  status: string
  last_activity_at: string | null
}

export interface DmSessionStepTransition {
  outcome_label: string
  target_step_id: string
}

export interface DmSessionNextStepPreview {
  title: string
  delay_days: number | null
}

export interface DmSessionRelanceStepOption {
  step_id: string
  title: string
  delay_days: number | null
}

export interface DmSessionTemplate {
  label: string
  text: string
  process_id: string | null
  step_id: string | null
  next_step_id: string | null
  delay_days: number | null
  transitions: DmSessionStepTransition[]
  next_step: DmSessionNextStepPreview | null
  relance_step_options: DmSessionRelanceStepOption[]
}

export interface DmSessionItem {
  id: string
  lead_id: string
  position: number
  category: PriorityCategory
  outcome: DmSessionItemOutcome | null
  note: string | null
  lead: DmSessionLead
  template?: DmSessionTemplate
}

export interface DmSessionDetail {
  id: string
  status: DmSessionStatus
  target_count: number
  stale_threshold_days: number
  items: DmSessionItem[]
}

export interface DmSessionSummary {
  id: string
  status: DmSessionStatus
  target_count: number
  items: { outcome: DmSessionItemOutcome | null }[]
}

export const CATEGORY_LABEL: Record<PriorityCategory, string> = {
  relance_du_jour: 'Relance du jour',
  relance_en_retard: 'Relance en retard',
  engagement_instagram: 'Engagement Instagram récent',
  jamais_recontacte: 'Ancien lead',
  premier_message: 'Jamais contacté',
}
