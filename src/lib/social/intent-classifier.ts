/**
 * Classifies a French DM/comment text by the lead-acquisition intent it expresses.
 * Pure function, used to power the social Inbox d'acquisition.
 */

export type SocialIntent = 'rdv' | 'prix' | 'info' | 'objection' | 'fan' | 'spam' | 'neutre'

export interface IntentMeta {
  key: SocialIntent
  label: string
  color: string
  priority: number // higher = more buying intent
  description: string
}

export const INTENT_META: Record<SocialIntent, IntentMeta> = {
  rdv:       { key: 'rdv',       label: 'RDV',       color: '#10b981', priority: 5, description: 'Demande un appel / créneau' },
  prix:      { key: 'prix',      label: 'Prix',      color: '#f59e0b', priority: 4, description: 'Demande tarifaire' },
  info:      { key: 'info',      label: 'Info',      color: '#3b82f6', priority: 3, description: 'Demande d’infos sur le programme' },
  objection: { key: 'objection', label: 'Objection', color: '#a855f7', priority: 3, description: 'Frein / question' },
  fan:       { key: 'fan',       label: 'Fan',       color: '#ec4899', priority: 1, description: 'Compliment / soutien' },
  spam:      { key: 'spam',      label: 'Spam',      color: '#64748b', priority: 0, description: 'Emoji seul / inutile' },
  neutre:    { key: 'neutre',    label: '—',         color: '#94a3b8', priority: 2, description: 'Autre' },
}

const RX_RDV       = /\b(rdv|rendez[\s-]?vous|cr[ée]neau|cr[ée]neaux|disponib|dispo|appel(e|er|ons)?|call|booker|r[ée]server|on s'?appelle|tu peux m'?appeler)\b/i
const RX_PRIX      = /\b(prix|tarif|tarifs|co[ûu]te|combien|c[\s']?est combien|payant|abonnement|mensualit[ée]|le co[ûu]t|budget|gratuit ou)\b/i
const RX_INFO      = /\b(info|infos|info(rmation)?s?|renseignement|d[ée]tails?|en savoir|comment[\s]?[çc]a|comment fonctionne|comment marche|programme|coaching|accompagnement|m[ée]thode|formation|j['']aimerais en savoir|peux[\s-]tu m['']en dire)\b/i
const RX_OBJECTION = /\b(mais|trop cher|peur|pas s[ûu]r|s[ée]rieux|arnaque|garantie|rembours|fonctionne vraiment|[çc]a marche vraiment|sceptique|h[ée]site)\b/i
const RX_FAN       = /\b(top|g[ée]nial|incroyable|merci|bravo|inspirant|inspir[ée]e|j['']adore|love|magnifique|continue|f[ée]licitation)\b/i

const RX_EMOJI_ONLY = /^[\s\p{Emoji_Presentation}\p{Extended_Pictographic}!?.]+$/u
const RX_GENERIC_SPAM = /^(first|premier|🔥+|❤️+|👏+|👍+|nice|cool|wow)$/i

/**
 * Returns the best-matching intent for a text. Multi-match: highest priority wins,
 * but RDV/PRIX/INFO take precedence over OBJECTION/FAN.
 */
export function classifyIntent(raw: string | null | undefined): SocialIntent {
  if (!raw) return 'neutre'
  const text = raw.trim()
  if (text.length === 0) return 'spam'

  if (RX_EMOJI_ONLY.test(text) || RX_GENERIC_SPAM.test(text)) return 'spam'

  // Buying signals first
  if (RX_RDV.test(text))       return 'rdv'
  if (RX_PRIX.test(text))      return 'prix'
  if (RX_INFO.test(text))      return 'info'
  if (RX_OBJECTION.test(text)) return 'objection'
  if (RX_FAN.test(text))       return 'fan'

  return 'neutre'
}

/** Sort helper: hottest intents first (rdv > prix > info > objection > neutre > fan > spam) */
export function intentSortValue(i: SocialIntent): number {
  return INTENT_META[i].priority
}
