// Deals — reads the EXISTING GET /api/deals (same route the web uses).
// Read-only listing here; deal creation stays on the web's ClosingModal
// flow / the lead detail panel's status-change-to-clos path, not duplicated.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../../lib/api-client'
import { LoadingState, ErrorState, EmptyState } from '../../design-system/States'
import type { DealWithLead } from './types'
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
        {deals && deals.length > 0 && (
          <div className="crm-deals-summary">
            <div>
              <div className="crm-deals-summary-value font-mono">{formatMoney(totalRevenue)}</div>
              <div className="crm-deals-summary-label">Revenue total</div>
            </div>
            <div>
              <div className="crm-deals-summary-value font-mono">{formatMoney(totalCollected)}</div>
              <div className="crm-deals-summary-label">Cash collecté</div>
            </div>
          </div>
        )}
      </div>

      {deals === null && !error && <LoadingState label="Chargement des deals…" />}
      {error && <ErrorState message={error} onRetry={load} />}
      {deals && deals.length === 0 && <EmptyState title="Aucun deal" description="Les deals apparaissent ici une fois un lead marqué comme closé." />}

      {deals && deals.length > 0 && (
        <table className="crm-table">
          <thead>
            <tr>
              <th>Lead</th>
              <th>Montant</th>
              <th>Cash collecté</th>
              <th>Échéances</th>
              <th>Statut</th>
              <th>Débuté le</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((deal) => (
              <tr key={deal.id} className="crm-table-clickable" onClick={() => deal.lead && navigate(`/leads?leadId=${deal.lead.id}`)}>
                <td>{deal.lead ? `${deal.lead.first_name} ${deal.lead.last_name}`.trim() || '—' : '—'}</td>
                <td className="font-mono">{formatMoney(deal.amount)}</td>
                <td className="font-mono">{formatMoney(deal.cash_collected)}</td>
                <td className="font-mono">{deal.installments}</td>
                <td>{STATUS_LABELS[deal.status] ?? deal.status}</td>
                <td>{new Date(deal.started_at).toLocaleDateString('fr-FR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
