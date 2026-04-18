import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { publishPendingBatch } from '@/lib/social/publish'

export const maxDuration = 300

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const supabase = createServiceClient()
    const result = await publishPendingBatch(supabase, 10)
    return NextResponse.json(result)
  } catch (e) {
    console.error('[cron/social-posts] error:', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
