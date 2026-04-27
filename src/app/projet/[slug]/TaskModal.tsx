'use client'

import { useEffect, useState } from 'react'
import type { PmTask, TaskAssignee, TaskPriority, TaskStatus } from '@/types/pm'
import { TASK_ASSIGNEES, TASK_PRIORITIES, TASK_STATUSES } from '@/types/pm'

export interface TaskFormValues {
  title: string
  description: string
  assignee: TaskAssignee
  status: TaskStatus
  priority: TaskPriority
}

interface Props {
  mode: 'create' | 'edit'
  initialTask?: PmTask
  defaultStatus?: TaskStatus
  onSubmit: (values: TaskFormValues) => Promise<void> | void
  onDelete?: () => Promise<void> | void
  onClose: () => void
}

export default function TaskModal({ mode, initialTask, defaultStatus, onSubmit, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(initialTask?.title ?? '')
  const [description, setDescription] = useState(initialTask?.description ?? '')
  const [assignee, setAssignee] = useState<TaskAssignee>(initialTask?.assignee ?? null)
  const [status, setStatus] = useState<TaskStatus>(initialTask?.status ?? defaultStatus ?? 'todo')
  const [priority, setPriority] = useState<TaskPriority>(initialTask?.priority ?? 'normal')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [onClose])

  async function submit() {
    if (!title.trim()) return
    setSubmitting(true)
    try {
      await onSubmit({ title: title.trim(), description: description.trim(), assignee, status, priority })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-primary)',
          borderRadius: 12,
          width: '100%',
          maxWidth: 520,
          padding: 24,
          color: 'var(--text-primary)',
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
          {mode === 'create' ? 'Nouvelle tâche' : 'Modifier la tâche'}
        </h2>

        <Field label="Titre">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex : Refacto du module emails"
            style={inputStyle}
            autoFocus
          />
        </Field>

        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optionnel"
            rows={3}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Assigné">
            <select value={assignee ?? ''} onChange={(e) => setAssignee((e.target.value || null) as TaskAssignee)} style={inputStyle}>
              <option value="">Personne</option>
              {TASK_ASSIGNEES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </Field>
          <Field label="Priorité">
            <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} style={inputStyle}>
              {TASK_PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Statut">
          <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} style={inputStyle}>
            {TASK_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
          {mode === 'edit' && onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              style={{
                background: 'transparent',
                color: '#EF4444',
                border: '1px solid #EF444455',
                padding: '8px 16px',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Supprimer
            </button>
          ) : <span />}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-primary)',
                padding: '8px 16px',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting || !title.trim()}
              style={{
                background: 'var(--color-primary)',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 6,
                cursor: submitting ? 'wait' : 'pointer',
                fontSize: 14,
                fontWeight: 600,
                opacity: submitting || !title.trim() ? 0.6 : 1,
              }}
            >
              {mode === 'create' ? 'Créer' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-input)',
  border: '1px solid var(--border-primary)',
  borderRadius: 6,
  padding: '8px 10px',
  fontSize: 14,
  color: 'var(--text-primary)',
  outline: 'none',
}
