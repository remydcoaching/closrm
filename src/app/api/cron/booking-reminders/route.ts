import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendEmail, isSuppressed } from '@/lib/email/client'
import { sendWhatsAppMessage } from '@/lib/whatsapp/client'
import { sendIgMessage } from '@/lib/instagram/api'
import { getIntegrationCredentials } from '@/lib/integrations/get-credentials'
import { consumeResource } from '@/lib/billing/service'
import { getWorkspaceSenderConfig } from '@/lib/email/sender-config'
import { logEmailSend } from '@/lib/email/log-send'
import { buildBookingConfirmationHtml } from '@/lib/email/templates/booking-confirmation'
import { parseISO } from 'date-fns'
import { formatBookingDateFR, formatBookingTimeFR } from '@/lib/bookings/format'

export const dynamic = 'force-dynamic'

/**
 * Lightweight cron — runs every minute to process pending booking reminders
 * that are due (send_at <= now). Kept separate from the heavier
 * workflow-scheduler (which only runs once a day) to avoid the latter's
 * load on Supabase while still delivering reminders on time.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const results = { sent: 0, failed: 0, errors: [] as string[] }

  const { data: pendingReminders } = await supabase
    .from('booking_reminders')
    .select('id, workspace_id, booking_id, lead_id, channel, message')
    .eq('status', 'pending')
    .lte('send_at', new Date().toISOString())
    .limit(100)

  if (!pendingReminders || pendingReminders.length === 0) {
    return NextResponse.json(results)
  }

  for (const reminder of pendingReminders) {
    try {
      const { data: lead } = await supabase
        .from('leads')
        .select('email, phone, first_name, last_name')
        .eq('id', reminder.lead_id)
        .single()

      if (!lead) {
        await supabase.from('booking_reminders')
          .update({ status: 'failed', error: 'Lead introuvable' })
          .eq('id', reminder.id)
        results.failed++
        continue
      }

      // Skip silently if the booking has been deleted or cancelled —
      // sending a reminder for a non-existent booking would just confuse
      // the prospect. Mark as cancelled instead of failed (this is expected).
      const { data: bookingStatus } = await supabase
        .from('bookings')
        .select('id, status')
        .eq('id', reminder.booking_id)
        .maybeSingle()
      if (!bookingStatus || bookingStatus.status === 'cancelled') {
        await supabase.from('booking_reminders')
          .update({ status: 'cancelled', error: 'Booking deleted or cancelled' })
          .eq('id', reminder.id)
        continue
      }

      let sendError: string | null = null

      if (reminder.channel === 'email') {
        if (!lead.email) {
          sendError = "Pas d'adresse email"
        } else if (!process.env.AWS_ACCESS_KEY_ID) {
          sendError = 'AWS SES non configuré'
        } else if (await isSuppressed(lead.email, reminder.workspace_id)) {
          sendError = null
        } else {
          const quotaResult = await consumeResource({
            workspaceId: reminder.workspace_id,
            resourceType: 'email',
            quantity: 1,
            source: 'booking_reminder',
            metadata: { reminder_id: reminder.id, lead_id: reminder.lead_id },
          })
          if (!quotaResult.allowed) {
            sendError = quotaResult.error_message || 'Quota email dépassé'
          } else {
            const [{ data: ws }, { data: coachUser }, { data: booking }] = await Promise.all([
              supabase.from('workspaces').select('name').eq('id', reminder.workspace_id).maybeSingle(),
              supabase.from('users').select('full_name').eq('workspace_id', reminder.workspace_id).eq('role', 'coach').maybeSingle(),
              supabase.from('bookings').select('scheduled_at, meet_url, location_name, location_address, calendar_id, manage_token').eq('id', reminder.booking_id).maybeSingle(),
            ])

            let calTemplate: 'premium' | 'minimal' | 'plain' = 'premium'
            let calAccent: string = '#E53E3E'
            const bookingCalId = (booking as { calendar_id?: string | null } | null)?.calendar_id
            if (bookingCalId) {
              const { data: cal } = await supabase
                .from('booking_calendars')
                .select('email_template, email_accent_color')
                .eq('id', bookingCalId)
                .maybeSingle()
              if (cal) {
                const t = (cal as { email_template?: string }).email_template
                if (t === 'minimal' || t === 'plain' || t === 'premium') calTemplate = t
                const c = (cal as { email_accent_color?: string }).email_accent_color
                if (typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c)) calAccent = c
              }
            }

            const scheduledAt = booking?.scheduled_at ? parseISO(booking.scheduled_at) : null
            const dateStr = scheduledAt ? formatBookingDateFR(scheduledAt) : ''
            const timeStr = scheduledAt ? formatBookingTimeFR(scheduledAt) : ''

            const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
            const manageToken = (booking as { manage_token?: string } | null)?.manage_token
            const manageUrl = appUrl && manageToken
              ? `${appUrl}/booking/manage/${reminder.booking_id}?token=${manageToken}`
              : undefined

            const html = scheduledAt
              ? buildBookingConfirmationHtml({
                  to: lead.email,
                  workspaceId: reminder.workspace_id,
                  coachName: coachUser?.full_name ?? '',
                  brandName: ws?.name ?? coachUser?.full_name ?? '',
                  prospectName: `${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim(),
                  date: dateStr,
                  time: timeStr,
                  meetUrl: booking?.meet_url ?? undefined,
                  locationName: booking?.location_name ?? undefined,
                  locationAddress: booking?.location_address ?? undefined,
                  customMessage: reminder.message,
                  template: calTemplate,
                  accentColor: calAccent,
                  manageUrl,
                })
              : `<p>${reminder.message.replace(/\n/g, '<br>')}</p>`

            const subject = scheduledAt
              ? `Votre rendez-vous le ${dateStr} à ${timeStr}`
              : 'Rappel de votre rendez-vous'

            const senderConfig = await getWorkspaceSenderConfig(reminder.workspace_id, {
              fromName: ws?.name ?? coachUser?.full_name ?? undefined,
            })
            const result = await sendEmail(
              {
                fromEmail: senderConfig.fromEmail,
                fromName: senderConfig.fromName,
                replyTo: senderConfig.replyTo,
                workspaceId: reminder.workspace_id,
              },
              lead.email,
              subject,
              html
            )
            if (!result.ok) {
              sendError = result.error ?? 'Erreur envoi email'
            } else {
              await logEmailSend({
                workspaceId: reminder.workspace_id,
                sesMessageId: result.id,
                source: 'booking_reminder',
                leadId: reminder.lead_id,
                subject,
                fromEmail: senderConfig.fromEmail,
              })
            }
          }
        }
      } else if (reminder.channel === 'whatsapp') {
        if (!lead.phone) {
          sendError = 'Pas de numéro de téléphone'
        } else {
          const creds = await getIntegrationCredentials(reminder.workspace_id, 'whatsapp')
          if (!creds) {
            sendError = 'WhatsApp non connecté'
          } else {
            const phone = lead.phone.replace(/[\s\-\.]/g, '').replace(/^0/, '33')
            const result = await sendWhatsAppMessage(
              { phoneNumberId: creds.phone_number_id, accessToken: creds.access_token },
              phone,
              reminder.message
            )
            if (!result.ok) sendError = result.error ?? 'Erreur envoi WhatsApp'
          }
        }
      } else if (reminder.channel === 'instagram_dm') {
        const { data: conv } = await supabase
          .from('ig_conversations')
          .select('participant_ig_id')
          .eq('lead_id', reminder.lead_id)
          .eq('workspace_id', reminder.workspace_id)
          .maybeSingle()

        if (!conv?.participant_ig_id) {
          sendError = 'Pas de conversation Instagram liée'
        } else {
          const { data: igAccount } = await supabase
            .from('ig_accounts')
            .select('page_access_token, page_id')
            .eq('workspace_id', reminder.workspace_id)
            .maybeSingle()

          if (!igAccount) {
            sendError = 'Compte Instagram non connecté'
          } else {
            try {
              await sendIgMessage(
                igAccount.page_access_token,
                igAccount.page_id,
                conv.participant_ig_id,
                reminder.message
              )
            } catch (err) {
              sendError = err instanceof Error ? err.message : 'Erreur envoi DM Instagram'
            }
          }
        }
      }

      if (sendError) {
        await supabase.from('booking_reminders')
          .update({ status: 'failed', error: sendError })
          .eq('id', reminder.id)

        // Notify coach via Telegram if available
        const notifCreds = await getIntegrationCredentials(reminder.workspace_id, 'telegram')
        if (notifCreds?.bot_token && notifCreds?.chat_id) {
          const msg = `⚠️ Rappel échoué pour ${lead.first_name} ${lead.last_name} : ${sendError}`
          fetch(`https://api.telegram.org/bot${notifCreds.bot_token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: notifCreds.chat_id, text: msg }),
          }).catch(() => {})
        }

        results.failed++
        results.errors.push(`Reminder ${reminder.id}: ${sendError}`)
      } else {
        await supabase.from('booking_reminders')
          .update({ status: 'sent' })
          .eq('id', reminder.id)
        results.sent++
      }
    } catch (err) {
      await supabase.from('booking_reminders')
        .update({ status: 'failed', error: err instanceof Error ? err.message : 'Unknown' })
        .eq('id', reminder.id)
      results.failed++
      results.errors.push(`Reminder ${reminder.id}: ${err instanceof Error ? err.message : 'Unknown'}`)
    }
  }

  return NextResponse.json(results)
}
