import { createServiceClient } from '@/lib/supabase/service'
import type { PmBoard, PmTask, TaskStatus, TaskAssignee, TaskPriority } from '@/types/pm'

function client() {
  return createServiceClient()
}

export async function getBoardBySlug(slug: string): Promise<PmBoard | null> {
  const { data, error } = await client().from('pm_boards').select('*').eq('slug', slug).maybeSingle()
  if (error) throw new Error(error.message)
  return data as PmBoard | null
}

export async function getTasksForBoard(boardId: string): Promise<PmTask[]> {
  const { data, error } = await client()
    .from('pm_tasks')
    .select('*')
    .eq('board_id', boardId)
    .order('position', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as PmTask[]
}

export interface CreateTaskInput {
  title: string
  description?: string | null
  assignee?: TaskAssignee
  status?: TaskStatus
  priority?: TaskPriority
}

export async function createTask(boardId: string, input: CreateTaskInput): Promise<PmTask> {
  const status = input.status ?? 'todo'
  const { data: maxPos } = await client()
    .from('pm_tasks')
    .select('position')
    .eq('board_id', boardId)
    .eq('status', status)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  const position = ((maxPos?.position as number | undefined) ?? 0) + 1

  const { data, error } = await client()
    .from('pm_tasks')
    .insert({
      board_id: boardId,
      title: input.title,
      description: input.description ?? null,
      assignee: input.assignee ?? null,
      status,
      priority: input.priority ?? 'normal',
      position,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as PmTask
}

export interface UpdateTaskInput {
  title?: string
  description?: string | null
  assignee?: TaskAssignee
  status?: TaskStatus
  priority?: TaskPriority
  position?: number
}

export async function updateTask(taskId: string, boardId: string, input: UpdateTaskInput): Promise<PmTask> {
  const { data, error } = await client()
    .from('pm_tasks')
    .update(input)
    .eq('id', taskId)
    .eq('board_id', boardId)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as PmTask
}

export async function deleteTask(taskId: string, boardId: string): Promise<void> {
  const { error } = await client().from('pm_tasks').delete().eq('id', taskId).eq('board_id', boardId)
  if (error) throw new Error(error.message)
}
