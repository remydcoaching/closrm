import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { syncAll } from '@/lib/instagram/sync'

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Get all connected IG accounts
  const { data: accounts, error } = await supabase
    .from('ig_accounts')
    .select('workspace_id, ig_user_id, access_token, page_id, page_access_token')
    .eq('is_connected', true)

  if (error || !accounts?.length) {
    return NextResponse.json({ synced: 0 })
  }

  let synced = 0
  let errors = 0

  for (const account of accounts) {
    try {
      await syncAll({
        supabase,
        workspaceId: account.workspace_id,
        accessToken: account.access_token,
        igUserId: account.ig_user_id,
        pageId: account.page_id ?? undefined,
        pageAccessToken: account.page_access_token ?? undefined,
      })
      synced++
    } catch (err) {
      console.error(`[Cron instagram-sync] Failed workspace ${account.workspace_id}:`, err)
      errors++
    }
  }

  return NextResponse.json({ synced, errors })
}
