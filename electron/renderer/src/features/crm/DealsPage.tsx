// Deals — reads the EXISTING GET /api/deals (same route the web uses).
// Read-only listing here; deal creation stays on the web's ClosingModal
// flow / the lead detail panel's status-change-to-clos path, not duplicated.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../../lib/api-client'
import { LoadingState, ErrorState, EmptyState } from '../../design-system/States'
import type { DealWithLead } from './types'
import { StatCard, StatGrid } from '../../design-system/StatCard'
import { TableCard, ContactCell } from '../../design-system/TableCard'
import { Avatar } from '../../design-system/Avatar'
import { shortDate } from '../leads/status'
import './crm.css'

const STATUS_LABELS: Record<string, string> = {
  active: 'Actif',
  completed: 'Terminé',
  churned: 'Churn',
  refunded: 'Remboursé',
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

export function DealsPage() {
  const navigate = useNavigate()
  const [deals, setDeals] = useState<DealWithLead[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      const res = await api.get<{ data: DealWithLead[] }>('/api/deals')
      setDeals(res.data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inconnue')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const totalRevenue = (deals ?? []).reduce((sum, d) => sum + d.amount, 0)
  const totalCollected = (deals ?? []).reduce((sum, d) => sum + d.cash_collected, 0)

  return (
    <div className="crm-page">
      <div className="crm-page-header">
        <div>
          <h1>Deals</h1>
          <p>{deals === null ? '…' : `${deals.length} deal${deals.length > 1 ? 's' : ''}`}</p>
        </div>
      </div>

      {deals && deals.length > 0 && (
        <StatGrid>
          <StatCard label="Revenue total" value={formatMoney(totalRevenue)} caption="montant cumulé des deals" />
          <StatCard label="Cash collecté" value={formatMoney(totalCollected)} highlight caption="encaissé à ce jour" />
          <StatCard
            label="Reste à encaisser"
            value={formatMoney(Math.max(totalRevenue - totalCollected, 0))}
            caption="sur les deals en cours"
          />
          <StatCard label="Deals" value={deals.length} caption={`dont ${deals.filter((d) => d.status === 'active').length} actifs`} />
        </StatGrid>
      )}

      {deals === null && !error && <LoadingState label="Chargement des deals…" />}
      {error && <ErrorState message={error} onRetry={load} />}
      {deals && deals.length === 0 && <EmptyState title="Aucun deal" description="Les deals apparaissent ici une fois un lead marqué comme closé." />}

      {deals && deals.length > 0 && (
        <TableCard title="Tous les deals" subtitle={`${deals.length} deal${deals.length > 1 ? 's' : ''}`}>
          <table className="ds-table">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Statut</th>
                <th className="ds-num-cell">Montant</th>
                <th className="ds-num-cell">Cash collecté</th>
                <th className="ds-num-cell">Échéances</th>
                <th className="ds-num-cell">Débuté le</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((deal) => {
                const name = deal.lead ? `${deal.lead.first_name} ${deal.lead.last_name}`.trim() || '—' : '—'
                return (
                  <tr key={deal.id} className="ds-row-clickable" onClick={() => deal.lead && navigate(`/leads/${deal.lead.id}`)}>
                    <td>
                      <ContactCell name={name} avatar={<Avatar name={name} size={28} />} />
                    </td>
                    <td>{STATUS_LABELS[deal.status] ?? deal.status}</td>
                    <td className="ds-num-cell">
                      <span className="ds-num">{formatMoney(deal.amount)}</span>
                    </td>
                    <td className="ds-num-cell">
                      <span className="ds-num">{formatMoney(deal.cash_collected)}</span>
                    </td>
                    <td className="ds-num-cell">
                      <span className="ds-num">{deal.installments}</span>
                    </td>
                    <td className="ds-num-cell">
                      <span className="ds-num">{shortDate(deal.started_at)}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </TableCard>
      )}
    </div>
  )
}
