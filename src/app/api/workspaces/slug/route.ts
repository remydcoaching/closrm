import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export async function GET(_request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('workspace_slugs')
      .select('slug')
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ slug: data?.slug ?? null })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const body = await request.json()
    const { slug } = body

    if (!slug || typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: 'Slug invalide (lettres minuscules, chiffres, tirets).' },
        { status: 400 }
      )
    }

    const { data: existing, error: checkError } = await supabase
      .from('workspace_slugs')
      .select('workspace_id')
      .eq('slug', slug)
      .neq('workspace_id', workspaceId)
      .maybeSingle()

    if (checkError) {
      return NextResponse.json({ error: checkError.message }, { status: 500 })
    }

    if (existing) {
      return NextResponse.json({ error: 'Ce slug est déjà pris.' }, { status: 409 })
    }

    const { data, error } = await supabase
      .from('workspace_slugs')
      .upsert({ workspace_id: workspaceId, slug }, { onConflict: 'workspace_id' })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ slug: data.slug })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
