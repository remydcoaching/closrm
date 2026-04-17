import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const homepage = new URL('/', request.url).toString()

  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('tracked_links')
      .select('id, lead_magnet_id, clicks_count, first_clicked_at, lead_magnets(url)')
      .eq('short_code', code)
      .maybeSingle()

    if (error || !data || !data.lead_magnets) {
      return NextResponse.redirect(homepage, 302)
    }

    const targetUrl = (data.lead_magnets as unknown as { url: string }).url
    const now = new Date().toISOString()

    // Fire-and-forget update (ne pas bloquer le redirect)
    supabase
      .from('tracked_links')
      .update({
        clicks_count: (data.clicks_count ?? 0) + 1,
        last_clicked_at: now,
        first_clicked_at: data.first_clicked_at ?? now,
      })
      .eq('id', data.id)
      .then(() => {})

    return NextResponse.redirect(targetUrl, 302)
  } catch {
    return NextResponse.redirect(homepage, 302)
  }
}
