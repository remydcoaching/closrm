import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

/**
 * The coach's own Instagram account used by Hiker features (header pill +
 * onboarding in ClosRM Desktop). Stored on workspaces.instagram_username
 * (migration 111). Until that column exists, falls back to the Meta-connected
 * account (ig_accounts) then to the last scanned account (discovery_runs).
 */
const HANDLE = /^[a-zA-Z0-9._]{1,30}$/

const putSchema = z.object({
  username: z
    .string()
    .trim()
    .transform((s) => s.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '').toLowerCase())
    .refine((s) => HANDLE.test(s), 'Pseudo Instagram invalide'),
})

export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data: ws, error } = await supabase.from('workspaces').select('instagram_username').eq('id', workspaceId).maybeSingle()
    if (!error && ws?.instagram_username) {
      return NextResponse.json({ data: { username: ws.instagram_username, source: 'workspace' } })
    }

    const { data: ig } = await supabase.from('ig_accounts').select('ig_username, is_connected').eq('workspace_id', workspaceId).maybeSingle()
    if (ig?.ig_username) return NextResponse.json({ data: { username: ig.ig_username, source: 'meta' } })

    const { data: run } = await supabase
      .from('discovery_runs')
      .select('instagram_username')
      .eq('workspace_id', workspaceId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (run?.instagram_username) return NextResponse.json({ data: { username: run.instagram_username, source: 'last_scan' } })

    return NextResponse.json({ data: null })
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
    const parsed = putSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Données invalides' }, { status: 400 })
    }
    const { error } = await supabase.from('workspaces').update({ instagram_username: parsed.data.username }).eq('id', workspaceId)
    if (error) {
      const missing = /column .*instagram_username|schema cache/i.test(error.message)
      return NextResponse.json(
        { error: missing ? 'Migration 105 non appliquée : impossible d’enregistrer le pseudo.' : error.message },
        { status: missing ? 503 : 500 },
      )
    }
    return NextResponse.json({ data: { username: parsed.data.username, source: 'workspace' } })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
