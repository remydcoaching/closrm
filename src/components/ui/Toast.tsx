'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

type ToastVariant = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  variant: ToastVariant
  message: string
  description?: string
}

interface ToastContextValue {
  toast: (message: string, opts?: { description?: string; variant?: ToastVariant }) => void
  success: (message: string, description?: string) => void
  error: (message: string, description?: string) => void
  info: (message: string, description?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

// Stable no-op fallback referenced once at module level so consumers used
// outside the provider still get a stable identity (avoids effect-loops when
// useToast() is in a useCallback dependency array).
const NOOP_TOAST: ToastContextValue = {
  toast: () => {}, success: () => {}, error: () => {}, info: () => {},
}

export function useToast(): ToastContextValue {
  return useContext(ToastContext) ?? NOOP_TOAST
}

const VARIANT_META: Record<ToastVariant, { color: string; icon: typeof CheckCircle2 }> = {
  success: { color: '#10b981', icon: CheckCircle2 },
  error:   { color: '#ef4444', icon: AlertCircle },
  info:    { color: '#3b82f6', icon: Info },
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback<ToastContextValue['toast']>((message, opts) => {
    const id = Date.now() + Math.random()
    const item: ToastItem = {
      id,
      message,
      description: opts?.description,
      variant: opts?.variant ?? 'info',
    }
    setToasts(prev => [...prev, item])
    setTimeout(() => dismiss(id), 4500)
  }, [dismiss])

  const success = useCallback((m: string, d?: string) => toast(m, { description: d, variant: 'success' }), [toast])
  const error   = useCallback((m: string, d?: string) => toast(m, { description: d, variant: 'error' }),   [toast])
  const info    = useCallback((m: string, d?: string) => toast(m, { description: d, variant: 'info' }),    [toast])

  // Memoize the value so consumers using useToast() in useCallback deps
  // don't see a new reference on every render of the provider.
  const value = useMemo(
    () => ({ toast, success, error, info }),
    [toast, success, error, info]
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div style={{
        position: 'fixed', bottom: 20, right: 20, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <ToastCard key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const meta = VARIANT_META[item.variant]
  const Icon = meta.icon
  const [entering, setEntering] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setEntering(false), 10)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={{
      pointerEvents: 'auto',
      minWidth: 280, maxWidth: 380,
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-primary)',
      borderLeft: `3px solid ${meta.color}`,
      borderRadius: 10,
      padding: '12px 14px',
      boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'flex-start', gap: 10,
      transform: entering ? 'translateX(20px)' : 'translateX(0)',
      opacity: entering ? 0 : 1,
      transition: 'opacity 0.2s, transform 0.2s',
    }}>
      <Icon size={16} color={meta.color} style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35 }}>
          {item.message}
        </div>
        {item.description && (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3, lineHeight: 1.4 }}>
            {item.description}
          </div>
        )}
      </div>
      <button
        onClick={onDismiss}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--text-tertiary)', padding: 0, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <X size={14} />
      </button>
    </div>
  )
}
