// Quick capture: N anywhere in the app (or the top bar's « + Noter ») opens a
// one-line « Nouvel objectif »: type, Enter. It lands in Idées by default, or
// today / this week — no need to open Objectifs.
import { useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../lib/api-client'
import { invalidate } from '../lib/query-cache'
import { periodStart, todayISO, type Horizon } from '../features/goals/periods'
import '../features/leads/lead-create-modal.css'
import './quick-goal.css'

type Where = 'inbox' | 'day' | 'week'

const WHERE: { key: Where; label: string }[] = [
  { key: 'inbox', label: 'Idées' },
  { key: 'day', label: 'Aujourd’hui' },
  { key: 'week', label: 'Cette semaine' },
]

function isTyping(): boolean {
  const el = document.activeElement as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
}

/** The top bar button; the N shortcut is registered by <QuickGoalHost />. */
export function QuickGoalButton() {
  return (
    <button type="button" className="quick-goal-trigger" onClick={() => window.dispatchEvent(new Event('closrm:quick-goal'))} title="Noter un objectif ou une idée (N)">
      + Noter <kbd>N</kbd>
    </button>
  )
}

export function QuickGoalHost() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'n' && e.key !== 'N') return
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping()) return
      e.preventDefault()
      setOpen(true)
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('closrm:quick-goal', onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('closrm:quick-goal', onOpen)
    }
  }, [])

  return open ? <QuickGoalModal onClose={() => setOpen(false)} /> : null
}

function QuickGoalModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [where, setWhere] = useState<Where>('inbox')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function save() {
    const t = title.trim()
    if (!t || saving) return
    setSaving(true)
    setError(null)
    const today = todayISO()
    const horizon: Horizon = where
    const period_start = where === 'inbox' ? null : where === 'day' ? today : periodStart('week', today)
    try {
      await api.post('/api/goals', { title: t, horizon, period_start })
      invalidate('goals:')
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible d’ajouter cet objectif')
      setSaving(false)
    }
  }

  return (
    <div className="lead-create-overlay" onClick={onClose}>
      <div className="lead-create-modal quick-goal-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Nouvel objectif">
        <input
          ref={inputRef}
          className="quick-goal-input"
          value={title}
          maxLength={500}
          placeholder="Nouvel objectif ou idée…"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save()
          }}
        />
        <div className="quick-goal-row">
          <div className="quick-goal-where" role="radiogroup" aria-label="Où le ranger">
            {WHERE.map((w) => (
              <button
                key={w.key}
                type="button"
                role="radio"
                aria-checked={where === w.key}
                className={`quick-goal-chip${where === w.key ? ' quick-goal-chip--on' : ''}`}
                onClick={() => {
                  setWhere(w.key)
                  inputRef.current?.focus()
                }}
              >
                {w.label}
              </button>
            ))}
          </div>
          <span className="quick-goal-hint">Entrée pour ajouter · Échap pour fermer</span>
        </div>
        {error && <div className="quick-goal-error">{error}</div>}
      </div>
    </div>
  )
}
