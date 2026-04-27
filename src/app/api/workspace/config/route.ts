import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createClient } from '@/lib/supabase/server'
import { mergeStatusConfig, mergeSourceConfig } from '@/lib/workspace/config-helpers'
import type { StatusConfig, SourceConfig } from '@/types'

const statusEntrySchema = z.object({
  key: z.enum(['nouveau', 'scripte', 'setting_planifie', 'no_show_setting', 'closing_planifie', 'no_show_closing', 'clos', 'dead']),
  label: z.string().min(1).max(60),
  color: z.string().regex(/^(#[0-9a-fA-F]{3,6}|var\(--[a-z0-9-]+\))$/),
  bg: z.string().min(1).max(80),
  visible: z.boolean(),
})

const sourceEntrySchema = z.object({
  key: z.enum(['facebook_ads', 'instagram_ads', 'follow_ads', 'formulaire', 'manuel', 'funnel']),
  label: z.string().min(1).max(60),
  color: z.string().regex(/^(#[0-9a-fA-F]{3,6}|var\(--[a-z0-9-]+\))$/),
  bg: z.string().min(1).max(80),
  visible: z.boolean(),
})

const patchSchema = z.object({
  status_config: z.array(statusEntrySchema).nullable().optional(),
  source_config: z.array(sourceEntrySchema).nullable().optional(),
})

export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('workspaces')
      .select('status_config, source_config')
      .eq('id', workspaceId)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Workspace introuvable' }, { status: 404 })
    }

    return NextResponse.json({
      data: {
        status_config: mergeStatusConfig(data.status_config as StatusConfig | null),
        source_config: mergeSourceConfig(data.source_config as SourceConfig | null),
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
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const body = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Payload invalide', details: parsed.error.issues }, { status: 400 })
    }

    const update: Record<string, unknown> = {}
    if (parsed.data.status_config !== undefined) update.status_config = parsed.data.status_config
    if (parsed.data.source_config !== undefined) update.source_config = parsed.data.source_config

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Rien à mettre à jour' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('workspaces')
      .update(update)
      .eq('id', workspaceId)
      .select('status_config, source_config')
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Mise à jour échouée' }, { status: 500 })
    }

    return NextResponse.json({
      data: {
        status_config: mergeStatusConfig(data.status_config as StatusConfig | null),
        source_config: mergeSourceConfig(data.source_config as SourceConfig | null),
      },
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
