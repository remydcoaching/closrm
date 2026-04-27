'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { PmTask } from '@/types/pm'
import { TASK_ASSIGNEES, TASK_PRIORITIES } from '@/types/pm'

interface Props {
  task: PmTask
  onEdit: (task: PmTask) => void
}

export default function TaskCard({ task, onEdit }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', task },
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const assigneeMeta = TASK_ASSIGNEES.find(a => a.value === task.assignee)
  const priorityMeta = TASK_PRIORITIES.find(p => p.value === task.priority)

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-primary)',
        borderRadius: 8,
        padding: 12,
        cursor: 'grab',
        marginBottom: 8,
        userSelect: 'none',
      }}
      {...attributes}
      {...listeners}
      onDoubleClick={() => onEdit(task)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', flex: 1, lineHeight: 1.3 }}>
          {task.title}
        </h4>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit(task) }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
            fontSize: 16,
            padding: 0,
            lineHeight: 1,
          }}
          title="Éditer"
        >
          ⋯
        </button>
      </div>

      {task.description && (
        <p style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          marginBottom: 8,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {task.description}
        </p>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {assigneeMeta && (
          <span style={{
            background: assigneeMeta.color + '22',
            color: assigneeMeta.color,
            border: `1px solid ${assigneeMeta.color}55`,
            padding: '2px 8px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 500,
          }}>
            {assigneeMeta.label}
          </span>
        )}
        {priorityMeta && task.priority !== 'normal' && (
          <span style={{
            background: priorityMeta.color + '22',
            color: priorityMeta.color,
            border: `1px solid ${priorityMeta.color}55`,
            padding: '2px 8px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 500,
          }}>
            {priorityMeta.label}
          </span>
        )}
      </div>
    </div>
  )
}
