'use client'

interface ConfirmModalProps {
  title: string
  message: string
  confirmLabel?: string
  confirmDanger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirmer',
  confirmDanger = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
        borderRadius: 14, padding: '28px 28px 24px', width: '100%', maxWidth: 380,
        boxShadow: '0 24px 64px var(--shadow-dropdown)',
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>{title}</h3>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '0 0 24px', lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            padding: '8px 18px', borderRadius: 8, fontSize: 13,
            border: '1px solid var(--border-primary)', background: 'transparent',
            color: 'var(--text-tertiary)', cursor: 'pointer',
          }}>
            Annuler
          </button>
          <button onClick={onConfirm} style={{
            padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: confirmDanger ? '#ef4444' : 'var(--color-primary)',
            border: 'none',
            color: confirmDanger ? 'var(--text-primary)' : '#000',
            cursor: 'pointer',
          }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
