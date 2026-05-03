'use client'

import { useEffect, useState, useCallback } from 'react'
import { Mail, MessageCircle, MessageSquare, CheckCircle2, XCircle, Clock, Ban, RefreshCw } from 'lucide-react'

interface Reminder {
  id: string
  channel: 'email' | 'whatsapp' | 'instagram_dm' | string
  message: string
  send_at: string
  status: 'pending' | 'sent' | 'failed' | 'cancelled' | string
  error: string | null
  created_at: string
  booking: { id: string; scheduled_at: string } | null
  lead: { id: string; first_name: string | null; last_name: string | null; email: string | null } | null
}

const CHANNEL_META: Record<string, { icon: typeof Mail; label: string; color: string }> = {
  email: { icon: Mail, label: 'Email', color: '#3b82f6' },
  whatsapp: { icon: MessageCircle, label: 'WhatsApp', color: '#25D366' },
  instagram_dm: { icon: MessageSquare, label: 'Instagram', color: '#E1306C' },
}

const STATUS_META: Record<string, { icon: typeof CheckCircle2; label: string; color: string; bg: string }> = {
  pending: { icon: Clock, label: 'En attente', color: '#D69E2E', bg: 'rgba(214,158,46,0.12)' },
  sent: { icon: CheckCircle2, label: 'Envoyé', color: '#38A169', bg: 'rgba(56,161,105,0.12)' },
  failed: { icon: XCircle, label: 'Échec', color: '#E53E3E', bg: 'rgba(229,62,62,0.12)' },
  cancelled: { icon: Ban, label: 'Annulé', color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)' },
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const PAGE_SIZE = 15

export default function RemindersLog({ calendarId }: { calendarId: string }) {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/calendars/${calendarId}/reminders-log`)
      if (!res.ok) throw new Error('Erreur de chargement')
      const data = await res.json()
      setReminders(data.reminders ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }, [calendarId])

  useEffect(() => {
    load()
  }, [load])

  // Reset pagination when filter or data changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [statusFilter, reminders])

  const filtered = statusFilter === 'all' ? reminders : reminders.filter((r) => r.status === statusFilter)
  const visible = filtered.slice(0, visibleCount)
  const hasMore = filtered.length > visibleCount

  const counts = {
    all: reminders.length,
    sent: reminders.filter((r) => r.status === 'sent').length,
    pending: reminders.filter((r) => r.status === 'pending').length,
    failed: reminders.filter((r) => r.status === 'failed').length,
    cancelled: reminders.filter((r) => r.status === 'cancelled').length,
  }

  return (
    <div>
      {/* Filters + refresh */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {(['all', 'sent', 'pending', 'failed', 'cancelled'] as const).map((s) => {
          const isActive = statusFilter === s
          const meta = s === 'all' ? null : STATUS_META[s]
          const label = s === 'all' ? 'Tous' : meta?.label ?? s
          const color = s === 'all' ? 'var(--text-primary)' : meta?.color ?? 'var(--text-primary)'
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 7,
                border: `1px solid ${isActive ? color : 'var(--border-primary)'}`,
                background: isActive && meta ? meta.bg : isActive ? 'var(--bg-elevated)' : 'transparent',
                color: isActive ? color : 'var(--text-secondary)',
                cursor: 'pointer', fontSize: 12, fontWeight: 500,
                transition: 'all 0.15s',
              }}
            >
              {label}
              <span style={{ fontSize: 11, opacity: 0.7 }}>{counts[s]}</span>
            </button>
          )
        })}
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={load}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 7,
            border: '1px solid var(--border-primary)',
            background: 'var(--bg-input)',
            color: 'var(--text-secondary)',
            cursor: loading ? 'wait' : 'pointer', fontSize: 12, fontWeight: 500,
          }}
        >
          <RefreshCw size={12} style={loading ? { animation: 'spin 1s linear infinite' } : undefined} />
          Rafraîchir
        </button>
      </div>

      {error && (
        <div style={{ padding: 12, color: '#E53E3E', fontSize: 13, background: 'rgba(229,62,62,0.08)', borderRadius: 8, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '24px 12px', margin: 0 }}>
          {statusFilter === 'all' ? 'Aucun rappel envoyé pour ce calendrier.' : `Aucun rappel "${STATUS_META[statusFilter]?.label.toLowerCase() ?? statusFilter}".`}
        </p>
      )}

      {/* List */}
      {filtered.length > 0 && (
        <div style={{
          border: '1px solid var(--border-primary)',
          borderRadius: 10,
          overflow: 'hidden',
          background: 'var(--bg-input)',
        }}>
          {visible.map((r, i) => {
            const channel = CHANNEL_META[r.channel] ?? CHANNEL_META.email
            const status = STATUS_META[r.status] ?? STATUS_META.pending
            const CIcon = channel.icon
            const SIcon = status.icon
            const leadName = r.lead
              ? `${r.lead.first_name ?? ''} ${r.lead.last_name ?? ''}`.trim() || (r.lead.email ?? '—')
              : '—'

            return (
              <div
                key={r.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px',
                  borderBottom: i < visible.length - 1 ? '1px solid var(--border-primary)' : 'none',
                  fontSize: 13,
                }}
              >
                {/* Channel */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 28, borderRadius: 7,
                  background: channel.color + '14',
                  color: channel.color,
                  flexShrink: 0,
                }}>
                  <CIcon size={13} />
                </div>

                {/* Lead + send time */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {leadName}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                    {formatDate(r.send_at)}
                    {r.booking?.scheduled_at && ` · RDV ${formatDate(r.booking.scheduled_at)}`}
                  </p>
                </div>

                {/* Error message if any */}
                {r.error && (
                  <p style={{ margin: 0, fontSize: 11, color: '#E53E3E', maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.error}>
                    {r.error}
                  </p>
                )}

                {/* Status badge */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '3px 9px', borderRadius: 6,
                  background: status.bg,
                  color: status.color,
                  fontSize: 11, fontWeight: 600,
                  flexShrink: 0,
                }}>
                  <SIcon size={11} />
                  {status.label}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {hasMore && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
          <button
            type="button"
            onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
            style={{
              padding: '8px 18px', borderRadius: 8,
              border: '1px solid var(--border-primary)',
              background: 'var(--bg-input)',
              color: 'var(--text-secondary)',
              cursor: 'pointer', fontSize: 12, fontWeight: 500,
            }}
          >
            Voir plus ({filtered.length - visibleCount} restant{filtered.length - visibleCount > 1 ? 's' : ''})
          </button>
        </div>
      )}
    </div>
  )
}
