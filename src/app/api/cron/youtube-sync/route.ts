/**
 * Cron quotidien (03h30 UTC) — sync YouTube de tous les workspaces connectés.
 * Sécurisé via x-vercel-cron header OU un secret custom (CRON_SECRET) si présent.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getValidYoutubeAccessToken } from '@/lib/youtube/api'
import { syncYoutubeAccount } from '@/lib/youtube/sync'

export async function GET(request: NextRequest) {
  // Auth: Vercel cron injecte le header x-vercel-cron
  const isVercelCron = request.headers.get('x-vercel-cron') === '1'
  const secret = process.env.CRON_SECRET
  const providedSecret = request.headers.get('authorization')?.replace('Bearer ', '')
  const isAuthorized = isVercelCron || (secret && providedSecret === secret)
  if (!isAuthorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: integrations } = await supabase
    .from('integrations')
    .select('workspace_id')
    .eq('type', 'youtube')
    .eq('is_active', true)

  const results: Record<string, unknown> = {}
  for (const row of integrations ?? []) {
    try {
      const token = await getValidYoutubeAccessToken(row.workspace_id)
      if (!token) {
        results[row.workspace_id] = { error: 'no_token' }
        continue
      }
      const result = await syncYoutubeAccount(row.workspace_id, token)
      results[row.workspace_id] = result
    } catch (e) {
      results[row.workspace_id] = { error: (e as Error).message }
    }
  }

  return NextResponse.json({ ok: true, count: Object.keys(results).length, results })
}
