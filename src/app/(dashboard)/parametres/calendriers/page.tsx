'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
          color: '#E53E3E',
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
    <div style={{ padding: 32, maxWidth: 900 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 32,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Calendriers de réservation
        </h1>
        <button
          onClick={handleCreate}
          disabled={creating}
          style={{
            background: '#E53E3E',
            border: 'none',
            borderRadius: 8,
            padding: '9px 18px',
            fontSize: 14,
            fontWeight: 600,
            color: '#fff',
            cursor: creating ? 'not-allowed' : 'pointer',
            opacity: creating ? 0.6 : 1,
          }}
        >
          {creating ? 'Création...' : '+ Nouveau calendrier'}
        </button>
      </div>

      {/* Slug warning */}
      {!workspaceSlug && (
        <div
          style={{
            background: 'rgba(214,158,46,0.1)',
            border: '1px solid rgba(214,158,46,0.3)',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13,
            color: '#D69E2E',
          }}
        >
          <span style={{ fontSize: 18 }}>⚠</span>
          <span>
            Configurez votre <strong>slug public</strong> dans{' '}
            <a href="/parametres/reglages" style={{ color: '#D69E2E', textDecoration: 'underline' }}>
              Paramètres &gt; Réglages
            </a>{' '}
            pour que vos liens de réservation fonctionnent.
          </span>
        </div>
      )}

      {/* Empty state */}
      {calendars.length === 0 && (
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-primary)',
            borderRadius: 10,
            padding: 40,
            textAlign: 'center',
          }}
        >
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
            Aucun calendrier de réservation. Créez-en un pour commencer.
          </p>
        </div>
      )}

      {/* Grid */}
      {calendars.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 16,
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
