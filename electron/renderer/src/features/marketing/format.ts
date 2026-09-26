// Pure helpers shared by the marketing pages (funnels, emails, automations,
// messages). Labels are copied verbatim from the web components they mirror.

/** "1 234" / "12,5 %" — safe for 0 denominators. */
export function percent(numerator: number, denominator: number): number | null {
  if (!denominator || denominator <= 0) return null
  return Math.round((numerator / denominator) * 1000) / 10
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value)} %`
}

/** "17 sept. 2026" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** "17/09, 14:05" — same format as the web broadcast recipients table. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/** Web ConversationList.timeAgo(): "à l'instant", "5m", "3h", "2j", "3sem", "4mo". */
export function shortAgo(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diff = now - t
  if (diff < 0) return ''
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}j`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}sem`
  return `${Math.floor(days / 30)}mo`
}

/** Execution duration as in the web ExecutionHistoryPanel ("850ms", "2.4s", "-"). */
export function formatDuration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return '-'
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime()
  if (!Number.isFinite(ms) || ms < 0) return '-'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function formatBytes(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n < 1024) return `${n} o`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`
}

/** Workspace name → URL slug, identical to the web WorkspaceNameModal normalizer. */
export function normalizeWorkspaceSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Public path of a funnel page (web buildPublicFunnelUrl, without origin). */
export function publicFunnelPath(workspaceSlug: string | null, funnelSlug: string | null, pageSlug: string | null): string | null {
  if (!workspaceSlug || !funnelSlug || !pageSlug) return null
  return `/f/${workspaceSlug}/${funnelSlug}/${pageSlug}`
}

/** Web EmailMessagesView.htmlToText(). */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Plain textarea → email HTML: one <p> per paragraph, <br> for single breaks. */
export function textToEmailHtml(text: string): string {
  return text
    .trim()
    .split(/\n{2,}/)
    .filter((p) => p.trim().length > 0)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

/** Web broadcast "libre" mode body_text: strip tags + collapse whitespace. */
export function htmlToPlainLine(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** "Email 1", "Email 2"… index among action steps up to `index`. */
export function emailStepNumber(steps: { step_type: string }[], index: number): number {
  return steps.filter((s, j) => j <= index && s.step_type === 'action').length
}

export interface SequenceDraftStep {
  step_type: 'action' | 'delay'
  action_type?: string
  action_config: Record<string, unknown>
  delay_value?: number
  delay_unit?: string
}

/** SequenceTimeline.addEmailStep(): a 1-day delay precedes every email but the first. */
export function addSequenceEmail(steps: SequenceDraftStep[]): SequenceDraftStep[] {
  const next = [...steps]
  if (next.length > 0) next.push({ step_type: 'delay', delay_value: 1, delay_unit: 'days', action_config: {} })
  next.push({ step_type: 'action', action_type: 'send_email', action_config: { template_id: '' } })
  return next
}

/** SequenceTimeline.removeStep(): removing an email also removes its preceding delay. */
export function removeSequenceStep(steps: SequenceDraftStep[], index: number): SequenceDraftStep[] {
  const next = [...steps]
  if (next[index]?.step_type === 'action' && index > 0 && next[index - 1].step_type === 'delay') {
    next.splice(index - 1, 2)
  } else {
    next.splice(index, 1)
  }
  return next
}

// ─── Labels (copied from the web) ───────────────────────────────────────────

/** src/components/automations/WorkflowCard.tsx triggerLabels */
export const TRIGGER_LABELS: Record<string, string> = {
  new_lead: 'Nouveau lead',
  lead_imported: 'Leads importés',
  lead_status_changed: 'Changement de statut',
  tag_added: 'Tag ajouté',
  tag_removed: 'Tag supprimé',
  deal_won: 'Deal gagné',
  lead_with_ig_handle: 'Lead avec pseudo IG',
  lead_inactive_x_days: 'Lead inactif',
  call_scheduled: 'Appel planifié',
  call_in_x_hours: 'Rappel avant appel',
  call_no_show: 'No-show appel',
  call_outcome_logged: "Résultat d'appel",
  followup_pending_x_days: 'Follow-up en attente',
  new_follower: 'Nouveau follower',
  dm_keyword: 'DM avec mot-clé',
  comment_keyword: 'Commentaire mot-clé',
  booking_created: 'Rendez-vous créé',
  booking_cancelled: 'Rendez-vous annulé',
  booking_no_show: 'No-show rendez-vous',
  booking_completed: 'Rendez-vous terminé',
  booking_in_x_hours: 'Rappel avant rendez-vous',
}

/** src/components/automations/StepBlock.tsx actionLabels */
export const ACTION_LABELS: Record<string, string> = {
  send_email: 'Envoyer un email',
  send_whatsapp: 'Envoyer WhatsApp',
  send_dm_instagram: 'Envoyer DM Instagram',
  create_followup: 'Créer un follow-up',
  change_lead_status: 'Changer le statut',
  add_tag: 'Ajouter un tag',
  remove_tag: 'Supprimer un tag',
  send_notification: 'Notifier le coach',
  facebook_conversions_api: 'Facebook Conversions API',
  enroll_in_sequence: 'Inscrire dans une séquence',
  add_note: 'Ajouter une note',
  set_reached: 'Marquer comme joint',
  schedule_call: 'Planifier un appel',
  webhook: 'Appeler un webhook',
  create_google_meet: 'Créer un Google Meet',
  update_lead_field: 'Modifier un champ',
  wait_until_date: "Attendre jusqu'à une date",
}

export const DELAY_UNIT_LABELS: Record<string, string> = { minutes: 'min', hours: 'heures', days: 'jours' }

export function triggerLabel(type: string): string {
  return TRIGGER_LABELS[type] ?? type
}

/** One-line description of a workflow step, e.g. "Attendre 2 jours". */
export function stepLabel(step: { step_type: string; action_type?: string | null; delay_value?: number | null; delay_unit?: string | null }): string {
  if (step.step_type === 'delay') {
    return `Attendre ${step.delay_value ?? 1} ${DELAY_UNIT_LABELS[step.delay_unit ?? 'days'] ?? step.delay_unit ?? ''}`.trim()
  }
  if (step.step_type === 'condition') return 'Condition'
  if (step.step_type === 'wait_for_event') return 'Attendre un événement'
  return step.action_type ? (ACTION_LABELS[step.action_type] ?? step.action_type) : 'Action non configurée'
}

/** Email send sources (email_sends.source) as grouped by /api/emails/stats. */
export const EMAIL_SOURCE_LABELS: Record<string, string> = {
  broadcast: 'Campagnes',
  workflow: 'Automations',
  sequence: 'Séquences',
  booking_reminder: 'Rappels de RDV',
  booking_confirmation: 'Confirmations de RDV',
  direct_message: 'Messages directs',
  manual: 'Manuel',
  unknown: 'Inconnu',
}
