import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { connectIntegrationSchema } from '@/lib/validations/integrations'
import { encrypt } from '@/lib/crypto'

const ALL_TYPES = ['google_calendar', 'meta', 'whatsapp', 'stripe', 'telegram'] as const

export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data: integrations, error } = await supabase
      .from('integrations')
      .select('id, workspace_id, type, connected_at, is_active')
      .eq('workspace_id', workspaceId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Build response with all 5 types, filling defaults for missing ones
    const integrationMap = new Map(
      (integrations ?? []).map((i) => [i.type, i])
    )

    const data = ALL_TYPES.map((type) => {
      const existing = integrationMap.get(type)
      if (existing) {
        return {
          id: existing.id,
          type: existing.type,
          is_active: existing.is_active,
          connected_at: existing.connected_at,
        }
      }
      return {
        id: null,
        type,
        is_active: false,
        connected_at: null,
      }
    })

    return NextResponse.json({ data })
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
    const parsed = connectIntegrationSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const encryptedCredentials = encrypt(JSON.stringify(parsed.data.credentials))

    const { data, error } = await supabase
      .from('integrations')
      .upsert(
        {
          workspace_id: workspaceId,
          type: parsed.data.type,
          credentials_encrypted: encryptedCredentials,
          is_active: true,
          connected_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id,type' }
      )
      .select('id, type, is_active, connected_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
