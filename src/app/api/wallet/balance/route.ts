import { NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = createServiceClient()

    const { data: workspaceRaw } = await supabase
      .from('workspaces')
      .select(
        'wallet_balance_cents, wallet_auto_recharge_enabled, ' +
        'wallet_auto_recharge_amount_cents, wallet_auto_recharge_threshold_cents'
      )
      .eq('id', workspaceId)
      .single()

    const ws = workspaceRaw as unknown as Record<string, unknown> | null

    return NextResponse.json({
      balance_cents: (ws?.wallet_balance_cents as number | undefined) ?? 0,
      auto_recharge_enabled: (ws?.wallet_auto_recharge_enabled as boolean | undefined) ?? false,
      auto_recharge_amount_cents: (ws?.wallet_auto_recharge_amount_cents as number | undefined) ?? 1000,
      auto_recharge_threshold_cents: (ws?.wallet_auto_recharge_threshold_cents as number | undefined) ?? 200,
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
