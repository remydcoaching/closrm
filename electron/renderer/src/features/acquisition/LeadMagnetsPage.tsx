// Acquisition > Lead Magnets — reproduces the web's lead-magnets-client.tsx:
// same GET/POST/PATCH/DELETE /api/lead-magnets and GET .../stats routes.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../../lib/api-client'
import { Button } from '../../design-system/Button'
import { Input } from '../../design-system/Input'
import { Drawer } from '../../design-system/Drawer'
import { LoadingState, ErrorState, EmptyState } from '../../design-system/States'
import { PLATFORM_OPTIONS } from './types'
import type { LeadMagnet, LeadMagnetPlatform, LeadMagnetStats } from './types'
import './acquisition.css'
import { TableCard } from '../../design-system/TableCard'
import { StatCard } from '../../design-system/StatCard'

export function LeadMagnetsPage() {
  const navigate = useNavigate()
  const [magnets, setMagnets] = useState<LeadMagnet[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<LeadMagnet | null>(null)
  const [statsFor, setStatsFor] = useState<LeadMagnet | null>(null)
  const [stats, setStats] = useState<LeadMagnetStats | null>(null)

  async function load() {
    setError(null)
    try {
      const res = await api.get<{ lead_magnets: LeadMagnet[] }>('/api/lead-magnets')
      setMagnets(res.lead_magnets)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inconnue')
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function openStats(m: LeadMagnet) {
    setStatsFor(m)
    setStats(null)
    try {
      const res = await api.get<LeadMagnetStats>(`/api/lead-magnets/${m.id}/stats`)
      setStats(res)
    } catch {
      setStats(null)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce lead magnet ? Tous les liens trackables associés seront supprimés.')) return
    await api.delete(`/api/lead-magnets/${id}`)
    await load()
  }

  return (
    <div className="ig-page">
      <div className="ig-page-header">
        <div>
          <h1>Lead Magnets</h1>
          <p>Contenus partagés avec les leads via des liens courts trackables.</p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setEditing(null)
            setShowForm(true)
          }}
        >
          + Nouveau contenu
        </Button>
      </div>

      {magnets === null && !error && <LoadingState label="Chargement…" />}
      {error && <ErrorState message={error} onRetry={load} />}
      {magnets && magnets.length === 0 && <EmptyState title="Aucun lead magnet" description="Créez votre premier contenu trackable." />}

      {magnets && magnets.length > 0 && (
        <TableCard>
          <table className="ds-table">
          <thead>
            <tr>
              <th>Titre</th>
              <th>Plateforme</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {magnets.map((m) => {
              const platform = PLATFORM_OPTIONS.find((p) => p.value === m.platform)
              return (
                <tr key={m.id}>
                  <td>
                    <div className="ig-cell-name">{m.title}</div>
                    <div className="ds-muted">{m.url}</div>
                  </td>
                  <td>
                    {platform?.emoji} {platform?.label}
                  </td>
                  <td>
                    <div className="acq-row-actions">
                      <button className="crm-table-action" onClick={() => openStats(m)}>
                        Voir stats
                      </button>
                      <button
                        className="crm-table-action"
                        onClick={() => {
                          setEditing(m)
                          setShowForm(true)
                        }}
                      >
                        Éditer
                      </button>
                      <button className="crm-table-action acq-action-danger" onClick={() => handleDelete(m.id)}>
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          </table>
        </TableCard>
      )}

      {showForm && (
        <LeadMagnetForm
          initial={editing}
          onClose={() => {
            setShowForm(false)
            setEditing(null)
          }}
          onSaved={() => {
            setShowForm(false)
            setEditing(null)
            load()
          }}
        />
      )}

      {statsFor && (
        <Drawer title={statsFor.title} onClose={() => setStatsFor(null)}>
          {!stats ? (
            <LoadingState label="Chargement des stats…" />
          ) : (
            <>
              <div className="ds-stat-grid">
                <StatCard label="Clics totaux" value={stats.total_clicks} />
                <StatCard label="Leads uniques" value={stats.unique_leads} />
              </div>
              <div className="lead-detail-section-title">Top leads ({stats.top_leads.length})</div>
              {stats.top_leads.length === 0 ? (
                <p className="lead-detail-empty">Personne n'a encore cliqué.</p>
              ) : (
                stats.top_leads.map((l) => (
                  <button key={l.lead_id} className="acq-top-lead-row" onClick={() => navigate(`/leads/${l.lead_id}`)}>
                    <div>
                      <div className="ig-cell-name">{l.name}</div>
                      <div className="ds-muted">
                        {l.last_clicked_at ? `Dernier clic : ${new Date(l.last_clicked_at).toLocaleString('fr-FR')}` : '—'}
                      </div>
                    </div>
                    <span className="acq-click-badge">{l.clicks} clic{l.clicks > 1 ? 's' : ''}</span>
                  </button>
                ))
              )}
            </>
          )}
        </Drawer>
      )}
    </div>
  )
}

function LeadMagnetForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: LeadMagnet | null
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [url, setUrl] = useState(initial?.url ?? '')
  const [platform, setPlatform] = useState<LeadMagnetPlatform>(initial?.platform ?? 'other')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!title || !url) return
    setSaving(true)
    try {
      if (initial) {
        await api.patch(`/api/lead-magnets/${initial.id}`, { title, url, platform })
      } else {
        await api.post('/api/lead-magnets', { title, url, platform })
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="lead-create-overlay" onClick={onClose}>
      <div className="lead-create-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{initial ? 'Éditer' : 'Nouveau'} lead magnet</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <Input placeholder="Titre" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          <Input placeholder="URL" value={url} onChange={(e) => setUrl(e.target.value)} />
          <select className="ds-input" value={platform} onChange={(e) => setPlatform(e.target.value as LeadMagnetPlatform)}>
            {PLATFORM_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.emoji} {p.label}
              </option>
            ))}
          </select>
          <div className="lead-create-actions">
            <Button type="submit" variant="primary" disabled={saving || !title || !url}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
