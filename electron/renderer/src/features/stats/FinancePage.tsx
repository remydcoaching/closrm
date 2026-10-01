// Finance — parity with the web's src/app/(dashboard)/finance/finance-client.tsx:
// GET /api/finance/overview (MRR, cash, CA, deals actifs, MRR 12 mois),
// GET /api/finance/team (performance closers/setters), GET /api/deals
// (deals actifs table) and DELETE /api/deals/:id. Deltas added only where
// the same data allows it: MRR vs mois précédent (mrr_by_month), cash du
// mois vs mois précédent (deals.started_at, the rule overview uses).
import { useState } from 'react'
import { useCachedQuery } from '../../lib/use-cached-query'
import { registerLoader } from '../../lib/query-cache'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../../lib/api-client'
import { downloadCsv } from '../../lib/csv'
import { StatCard, StatGrid, formatNumber } from '../../design-system/StatCard'
import { TableCard, SortHeader } from '../../design-system/TableCard'
import { Avatar } from '../../design-system/Avatar'
import { Button } from '../../design-system/Button'
import { LoadingState, ErrorState, EmptyState } from '../../design-system/States'
import { displayName, shortDate } from '../leads/status'
import type { DealWithLead } from '../crm/types'
import { fetchDeals, fetchFinanceOverview, fetchFinanceTeam, type FinanceOverview, type MemberPerformance } from './stats-api'
import { formatEuro, pctDelta, sumBy } from './metrics'
import { BarChart, ChartCard } from './charts'
import './stats.css'
import '../leads/lead-create-modal.css'

interface FinanceData {
  overview: FinanceOverview
  team: MemberPerformance[]
  deals: DealWithLead[]
}

type SortKey = 'client' | 'amount' | 'cash' | 'remaining' | 'mrr' | 'ends_at'

function dealMrr(d: DealWithLead): number {
  return d.duration_months ? Number(d.amount) / d.duration_months : 0
}

const FINANCE_KEY = 'desktop:finance'

async function loadFinance(): Promise<FinanceData> {
  const [overview, team, deals] = await Promise.all([fetchFinanceOverview(), fetchFinanceTeam().catch(() => []), fetchDeals()])
  return { overview, team, deals }
}

registerLoader(FINANCE_KEY, () => loadFinance)

export function FinancePage() {
  const navigate = useNavigate()
  const [toDelete, setToDelete] = useState<DealWithLead | null>(null)
  const [sort, setSort] = useState<{ key: SortKey; order: 'asc' | 'desc' }>({ key: 'amount', order: 'desc' })
  // Last figures shown at once, refreshed in the background.
  const query = useCachedQuery<FinanceData>(FINANCE_KEY, { screen: 'Finance', staleMs: 60_000, fetcher: loadFinance })
  const data = query.data ?? null
  const error = query.error
  const load = query.refresh

  if (error) {
    return (
      <div className="stats-page">
        <Header />
        <ErrorState message={error} onRetry={load} />
      </div>
    )
  }
  if (!data) {
    return (
      <div className="stats-page">
        <Header />
        <LoadingState />
      </div>
    )
  }

  const { overview: o, team, deals } = data
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime()
  const cashLastMonth = sumBy(
    deals.filter((d) => {
      const t = new Date(d.started_at).getTime()
      return t >= lastMonthStart && t < monthStart
    }),
    (d) => d.cash_collected,
  )
  const months = o.mrr_by_month
  const mrrPrev = months.length >= 2 ? months[months.length - 2].mrr : null
  const activeDeals = deals.filter((d) => d.status === 'active')
  const teamById = new Map(team.map((m) => [m.user_id, m]))

  const sortedDeals = [...activeDeals].sort((a, b) => {
    const val = (d: DealWithLead): number | string => {
      switch (sort.key) {
        case 'client':
          return d.lead ? `${d.lead.first_name} ${d.lead.last_name}`.toLowerCase() : ''
        case 'amount':
          return Number(d.amount)
        case 'cash':
          return Number(d.cash_collected)
        case 'remaining':
          return Math.max(0, Number(d.amount) - Number(d.cash_collected))
        case 'mrr':
          return dealMrr(d)
        case 'ends_at':
          return d.ends_at ? new Date(d.ends_at).getTime() : Number.MAX_SAFE_INTEGER
      }
    }
    const va = val(a)
    const vb = val(b)
    const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
    return sort.order === 'asc' ? cmp : -cmp
  })

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, order: s.order === 'asc' ? 'desc' : 'asc' } : { key, order: 'desc' }))
  }

  function exportDeals() {
    downloadCsv(
      'deals-actifs.csv',
      [['Client', 'Closer', 'Montant', 'Encaissé', 'Reste', 'Paiement', 'Durée (mois)', 'MRR', 'Fin'], ...sortedDeals.map((d) => [
        d.lead ? `${d.lead.first_name} ${d.lead.last_name}` : '',
        teamById.get(d.closer_id ?? '')?.full_name ?? '',
        String(d.amount),
        String(d.cash_collected),
        String(Math.max(0, Number(d.amount) - Number(d.cash_collected))),
        `${d.installments}x`,
        d.duration_months ? String(d.duration_months) : 'One-shot',
        dealMrr(d) > 0 ? dealMrr(d).toFixed(2) : '',
        d.ends_at ?? '',
      ])],
    )
  }

  return (
    <div className="stats-page">
      <Header />

      <StatGrid>
        <StatCard
          label="MRR actuel"
          value={formatEuro(o.mrr_current)}
          delta={mrrPrev !== null ? pctDelta(o.mrr_current, mrrPrev) : null}
          caption={
            [o.mrr_new_this_month > 0 ? `+${formatEuro(o.mrr_new_this_month)} nouveau` : null, o.mrr_churned_this_month > 0 ? `−${formatEuro(o.mrr_churned_this_month)} churn` : null]
              .filter(Boolean)
              .join(' · ') || 'Aucun mouvement ce mois-ci'
          }
          highlight
        />
        <StatCard label="Cash ce mois" value={formatEuro(o.cash_this_month)} delta={pctDelta(o.cash_this_month, cashLastMonth)} caption={`Cash cumulé : ${formatEuro(o.cash_cumulative)}`} />
        <StatCard label="CA cumulé" value={formatEuro(o.revenue_cumulative)} caption={`Reste à collecter : ${formatEuro(o.revenue_cumulative - o.cash_cumulative)}`} />
        <StatCard label="Deals actifs" value={o.deals_active} caption={`Ticket moyen : ${formatEuro(o.avg_deal_size)}`} onClick={() => navigate('/deals')} />
      </StatGrid>

      <ChartCard title="MRR sur 12 mois" subtitle="Revenu mensuel récurrent des deals actifs (montant / durée)">
        <BarChart
          points={months.map((m) => {
            const [y, mo] = m.month.split('-').map(Number)
            return { key: m.month, label: new Date(y, mo - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }), value: m.mrr }
          })}
          format={formatEuro}
          color="var(--color-success)"
          emptyLabel="Aucun MRR sur les 12 derniers mois (deals one-shot uniquement ou aucun deal)."
        />
      </ChartCard>

      <TableCard
        title={`Deals actifs (${formatNumber(activeDeals.length)})`}
        subtitle={`Reste à encaisser : ${formatEuro(sumBy(activeDeals, (d) => Math.max(0, Number(d.amount) - Number(d.cash_collected))))}`}
        toolbar={
          <button type="button" className="ds-pill-button" onClick={exportDeals} disabled={activeDeals.length === 0}>
            Exporter CSV
          </button>
        }
      >
        {activeDeals.length === 0 ? (
          <EmptyState title="Aucun deal actif" />
        ) : (
          <table className="ds-table">
            <thead>
              <tr>
                <SortHeader label="Client" active={sort.key === 'client'} order={sort.order} onClick={() => toggleSort('client')} />
                <th>Closer</th>
                <SortHeader label="Montant" align="right" active={sort.key === 'amount'} order={sort.order} onClick={() => toggleSort('amount')} />
                <SortHeader label="Encaissé" align="right" active={sort.key === 'cash'} order={sort.order} onClick={() => toggleSort('cash')} />
                <SortHeader label="Reste" align="right" active={sort.key === 'remaining'} order={sort.order} onClick={() => toggleSort('remaining')} />
                <th className="ds-num-cell">Paiement</th>
                <th className="ds-num-cell">Durée</th>
                <SortHeader label="MRR" align="right" active={sort.key === 'mrr'} order={sort.order} onClick={() => toggleSort('mrr')} />
                <SortHeader label="Fin" align="right" active={sort.key === 'ends_at'} order={sort.order} onClick={() => toggleSort('ends_at')} />
                <th />
              </tr>
            </thead>
            <tbody>
              {sortedDeals.map((d) => {
                const remaining = Math.max(0, Number(d.amount) - Number(d.cash_collected))
                const mrr = dealMrr(d)
                const closer = d.closer_id ? teamById.get(d.closer_id) : undefined
                const name = d.lead ? displayName(d.lead.first_name, d.lead.last_name, 'Client') : null
                return (
                  <tr key={d.id} className={d.lead ? 'ds-row-clickable' : undefined} onClick={() => d.lead && navigate(`/leads/${d.lead.id}`)}>
                    <td>
                      {name ? (
                        <div className="ds-contact">
                          <Avatar name={name} size={30} src={d.lead?.instagram_profile_pic_url} />
                          <div className="ds-contact-text">
                            <div className="ds-contact-name">{name}</div>
                          </div>
                        </div>
                      ) : (
                        <span className="ds-muted">—</span>
                      )}
                    </td>
                    <td className="ds-muted">{closer?.full_name ?? (d.closer_id ? '—' : 'Non attribué')}</td>
                    <td className="ds-num-cell">
                      <span className="ds-num">{formatEuro(Number(d.amount))}</span>
                    </td>
                    <td className="ds-num-cell">
                      <span className="ds-num" style={{ color: 'var(--color-success)' }}>
                        {formatEuro(Number(d.cash_collected))}
                      </span>
                    </td>
                    <td className="ds-num-cell">
                      <span className="ds-num" style={{ color: remaining > 0 ? 'var(--color-warning)' : undefined }}>
                        {formatEuro(remaining)}
                      </span>
                    </td>
                    <td className="ds-num-cell">
                      <span className="ds-num">{d.installments}x</span>
                    </td>
                    <td className="ds-num-cell">
                      <span className="ds-num">{d.duration_months ? `${d.duration_months} mois` : 'One-shot'}</span>
                    </td>
                    <td className="ds-num-cell">
                      <span className="ds-num">{mrr > 0 ? formatEuro(mrr) : '—'}</span>
                    </td>
                    <td className="ds-num-cell">
                      <span className="ds-num">{shortDate(d.ends_at)}</span>
                    </td>
                    <td className="ds-num-cell">
                      <button
                        type="button"
                        className="stats-icon-button stats-icon-button--danger"
                        title="Supprimer le deal"
                        onClick={(e) => {
                          e.stopPropagation()
                          setToDelete(d)
                        }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </TableCard>

      <TableCard title="Performance équipe" subtitle="Tous deals confondus (closer_id / setter_id)">
        {team.length === 0 ? (
          <EmptyState title="Aucun membre actif" />
        ) : (
          <table className="ds-table">
            <thead>
              <tr>
                <th>Membre</th>
                <th>Rôle</th>
                <th className="ds-num-cell">Deals (closer)</th>
                <th className="ds-num-cell">Deals (setter)</th>
                <th className="ds-num-cell">CA généré</th>
                <th className="ds-num-cell">Cash collecté</th>
                <th className="ds-num-cell">MRR contribué</th>
              </tr>
            </thead>
            <tbody>
              {team.map((m) => (
                <tr key={m.user_id}>
                  <td>
                    <div className="ds-contact">
                      <Avatar name={m.full_name} size={30} />
                      <div className="ds-contact-text">
                        <div className="ds-contact-name">{m.full_name}</div>
                        {m.email && <div className="ds-muted">{m.email}</div>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="stats-role-tag">{m.role}</span>
                  </td>
                  <td className="ds-num-cell">
                    <span className="ds-num">{formatNumber(m.deals_as_closer)}</span>
                  </td>
                  <td className="ds-num-cell">
                    <span className="ds-num">{formatNumber(m.deals_as_setter)}</span>
                  </td>
                  <td className="ds-num-cell">
                    <span className="ds-num">{formatEuro(m.revenue_closed)}</span>
                  </td>
                  <td className="ds-num-cell">
                    <span className="ds-num" style={{ color: 'var(--color-success)' }}>
                      {formatEuro(m.cash_collected)}
                    </span>
                  </td>
                  <td className="ds-num-cell">
                    <span className="ds-num">{m.mrr_contributed > 0 ? formatEuro(m.mrr_contributed) : '—'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableCard>

      {toDelete && (
        <DeleteDealModal
          deal={toDelete}
          onClose={() => setToDelete(null)}
          onDeleted={() => {
            setToDelete(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function Header() {
  return (
    <div className="stats-page-header">
      <div>
        <h1>Finance</h1>
        <p>MRR, cash collecté, performances closers & setters</p>
      </div>
    </div>
  )
}

function DeleteDealModal({ deal, onClose, onDeleted }: { deal: DealWithLead; onClose: () => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const name = deal.lead ? `${deal.lead.first_name} ${deal.lead.last_name}` : 'ce client'

  async function confirmDelete() {
    setBusy(true)
    setError(null)
    try {
      await api.delete(`/api/deals/${deal.id}`)
      onDeleted()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Suppression impossible')
      setBusy(false)
    }
  }

  return (
    <div className="lead-create-overlay" onClick={onClose}>
      <div className="lead-create-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Supprimer le deal</h2>
        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
          Supprimer le deal de {formatEuro(Number(deal.amount))} pour {name} ? Cette action est irréversible.
        </p>
        {error && <p className="lead-create-error">{error}</p>}
        <div className="lead-create-actions">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button variant="primary" onClick={confirmDelete} disabled={busy}>
            {busy ? 'Suppression…' : 'Supprimer'}
          </Button>
        </div>
      </div>
    </div>
  )
}
