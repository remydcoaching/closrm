import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { fireTriggersForEvent } from '@/lib/workflows/trigger'
import { resumeExecution } from '@/lib/workflows/engine'

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
  } catch (err) {
    results.errors.push(`Global: ${err instanceof Error ? err.message : 'Unknown error'}`)
  }

  return NextResponse.json({ ok: true, ...results })
}
