import { NextRequest, NextResponse } from 'next/server'
import { getBoardBySlug, updateTask, deleteTask } from '@/lib/pm/queries'
import type { TaskAssignee, TaskPriority, TaskStatus } from '@/types/pm'

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await ctx.params
  const board = await getBoardBySlug(slug)
  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 })

  let body: {
    title?: string
    description?: string | null
    assignee?: TaskAssignee
    status?: TaskStatus
    priority?: TaskPriority
    position?: number
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    const task = await updateTask(id, board.id, body)
    return NextResponse.json(task)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await ctx.params
  const board = await getBoardBySlug(slug)
  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 })

  try {
    await deleteTask(id, board.id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
