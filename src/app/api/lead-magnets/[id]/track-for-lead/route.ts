import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { trackForLeadSchema } from '@/lib/validations/lead-magnets'
import { generateShortCode } from '@/lib/lead-magnets/shortcode'

const MAX_RETRIES = 3

function getAppUrl(request: NextRequest): string {
  // Toujours utiliser l'origin de la requête — gère localhost (n'importe quel port),
  // preview Vercel, et prod custom domain sans config.
  return request.nextUrl.origin
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadMagnetId } = await params
    const { workspaceId } = await getWorkspaceId()
    const body = await request.json()
    const { lead_id } = trackForLeadSchema.parse(body)
    const supabase = await createClient()
    const appUrl = getAppUrl(request)

    const [{ data: lm }, { data: lead }] = await Promise.all([
      supabase.from('lead_magnets').select('id').eq('id', leadMagnetId).eq('workspace_id', workspaceId).single(),
      supabase.from('leads').select('id').eq('id', lead_id).eq('workspace_id', workspaceId).single(),
    ])
    if (!lm || !lead) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { data: existing } = await supabase
      .from('tracked_links')
      .select('short_code')
      .eq('lead_magnet_id', leadMagnetId)
      .eq('lead_id', lead_id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({
        short_code: existing.short_code,
        full_url: `${appUrl}/c/${existing.short_code}`,
      })
    }

    let attempt = 0
    while (attempt < MAX_RETRIES) {
      const short_code = generateShortCode()
      const { data, error } = await supabase
        .from('tracked_links')
        .insert({
          workspace_id: workspaceId,
          lead_magnet_id: leadMagnetId,
          lead_id,
          short_code,
        })
        .select('short_code')
        .single()
      if (!error && data) {
        return NextResponse.json({
          short_code: data.short_code,
          full_url: `${appUrl}/c/${data.short_code}`,
        }, { status: 201 })
      }
      if (error && error.code === '23505') {
        attempt++
        continue
      }
      throw error
    }
    return NextResponse.json({ error: 'Shortcode generation failed' }, { status: 500 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
