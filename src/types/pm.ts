export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked'
export type TaskAssignee = 'pierre' | 'remy' | 'both' | null
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface PmBoard {
  id: string
  slug: string
  name: string
  created_at: string
  updated_at: string
}

export interface PmTask {
  id: string
  board_id: string
  title: string
  description: string | null
  assignee: TaskAssignee
  status: TaskStatus
  priority: TaskPriority
  position: number
  created_at: string
  updated_at: string
  completed_at: string | null
}

export const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'À faire' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'done', label: 'Terminé' },
  { value: 'blocked', label: 'Bloqué' },
]

export const TASK_ASSIGNEES: { value: Exclude<TaskAssignee, null>; label: string; color: string }[] = [
  { value: 'pierre', label: 'Pierre', color: '#3B82F6' },
  { value: 'remy', label: 'Rémy', color: '#A855F7' },
  { value: 'both', label: 'Les deux', color: '#F59E0B' },
]

export const TASK_PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Basse', color: '#6B7280' },
  { value: 'normal', label: 'Normale', color: '#9CA3AF' },
  { value: 'high', label: 'Haute', color: '#F59E0B' },
  { value: 'urgent', label: 'Urgente', color: '#EF4444' },
]
