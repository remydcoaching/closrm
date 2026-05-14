import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { isR2Configured } from '@/lib/storage/r2-client'
import { deleteObject, pathBelongsToWorkspace } from '@/lib/storage/signing'

const bodySchema = z.object({ path: z.string().min(1) })

export async function DELETE(request: NextRequest) {
  try {
    if (!isR2Configured()) {
      return NextResponse.json({ error: 'R2 storage not configured' }, { status: 503 })
    }

    const { workspaceId } = await getWorkspaceId()
    const body = await request.json().catch(() => null)
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    if (!pathBelongsToWorkspace(parsed.data.path, workspaceId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await deleteObject(parsed.data.path)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[storage/object DELETE]', e)
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
