import type { SupabaseClient } from '@supabase/supabase-js'

import { execute as createFollowup } from './create-followup'
import { execute as changeStatus } from './change-status'
import { execute as manageTags } from './manage-tags'
import { execute as sendEmail } from './send-email'
import { execute as sendWhatsapp } from './send-whatsapp'
import { execute as sendDmInstagram } from './send-dm-instagram'
import { execute as sendNotification } from './send-notification'
import { execute as fbConversions } from './fb-conversions'

/**
 * Context passed to every action handler during workflow execution.
 */
export interface ExecutionContext {
  workspaceId: string
  leadId?: string
  lead?: Record<string, unknown>
  coach?: { full_name: string }
  actionType?: string
  resolveTemplate: (template: string) => string
  supabase: SupabaseClient
}

type ActionHandler = (
  config: Record<string, unknown>,
  context: ExecutionContext
) => Promise<{ success: boolean; result?: Record<string, unknown>; error?: string }>

/**
 * Registry mapping action_type to its handler function.
 */
export const actionHandlers: Record<string, ActionHandler> = {
  create_followup: createFollowup,
  change_lead_status: changeStatus,
  add_tag: manageTags,
  remove_tag: manageTags,
  send_email: sendEmail,
  send_whatsapp: sendWhatsapp,
  send_dm_instagram: sendDmInstagram,
  send_notification: sendNotification,
  facebook_conversions_api: fbConversions,
}
