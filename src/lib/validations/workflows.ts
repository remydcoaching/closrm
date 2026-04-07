import { z } from 'zod'

const workflowTriggerTypes = [
  'new_lead',
  'lead_imported',
  'lead_status_changed',
  'tag_added',
  'tag_removed',
  'deal_won',
  'lead_with_ig_handle',
  'lead_inactive_x_days',
  'call_scheduled',
  'call_in_x_hours',
  'call_no_show',
  'call_outcome_logged',
  'followup_pending_x_days',
  'new_follower',
  'dm_keyword',
  'comment_keyword',
  'booking_created',
  'booking_cancelled',
  'booking_no_show',
] as const

const workflowActionTypes = [
  'send_email',
  'send_whatsapp',
  'send_dm_instagram',
  'create_followup',
  'change_lead_status',
  'add_tag',
  'remove_tag',
  'send_notification',
  'facebook_conversions_api',
  'enroll_in_sequence',
  'add_note',
  'set_reached',
  'schedule_call',
  'webhook',
  'create_google_meet',
  'update_lead_field',
  'wait_until_date',
] as const

export const createWorkflowSchema = z.object({
  name: z.string().min(1, 'Le nom est requis.').max(200, 'Le nom ne doit pas dépasser 200 caractères.'),
  description: z.string().max(2000).optional().default(''),
  trigger_type: z.enum(workflowTriggerTypes, { message: 'Type de déclencheur invalide.' }),
  trigger_config: z.record(z.string(), z.unknown()).optional().default({}),
})

export const updateWorkflowSchema = z.object({
  name: z.string().min(1, 'Le nom est requis.').max(200, 'Le nom ne doit pas dépasser 200 caractères.').optional(),
  description: z.string().max(2000).optional(),
  trigger_type: z.enum(workflowTriggerTypes, { message: 'Type de déclencheur invalide.' }).optional(),
  trigger_config: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(['brouillon', 'actif', 'inactif']).optional(),
  notify_on_failure: z.boolean().optional(),
  failure_notification_channel: z.string().max(50).nullable().optional(),
})

export const workflowFiltersSchema = z.object({
  status: z.enum(['brouillon', 'actif', 'inactif']).optional(),
  trigger_type: z.enum(workflowTriggerTypes).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.enum(['created_at', 'updated_at', 'name']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
})

export const createStepSchema = z.object({
  insert_after: z.number().int().min(0).optional(),
  step_type: z.enum(['action', 'delay', 'condition', 'wait_for_event'], { message: 'Type d\'étape invalide.' }),
  action_type: z.enum(workflowActionTypes).optional(),
  action_config: z.record(z.string(), z.unknown()).optional().default({}),
  delay_value: z.number().int().min(1).optional(),
  delay_unit: z.enum(['minutes', 'hours', 'days']).optional(),
  condition_field: z.string().max(200).optional(),
  condition_operator: z.string().max(50).optional(),
  condition_value: z.string().max(500).optional(),
  on_true_step: z.number().int().min(1).optional(),
  on_false_step: z.number().int().min(1).optional(),
  parent_step_id: z.string().uuid().optional(),
  branch: z.enum(['main', 'true', 'false']).optional(),
})

export const updateStepSchema = z.object({
  step_type: z.enum(['action', 'delay', 'condition', 'wait_for_event']).optional(),
  action_type: z.enum(workflowActionTypes).optional().nullable(),
  action_config: z.record(z.string(), z.unknown()).optional(),
  delay_value: z.number().int().min(1).optional().nullable(),
  delay_unit: z.enum(['minutes', 'hours', 'days']).optional().nullable(),
  condition_field: z.string().max(200).optional().nullable(),
  condition_operator: z.string().max(50).optional().nullable(),
  condition_value: z.string().max(500).optional().nullable(),
  on_true_step: z.number().int().min(1).optional().nullable(),
  on_false_step: z.number().int().min(1).optional().nullable(),
})

export const reorderStepsSchema = z.array(
  z.object({
    id: z.string().uuid('ID étape invalide.'),
    step_order: z.number().int().min(1),
  })
)

export type CreateWorkflowData = z.infer<typeof createWorkflowSchema>
export type UpdateWorkflowData = z.infer<typeof updateWorkflowSchema>
export type WorkflowFilters = z.infer<typeof workflowFiltersSchema>
export type CreateStepData = z.infer<typeof createStepSchema>
export type UpdateStepData = z.infer<typeof updateStepSchema>
export type ReorderStepsData = z.infer<typeof reorderStepsSchema>
