import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { updateProfileSchema } from '@/lib/validations/settings'

export async function GET() {
  try {
    const { userId, workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const [userResult, workspaceResult] = await Promise.all([
      supabase
        .from('users')
        .select('id, full_name, email, avatar_url')
        .eq('id', userId)
        .single(),
      supabase
        .from('workspaces')
        .select('id, name, timezone')
        .eq('id', workspaceId)
        .single(),
    ])

    if (userResult.error || workspaceResult.error) {
      return NextResponse.json({ error: 'Erreur chargement profil' }, { status: 500 })
    }

    return NextResponse.json({
      data: {
        user: userResult.data,
        workspace: workspaceResult.data,
      },
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await getWorkspaceId()
    const supabase = await createClient()

    const body = await request.json()
    const parsed = updateProfileSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('users')
      .update({ full_name: parsed.data.full_name })
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
