import { createServiceClient } from '@/lib/supabase/service'
import type { BillingPlan, QuotaInfo, ResourceType, WorkspaceCurrentUsage } from '@/types/billing'

/**
 * Calcule les infos de quota pour un workspace et une ressource donnée.
 * Agnostique des plans : fonctionne pour tous les plans de billing_plans.
 */
export async function getQuotaInfo(
  workspaceId: string,
  resourceType: ResourceType
): Promise<QuotaInfo | null> {
  const supabase = createServiceClient()

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, plan_id, seats_count, current_period_start, is_internal')
    .eq('id', workspaceId)
    .single()

  if (!workspace || !workspace.plan_id) return null

  if (workspace.is_internal) {
    return {
      plan_id: 'internal',
      resource_type: resourceType,
      quota_total: Number.MAX_SAFE_INTEGER,
      quota_used: 0,
      quota_remaining: Number.MAX_SAFE_INTEGER,
      fair_use_cap: null,
      overage_price_cents_per_1k: 0,
    }
  }

  const { data: plan } = await supabase
    .from('billing_plans')
    .select('*')
    .eq('id', workspace.plan_id)
    .single<BillingPlan>()

  if (!plan) return null

  const quotaBase =
    resourceType === 'email'
      ? plan.quota_emails
      : resourceType === 'ai_tokens'
        ? plan.quota_ai_tokens
        : resourceType === 'whatsapp'
          ? plan.quota_whatsapp
          : 0

  const quotaPerSeat =
    resourceType === 'email'
      ? plan.quota_emails_per_seat
      : resourceType === 'ai_tokens'
        ? plan.quota_ai_tokens_per_seat
        : resourceType === 'whatsapp'
          ? plan.quota_whatsapp_per_seat
          : 0

  const overagePrice =
    resourceType === 'email'
      ? plan.overage_email_price_cents_per_1k
      : resourceType === 'ai_tokens'
        ? plan.overage_ai_tokens_price_cents_per_1k
        : resourceType === 'whatsapp'
          ? plan.overage_whatsapp_price_cents_per_1k
          : 0

  const quotaTotal =
    Number(quotaBase) + Number(quotaPerSeat) * Math.max(workspace.seats_count - 1, 0)

  const { data: usedRow } = await supabase
    .from('usage_events')
    .select('quantity')
    .eq('workspace_id', workspaceId)
    .eq('resource_type', resourceType)
    .eq('billing_period_start', workspace.current_period_start)
    .eq('billed_from', 'quota')

  const quotaUsed = (usedRow ?? []).reduce((sum, row) => sum + Number(row.quantity), 0)

  return {
    plan_id: workspace.plan_id,
    resource_type: resourceType,
    quota_total: quotaTotal,
    quota_used: quotaUsed,
    quota_remaining: Math.max(quotaTotal - quotaUsed, 0),
    fair_use_cap: resourceType === 'email' ? plan.fair_use_emails_cap : null,
    overage_price_cents_per_1k: overagePrice,
  }
}

/**
 * Récupère un résumé complet de la consommation de la période en cours.
 */
export async function getCurrentUsage(
  workspaceId: string
): Promise<WorkspaceCurrentUsage | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('workspace_current_usage')
    .select('*')
    .eq('workspace_id', workspaceId)
    .single<WorkspaceCurrentUsage>()
  return data
}
