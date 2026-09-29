// Small shared building blocks for the social + settings screens (modal shell
// reusing the leads modal classes, labelled field, transient notice banner).
import { useCallback, useEffect, useState } from 'react'
import '../leads/lead-create-modal.css'
import './social.css'

export function Modal({
  title,
  onClose,
  children,
  size,
}: {
  title: React.ReactNode
  onClose: () => void
  children: React.ReactNode
  size?: 'mid' | 'wide'
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="lead-create-overlay" onClick={onClose}>
      <div
        className={`lead-create-modal ${size === 'wide' ? 'soc-modal-wide' : size === 'mid' ? 'soc-modal-mid' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="soc-card-head" style={{ marginBottom: 'var(--space-4)' }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button type="button" className="ds-pill-button" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, action, children }: { label: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="soc-field">
      <div className="soc-label">
        <span>{label}</span>
        {action}
      </div>
      {children}
    </div>
  )
}

export type NoticeTone = 'success' | 'danger' | 'info' | 'warning'
export interface Notice {
  tone: NoticeTone
  text: string
}

/** Transient banner used instead of the web's toasts. */
export function useNotice(): [Notice | null, (text: string, tone?: NoticeTone) => void, () => void] {
  const [notice, setNotice] = useState<Notice | null>(null)
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 6000)
    return () => clearTimeout(t)
  }, [notice])
  const push = useCallback((text: string, tone: NoticeTone = 'success') => setNotice({ text, tone }), [])
  const clear = useCallback(() => setNotice(null), [])
  return [notice, push, clear]
}

export function NoticeBanner({ notice, onClose }: { notice: Notice | null; onClose: () => void }) {
  if (!notice) return null
  return (
    <div className={`soc-banner soc-banner--${notice.tone}`}>
      <span style={{ flex: 1 }}>{notice.text}</span>
      <button type="button" className="soc-link-btn" onClick={onClose}>
        Fermer
      </button>
    </div>
  )
}

/** Inline confirm used instead of window.confirm (two clicks). */
export function ConfirmButton({
  label,
  confirmLabel = 'Confirmer ?',
  onConfirm,
  className = 'ds-pill-button',
  disabled,
}: {
  label: string
  confirmLabel?: string
  onConfirm: () => void
  className?: string
  disabled?: boolean
}) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <button
      type="button"
      className={`${className} ${armed ? 'soc-danger-btn' : ''}`}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        if (armed) {
          setArmed(false)
          onConfirm()
        } else setArmed(true)
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  )
}
