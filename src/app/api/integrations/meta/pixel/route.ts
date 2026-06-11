/**
 * PATCH /api/integrations/meta/pixel
 *
 * Persist the workspace-level fallback Meta Pixel ID. This pixel is used
 * by the direct booking page (/book/<ws>/<cal>) which has no funnel, and
 * by CAPI when a lead has no funnel attribution.
 *
 * Body: { pixel_id: string | null }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export async function PATCH(req: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const body = (await req.json().catch(() => null)) as
      | { pixel_id?: string | null; capi_enabled?: boolean }
      | null

    const updates: Record<string, unknown> = {}

    if (body?.pixel_id !== undefined) {
      const pixelId = body.pixel_id?.toString().trim() || null
      // Sanity: Meta pixel IDs are 6-20 digit numbers.
      if (pixelId && !/^\d{6,20}$/.test(pixelId)) {
        return NextResponse.json({ error: 'Format de Pixel ID invalide (chiffres uniquement).' }, { status: 422 })
      }
      updates.meta_pixel_id = pixelId
    }

    if (typeof body?.capi_enabled === 'boolean') {
      updates.capi_enabled = body.capi_enabled
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Aucun champ à mettre à jour.' }, { status: 400 })
    }

    const { error } = await supabase
      .from('integrations')
      .update(updates)
      .eq('workspace_id', workspaceId)
      .eq('type', 'meta')

    if (error) {
      console.error('[meta/pixel] PATCH error', error)
      return NextResponse.json({ error: 'Erreur lors de la sauvegarde.' }, { status: 500 })
    }

    return NextResponse.json({ data: updates })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    console.error('[meta/pixel] unhandled error', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
