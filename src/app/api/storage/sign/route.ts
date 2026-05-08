import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { isR2Configured } from '@/lib/storage/r2-client'
import { signRead, pathBelongsToWorkspace } from '@/lib/storage/signing'

export async function GET(request: NextRequest) {
  try {
    if (!isR2Configured()) {
      return NextResponse.json({ error: 'R2 storage not configured' }, { status: 503 })
    }

    const { workspaceId } = await getWorkspaceId()
    const path = new URL(request.url).searchParams.get('path')

    if (!path) {
      return NextResponse.json({ error: 'Missing path' }, { status: 400 })
    }

    if (!pathBelongsToWorkspace(path, workspaceId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const url = await signRead(path)
    return NextResponse.json({ url })
  } catch (e) {
    console.error('[storage/sign]', e)
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
