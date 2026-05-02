import { sendEmail, isSuppressed } from '@/lib/email/client'
import { getWorkspaceSenderConfig, SENDER_FALLBACK_EMAIL, SENDER_FALLBACK_NAME } from '@/lib/email/sender-config'
import { consumeResource } from '@/lib/billing/service'
import { logEmailSend } from '@/lib/email/log-send'
import { createServiceClient } from '@/lib/supabase/service'
import { renderBookingTemplate, type BookingTemplateRow } from '@/lib/email/booking/render-template'

interface BookingConfirmationParams {
  to: string
  coachName: string
  prospectName: string
  date: string
  time: string
  meetUrl?: string
  locationName?: string
  locationAddress?: string
  workspaceId?: string
  /**
   * If provided, the calendar's `confirmation_template_id` is looked up. When
   * a custom template is configured, it is rendered with booking variables
   * instead of the hardcoded HTML below.
   */
  calendarId?: string
}

function buildBookingConfirmationHtml(params: BookingConfirmationParams): string {
  const { coachName, prospectName, date, time, meetUrl, locationName, locationAddress } = params

  const meetSection = meetUrl
    ? `
      <tr>
        <td style="padding: 20px 0 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;">
            <tr>
              <td style="padding: 16px 20px;">
                <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #166534;">
                  Rejoindre la reunion
                </p>
                <a href="${meetUrl}" target="_blank" style="display: inline-block; background: #38A169; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-size: 14px; font-weight: 600;">
                  Ouvrir Google Meet
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : ''

  const locationSection =
    locationName && !meetUrl
      ? `
      <tr>
        <td style="padding: 20px 0 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
            <tr>
              <td style="padding: 16px 20px;">
                <p style="margin: 0 0 4px; font-size: 14px; font-weight: 600; color: #1e293b;">
                  Lieu
                </p>
                <p style="margin: 0; font-size: 14px; color: #475569;">
                  ${locationName}${locationAddress ? `<br/>${locationAddress}` : ''}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
      : ''

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin: 0; padding: 0; background: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: #f4f4f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 12px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: #0A0A0A; padding: 28px 32px;">
              <p style="margin: 0; font-size: 18px; font-weight: 700; color: #ffffff;">
                Rendez-vous confirme
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 20px; font-size: 15px; color: #374151; line-height: 1.6;">
                Bonjour ${prospectName || 'there'},
              </p>
              <p style="margin: 0 0 24px; font-size: 15px; color: #374151; line-height: 1.6;">
                Votre rendez-vous avec <strong>${coachName}</strong> est confirme.
              </p>
              <!-- Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #fafafa; border: 1px solid #e5e7eb; border-radius: 8px;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 4px 0; font-size: 13px; color: #6b7280; width: 80px; vertical-align: top;">Date</td>
                        <td style="padding: 4px 0; font-size: 14px; color: #111827; font-weight: 500;">${date}</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; font-size: 13px; color: #6b7280; vertical-align: top;">Heure</td>
                        <td style="padding: 4px 0; font-size: 14px; color: #111827; font-weight: 500;">${time}</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; font-size: 13px; color: #6b7280; vertical-align: top;">Coach</td>
                        <td style="padding: 4px 0; font-size: 14px; color: #111827; font-weight: 500;">${coachName}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              ${meetSection}
              ${locationSection}
              <!-- Footer -->
              <tr>
                <td style="padding: 28px 0 0;">
                  <p style="margin: 0; font-size: 14px; color: #6b7280; line-height: 1.5;">
                    A bientot !
                  </p>
                </td>
              </tr>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/**
 * Send a booking confirmation email via AWS SES.
 */
export async function sendBookingConfirmationEmail(
  params: BookingConfirmationParams
): Promise<void> {
  if (!process.env.AWS_ACCESS_KEY_ID) return

  // Pre-check suppression list avant débit — évite un prélèvement wallet sur
  // une adresse que SES refuserait.
  if (await isSuppressed(params.to, params.workspaceId)) {
    return
  }

  // Quota check si workspaceId fourni (on skip pour les envois hors workspace,
  // ex. email test sans contexte, pour ne pas casser les anciens appels)
  if (params.workspaceId) {
    const quotaResult = await consumeResource({
      workspaceId: params.workspaceId,
      resourceType: 'email',
      quantity: 1,
      source: 'booking_confirmation',
      metadata: { to: params.to },
    })
    if (!quotaResult.allowed) {
      console.warn('[booking-confirmation] Quota email dépassé pour workspace', params.workspaceId)
      return
    }
  }

  // From-name priority: workspace brand name > coach legal name > fallback.
  let senderName = params.coachName
  if (params.workspaceId) {
    const { data: ws } = await createServiceClient()
      .from('workspaces')
      .select('name')
      .eq('id', params.workspaceId)
      .maybeSingle()
    if (ws?.name) senderName = ws.name
  }

  // If the calendar has a custom confirmation template, render it. Otherwise
  // fall back to the hardcoded HTML so existing calendars keep working.
  let html: string
  let subject: string

  let customTemplate: BookingTemplateRow | null = null
  if (params.calendarId && params.workspaceId) {
    const supabase = createServiceClient()
    const { data: calendar } = await supabase
      .from('booking_calendars')
      .select('confirmation_template_id')
      .eq('id', params.calendarId)
      .eq('workspace_id', params.workspaceId)
      .maybeSingle()

    if (calendar?.confirmation_template_id) {
      const { data: tpl } = await supabase
        .from('email_templates')
        .select('subject, blocks, preview_text, preset_id, preset_override')
        .eq('id', calendar.confirmation_template_id)
        .eq('workspace_id', params.workspaceId)
        .maybeSingle()
      if (tpl) customTemplate = tpl as BookingTemplateRow
    }
  }

  if (customTemplate) {
    const [firstName, ...rest] = params.prospectName.split(' ')
    const rendered = renderBookingTemplate(customTemplate, {
      prenom_lead: firstName ?? '',
      nom_lead: rest.join(' '),
      nom_coach: senderName,
      date_rdv: params.date,
      heure_rdv: params.time,
      lieu_rdv: params.locationName,
      adresse_rdv: params.locationAddress,
      lien_meet: params.meetUrl,
    })
    html = rendered.html
    subject = rendered.subject || `Votre rendez-vous avec ${senderName} est confirme`
  } else {
    html = buildBookingConfirmationHtml(params)
    subject = `Votre rendez-vous avec ${senderName} est confirme`
  }

  const senderConfig = params.workspaceId
    ? await getWorkspaceSenderConfig(params.workspaceId, { fromName: senderName })
    : { fromEmail: SENDER_FALLBACK_EMAIL, fromName: senderName || SENDER_FALLBACK_NAME }

  const result = await sendEmail(
    {
      fromEmail: senderConfig.fromEmail,
      fromName: senderConfig.fromName,
      replyTo: 'replyTo' in senderConfig ? senderConfig.replyTo : undefined,
      workspaceId: params.workspaceId,
    },
    params.to,
    subject,
    html,
  )

  if (result.ok && params.workspaceId) {
    await logEmailSend({
      workspaceId: params.workspaceId,
      sesMessageId: result.id,
      source: 'booking_confirmation',
      subject,
      fromEmail: senderConfig.fromEmail,
    })
  }
}
