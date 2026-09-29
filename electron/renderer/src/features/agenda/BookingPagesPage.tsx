// Agenda › Pages de réservation — port of
// src/app/(dashboard)/parametres/calendriers/page.tsx (+ CalendarCard):
// list of booking calendars with their public link (/book/:workspace/:slug),
// active toggle, creation (same default body as the web), edit, delete.
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api-client'
import { openWeb, webUrl } from '../../lib/web-link'
import { StatCard, StatGrid } from '../../design-system/StatCard'
import { TableCard } from '../../design-system/TableCard'
import { Button } from '../../design-system/Button'
import { EmptyState, ErrorState, LoadingState } from '../../design-system/States'
import '../leads/lead-create-modal.css'
import './agenda.css'
import type { BookingCalendar, CalendarPurpose, ListResponse } from './types'
import { swrGet } from '../../lib/query-cache'

export const PURPOSE_LABELS: Record<CalendarPurpose, string> = {
  setting: 'Appel découverte',
  closing: 'Appel de closing',
  other: 'Autre',
}

const DEFAULT_NEW_CALENDAR = {
  name: 'Nouveau calendrier',
  duration_minutes: 30,
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
}

export function bookingPageUrl(workspaceSlug: string, calendarSlug: string): string {
  return webUrl(`/book/${workspaceSlug}/${calendarSlug}`)
}

export function BookingPagesPage() {
  const navigate = useNavigate()
  const [calendars, setCalendars] = useState<BookingCalendar[]>([])
  const [workspaceSlug, setWorkspaceSlug] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<BookingCalendar | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([
        swrGet<ListResponse<BookingCalendar>>('/api/booking-calendars', (cals) => {
          setCalendars(cals.data ?? [])
          setLoading(false)
        }),
        swrGet<{ slug: string | null }>('/api/workspaces/slug', (slug) => setWorkspaceSlug(slug.slug ?? null)).catch(() => setWorkspaceSlug(null)),
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les calendriers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function toggleActive(cal: BookingCalendar) {
    const next = !cal.is_active
    setCalendars((prev) => prev.map((c) => (c.id === cal.id ? { ...c, is_active: next } : c)))
    try {
      await api.patch(`/api/booking-calendars/${cal.id}`, { is_active: next })
    } catch (err) {
      setCalendars((prev) => prev.map((c) => (c.id === cal.id ? { ...c, is_active: cal.is_active } : c)))
      setActionError(err instanceof Error ? err.message : 'Modification échouée')
    }
  }

  async function create() {
    setCreating(true)
    setActionError(null)
    try {
      const res = await api.post<{ data: BookingCalendar }>('/api/booking-calendars', {
        ...DEFAULT_NEW_CALENDAR,
        slug: `calendrier-${Date.now()}`,
      })
      navigate(`/agenda/pages/${res.data.id}`)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Création échouée')
    } finally {
      setCreating(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/api/booking-calendars/${deleteTarget.id}`)
      setCalendars((prev) => prev.filter((c) => c.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Suppression échouée')
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  async function copy(cal: BookingCalendar) {
    if (!workspaceSlug) return
    try {
      await navigator.clipboard.writeText(bookingPageUrl(workspaceSlug, cal.slug))
      setCopiedId(cal.id)
      window.setTimeout(() => setCopiedId((id) => (id === cal.id ? null : id)), 2000)
    } catch {
      setActionError('Copie impossible — sélectionne le lien manuellement.')
    }
  }

  const activeCount = calendars.filter((c) => c.is_active).length

  return (
    <div className="agenda-page agenda-page--scroll">
      <div className="agenda-header">
        <div>
          <h1>Pages de réservation</h1>
          <p>Gérez vos types de rendez-vous et liens de réservation</p>
        </div>
        <div className="agenda-header-actions">
          <button type="button" className="ds-pill-button ds-pill-button--dark" onClick={() => void create()} disabled={creating}>
            {creating ? 'Création…' : '+ Nouveau calendrier'}
          </button>
        </div>
      </div>

      {!loading && !error && !workspaceSlug && (
        <div className="agenda-banner">
          <span>
            Configurez votre <strong>slug public</strong> dans Paramètres › Réglages pour activer vos liens de réservation.
          </span>
          <button type="button" onClick={() => void openWeb('/parametres/reglages')}>
            Ouvrir les réglages ↗
          </button>
        </div>
      )}
      {actionError && (
        <div className="agenda-banner" role="alert">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)}>
            Fermer
          </button>
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <>
          <StatGrid>
            <StatCard label="Calendriers" value={calendars.length} highlight />
            <StatCard label="Actifs" value={activeCount} caption="Réservables publiquement" />
            <StatCard label="Inactifs" value={calendars.length - activeCount} />
          </StatGrid>

          <TableCard title="Calendriers de réservation" subtitle="Lien public partagé à vos prospects pour réserver un créneau">
            {calendars.length === 0 ? (
              <div>
                <EmptyState
                  title="Aucun calendrier"
                  description="Créez votre premier calendrier de réservation pour permettre à vos leads de prendre rendez-vous."
                />
                <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 16 }}>
                  <Button variant="primary" onClick={() => void create()} disabled={creating}>
                    Créer un calendrier
                  </Button>
                </div>
              </div>
            ) : (
              <table className="ds-table">
                <thead>
                  <tr>
                    <th>Calendrier</th>
                    <th>Objectif</th>
                    <th className="ds-num-cell">Durée</th>
                    <th>Lien public</th>
                    <th>Statut</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {calendars.map((cal) => (
                    <tr key={cal.id} className="ds-row-clickable" onClick={() => navigate(`/agenda/pages/${cal.id}`)}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span className="agenda-dot" style={{ background: cal.color, width: 10, height: 10 }} />
                          <div style={{ minWidth: 0 }}>
                            <strong>{cal.name}</strong>
                            {cal.description && (
                              <div className="ds-muted" style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {cal.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="ds-muted">{PURPOSE_LABELS[cal.purpose] ?? '—'}</td>
                      <td className="ds-num-cell">
                        <span className="ds-num">{cal.duration_minutes}</span> <span className="ds-muted">min</span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {workspaceSlug ? (
                          <div className="agenda-url">
                            <code title={bookingPageUrl(workspaceSlug, cal.slug)}>/book/{workspaceSlug}/{cal.slug}</code>
                            <button type="button" className="agenda-mini-button" onClick={() => void copy(cal)}>
                              {copiedId === cal.id ? 'Copié ✓' : 'Copier'}
                            </button>
                            <button type="button" className="agenda-mini-button" onClick={() => void openWeb(`/book/${workspaceSlug}/${cal.slug}`)}>
                              Ouvrir ↗
                            </button>
                          </div>
                        ) : (
                          <span className="ds-muted">—</span>
                        )}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <span className="agenda-toggle-row">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={cal.is_active}
                            aria-label={cal.is_active ? 'Désactiver' : 'Activer'}
                            className={`agenda-toggle ${cal.is_active ? 'agenda-toggle--on' : ''}`}
                            onClick={() => void toggleActive(cal)}
                          />
                          {cal.is_active ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button type="button" className="agenda-mini-button" onClick={() => navigate(`/agenda/pages/${cal.id}`)}>
                            Modifier
                          </button>
                          <button type="button" className="agenda-mini-button agenda-mini-button--danger" onClick={() => setDeleteTarget(cal)}>
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TableCard>
        </>
      )}

      {deleteTarget && (
        <div className="lead-create-overlay" onMouseDown={(e) => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div className="lead-create-modal">
            <h2>Supprimer le calendrier</h2>
            <p className="ds-muted" style={{ marginTop: 0 }}>
              « {deleteTarget.name} » — cette action est irréversible. Le calendrier et tous ses créneaux seront définitivement supprimés.
            </p>
            <div className="lead-create-actions">
              <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
                Annuler
              </Button>
              <button type="button" className="agenda-danger-button" disabled={deleting} onClick={() => void confirmDelete()}>
                {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
