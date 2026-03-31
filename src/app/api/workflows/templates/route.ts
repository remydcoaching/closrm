import { NextResponse } from 'next/server'
import { workflowTemplates } from '@/lib/workflows/templates'

export async function GET() {
  return NextResponse.json({ data: workflowTemplates })
}
