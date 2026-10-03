// Instagram > Audience (Insyder « Analyse de votre audience »):
// - three cards from the Leads Instagram index (everyone who reacted, not only
//   CRM leads): personnes actives, ne vous suivent pas, lurkers — each opens
//   the matching list on /instagram/leads;
// - Quand publier (BestTimeSection), your stories, highlights, best reels.
// The people lists themselves live on Leads Instagram (no duplicate here).
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { StatCard, StatGrid, formatNumber } from '../../design-system/StatCard'
import { TableCard } from '../../design-system/TableCard'
import { Chips } from '../../design-system/Tabs'
import { LoadingState, ErrorState, EmptyState } from '../../design-system/States'
import { shortDate } from '../leads/status'
import { ContentThumb } from './ContentThumb'
import { formatRate } from './ContentPage'
import { BestTimeSection } from './BestTimeSection'
import { StoriesGallery } from './StoriesPage'
import { HighlightsSection } from './HighlightsSection'
import type { ContentChartPoint } from './types'
import './instagram.css'
import { useCachedQuery } from '../../lib/use-cached-query'

interface PeopleSummary {
  kpis: { active: number; notFollowing: number; followUnknown: number; buyerLurkers: number }
  recentStoriesCount: number
}

type Period = '7' | '30' | '90' | '365'

const PERIODS: { key: Period; label: string }[] = [
  { key: '7', label: '7 j' },
  { key: '30', label: '30 j' },
  { key: '90', label: '90 j' },
  { key: '365', label: '1 an' },
]

const NO_CONTENTS: ContentChartPoint[] = []

export function AudiencePage() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState<Period>('30')
  // Cached snapshots: the page shows the last values at once, each block refreshes alone.
  const peopleQuery = useCachedQuery<{ data: PeopleSummary }>(`/api/instagram/people?period_days=${period}&tab=actifs&page=1&per_page=1`, { screen: 'AudiencePeople', staleMs: 60_000, keepPrevious: true })
  const contentsQuery = useCachedQuery<{ data: ContentChartPoint[] }>('/api/instagram/content/chart?days=365', { screen: 'AudienceContents', staleMs: 5 * 60_000 })
  const people = peopleQuery.data?.data ?? null
  const contents = contentsQuery.data?.data ?? (contentsQuery.error ? NO_CONTENTS : null)

  const topReels = useMemo(
    () =>
      (contents ?? [])
        .filter((c) => c.contentType === 'clip' && c.engagementRate !== null)
        .sort((a, b) => (b.engagementRate as number) - (a.engagementRate as number))
        .slice(0, 5),
    [contents],
  )

  return (
    <div className="ig-page">
      <div className="ig-page-header">
        <div>
          <h1>Audience</h1>
          <p>Comment votre communauté interagit avec vous</p>
        </div>
        <Chips items={PERIODS} active={period} onChange={setPeriod} />
      </div>

      {!people && !peopleQuery.error && <LoadingState label="Chargement…" />}
      {!people && peopleQuery.error && <ErrorState message={peopleQuery.error} onRetry={peopleQuery.refresh} />}

      {people && (
        <StatGrid>
          <StatCard label="Personnes actives" value={people.kpis.active} caption={`ont fait un geste sur ${period} jours`} onClick={() => navigate(`/instagram/leads?tab=actifs&period=${period}`)} />
          <StatCard
            label="Ne vous suivent pas"
            value={people.kpis.notFollowing}
            highlight
            caption={
              people.kpis.active > 0
                ? `${Math.round((people.kpis.notFollowing / people.kpis.active) * 100)} % des actifs · ${formatNumber(people.kpis.followUnknown)} pas encore vérifiés`
                : undefined
            }
            onClick={() => navigate(`/instagram/leads?tab=actifs&period=${period}&follows=0`)}
          />
          <StatCard
            label="Lurkers"
            value={people.kpis.buyerLurkers}
            caption={people.recentStoriesCount > 0 ? `vus sur la moitié de vos ${people.recentStoriesCount} dernières stories, jamais un geste` : 'aucune story collectée pour l’instant'}
            onClick={() => navigate(`/instagram/leads?tab=lurkers&period=${period}`)}
          />
        </StatGrid>
      )}

      <BestTimeSection contents={contents} periodDays={Number(period)} />

      <TableCard>
        <StoriesGallery />
      </TableCard>

      <TableCard>
        <HighlightsSection />
      </TableCard>

      <div className="ig-audience-columns">
        <TableCard title="Vos réels" subtitle="Top 5 par taux d'engagement">
          {topReels.length === 0 ? (
            <EmptyState title="Aucun réel analysé" />
          ) : (
            <table className="ds-table">
              <tbody>
                {topReels.map((c) => (
                  <tr key={c.contentId} className="ds-row-clickable" onClick={() => navigate(`/instagram/content/${encodeURIComponent(c.contentId)}`)}>
                    <td>
                      <div className="ds-contact">
                        <ContentThumb url={c.thumbnailUrl} size={28} />
                        <div className="ds-contact-text">
                          <div className="ds-contact-name">Réel du {shortDate(c.publishedAt)}</div>
                          <div className="ds-muted">{formatNumber(c.views ?? 0)} vues</div>
                        </div>
                      </div>
                    </td>
                    <td className="ds-num-cell">
                      <span className="ds-num">{formatRate(c.engagementRate)}</span>
                    </td>
                    <td className="ds-num-cell">
                      <span className="ds-num">{c.leadsCount} leads</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TableCard>

      </div>

    </div>
  )
}
