import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { isR2Configured } from '@/lib/storage/r2-client'
import { buildR2Path, signUpload, type R2Target } from '@/lib/storage/signing'

const MAX_BYTES = 250 * 1024 * 1024 // 250 MB — match historic Supabase limit

const bodySchema = z.object({
  post_id: z.string().uuid(),
  target: z.enum(['final', 'media', 'rush']),
  filename: z.string().min(1).max(255),
  content_type: z.string().min(1).max(100),
  content_length: z.number().int().positive().max(MAX_BYTES),
})

export async function POST(request: NextRequest) {
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

    const { post_id, target, filename, content_type, content_length } = parsed.data

    const path = buildR2Path({
      workspaceId,
      postId: post_id,
      target: target as R2Target,
      filename,
    })

    const upload_url = await signUpload({
      path,
      contentType: content_type,
      contentLength: content_length,
    })

    return NextResponse.json({ upload_url, path })
  } catch (e) {
    console.error('[storage/upload-url]', e)
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
