'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Calendar, AlertTriangle } from 'lucide-react'
import { BookingCalendar } from '@/types'
import CalendarCard from '@/components/booking-calendars/CalendarCard'
import ConfirmModal from '@/components/shared/ConfirmModal'

export default function CalendriersPage() {
  const router = useRouter()
  const [calendars, setCalendars] = useState<BookingCalendar[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [workspaceSlug, setWorkspaceSlug] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  async function fetchData() {
    try {
      const [calendarsRes, slugRes] = await Promise.all([
        fetch('/api/booking-calendars'),
        fetch('/api/workspaces/slug'),
      ])

      if (!calendarsRes.ok) throw new Error('Impossible de charger les calendriers')

      const calendarsJson = await calendarsRes.json()
      const slugJson = await slugRes.json()

      setCalendars(calendarsJson.data ?? [])
      setWorkspaceSlug(slugJson.slug ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  async function handleToggleActive(id: string, active: boolean) {
    const res = await fetch(`/api/booking-calendars/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: active }),
    })
    if (res.ok) {
      setCalendars(prev =>
        prev.map(c => (c.id === id ? { ...c, is_active: active } : c))
      )
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/booking-calendars/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setCalendars(prev => prev.filter(c => c.id !== id))
    }
    setDeleteTarget(null)
  }

  async function handleCreate() {
    setCreating(true)
    try {
      const slug = `calendrier-${Date.now()}`
      const res = await fetch('/api/booking-calendars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Nouveau calendrier',
          slug,
          duration_minutes: 30,
          color: '#3b82f6',
          availability: {
            monday: [{ start: '09:00', end: '17:00' }],
            tuesday: [{ start: '09:00', end: '17:00' }],
            wednesday: [{ start: '09:00', end: '17:00' }],
            thursday: [{ start: '09:00', end: '17:00' }],
            friday: [{ start: '09:00', end: '17:00' }],
            saturday: [],
            sunday: [],
          },
          form_fields: [],
          buffer_minutes: 0,
        }),
      })
      if (res.ok) {
        const json = await res.json()
        router.push(`/parametres/calendriers/${json.data.id}`)
      }
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Chargement...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 32 }}>
        <p style={{ color: '#ef4444', fontSize: 14 }}>{error}</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '28px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Calendriers de réservation
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
            Gérez vos types de rendez-vous et liens de réservation
          </p>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--color-primary)',
            border: 'none',
            borderRadius: 8,
            padding: '9px 16px',
            fontSize: 13,
            fontWeight: 600,
            color: '#fff',
            cursor: creating ? 'not-allowed' : 'pointer',
            opacity: creating ? 0.6 : 1,
            transition: 'opacity 0.15s ease',
          }}
        >
          <Plus size={15} strokeWidth={2.5} />
          {creating ? 'Création...' : 'Nouveau calendrier'}
        </button>
      </div>

      {/* Slug warning */}
      {!workspaceSlug && (
        <div
          style={{
            background: 'rgba(214,158,46,0.06)',
            border: '1px solid rgba(214,158,46,0.2)',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13,
            color: '#D69E2E',
          }}
        >
          <AlertTriangle size={15} />
          <span>
            Configurez votre <strong>slug public</strong> dans{' '}
            <a href="/parametres/reglages" style={{ color: '#D69E2E', textDecoration: 'underline' }}>
              Paramètres &gt; Réglages
            </a>{' '}
            pour activer vos liens de réservation.
          </span>
        </div>
      )}

      {/* Empty state */}
      {calendars.length === 0 && (
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-primary)',
            borderRadius: 12,
            padding: '56px 32px',
            textAlign: 'center',
          }}
        >
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'var(--bg-active)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <Calendar size={22} style={{ color: 'var(--color-primary)' }} />
          </div>
          <p style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, margin: '0 0 6px' }}>
            Aucun calendrier
          </p>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13, margin: '0 0 20px', maxWidth: 320, marginLeft: 'auto', marginRight: 'auto' }}>
            Créez votre premier calendrier de réservation pour permettre à vos leads de prendre rendez-vous.
          </p>
          <button
            onClick={handleCreate}
            disabled={creating}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--color-primary)',
              border: 'none',
              borderRadius: 8,
              padding: '9px 18px',
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
              cursor: creating ? 'not-allowed' : 'pointer',
            }}
          >
            <Plus size={15} strokeWidth={2.5} />
            Créer un calendrier
          </button>
        </div>
      )}

      {/* Grid */}
      {calendars.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: 14,
          }}
        >
          {calendars.map(calendar => (
            <CalendarCard
              key={calendar.id}
              calendar={calendar}
              workspaceSlug={workspaceSlug}
              onToggleActive={handleToggleActive}
              onDelete={id => setDeleteTarget(id)}
            />
          ))}
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <ConfirmModal
          title="Supprimer le calendrier"
          message="Cette action est irréversible. Le calendrier et tous ses créneaux seront définitivement supprimés."
          confirmLabel="Supprimer"
          confirmDanger
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
