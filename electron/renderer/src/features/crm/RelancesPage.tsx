// Relances — reads the EXISTING GET /api/follow-ups (same route, same
// filters, same role-scoping as the web). Status change uses the same
// PATCH /api/follow-ups/:id the web's FollowUpActionModal uses.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../../lib/api-client'
import { FilterMenu } from '../../design-system/FilterMenu'
import { LoadingState, ErrorState, EmptyState } from '../../design-system/States'
import { followUpChannelLabel, followUpStatusLabel } from '../leads/status'
import type { FollowUpWithLead, FollowUpsListResponse, FollowUpStatus } from './types'
import './crm.css'
import { TableCard } from '../../design-system/TableCard'

const STATUS_OPTIONS = [
  { key: 'en_attente', label: 'En attente' },
  { key: 'fait', label: 'Fait' },
  { key: 'annule', label: 'Annulé' },
]

function isOverdue(fu: FollowUpWithLead): boolean {
  return fu.status === 'en_attente' && new Date(fu.scheduled_at) < new Date()
}

export function RelancesPage() {
  const navigate = useNavigate()
  const [followUps, setFollowUps] = useState<FollowUpWithLead[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [statuses, setStatuses] = useState<string[]>(['en_attente'])
  const [updating, setUpdating] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('per_page', '100')
      if (statuses.length > 0) params.set('status', statuses.join(','))
      const res = await api.get<FollowUpsListResponse>(`/api/follow-ups?${params.toString()}`)
      setFollowUps(res.data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inconnue')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statuses])

  async function markDone(fu: FollowUpWithLead) {
    setUpdating(fu.id)
    try {
      await api.patch(`/api/follow-ups/${fu.id}`, { status: 'fait' as FollowUpStatus })
      await load()
    } finally {
      setUpdating(null)
    }
  }

  const overdueCount = (followUps ?? []).filter(isOverdue).length

  return (
    <div className="crm-page">
      <div className="crm-page-header">
        <div>
          <h1>Relances</h1>
          <p>
            {followUps === null ? '…' : `${followUps.length} relance${followUps.length > 1 ? 's' : ''}`}
            {overdueCount > 0 && <span className="crm-overdue-badge">{overdueCount} en retard</span>}
          </p>
        </div>
        <FilterMenu label="Statut" options={STATUS_OPTIONS} selected={statuses} onChange={setStatuses} />
      </div>

      {followUps === null && !error && <LoadingState label="Chargement des relances…" />}
      {error && <ErrorState message={error} onRetry={load} />}
      {followUps && followUps.length === 0 && <EmptyState title="Aucune relance" description="Rien à traiter pour ce filtre." />}

      {followUps && followUps.length > 0 && (
        <TableCard>
          <table className="ds-table">
          <thead>
            <tr>
              <th>Lead</th>
              <th>Raison</th>
              <th>Canal</th>
              <th>Prévue le</th>
              <th>Statut</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {followUps.map((fu) => (
              <tr key={fu.id} className={isOverdue(fu) ? 'ds-row--alert' : ''}>
                <td className="crm-table-clickable" onClick={() => fu.lead && navigate(`/leads/${fu.lead.id}`)}>
                  {fu.lead ? `${fu.lead.first_name} ${fu.lead.last_name}`.trim() || '—' : '—'}
                </td>
                <td>{fu.reason}</td>
                <td>{followUpChannelLabel(fu.channel)}</td>
                <td className={isOverdue(fu) ? 'crm-cell-overdue' : ''}>{new Date(fu.scheduled_at).toLocaleString('fr-FR')}</td>
                <td>{followUpStatusLabel(fu.status)}</td>
                <td>
                  {fu.status === 'en_attente' && (
                    <button className="crm-table-action" disabled={updating === fu.id} onClick={() => markDone(fu)}>
                      {updating === fu.id ? '…' : 'Marquer fait'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </TableCard>
      )}
    </div>
  )
}
