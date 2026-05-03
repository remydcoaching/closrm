import { sendEmail, isSuppressed } from '@/lib/email/client'
import { getWorkspaceSenderConfig, SENDER_FALLBACK_EMAIL, SENDER_FALLBACK_NAME } from '@/lib/email/sender-config'
import { consumeResource } from '@/lib/billing/service'
import { logEmailSend } from '@/lib/email/log-send'
import { createServiceClient } from '@/lib/supabase/service'

export type BookingEmailTemplate = 'premium' | 'minimal' | 'plain'

export interface BookingConfirmationParams {
  to: string
  coachName: string
  prospectName: string
  date: string
  time: string
  meetUrl?: string
  locationName?: string
  locationAddress?: string
  workspaceId?: string
  brandName?: string
  customMessage?: string
  template?: BookingEmailTemplate
  accentColor?: string
  manageUrl?: string
}

const DEFAULT_ACCENT = '#E53E3E'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return `rgba(229, 62, 62, ${alpha})`
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

function shiftColor(hex: string, amount: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const clamp = (v: number) => Math.max(0, Math.min(255, v))
  const r = clamp(((n >> 16) & 255) + amount)
  const g = clamp(((n >> 8) & 255) + amount)
  const b = clamp((n & 255) + amount)
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
}

function buildPremiumHtml(params: BookingConfirmationParams): string {
  const { coachName, prospectName, date, time, meetUrl, locationName, locationAddress, brandName, customMessage } = params
  const accent = params.accentColor || DEFAULT_ACCENT
  const accentDark = shiftColor(accent, -25)
  const accentTint = hexToRgba(accent, 0.06)

  const safeProspect = escapeHtml(prospectName?.trim() || '')
  const safeCoach = escapeHtml(coachName?.trim() || '')
  const safeBrand = escapeHtml((brandName || coachName || 'ClosRM').trim())
  const safeDate = escapeHtml(date)
  const safeTime = escapeHtml(time)
  const safeLocationName = locationName ? escapeHtml(locationName) : ''
  const safeLocationAddress = locationAddress ? escapeHtml(locationAddress) : ''
  const brandInitial = (safeBrand.charAt(0) || 'C').toUpperCase()
  const greeting = safeProspect ? `Bonjour ${safeProspect},` : 'Bonjour,'

  // No SVG icons — Gmail strips inline SVG. We use a colored vertical bar
  // (left border) on each row instead, which renders identically everywhere.
  const detailRow = (label: string, value: string) => `
    <tr>
      <td style="padding: 14px 16px; border-bottom: 1px solid #EFEFEF; border-left: 3px solid ${accent};">
        <p style="margin: 0 0 2px; font-size: 11px; font-weight: 600; color: #9CA3AF; letter-spacing: 0.6px; text-transform: uppercase;">${label}</p>
        <p style="margin: 0; font-size: 15px; color: #111827; font-weight: 600;">${value}</p>
      </td>
    </tr>`

  const detailRowLast = (label: string, value: string) =>
    detailRow(label, value).replace('border-bottom: 1px solid #EFEFEF;', '')

  const meetBlock = meetUrl
    ? `
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background: linear-gradient(135deg, #0A0A0A 0%, #1F1F1F 100%); border-radius: 14px; margin-top: 28px;">
            <tr>
              <td style="padding: 22px 24px;">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td style="vertical-align: middle;">
                      <p style="margin: 0 0 4px; font-size: 11px; font-weight: 700; color: ${accent}; letter-spacing: 0.8px; text-transform: uppercase;">En visio</p>
                      <p style="margin: 0; font-size: 16px; font-weight: 600; color: #ffffff;">Rejoindre la réunion</p>
                    </td>
                    <td align="right" style="vertical-align: middle;">
                      <a href="${escapeHtml(meetUrl)}" target="_blank" style="display: inline-block; background: ${accent}; color: #ffffff; text-decoration: none; padding: 12px 22px; border-radius: 10px; font-size: 14px; font-weight: 600; box-shadow: 0 4px 12px ${hexToRgba(accent, 0.35)};">
                        Ouvrir le lien
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>`
    : ''

  const locationBlock =
    safeLocationName && !meetUrl
      ? `
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background: #FAFAFA; border: 1px solid #EFEFEF; border-left: 3px solid ${accent}; border-radius: 6px; margin-top: 28px;">
            <tr>
              <td style="padding: 20px 22px;">
                <p style="margin: 0 0 4px; font-size: 11px; font-weight: 700; color: #9CA3AF; letter-spacing: 0.8px; text-transform: uppercase;">Lieu du rendez-vous</p>
                <p style="margin: 0 0 ${safeLocationAddress ? '4px' : '0'}; font-size: 15px; color: #111827; font-weight: 600;">${safeLocationName}</p>
                ${safeLocationAddress ? `<p style="margin: 0; font-size: 14px; color: #6B7280; line-height: 1.5;">${safeLocationAddress}</p>` : ''}
              </td>
            </tr>
          </table>
        </td>
      </tr>`
      : ''

  const hasCustomMessage = !!(customMessage && customMessage.trim())

  // When a custom coach message is present, it REPLACES the default
  // greeting + intro paragraph. Coach controls the tone of voice end-to-end.
  const introBlock = hasCustomMessage
    ? `
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background: #FFFBEB; border-left: 3px solid ${accent}; border-radius: 6px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 22px 24px;">
                    <p style="margin: 0 0 10px; font-size: 11px; font-weight: 700; color: #92400E; letter-spacing: 0.8px; text-transform: uppercase;">Message de ${safeCoach || safeBrand}</p>
                    <p style="margin: 0; font-size: 15px; color: #1F2937; line-height: 1.7; white-space: pre-wrap;">${escapeHtml(customMessage!.trim())}</p>
                  </td>
                </tr>
              </table>`
    : `
              <p style="margin: 0 0 12px; font-size: 17px; font-weight: 600; color: #111827;">${greeting}</p>
              <p style="margin: 0 0 28px; font-size: 15px; color: #4B5563; line-height: 1.65;">
                Votre rendez-vous avec <strong style="color: #111827;">${safeCoach || safeBrand}</strong> est confirmé. Voici le récapitulatif&nbsp;:
              </p>`

  const signOff = hasCustomMessage
    ? ''
    : `
              <p style="margin: 36px 0 0; font-size: 15px; color: #4B5563; line-height: 1.65;">
                À très vite,<br/>
                <strong style="color: #111827;">${safeCoach || safeBrand}</strong>
              </p>`

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
  <title>Rendez-vous confirmé</title>
</head>
<body style="margin: 0; padding: 0; background: #F4F4F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #111827;">
  <div style="display:none; overflow:hidden; line-height:1px; opacity:0; max-height:0; max-width:0;">Votre rendez-vous avec ${safeCoach || safeBrand} le ${safeDate} à ${safeTime} est confirmé.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #F4F4F5; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 32px rgba(10, 10, 10, 0.08);">
          <!-- Header dark luxe -->
          <tr>
            <td style="background: #0A0A0A; background-image: linear-gradient(135deg, #0A0A0A 0%, #1A1A1A 60%, #0F0F0F 100%); padding: 36px 36px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="vertical-align: middle;">
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="background: linear-gradient(135deg, ${accent} 0%, ${accentDark} 100%); width: 36px; height: 36px; border-radius: 10px; text-align: center; vertical-align: middle; color: #ffffff; font-size: 16px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
                          ${brandInitial}
                        </td>
                        <td style="padding-left: 12px; vertical-align: middle;">
                          <p style="margin: 0; font-size: 15px; font-weight: 600; color: #ffffff; letter-spacing: -0.2px;">${safeBrand}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <table cellpadding="0" cellspacing="0" role="presentation" style="background: rgba(34, 197, 94, 0.12); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 999px;">
                      <tr>
                        <td style="padding: 6px 14px; vertical-align: middle; font-size: 12px; font-weight: 600; color: #22c55e; letter-spacing: 0.2px;">Confirmé</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <!-- Hero title -->
              <p style="margin: 32px 0 8px; font-size: 11px; font-weight: 700; color: ${accent}; letter-spacing: 1.2px; text-transform: uppercase;">Rendez-vous</p>
              <h1 style="margin: 0; font-size: 30px; line-height: 1.15; font-weight: 700; color: #ffffff; letter-spacing: -0.6px;">
                ${safeDate}<br/>
                <span style="color: #A1A1AA; font-weight: 500;">à ${safeTime}</span>
              </h1>
            </td>
          </tr>

          <!-- Accent line -->
          <tr>
            <td style="height: 3px; background: linear-gradient(90deg, ${accent} 0%, ${accentDark} 100%); line-height: 3px; font-size: 0;">&nbsp;</td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px 36px 36px;">
              ${introBlock}

              <!-- Details card -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background: #FAFAFA; border: 1px solid #EFEFEF; border-radius: 14px;">
                <tr>
                  <td style="padding: 8px 22px;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                      ${detailRow('Date', safeDate)}
                      ${detailRow('Heure', safeTime)}
                      ${detailRowLast('Avec', safeCoach || safeBrand)}
                    </table>
                  </td>
                </tr>
              </table>

              ${meetBlock}
              ${locationBlock}
              ${signOff}

              <!-- Bottom section: manage button (if available) + disclaimer -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top: 36px; border-top: 1px solid #F1F1F1;">
                ${params.manageUrl ? `
                <tr>
                  <td style="padding: 28px 0 8px; text-align: center;">
                    <a href="${escapeHtml(params.manageUrl)}" target="_blank" style="display: inline-block; padding: 11px 22px; background: #ffffff; border: 1px solid #E5E7EB; border-radius: 10px; color: #374151; text-decoration: none; font-size: 13px; font-weight: 600;">
                      Reprogrammer ou annuler ce RDV
                    </a>
                  </td>
                </tr>` : ''}
                <tr>
                  <td style="padding: ${params.manageUrl ? '8px 0 0' : '24px 0 0'}; text-align: center;">
                    <p style="margin: 0; font-size: 12px; color: #9CA3AF; line-height: 1.6;">
                      Vous recevez cet email car vous avez réservé un rendez-vous avec ${safeBrand}.${params.manageUrl ? '' : '<br/>Pour annuler ou reprogrammer, répondez simplement à cet email.'}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Outer footer brand -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
          <tr>
            <td align="center" style="padding: 20px 16px 8px;">
              <p style="margin: 0; font-size: 11px; color: #A1A1AA; letter-spacing: 0.4px;">
                Propulsé par <strong style="color: #6B7280;">ClosRM</strong>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ── Minimal template — light, sober, Cal.com-ish ─────────────────────────────
function buildMinimalHtml(params: BookingConfirmationParams): string {
  const accent = params.accentColor || DEFAULT_ACCENT
  const accentTint = hexToRgba(accent, 0.08)
  const safeProspect = escapeHtml(params.prospectName?.trim() || '')
  const safeCoach = escapeHtml(params.coachName?.trim() || '')
  const safeBrand = escapeHtml((params.brandName || params.coachName || 'ClosRM').trim())
  const safeDate = escapeHtml(params.date)
  const safeTime = escapeHtml(params.time)
  const safeLocationName = params.locationName ? escapeHtml(params.locationName) : ''
  const safeLocationAddress = params.locationAddress ? escapeHtml(params.locationAddress) : ''
  const meetUrl = params.meetUrl ? escapeHtml(params.meetUrl) : ''
  const greeting = safeProspect ? `Bonjour ${safeProspect},` : 'Bonjour,'
  const hasCustomMessage = !!(params.customMessage && params.customMessage.trim())

  const introBlock = hasCustomMessage
    ? `<p style="margin: 0 0 28px; font-size: 15px; color: #1F2937; line-height: 1.7; white-space: pre-wrap;">${escapeHtml(params.customMessage!.trim())}</p>`
    : `<p style="margin: 0 0 8px; font-size: 16px; color: #111827; font-weight: 500;">${greeting}</p>
       <p style="margin: 0 0 28px; font-size: 15px; color: #4B5563; line-height: 1.65;">Votre rendez-vous avec <strong>${safeCoach || safeBrand}</strong> est confirmé.</p>`

  const meetBlock = meetUrl
    ? `<p style="margin: 24px 0 0;">
         <a href="${meetUrl}" target="_blank" style="display: inline-block; background: ${accent}; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">Rejoindre la réunion</a>
       </p>`
    : ''

  const locationBlock = safeLocationName && !meetUrl
    ? `<p style="margin: 24px 0 0; font-size: 14px; color: #4B5563; line-height: 1.6;"><strong style="color: #111827;">Lieu :</strong> ${safeLocationName}${safeLocationAddress ? `<br/>${safeLocationAddress}` : ''}</p>`
    : ''

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Rendez-vous confirmé</title></head>
<body style="margin: 0; padding: 0; background: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #111827;">
  <div style="display:none; overflow:hidden; line-height:1px; opacity:0; max-height:0; max-width:0;">Votre rendez-vous avec ${safeCoach || safeBrand} le ${safeDate} à ${safeTime} est confirmé.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff; padding: 48px 16px;">
    <tr><td align="center">
      <table role="presentation" width="540" cellpadding="0" cellspacing="0" style="max-width: 540px; width: 100%;">
        <tr><td style="padding: 0 8px;">
          <p style="margin: 0 0 6px; font-size: 12px; font-weight: 600; color: ${accent}; letter-spacing: 0.5px; text-transform: uppercase;">${safeBrand}</p>
          <h1 style="margin: 0 0 32px; font-size: 24px; font-weight: 600; color: #111827; letter-spacing: -0.3px;">Rendez-vous confirmé</h1>
          ${introBlock}
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border: 1px solid #E5E7EB; border-radius: 10px; background: ${accentTint};">
            <tr><td style="padding: 20px 22px;">
              <p style="margin: 0 0 10px; font-size: 13px; color: #6B7280;">Date &amp; heure</p>
              <p style="margin: 0 0 18px; font-size: 17px; color: #111827; font-weight: 600;">${safeDate} · ${safeTime}</p>
              <p style="margin: 0 0 4px; font-size: 13px; color: #6B7280;">Avec</p>
              <p style="margin: 0; font-size: 15px; color: #111827; font-weight: 500;">${safeCoach || safeBrand}</p>
            </td></tr>
          </table>
          ${meetBlock}
          ${locationBlock}
          ${params.manageUrl ? `<p style="margin: 36px 0 0; text-align: center;">
            <a href="${escapeHtml(params.manageUrl)}" target="_blank" style="display: inline-block; padding: 10px 20px; background: #ffffff; border: 1px solid #E5E7EB; border-radius: 8px; color: #374151; text-decoration: none; font-size: 13px; font-weight: 600;">Reprogrammer ou annuler</a>
          </p>` : ''}
          <p style="margin: 48px 0 0; padding-top: 24px; border-top: 1px solid #F1F1F1; font-size: 12px; color: #9CA3AF; line-height: 1.6;">
            ${params.manageUrl ? 'Une question&nbsp;? Répondez simplement à cet email.' : 'Pour annuler ou reprogrammer, répondez simplement à cet email.'}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── Plain template — text-only with bare HTML wrapper ────────────────────────
function buildPlainHtml(params: BookingConfirmationParams): string {
  const safeProspect = escapeHtml(params.prospectName?.trim() || '')
  const safeCoach = escapeHtml(params.coachName?.trim() || '')
  const safeBrand = escapeHtml((params.brandName || params.coachName || 'ClosRM').trim())
  const safeDate = escapeHtml(params.date)
  const safeTime = escapeHtml(params.time)
  const safeLocationName = params.locationName ? escapeHtml(params.locationName) : ''
  const safeLocationAddress = params.locationAddress ? escapeHtml(params.locationAddress) : ''
  const meetUrl = params.meetUrl ? escapeHtml(params.meetUrl) : ''
  const greeting = safeProspect ? `Bonjour ${safeProspect},` : 'Bonjour,'
  const hasCustomMessage = !!(params.customMessage && params.customMessage.trim())

  const lines: string[] = []
  if (hasCustomMessage) {
    lines.push(escapeHtml(params.customMessage!.trim()))
    lines.push('')
  } else {
    lines.push(greeting)
    lines.push('')
    lines.push(`Votre rendez-vous avec ${safeCoach || safeBrand} est confirmé.`)
    lines.push('')
  }
  lines.push(`Date : ${safeDate}`)
  lines.push(`Heure : ${safeTime}`)
  if (meetUrl) {
    lines.push('')
    lines.push(`Lien de la réunion : <a href="${meetUrl}" style="color:#1d4ed8;">${meetUrl}</a>`)
  } else if (safeLocationName) {
    lines.push('')
    lines.push(`Lieu : ${safeLocationName}${safeLocationAddress ? ' — ' + safeLocationAddress : ''}`)
  }
  if (!hasCustomMessage) {
    lines.push('')
    lines.push('À très vite,')
    lines.push(safeCoach || safeBrand)
  }
  if (params.manageUrl) {
    lines.push('')
    lines.push(`Reprogrammer ou annuler : <a href="${escapeHtml(params.manageUrl)}" style="color:#1d4ed8;">${escapeHtml(params.manageUrl)}</a>`)
  }

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8" /><title>Rendez-vous confirmé</title></head>
<body style="margin:0;padding:24px;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#111827;font-size:15px;line-height:1.65;">
  <pre style="margin:0;font-family:inherit;font-size:inherit;color:inherit;white-space:pre-wrap;">${lines.join('\n')}</pre>
</body>
</html>`
}

// ── Dispatcher ───────────────────────────────────────────────────────────────
export function buildBookingConfirmationHtml(params: BookingConfirmationParams): string {
  const tpl = params.template ?? 'premium'
  if (tpl === 'minimal') return buildMinimalHtml(params)
  if (tpl === 'plain') return buildPlainHtml(params)
  return buildPremiumHtml(params)
}

/**
 * Send a booking confirmation email via AWS SES.
 */
export async function sendBookingConfirmationEmail(
  params: BookingConfirmationParams
): Promise<void> {
  if (!process.env.AWS_ACCESS_KEY_ID) {
    console.error('[booking-confirmation] AWS_ACCESS_KEY_ID non configuré — email non envoyé', {
      to: params.to,
      workspaceId: params.workspaceId,
    })
    return
  }

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

  const html = buildBookingConfirmationHtml(params)
  const subject = `Votre rendez-vous avec ${params.coachName} est confirme`

  // From-name priority: workspace brand name > coach legal name > fallback.
  // The brand name (workspaces.name) is what coaches expect to appear in
  // recipients' inboxes. Falls back to coachName (users.full_name) if the
  // workspace has no brand name yet.
  let senderName = params.coachName
  if (params.workspaceId) {
    const { data: ws } = await createServiceClient()
      .from('workspaces')
      .select('name')
      .eq('id', params.workspaceId)
      .maybeSingle()
    if (ws?.name) senderName = ws.name
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
