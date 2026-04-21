/**
 * Helper universel pour logger un envoi email dans la table email_sends.
 * Critique pour que les events SES futurs (bounce/complaint/open/click) puissent
 * être matchés au send d'origine via resend_email_id.
 *
 * Si lead_id est inconnu (ex: booking confirmation à une adresse hors CRM),
 * on log quand même — la migration 047 a rendu lead_id nullable.
 *
 * Appelé APRÈS l'envoi réussi. Error handling interne : si l'insert échoue,
 * on log mais on ne throw pas (le mail est déjà parti, pas la peine de
 * pénaliser le call site).
 */

import { createServiceClient } from '@/lib/supabase/service'

export type EmailSendSource =
  | 'broadcast'
  | 'workflow'
  | 'sequence'
  | 'booking_reminder'
  | 'booking_confirmation'
  | 'direct_message'
  | 'manual'

export interface LogEmailSendInput {
  workspaceId: string
  sesMessageId: string | null | undefined
  source: EmailSendSource
  leadId?: string | null
  broadcastId?: string | null
  sequenceId?: string | null
  templateId?: string | null
  subject?: string | null
  fromEmail?: string | null
}

export async function logEmailSend(input: LogEmailSendInput): Promise<void> {
  // Pas de SES messageId → pas de match possible avec les events futurs,
  // log quand même pour l'historique mais resend_email_id = null
  const supabase = createServiceClient()

  const { error } = await supabase.from('email_sends').insert({
    workspace_id: input.workspaceId,
    lead_id: input.leadId ?? null,
    broadcast_id: input.broadcastId ?? null,
    sequence_id: input.sequenceId ?? null,
    template_id: input.templateId ?? null,
    resend_email_id: input.sesMessageId ?? null,
    source: input.source,
    status: 'sent',
    subject: input.subject ?? null,
    from_email: input.fromEmail ?? null,
  })

  if (error) {
    console.error('[log-send] email_sends insert failed', {
      source: input.source,
      sesMessageId: input.sesMessageId,
      error: error.message,
    })
  }
}
