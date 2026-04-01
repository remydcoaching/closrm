import { NextResponse } from 'next/server'
import { compileBlocks } from '@/lib/email/compiler'

export async function POST(request: Request) {
  const body = await request.json()
  const html = compileBlocks(body.blocks || [], body.preview_text)
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
