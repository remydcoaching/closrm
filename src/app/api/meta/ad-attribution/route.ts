import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { decrypt } from '@/lib/meta/encryption'
import { listAdObjects, type MetaCredentials, type MetaAdObject } from '@/lib/meta/client'

// In-memory cache: workspace_id -> { fetched_at, byId }
interface WorkspaceCache {
  fetched_at: number
  byId: Record<string, { id: string; name: string; type: 'campaign' | 'adset' | 'ad'; status: string }>
}
const CACHE = new Map<string, WorkspaceCache>()
const TTL_MS = 60 * 60 * 1000 // 1h

async function loadAllObjects(adAccountId: string, token: string): Promise<WorkspaceCache['byId']> {
  const byId: WorkspaceCache['byId'] = {}
  const levels: ('campaign' | 'adset' | 'ad')[] = ['campaign', 'adset', 'ad']
  for (const level of levels) {
    const objs: MetaAdObject[] = await listAdObjects(adAccountId, token, level)
    for (const o of objs) {
      byId[o.id] = { id: o.id, name: o.name, type: level, status: o.effective_status }
    }
  }
  return byId
}

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const idsParam = request.nextUrl.searchParams.get('ids') || ''
    const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean)
    if (ids.length === 0) return NextResponse.json({ data: {} })

    // Cache hit ?
    const now = Date.now()
    const cached = CACHE.get(workspaceId)
    if (cached && now - cached.fetched_at < TTL_MS) {
      const data: Record<string, { id: string; name: string; type: string; status: string } | null> = {}
      for (const id of ids) data[id] = cached.byId[id] ?? null
      return NextResponse.json({ data })
    }

    // Fetch Meta integration
    const supabase = await createClient()
    const { data: integration } = await supabase
      .from('integrations')
      .select('credentials_encrypted, is_active')
      .eq('workspace_id', workspaceId)
      .eq('type', 'meta')
      .eq('is_active', true)
      .maybeSingle()

    if (!integration?.credentials_encrypted) {
      return NextResponse.json({ data: {}, error: 'meta_not_connected' })
    }
    const credentials: MetaCredentials = JSON.parse(decrypt(integration.credentials_encrypted))
    if (!credentials.ad_account_id) {
      return NextResponse.json({ data: {}, error: 'needs_upgrade' })
    }

    const byId = await loadAllObjects(credentials.ad_account_id, credentials.user_access_token)
    CACHE.set(workspaceId, { fetched_at: now, byId })

    const data: Record<string, { id: string; name: string; type: string; status: string } | null> = {}
    for (const id of ids) data[id] = byId[id] ?? null
    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    console.error('ad-attribution error', err)
    return NextResponse.json({ data: {}, error: 'meta_error' })
  }
}
