// Audience segmentation shared by GET /api/instagram/audience — pure so it
// can be unit-tested without Supabase. Every count comes from rows ClosRM
// actually persisted (instagram_interactions, discovery_profiles, leads,
// dm_session_items); nothing is estimated.

export interface EngagedLead {
  id: string
  /** Most recent instagram_interactions.last_seen_at for this lead. */
  lastSeenAt: string
  callAttempts: number
  dmConversationActiveAt: string | null
  /** At least one dm_session_items row with outcome relaunched/replied. */
  dmSent: boolean
  /** Latest discovery_profiles.follows_target for this lead, if ever scanned. */
  followsTarget: boolean | null
}

export interface AudienceSegments {
  totalEngaged: number
  /** Interacted within the period. */
  actifs: number
  /** Interacted within the period and nobody ever wrote to / called them. */
  actifsJamaisContactes: number
  /** Observed not following the coach at the last Ciblage scan. */
  neVousSuiventPas: number
  /** Interacted at some point, never contacted (all time). */
  lurkers: number
}

export function wasContacted(lead: Pick<EngagedLead, 'callAttempts' | 'dmConversationActiveAt' | 'dmSent'>): boolean {
  return lead.callAttempts > 0 || lead.dmConversationActiveAt !== null || lead.dmSent
}

export type AudienceSegment = 'actifs' | 'actifs_jamais_contactes' | 'ne_vous_suivent_pas' | 'lurkers'

export const AUDIENCE_SEGMENTS: AudienceSegment[] = ['actifs', 'actifs_jamais_contactes', 'ne_vous_suivent_pas', 'lurkers']

/** Single definition of every segment — counts and drill-down lists both use it. */
export function inSegment(lead: EngagedLead, segment: AudienceSegment, periodDays: number, now: Date = new Date()): boolean {
  const since = new Date(now.getTime() - periodDays * 86_400_000).toISOString()
  const active = lead.lastSeenAt >= since
  switch (segment) {
    case 'actifs':
      return active
    case 'actifs_jamais_contactes':
      return active && !wasContacted(lead)
    case 'ne_vous_suivent_pas':
      return lead.followsTarget === false
    case 'lurkers':
      return !wasContacted(lead)
  }
}

export function segmentAudience(leads: EngagedLead[], periodDays: number, now: Date = new Date()): AudienceSegments {
  const count = (segment: AudienceSegment) => leads.filter((l) => inSegment(l, segment, periodDays, now)).length
  return {
    totalEngaged: leads.length,
    actifs: count('actifs'),
    actifsJamaisContactes: count('actifs_jamais_contactes'),
    neVousSuiventPas: count('ne_vous_suivent_pas'),
    lurkers: count('lurkers'),
  }
}
