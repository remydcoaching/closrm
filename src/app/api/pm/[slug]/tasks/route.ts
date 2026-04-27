import { NextRequest, NextResponse } from 'next/server'
import { getBoardBySlug, createTask } from '@/lib/pm/queries'
import type { TaskAssignee, TaskPriority, TaskStatus } from '@/types/pm'

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const board = await getBoardBySlug(slug)
  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 })

  let body: {
    title?: string
    description?: string
    assignee?: TaskAssignee
    status?: TaskStatus
    priority?: TaskPriority
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.title || typeof body.title !== 'string' || body.title.trim().length === 0) {
    return NextResponse.json({ error: 'Title required' }, { status: 400 })
  }

  try {
    const task = await createTask(board.id, {
      title: body.title.trim(),
      description: body.description ?? null,
      assignee: body.assignee ?? null,
      status: body.status,
      priority: body.priority,
    })
    return NextResponse.json(task)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
