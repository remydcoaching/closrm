import { createServiceClient } from '@/lib/supabase/service'
import type { ConsumeResult, ResourceType } from '@/types/billing'
import { estimateProviderCostCents } from './resources'

export interface CheckAndConsumeOptions {
  workspaceId: string
  resourceType: ResourceType
  quantity: number
  source: string
  metadata?: Record<string, unknown>
}

/**
 * Consomme une ressource : vérifie quota plan puis débite wallet si nécessaire.
 *
 * Usage :
 *   const result = await consumeResource({
 *     workspaceId, resourceType: 'email', quantity: 1,
 *     source: 'workflow', metadata: { workflow_id }
 *   })
 *   if (!result.allowed) throw new QuotaExceededError(result.error_message)
 *
 * Comportement :
 *   - Workspace `is_internal=true` : bypass complet, toujours allowed
 *   - Sinon : check quota plan, puis wallet pour l'overage
 *   - Atomique (pas de race condition) grâce à la fonction SQL
 */
export async function consumeResource(
  options: CheckAndConsumeOptions
): Promise<ConsumeResult> {
  const { workspaceId, resourceType, quantity, source, metadata } = options

  if (quantity <= 0) {
    return {
      allowed: false,
      billed_from: null,
      amount_cents_debited: 0,
      error_message: 'Quantity must be positive',
    }
  }

  const supabase = createServiceClient()
  const costCentsEur = estimateProviderCostCents(resourceType, quantity)

  const { data, error } = await supabase.rpc('consume_resource', {
    p_workspace_id: workspaceId,
    p_resource_type: resourceType,
    p_quantity: quantity,
    p_cost_cents_eur: costCentsEur,
    p_source: source,
    p_metadata: metadata ?? null,
  })

  if (error) {
    return {
      allowed: false,
      billed_from: null,
      amount_cents_debited: 0,
      error_message: `Billing RPC error: ${error.message}`,
    }
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row) {
    return {
      allowed: false,
      billed_from: null,
      amount_cents_debited: 0,
      error_message: 'Billing RPC returned no row',
    }
  }

  return {
    allowed: row.allowed,
    billed_from: row.billed_from,
    amount_cents_debited: row.amount_cents_debited ?? 0,
    error_message: row.error_message,
  }
}

/**
 * Crédite le wallet (recharge manuelle ou Stripe).
 */
export async function creditWallet(options: {
  workspaceId: string
  amountCents: number
  stripePaymentIntentId?: string
  initiatedBy?: 'user' | 'auto' | 'admin' | 'system'
  notes?: string
}): Promise<{ success: boolean; newBalanceCents: number; error?: string }> {
  const supabase = createServiceClient()

  const { data, error } = await supabase.rpc('credit_wallet', {
    p_workspace_id: options.workspaceId,
    p_amount_cents: options.amountCents,
    p_stripe_payment_intent_id: options.stripePaymentIntentId ?? null,
    p_initiated_by: options.initiatedBy ?? 'user',
    p_notes: options.notes ?? null,
  })

  if (error) {
    return { success: false, newBalanceCents: 0, error: error.message }
  }

  const row = Array.isArray(data) ? data[0] : data
  return {
    success: row?.success ?? false,
    newBalanceCents: row?.new_balance_cents ?? 0,
    error: row?.error_message ?? undefined,
  }
}
