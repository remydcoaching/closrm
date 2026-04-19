import { NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createServiceClient } from '@/lib/supabase/service'
import { getCurrentUsage, getQuotaInfo } from '@/lib/billing/quota'
import type { BillingPlan, ResourceType } from '@/types/billing'

export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = createServiceClient()

    const { data: workspaceRaw } = await supabase
      .from('workspaces')
      .select(
        'id, plan_id, subscription_status, trial_ends_at, current_period_start, current_period_end, ' +
        'is_internal, seats_count, wallet_balance_cents, wallet_auto_recharge_enabled, ' +
        'wallet_auto_recharge_amount_cents, wallet_auto_recharge_threshold_cents'
      )
      .eq('id', workspaceId)
      .single()

    if (!workspaceRaw) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

    // Cast : les colonnes billing sont présentes en DB (migrations 038/040)
    // mais les types TS Supabase générés ne les connaissent pas encore.
    const workspace = workspaceRaw as unknown as { id: string } & Record<string, unknown>

    const { data: plan } = await supabase
      .from('billing_plans')
      .select('*')
      .eq('id', workspace.plan_id as string)
      .single<BillingPlan>()

    const usage = await getCurrentUsage(workspaceId)
    // V1 : on ne facture que les emails. IA = chacun sa clé Anthropic perso,
    // WhatsApp = pas encore implémenté. Réactiver quand Stripe sera en place.
    const resources: ResourceType[] = ['email']
    const quotas = await Promise.all(resources.map((r) => getQuotaInfo(workspaceId, r)))

    return NextResponse.json({
      workspace,
      plan,
      usage,
      quotas: quotas.filter(Boolean),
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    console.error('[API /billing/plan] Error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
