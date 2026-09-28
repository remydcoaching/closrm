// Emails > Statistiques — GET /api/emails/stats?days=N (the web shows the
// 30-day version inside its "Paramètres" tab). All sources: campaigns,
// sequences, automations, booking reminders, direct messages.
import { useCallback, useEffect, useState } from 'react'
import { api } from '../../../lib/api-client'
import { swrGet } from '../../../lib/query-cache'
import { StatCard, StatGrid, formatNumber } from '../../../design-system/StatCard'
import { TableCard } from '../../../design-system/TableCard'
import { Tabs } from '../../../design-system/Tabs'
import { LoadingState, ErrorState, EmptyState } from '../../../design-system/States'
import { errorMessage } from '../http'
import { EMAIL_SOURCE_LABELS, formatPercent, percent } from '../format'
import type { EmailGlobalStats } from '../types'

type Period = '7' | '30' | '90'

export function EmailStatsTab() {
  const [days, setDays] = useState<Period>('30')
  const [stats, setStats] = useState<EmailGlobalStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      // Cached value of this period at once (none → loading), fresh one after.
      setStats(null)
      await swrGet<EmailGlobalStats>(`/api/emails/stats?days=${days}`, setStats)
    } catch (err) {
      setError(errorMessage(err))
    }
  }, [days])

  useEffect(() => {
    load()
  }, [load])

  const sources = stats ? Object.entries(stats.by_source).sort((a, b) => b[1].count - a[1].count) : []

  return (
    <>
      <div className="mk-header">
        <div>
          <h2 className="mk-section-title">Statistiques</h2>
          <p>Performances de tous les emails envoyés sur la période</p>
        </div>
        <Tabs
          items={[
            { key: '7' as Period, label: '7 jours' },
            { key: '30' as Period, label: '30 jours' },
            { key: '90' as Period, label: '90 jours' },
          ]}
          active={days}
          onChange={setDays}
        />
      </div>
      {error && <ErrorState message={error} onRetry={load} />}
      {!stats && !error && <LoadingState label="Chargement des statistiques…" />}
      {stats && (
        <>
          <StatGrid>
            <StatCard label="Emails envoyés" value={stats.total} />
            <StatCard
              label="Taux d'ouverture"
              highlight
              value={stats.total > 0 ? formatPercent(stats.rates?.open ?? percent(stats.opened, stats.total)) : '—'}
              caption={`${formatNumber(stats.opened)} ouverts`}
            />
            <StatCard
              label="Taux de clic"
              value={stats.total > 0 ? formatPercent(stats.rates?.click ?? percent(stats.clicked, stats.total)) : '—'}
              caption={`${formatNumber(stats.clicked)} clics`}
            />
            <StatCard
              label="Bounces"
              value={stats.total > 0 ? formatPercent(stats.rates?.bounce ?? percent(stats.bounced, stats.total)) : '—'}
              caption={`${formatNumber(stats.bounced)} rejetés`}
            />
            <StatCard label="Remis" value={stats.delivered} />
            <StatCard label="Plaintes" value={stats.complained} />
            <StatCard label="Désinscriptions" value={stats.unsubscribed ?? 0} caption="Leads désinscrits sur la période" />
          </StatGrid>
          <TableCard title="Par source" subtitle="D'où viennent les envois">
            {sources.length === 0 ? (
              <EmptyState title="Aucun envoi sur la période" />
            ) : (
              <table className="ds-table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th className="ds-num-cell">Envois</th>
                    <th className="ds-num-cell">Bounces</th>
                    <th className="ds-num-cell">Taux de bounce</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map(([key, v]) => (
                    <tr key={key}>
                      <td className="mk-name">{EMAIL_SOURCE_LABELS[key] ?? key}</td>
                      <td className="ds-num-cell">
                        <span className="ds-num">{formatNumber(v.count)}</span>
                      </td>
                      <td className="ds-num-cell">
                        <span className="ds-num">{formatNumber(v.bounced)}</span>
                      </td>
                      <td className="ds-num-cell">
                        <span className="ds-num">{formatPercent(percent(v.bounced, v.count))}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TableCard>
        </>
      )}
    </>
  )
}
