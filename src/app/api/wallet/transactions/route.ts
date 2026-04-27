import { NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error
    return NextResponse.json({ transactions: data ?? [] })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
