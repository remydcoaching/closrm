import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { PUSH_TYPES, type PushType } from '@/lib/push/send-to-workspace'

// GET — toutes les préférences du user courant.
// Defaults : si pas de row pour un type, considéré enabled=true côté
// client (le UI montre tous les types avec un toggle).
export async function GET() {
  try {
    const { userId } = await getWorkspaceId()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('type, enabled')
      .eq('user_id', userId)
    if (error) throw error
    return NextResponse.json({ data: data ?? [] })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

const patchSchema = z.object({
  type: z.string().min(1).max(64),
  enabled: z.boolean(),
})

// PATCH — toggle un type. Upsert sur (user_id, type).
export async function PATCH(request: NextRequest) {
  try {
    const { userId, workspaceId } = await getWorkspaceId()
    const body = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    // Sanity check : type doit être dans la liste connue
    const known = PUSH_TYPES.map((p) => p.type as string)
    if (!known.includes(parsed.data.type)) {
      return NextResponse.json({ error: 'Type inconnu' }, { status: 400 })
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from('notification_preferences')
      .upsert(
        {
          user_id: userId,
          workspace_id: workspaceId,
          type: parsed.data.type as PushType,
          enabled: parsed.data.enabled,
        },
        { onConflict: 'user_id,type' },
      )
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
