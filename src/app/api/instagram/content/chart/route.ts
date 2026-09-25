import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { loadContentMetrics } from '@/lib/instagram/content-data'

/**
 * Content page data: one entry per scanned content (latest Ciblage snapshot)
 * with views, Instagram engagement rate, identified likers/commenters and
 * leads reached — see src/lib/instagram/content-metrics.ts. `?days=` filters
 * on publish date. Content without views is returned with a null rate (the
 * chart skips it, the table still lists it) — never a fabricated value.
 */
export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const days = Number(request.nextUrl.searchParams.get('days'))
    const since = days > 0 ? new Date(Date.now() - days * 86_400_000).toISOString() : null
    const data = await loadContentMetrics(supabase, workspaceId, since)
    data.sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
