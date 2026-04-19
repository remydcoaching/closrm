import { NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  try {
    await getWorkspaceId()
    const supabase = createServiceClient()

    const { data: plans, error } = await supabase
      .from('billing_plans')
      .select('*')
      .eq('is_public', true)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) throw error

    return NextResponse.json({ plans })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
