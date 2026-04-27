'use client'

import { useMemo, useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { PmBoard, PmTask, TaskAssignee, TaskStatus } from '@/types/pm'
import { TASK_ASSIGNEES, TASK_STATUSES } from '@/types/pm'
import TaskCard from './TaskCard'
import TaskModal, { TaskFormValues } from './TaskModal'

interface Props {
  slug: string
  board: PmBoard
  initialTasks: PmTask[]
}

type AssigneeFilter = 'all' | Exclude<TaskAssignee, null>

const COLUMN_BG: Record<TaskStatus, string> = {
  todo: 'rgba(160,160,160,0.06)',
  in_progress: 'rgba(59,130,246,0.08)',
  done: 'rgba(0,200,83,0.08)',
  blocked: 'rgba(239,68,68,0.08)',
}

export default function KanbanClient({ slug, board, initialTasks }: Props) {
  const [tasks, setTasks] = useState<PmTask[]>(initialTasks)
  const [filter, setFilter] = useState<AssigneeFilter>('all')
  const [modal, setModal] = useState<
    | { mode: 'create'; defaultStatus: TaskStatus }
    | { mode: 'edit'; task: PmTask }
    | null
  >(null)
  const [activeTask, setActiveTask] = useState<PmTask | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const filteredTasks = useMemo(() => {
    if (filter === 'all') return tasks
    return tasks.filter(t => t.assignee === filter || t.assignee === 'both')
  }, [tasks, filter])

  const tasksByStatus = useMemo(() => {
    const map: Record<TaskStatus, PmTask[]> = { todo: [], in_progress: [], done: [], blocked: [] }
    for (const t of filteredTasks) map[t.status].push(t)
    for (const status of Object.keys(map) as TaskStatus[]) {
      map[status].sort((a, b) => a.position - b.position)
    }
    return map
  }, [filteredTasks])

  function findTask(id: string) {
    return tasks.find(t => t.id === id) ?? null
  }

  function findContainer(id: string): TaskStatus | null {
    if ((TASK_STATUSES as { value: TaskStatus }[]).some(s => s.value === id)) return id as TaskStatus
    const t = findTask(id)
    return t ? t.status : null
  }

  function handleDragStart(e: DragStartEvent) {
    const t = findTask(String(e.active.id))
    if (t) setActiveTask(t)
  }

  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    if (activeId === overId) return

    const activeContainer = findContainer(activeId)
    const overContainer = findContainer(overId)
    if (!activeContainer || !overContainer || activeContainer === overContainer) return

    setTasks(prev => prev.map(t => (t.id === activeId ? { ...t, status: overContainer } : t)))
  }

  async function handleDragEnd(e: DragEndEvent) {
    setActiveTask(null)
    const { active, over } = e
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)

    const activeContainer = findContainer(activeId)
    const overContainer = findContainer(overId)
    if (!activeContainer || !overContainer) return

    const overTasks = tasks.filter(t => t.status === overContainer).sort((a, b) => a.position - b.position)
    const overIsColumn = overId === overContainer
    const overIndex = overIsColumn ? overTasks.length : overTasks.findIndex(t => t.id === overId)

    const moved = tasks.find(t => t.id === activeId)
    if (!moved) return

    const without = overTasks.filter(t => t.id !== activeId)
    const insertAt = Math.max(0, Math.min(overIndex, without.length))
    const reordered = [...without.slice(0, insertAt), { ...moved, status: overContainer }, ...without.slice(insertAt)]

    setTasks(prev => {
      const others = prev.filter(t => t.status !== overContainer && t.id !== activeId)
      const renumbered = reordered.map((t, i) => ({ ...t, position: i + 1 }))
      return [...others, ...renumbered]
    })

    const newPosition = insertAt + 1
    try {
      const res = await fetch(`/api/pm/${slug}/tasks/${activeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: overContainer, position: newPosition }),
      })
      if (!res.ok) throw new Error('Update failed')
    } catch {
      setTasks(initialTasks)
    }
  }

  async function handleCreate(values: TaskFormValues) {
    const res = await fetch(`/api/pm/${slug}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    if (!res.ok) return
    const task = (await res.json()) as PmTask
    setTasks(prev => [...prev, task])
    setModal(null)
  }

  async function handleUpdate(values: TaskFormValues) {
    if (modal?.mode !== 'edit') return
    const id = modal.task.id
    const res = await fetch(`/api/pm/${slug}/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    if (!res.ok) return
    const task = (await res.json()) as PmTask
    setTasks(prev => prev.map(t => (t.id === id ? task : t)))
    setModal(null)
  }

  async function handleDelete() {
    if (modal?.mode !== 'edit') return
    const id = modal.task.id
    if (!confirm('Supprimer cette tâche ?')) return
    const res = await fetch(`/api/pm/${slug}/tasks/${id}`, { method: 'DELETE' })
    if (!res.ok) return
    setTasks(prev => prev.filter(t => t.id !== id))
    setModal(null)
  }

  const totals = useMemo(() => ({
    total: tasks.length,
    done: tasks.filter(t => t.status === 'done').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
  }), [tasks])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <header style={{
        padding: '20px 32px',
        borderBottom: '1px solid var(--border-primary)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{board.name}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {totals.total} tâche{totals.total > 1 ? 's' : ''} · {totals.inProgress} en cours · {totals.done} terminée{totals.done > 1 ? 's' : ''}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{
            display: 'flex',
            gap: 4,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-primary)',
            borderRadius: 8,
            padding: 4,
          }}>
            {(['all', 'pierre', 'remy'] as AssigneeFilter[]).map(f => {
              const meta = f === 'all' ? { label: 'Tous', color: 'var(--text-primary)' } : TASK_ASSIGNEES.find(a => a.value === f)!
              const active = filter === f
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  style={{
                    background: active ? 'var(--bg-active)' : 'transparent',
                    color: active ? 'var(--color-primary)' : 'var(--text-secondary)',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  {meta.label}
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => setModal({ mode: 'create', defaultStatus: 'todo' })}
            style={{
              background: 'var(--color-primary)',
              color: '#fff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + Nouvelle tâche
          </button>
        </div>
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(260px, 1fr))',
          gap: 16,
          padding: 24,
          overflowX: 'auto',
        }}>
          {TASK_STATUSES.map(({ value, label }) => (
            <KanbanColumn
              key={value}
              status={value}
              label={label}
              tasks={tasksByStatus[value]}
              onAddInColumn={(s) => setModal({ mode: 'create', defaultStatus: s })}
              onEditTask={(t) => setModal({ mode: 'edit', task: t })}
              bg={COLUMN_BG[value]}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask && <TaskCard task={activeTask} onEdit={() => {}} />}
        </DragOverlay>
      </DndContext>

      {modal?.mode === 'create' && (
        <TaskModal
          mode="create"
          defaultStatus={modal.defaultStatus}
          onSubmit={handleCreate}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.mode === 'edit' && (
        <TaskModal
          mode="edit"
          initialTask={modal.task}
          onSubmit={handleUpdate}
          onDelete={handleDelete}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

function KanbanColumn({
  status,
  label,
  tasks,
  onAddInColumn,
  onEditTask,
  bg,
}: {
  status: TaskStatus
  label: string
  tasks: PmTask[]
  onAddInColumn: (s: TaskStatus) => void
  onEditTask: (t: PmTask) => void
  bg: string
}) {
  const { setNodeRef } = useSortable({ id: status, data: { type: 'column', status } })
  return (
    <div
      ref={setNodeRef}
      style={{
        background: bg,
        border: '1px solid var(--border-primary)',
        borderRadius: 12,
        padding: 12,
        minHeight: 200,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary)' }}>
          {label} <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>· {tasks.length}</span>
        </h3>
        <button
          type="button"
          onClick={() => onAddInColumn(status)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
            padding: 0,
          }}
          title="Ajouter ici"
        >
          +
        </button>
      </div>

      <SortableContext id={status} items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        {tasks.map(t => <TaskCard key={t.id} task={t} onEdit={onEditTask} />)}
      </SortableContext>

      {tasks.length === 0 && (
        <div style={{
          padding: 20,
          textAlign: 'center',
          fontSize: 12,
          color: 'var(--text-tertiary)',
          border: '1px dashed var(--border-primary)',
          borderRadius: 8,
        }}>
          Aucune tâche
        </div>
      )}
    </div>
  )
}
