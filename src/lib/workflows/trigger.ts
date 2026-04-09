/**
 * Workflow trigger dispatcher.
 * Called from API routes when events happen (fire-and-forget).
 *
 * Usage in API routes:
 *   import { fireTriggersForEvent } from '@/lib/workflows/trigger'
 *   // Fire and forget — don't await in the response path if latency matters
 *   fireTriggersForEvent(workspaceId, 'new_lead', { lead_id: lead.id, source: 'facebook_ads' })
 */

import { createServiceClient } from '@/lib/supabase/service'
import { executeWorkflow, type TriggerData } from './engine'

/**
 * Find all active workflows matching the trigger type and config,
 * then execute each one.
 */
export async function fireTriggersForEvent(
  workspaceId: string,
  triggerType: string,
  triggerData: TriggerData
): Promise<void> {
  try {
    const supabase = createServiceClient()

    // Fetch all active workflows for this trigger type in this workspace
    const { data: workflows, error } = await supabase
      .from('workflows')
      .select('id, trigger_config')
      .eq('workspace_id', workspaceId)
      .eq('status', 'actif')
      .eq('trigger_type', triggerType)

    if (error) {
      console.error(`[workflow-trigger] Failed to query workflows for ${triggerType}:`, error)
      return
    }

    if (!workflows?.length) return

    for (const workflow of workflows) {
      try {
        const config = (workflow.trigger_config ?? {}) as Record<string, unknown>

        if (!matchesTriggerConfig(triggerType, config, triggerData)) {
          continue
        }

        // Execute workflow — don't await to keep fire-and-forget behavior
        // (errors are caught inside executeWorkflow)
        executeWorkflow(workflow.id, workspaceId, triggerData).catch(err => {
          console.error(`[workflow-trigger] Error executing workflow ${workflow.id}:`, err)
        })
      } catch (err) {
        console.error(`[workflow-trigger] Error processing workflow ${workflow.id}:`, err)
      }
    }
  } catch (err) {
    // Never throw from fire-and-forget
    console.error(`[workflow-trigger] Unhandled error for ${triggerType}:`, err)
  }
}

/**
 * Check if the trigger's config conditions match the incoming event data.
 * Returns true if the workflow should fire.
 */
function matchesTriggerConfig(
  triggerType: string,
  config: Record<string, unknown>,
  data: TriggerData
): boolean {
  switch (triggerType) {
    case 'lead_status_changed': {
      // If config specifies from_status, it must match
      if (config.from_status && config.from_status !== data.old_status) return false
      // If config specifies to_status, it must match
      if (config.to_status && config.to_status !== data.new_status) return false
      return true
    }

    case 'tag_added':
    case 'tag_removed': {
      // If config specifies a specific tag, it must match
      if (config.tag && config.tag !== data.tag) return false
      return true
    }

    case 'new_lead': {
      // If config specifies a source filter, it must match
      if (config.source && config.source !== data.source) return false
      return true
    }

    case 'lead_imported': {
      // Optional source filter
      if (config.source && config.source !== data.source) return false
      return true
    }

    case 'lead_with_ig_handle':
      // No config — fires whenever a lead is created with an instagram_handle
      return true

    case 'booking_no_show':
    case 'booking_created':
    case 'booking_cancelled':
    case 'booking_completed': {
      // Optional calendar_id filter — if set, only fire for that calendar
      if (config.calendar_id && config.calendar_id !== data.calendar_id) return false
      return true
    }

    case 'booking_in_x_hours':
      // Handled by cron job, similar to call_in_x_hours
      return false

    case 'lead_inactive_x_days': {
      // Config has `days`, triggerData has `days_inactive`
      const configDays = (config.days as number) ?? 30
      const inactiveDays = (data.days_inactive as number) ?? 0
      return inactiveDays >= configDays
    }

    case 'call_in_x_hours':
      // Handled by cron job, not direct trigger dispatch
      return false

    default:
      // For all other triggers (call_scheduled, call_no_show, deal_won, etc.)
      // no config matching needed — fire for any matching trigger_type
      return true
  }
}
