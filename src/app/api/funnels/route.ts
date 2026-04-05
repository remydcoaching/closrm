import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { FUNNEL_TEMPLATES } from '@/lib/funnels/templates'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('funnels')
      .select('*, funnel_pages(count)')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const funnels = (data ?? []).map((f) => ({
      ...f,
      page_count: f.funnel_pages?.[0]?.count ?? 0,
      funnel_pages: undefined,
    }))

    return NextResponse.json({ data: funnels })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const body = await request.json()
    const { name, slug, description, template_id } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
    }

    let funnelSlug = slug ? slugify(slug) : slugify(name)

    // Check for duplicate slug and add suffix if needed
    const { data: existing } = await supabase
      .from('funnels')
      .select('slug')
      .eq('workspace_id', workspaceId)
      .like('slug', `${funnelSlug}%`)

    if (existing && existing.length > 0) {
      const existingSlugs = new Set(existing.map(f => f.slug))
      if (existingSlugs.has(funnelSlug)) {
        let i = 2
        while (existingSlugs.has(`${funnelSlug}-${i}`)) i++
        funnelSlug = `${funnelSlug}-${i}`
      }
    }

    // Create the funnel
    const { data: funnel, error: funnelError } = await supabase
      .from('funnels')
      .insert({
        workspace_id: workspaceId,
        name: name.trim(),
        slug: funnelSlug,
        description: description || null,
        status: 'draft',
      })
      .select()
      .single()

    if (funnelError) {
      return NextResponse.json({ error: funnelError.message }, { status: 500 })
    }

    // If template_id provided, create pages from template
    if (template_id) {
      const template = FUNNEL_TEMPLATES.find((t) => t.id === template_id)
      if (template) {
        const pages = template.pages.map((page, index) => ({
          funnel_id: funnel.id,
          workspace_id: workspaceId,
          name: page.name,
          slug: page.slug,
          page_order: index,
          blocks: page.blocks,
          is_published: false,
        }))

        const { error: pagesError } = await supabase
          .from('funnel_pages')
          .insert(pages)

        if (pagesError) {
          // Rollback funnel creation
          await supabase.from('funnels').delete().eq('id', funnel.id)
          return NextResponse.json({ error: pagesError.message }, { status: 500 })
        }
      }
    }

    return NextResponse.json({ data: funnel }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
