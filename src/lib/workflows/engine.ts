/**
 * Workflow execution engine.
 * Runs server-side only — called from API routes, triggers, and cron jobs.
 *
 * Executes workflow steps sequentially: actions, delays (pause for cron),
 * and conditions (branching logic).
 */

import { createServiceClient } from '@/lib/supabase/service'
import { resolveTemplate, type TemplateContext } from './variables'
import { actionHandlers, type ExecutionContext } from './actions'
import type { WorkflowStep, WorkflowActionType } from '@/types'

export interface TriggerData {
  lead_id?: string
  call_id?: string
  old_status?: string
  new_status?: string
  tag?: string
  source?: string
  [key: string]: unknown
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Start executing a workflow from step 1.
 * Called by the trigger dispatcher when an event matches a workflow.
 */
export async function executeWorkflow(
  workflowId: string,
  workspaceId: string,
  triggerData: TriggerData
): Promise<void> {
  const supabase = createServiceClient()

  // 1. Create execution record
  const { data: execution, error: execError } = await supabase
    .from('workflow_executions')
    .insert({
      workflow_id: workflowId,
      workspace_id: workspaceId,
      lead_id: triggerData.lead_id ?? null,
      trigger_data: triggerData,
      status: 'running',
      current_step: 1,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (execError || !execution) {
    console.error(`[workflow-engine] Failed to create execution for workflow ${workflowId}:`, execError)
    return
  }

  // 2. Fetch workflow steps
  const { data: steps, error: stepsError } = await supabase
    .from('workflow_steps')
    .select('*')
    .eq('workflow_id', workflowId)
    .order('step_order', { ascending: true })

  if (stepsError || !steps?.length) {
    await markFailed(supabase, execution.id, 'No steps found or failed to fetch steps')
    return
  }

  // 3. Build template context
  const templateContext = await buildTemplateContext(supabase, workspaceId, triggerData)

  // 4. Run steps starting from 1
  await runSteps(supabase, execution.id, workflowId, workspaceId, steps, 1, triggerData, templateContext)
}

/**
 * Resume a paused execution (after a delay step).
 * Called by the cron job that checks for executions with resume_at <= now.
 */
export async function resumeExecution(executionId: string): Promise<void> {
  const supabase = createServiceClient()

  // 1. Fetch execution
  const { data: execution, error: execError } = await supabase
    .from('workflow_executions')
    .select('*')
    .eq('id', executionId)
    .eq('status', 'waiting')
    .single()

  if (execError || !execution) {
    console.error(`[workflow-engine] Cannot resume execution ${executionId}:`, execError?.message ?? 'Not found or not waiting')
    return
  }

  // 2. Update status to running
  await supabase
    .from('workflow_executions')
    .update({ status: 'running' })
    .eq('id', executionId)

  // 3. Fetch steps
  const { data: steps, error: stepsError } = await supabase
    .from('workflow_steps')
    .select('*')
    .eq('workflow_id', execution.workflow_id)
    .order('step_order', { ascending: true })

  if (stepsError || !steps?.length) {
    await markFailed(supabase, executionId, 'Failed to fetch steps on resume')
    return
  }

  // 4. Build template context
  const triggerData = (execution.trigger_data ?? {}) as TriggerData
  const templateContext = await buildTemplateContext(supabase, execution.workspace_id, triggerData)

  // 5. Continue from next step after the delay
  const nextStep = execution.current_step + 1
  await runSteps(supabase, executionId, execution.workflow_id, execution.workspace_id, steps, nextStep, triggerData, templateContext)
}

// ─── Core step runner ────────────────────────────────────────────────────────

async function runSteps(
  supabase: ReturnType<typeof createServiceClient>,
  executionId: string,
  workflowId: string,
  workspaceId: string,
  steps: WorkflowStep[],
  startFromOrder: number,
  triggerData: TriggerData,
  templateContext: TemplateContext
): Promise<void> {
  // Fetch lead data for condition evaluation
  let leadData: Record<string, unknown> = {}
  if (triggerData.lead_id) {
    const { data } = await supabase
      .from('leads')
      .select('*')
      .eq('id', triggerData.lead_id)
      .eq('workspace_id', workspaceId)
      .single()
    if (data) leadData = data as Record<string, unknown>
  }

  const resolveTemplateFn = (template: string) => resolveTemplate(template, templateContext)

  let currentOrder = startFromOrder

  while (currentOrder <= steps.length) {
    const step = steps.find(s => s.step_order === currentOrder)
    if (!step) {
      // No step at this order — we're done
      break
    }

    // Update current_step
    await supabase
      .from('workflow_executions')
      .update({ current_step: currentOrder })
      .eq('id', executionId)

    try {
      if (step.step_type === 'action') {
        const actionType = step.action_type as WorkflowActionType
        const handler = actionHandlers[actionType]

        if (!handler) {
          await logStep(supabase, executionId, step, 'failed', undefined, `Unknown action type: ${actionType}`)
          currentOrder++
          continue
        }

        const context: ExecutionContext = {
          workspaceId,
          leadId: triggerData.lead_id,
          lead: leadData,
          coach: templateContext.coach,
          actionType,
          resolveTemplate: resolveTemplateFn,
          supabase,
        }

        const result = await handler(step.action_config ?? {}, context)

        await logStep(
          supabase,
          executionId,
          step,
          result.success ? 'success' : 'failed',
          result.result,
          result.error
        )

        // Re-fetch lead data after mutations (status change, tag change)
        if (result.success && (actionType === 'change_lead_status' || actionType === 'add_tag' || actionType === 'remove_tag')) {
          if (triggerData.lead_id) {
            const { data } = await supabase
              .from('leads')
              .select('*')
              .eq('id', triggerData.lead_id)
              .eq('workspace_id', workspaceId)
              .single()
            if (data) leadData = data as Record<string, unknown>
          }
        }

        currentOrder++
      } else if (step.step_type === 'delay') {
        const delayMs = computeDelayMs(step.delay_value, step.delay_unit)
        const resumeAt = new Date(Date.now() + delayMs)

        await logStep(supabase, executionId, step, 'success', {
          delay_value: step.delay_value,
          delay_unit: step.delay_unit,
          resume_at: resumeAt.toISOString(),
        })

        // Pause execution — cron will resume later
        await supabase
          .from('workflow_executions')
          .update({
            status: 'waiting',
            current_step: currentOrder,
            resume_at: resumeAt.toISOString(),
          })
          .eq('id', executionId)

        return // Exit — cron will call resumeExecution
      } else if (step.step_type === 'condition') {
        const conditionMet = evaluateCondition(step, leadData)

        await logStep(supabase, executionId, step, 'success', {
          field: step.condition_field,
          operator: step.condition_operator,
          expected: step.condition_value,
          actual: leadData[step.condition_field ?? ''],
          result: conditionMet,
        })

        if (conditionMet) {
          currentOrder = step.on_true_step ?? currentOrder + 1
        } else {
          // on_false_step = null means stop execution
          if (step.on_false_step === null) {
            break
          }
          currentOrder = step.on_false_step
        }
      } else {
        await logStep(supabase, executionId, step, 'skipped', undefined, `Unknown step type: ${step.step_type}`)
        currentOrder++
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      await logStep(supabase, executionId, step, 'failed', undefined, errorMessage)
      await markFailed(supabase, executionId, `Step ${currentOrder} failed: ${errorMessage}`)
      return
    }
  }

  // All steps completed
  await markCompleted(supabase, executionId, workflowId)
}

// ─── Condition evaluation ────────────────────────────────────────────────────

function evaluateCondition(step: WorkflowStep, leadData: Record<string, unknown>): boolean {
  const field = step.condition_field
  if (!field) return false

  const fieldValue = leadData[field]
  const expected = step.condition_value ?? ''

  switch (step.condition_operator) {
    case 'equals':
      return String(fieldValue) === expected
    case 'not_equals':
      return String(fieldValue) !== expected
    case 'contains':
      return String(fieldValue ?? '').includes(expected)
    case 'not_contains':
      return !String(fieldValue ?? '').includes(expected)
    default:
      return false
  }
}

// ─── Delay computation ───────────────────────────────────────────────────────

function computeDelayMs(value: number | null, unit: string | null): number {
  const v = value ?? 0
  switch (unit) {
    case 'minutes': return v * 60 * 1000
    case 'hours':   return v * 60 * 60 * 1000
    case 'days':    return v * 24 * 60 * 60 * 1000
    default:        return v * 60 * 1000 // default to minutes
  }
}

// ─── Template context builder ────────────────────────────────────────────────

async function buildTemplateContext(
  supabase: ReturnType<typeof createServiceClient>,
  workspaceId: string,
  triggerData: TriggerData
): Promise<TemplateContext> {
  const context: TemplateContext = {}

  // Fetch lead data
  if (triggerData.lead_id) {
    const { data: lead } = await supabase
      .from('leads')
      .select('first_name, last_name, email, phone')
      .eq('id', triggerData.lead_id)
      .eq('workspace_id', workspaceId)
      .single()

    if (lead) {
      context.lead = {
        first_name: lead.first_name,
        last_name: lead.last_name,
        email: lead.email,
        phone: lead.phone,
      }
    }
  }

  // Fetch call data
  if (triggerData.call_id) {
    const { data: call } = await supabase
      .from('calls')
      .select('scheduled_at, type')
      .eq('id', triggerData.call_id)
      .eq('workspace_id', workspaceId)
      .single()

    if (call) {
      context.call = {
        scheduled_at: call.scheduled_at,
        type: call.type,
      }
    }
  }

  // Fetch coach (workspace owner)
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('owner_id')
    .eq('id', workspaceId)
    .single()

  if (workspace?.owner_id) {
    const { data: coach } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', workspace.owner_id)
      .single()

    if (coach) {
      context.coach = { full_name: coach.full_name }
    }
  }

  return context
}

// ─── Logging & status helpers ────────────────────────────────────────────────

async function logStep(
  supabase: ReturnType<typeof createServiceClient>,
  executionId: string,
  step: WorkflowStep,
  status: 'success' | 'failed' | 'skipped',
  result?: Record<string, unknown>,
  errorMessage?: string
): Promise<void> {
  await supabase.from('workflow_execution_logs').insert({
    execution_id: executionId,
    step_id: step.id,
    step_order: step.step_order,
    step_type: step.step_type,
    action_type: step.action_type,
    status,
    result: result ?? {},
    error_message: errorMessage ?? null,
    executed_at: new Date().toISOString(),
  })
}

async function markFailed(
  supabase: ReturnType<typeof createServiceClient>,
  executionId: string,
  errorMessage: string
): Promise<void> {
  console.error(`[workflow-engine] Execution ${executionId} failed: ${errorMessage}`)
  await supabase
    .from('workflow_executions')
    .update({
      status: 'failed',
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq('id', executionId)
}

async function markCompleted(
  supabase: ReturnType<typeof createServiceClient>,
  executionId: string,
  workflowId: string
): Promise<void> {
  const now = new Date().toISOString()

  await supabase
    .from('workflow_executions')
    .update({
      status: 'completed',
      completed_at: now,
    })
    .eq('id', executionId)

  // Update workflow stats (RPC preferred for atomicity)
  const { error: rpcError } = await supabase.rpc('increment_workflow_execution_count', {
    p_workflow_id: workflowId,
    p_last_run_at: now,
  })

  if (rpcError?.code === '42883') {
    // RPC not found — do manual update
    const { data: workflow } = await supabase
      .from('workflows')
      .select('execution_count')
      .eq('id', workflowId)
      .single()

    if (workflow) {
      await supabase
        .from('workflows')
        .update({
          execution_count: (workflow.execution_count ?? 0) + 1,
          last_run_at: now,
        })
        .eq('id', workflowId)
    }
  }
}
