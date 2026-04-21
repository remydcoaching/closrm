import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { fireTriggersForEvent } from '@/lib/workflows/trigger'
import { resumeExecution } from '@/lib/workflows/engine'
import { sendEmail, isSuppressed } from '@/lib/email/client'
import { sendWhatsAppMessage } from '@/lib/whatsapp/client'
import { sendIgMessage } from '@/lib/instagram/api'
import { getIntegrationCredentials } from '@/lib/integrations/get-credentials'
import { cancelBookingReminders } from '@/lib/bookings/reminders'
import { verifyDomain } from '@/lib/email/domains'
import { consumeResource } from '@/lib/billing/service'
import { getWorkspaceSenderConfig } from '@/lib/email/sender-config'

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = {
    resumed_executions: 0,
    call_reminders_fired: 0,
    followup_reminders_fired: 0,
    booking_no_show_fired: 0,
    booking_reminders_fired: 0,
    calendar_reminders_sent: 0,
    email_domains_verified: 0,
    lead_inactive_fired: 0,
    errors: [] as string[],
  }

  try {
    const supabase = createServiceClient()

    // ─── 1. Resume paused executions (delay steps) ────────────────────────
    const { data: pausedExecutions } = await supabase
      .from('workflow_executions')
      .select('id')
      .eq('status', 'waiting')
      .lte('resume_at', new Date().toISOString())

    if (pausedExecutions) {
      for (const exec of pausedExecutions) {
        try {
          await resumeExecution(exec.id)
          results.resumed_executions++
        } catch (err) {
          results.errors.push(`Resume ${exec.id}: ${err instanceof Error ? err.message : 'Unknown error'}`)
        }
      }
    }

    // ─── 2. Fire call_in_x_hours triggers ─────────────────────────────────
    // Find active workflows with call_in_x_hours trigger
    const { data: callReminderWorkflows } = await supabase
      .from('workflows')
      .select('id, workspace_id, trigger_config')
      .eq('status', 'actif')
      .eq('trigger_type', 'call_in_x_hours')

    if (callReminderWorkflows) {
      for (const wf of callReminderWorkflows) {
        const hoursBefore = (wf.trigger_config as Record<string, unknown>)?.hours_before as number || 24
        const now = new Date()
        const targetTime = new Date(now.getTime() + hoursBefore * 60 * 60 * 1000)
        // Window: 15 minutes (cron interval)
        const windowStart = new Date(targetTime.getTime() - 15 * 60 * 1000)

        const { data: upcomingCalls } = await supabase
          .from('calls')
          .select('id, lead_id')
          .eq('workspace_id', wf.workspace_id)
          .eq('outcome', 'pending')
          .gte('scheduled_at', windowStart.toISOString())
          .lt('scheduled_at', targetTime.toISOString())

        if (upcomingCalls) {
          for (const call of upcomingCalls) {
            // Check if already fired for this call+workflow combo
            const { count } = await supabase
              .from('workflow_executions')
              .select('*', { count: 'exact', head: true })
              .eq('workflow_id', wf.id)
              .eq('lead_id', call.lead_id)
              .gte('started_at', new Date(now.getTime() - hoursBefore * 60 * 60 * 1000).toISOString())

            if ((count ?? 0) === 0) {
              try {
                await fireTriggersForEvent(wf.workspace_id, 'call_in_x_hours', {
                  lead_id: call.lead_id,
                  call_id: call.id,
                })
                results.call_reminders_fired++
              } catch (err) {
                results.errors.push(`Call reminder ${call.id}: ${err instanceof Error ? err.message : 'Unknown'}`)
              }
            }
          }
        }
      }
    }

    // ─── 3. Fire followup_pending_x_days triggers ─────────────────────────
    const { data: followupWorkflows } = await supabase
      .from('workflows')
      .select('id, workspace_id, trigger_config')
      .eq('status', 'actif')
      .eq('trigger_type', 'followup_pending_x_days')

    if (followupWorkflows) {
      for (const wf of followupWorkflows) {
        const pendingDays = (wf.trigger_config as Record<string, unknown>)?.days as number || 3
        const cutoff = new Date(Date.now() - pendingDays * 24 * 60 * 60 * 1000)

        const { data: pendingFollowups } = await supabase
          .from('follow_ups')
          .select('id, lead_id')
          .eq('workspace_id', wf.workspace_id)
          .eq('status', 'en_attente')
          .lte('scheduled_at', cutoff.toISOString())

        if (pendingFollowups) {
          for (const fu of pendingFollowups) {
            const { count } = await supabase
              .from('workflow_executions')
              .select('*', { count: 'exact', head: true })
              .eq('workflow_id', wf.id)
              .eq('lead_id', fu.lead_id)
              .gte('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

            if ((count ?? 0) === 0) {
              try {
                await fireTriggersForEvent(wf.workspace_id, 'followup_pending_x_days', {
                  lead_id: fu.lead_id,
                  followup_id: fu.id,
                })
                results.followup_reminders_fired++
              } catch (err) {
                results.errors.push(`Followup ${fu.id}: ${err instanceof Error ? err.message : 'Unknown'}`)
              }
            }
          }
        }
      }
    }
    // ─── 4. Auto-detect booking no-shows ──────────────────────────────────
    // Bookings confirmed but scheduled_at < now() - 1 hour → mark as no_show
    {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const { data: overdueBookings } = await supabase
        .from('bookings')
        .select('id, lead_id, workspace_id, calendar_id, call_id')
        .eq('status', 'confirmed')
        .lt('scheduled_at', oneHourAgo)

      if (overdueBookings) {
        for (const booking of overdueBookings) {
          try {
            await supabase
              .from('bookings')
              .update({ status: 'no_show' })
              .eq('id', booking.id)

            // Cancel any pending reminders
            cancelBookingReminders(booking.id).catch(() => {})

            if (booking.lead_id) {
              await fireTriggersForEvent(booking.workspace_id, 'booking_no_show', {
                lead_id: booking.lead_id,
                booking_id: booking.id,
                calendar_id: booking.calendar_id,
              })
              results.booking_no_show_fired++

              // Sync to linked call if exists
              if (booking.call_id) {
                const { data: linkedCall } = await supabase
                  .from('calls')
                  .select('id, type')
                  .eq('id', booking.call_id)
                  .single()

                if (linkedCall) {
                  await supabase
                    .from('calls')
                    .update({ outcome: 'no_show' })
                    .eq('id', linkedCall.id)

                  const noShowStatus = linkedCall.type === 'setting' ? 'no_show_setting' : 'no_show_closing'
                  await supabase
                    .from('leads')
                    .update({ status: noShowStatus })
                    .eq('id', booking.lead_id)
                    .eq('workspace_id', booking.workspace_id)

                  // Create follow-up
                  const tomorrow = new Date()
                  tomorrow.setDate(tomorrow.getDate() + 1)
                  tomorrow.setHours(9, 0, 0, 0)
                  await supabase
                    .from('follow_ups')
                    .insert({
                      workspace_id: booking.workspace_id,
                      lead_id: booking.lead_id,
                      reason: 'No-show RDV — à relancer',
                      scheduled_at: tomorrow.toISOString(),
                      channel: 'whatsapp',
                      status: 'en_attente',
                    })
                }
              }
            }
          } catch (err) {
            results.errors.push(`Booking no-show ${booking.id}: ${err instanceof Error ? err.message : 'Unknown'}`)
          }
        }
      }
    }

    // ─── 4b. Fire booking_in_x_hours triggers ────────────────────────────
    {
      const { data: bookingReminderWorkflows } = await supabase
        .from('workflows')
        .select('id, workspace_id, trigger_config')
        .eq('status', 'actif')
        .eq('trigger_type', 'booking_in_x_hours')

      if (bookingReminderWorkflows) {
        for (const wf of bookingReminderWorkflows) {
          const config = (wf.trigger_config ?? {}) as Record<string, unknown>
          const hoursBefore = (config.hours_before as number) || 24
          const now = new Date()
          const targetTime = new Date(now.getTime() + hoursBefore * 60 * 60 * 1000)
          const windowStart = new Date(targetTime.getTime() - 15 * 60 * 1000)

          let query = supabase
            .from('bookings')
            .select('id, lead_id, calendar_id')
            .eq('workspace_id', wf.workspace_id)
            .eq('status', 'confirmed')
            .gte('scheduled_at', windowStart.toISOString())
            .lt('scheduled_at', targetTime.toISOString())

          // Optional calendar filter
          if (config.calendar_id) {
            query = query.eq('calendar_id', config.calendar_id as string)
          }

          const { data: upcomingBookings } = await query

          if (upcomingBookings) {
            for (const booking of upcomingBookings) {
              if (!booking.lead_id) continue

              const { count } = await supabase
                .from('workflow_executions')
                .select('*', { count: 'exact', head: true })
                .eq('workflow_id', wf.id)
                .eq('lead_id', booking.lead_id)
                .gte('started_at', new Date(now.getTime() - hoursBefore * 60 * 60 * 1000).toISOString())

              if ((count ?? 0) === 0) {
                try {
                  await fireTriggersForEvent(wf.workspace_id, 'booking_in_x_hours', {
                    lead_id: booking.lead_id,
                    booking_id: booking.id,
                    calendar_id: booking.calendar_id,
                  })
                  results.booking_reminders_fired++
                } catch (err) {
                  results.errors.push(`Booking reminder ${booking.id}: ${err instanceof Error ? err.message : 'Unknown'}`)
                }
              }
            }
          }
        }
      }
    }

    // ─── 5. Fire lead_inactive_x_days triggers ─────────────────────────────
    {
      const { data: inactiveWorkflows } = await supabase
        .from('workflows')
        .select('id, workspace_id, trigger_config')
        .eq('status', 'actif')
        .eq('trigger_type', 'lead_inactive_x_days')

      if (inactiveWorkflows) {
        for (const wf of inactiveWorkflows) {
          const days = (wf.trigger_config as Record<string, unknown>)?.days as number || 30
          const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

          const { data: inactiveLeads } = await supabase
            .from('leads')
            .select('id')
            .eq('workspace_id', wf.workspace_id)
            .lt('last_activity_at', cutoff)

          if (inactiveLeads) {
            for (const lead of inactiveLeads) {
              // Anti-duplicate: check no execution for this lead+workflow in the last {days} days
              const antiDupeCutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
              const { count } = await supabase
                .from('workflow_executions')
                .select('*', { count: 'exact', head: true })
                .eq('workflow_id', wf.id)
                .eq('lead_id', lead.id)
                .gte('started_at', antiDupeCutoff)

              if ((count ?? 0) === 0) {
                try {
                  await fireTriggersForEvent(wf.workspace_id, 'lead_inactive_x_days', {
                    lead_id: lead.id,
                    days_inactive: days,
                  })
                  results.lead_inactive_fired++
                } catch (err) {
                  results.errors.push(`Lead inactive ${lead.id}: ${err instanceof Error ? err.message : 'Unknown'}`)
                }
              }
            }
          }
        }
      }
    }
    // ─── 6. Send pending booking reminders ────────────────────────────────
    {
      const { data: pendingReminders } = await supabase
        .from('booking_reminders')
        .select('id, workspace_id, booking_id, lead_id, channel, message')
        .eq('status', 'pending')
        .lte('send_at', new Date().toISOString())
        .limit(100)

      if (pendingReminders) {
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
              continue
            }

            let sendError: string | null = null

            if (reminder.channel === 'email') {
              if (!lead.email) {
                sendError = "Pas d'adresse email"
              } else if (!process.env.AWS_ACCESS_KEY_ID) {
                sendError = 'AWS SES non configuré'
              } else if (await isSuppressed(lead.email, reminder.workspace_id)) {
                // Skip sans débit ni erreur : rappel silencieux si lead unsubscribed/bounced
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
                  const senderConfig = await getWorkspaceSenderConfig(reminder.workspace_id)
                  const result = await sendEmail(
                    {
                      fromEmail: senderConfig.fromEmail,
                      fromName: senderConfig.fromName,
                      workspaceId: reminder.workspace_id,
                    },
                    lead.email,
                    'Rappel de votre rendez-vous',
                    `<p>${reminder.message.replace(/\n/g, '<br>')}</p>`
                  )
                  if (!result.ok) sendError = result.error ?? 'Erreur envoi email'
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

              results.errors.push(`Reminder ${reminder.id}: ${sendError}`)
            } else {
              await supabase.from('booking_reminders')
                .update({ status: 'sent' })
                .eq('id', reminder.id)
              results.calendar_reminders_sent++
            }
          } catch (err) {
            await supabase.from('booking_reminders')
              .update({ status: 'failed', error: err instanceof Error ? err.message : 'Unknown' })
              .eq('id', reminder.id)
            results.errors.push(`Reminder ${reminder.id}: ${err instanceof Error ? err.message : 'Unknown'}`)
          }
        }
      }
    }
    // ─── 7. Background DNS verification for pending email domains ─────
    {
      const { data: pendingDomains } = await supabase
        .from('email_domains')
        .select('id, resend_domain_id, status')
        .eq('status', 'pending')

      if (pendingDomains) {
        for (const domain of pendingDomains) {
          try {
            if (!domain.resend_domain_id) continue

            const result = await verifyDomain(domain.resend_domain_id)
            if (!result.ok || !result.domain) continue

            const resendDomain = result.domain
            const newStatus = resendDomain.status === 'verified' ? 'verified'
              : resendDomain.status === 'failed' ? 'failed'
              : 'pending'

            const dnsRecords = (resendDomain.records ?? []).map((r: { type: string; name: string; value: string; priority?: number; status: string }) => ({
              type: r.type,
              name: r.name,
              value: r.value,
              priority: r.priority ?? null,
              status: r.status,
            }))

            await supabase
              .from('email_domains')
              .update({ status: newStatus, dns_records: dnsRecords })
              .eq('id', domain.id)

            if (newStatus === 'verified') results.email_domains_verified++
          } catch (err) {
            results.errors.push(`Email domain ${domain.id}: ${err instanceof Error ? err.message : 'Unknown'}`)
          }
        }
      }
    }
  } catch (err) {
    results.errors.push(`Global: ${err instanceof Error ? err.message : 'Unknown error'}`)
  }

  return NextResponse.json({ ok: true, ...results })
}
