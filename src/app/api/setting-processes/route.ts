import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { hasPermission } from '@/lib/permissions'
import { createSettingProcessSchema } from '@/lib/validations/setting-processes'

export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data: processes, error } = await supabase
      .from('setting_processes')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })

    return NextResponse.json({ data: processes ?? [] })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId, role } = await getWorkspaceId()
    if (!hasPermission(role, 'manageProcesses')) {
      return NextResponse.json({ error: 'Action réservée aux administrateurs' }, { status: 403 })
    }
    const supabase = await createClient()

    const body = await request.json()
    const parsed = createSettingProcessSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { data: process, error } = await supabase
      .from('setting_processes')
      .insert({ workspace_id: workspaceId, ...parsed.data })
      .select()
      .single()

    if (error || !process) {
      return NextResponse.json({ error: 'Impossible de créer le process' }, { status: 500 })
    }

    return NextResponse.json({ data: process })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
