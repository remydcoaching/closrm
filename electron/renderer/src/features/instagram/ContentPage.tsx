// Instagram > Contenu — "quel contenu amène des leads". Reads
// GET /api/instagram/content/chart (one entry per scanned content, latest
// Ciblage snapshot — see src/lib/instagram/content-metrics.ts).
// Chart: engagement rate (linear Y) vs views (log X, otherwise 9 bubbles out
// of 10 pile up on the left), bubble size = leads reached, colour = funnel
// stage (funnel-stage.ts). Clicking a bubble or a row opens the content's
// own page with every identified profile.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../../lib/api-client'
import { ScatterChart, type ScatterPoint } from '../../design-system/ScatterChart'
import { StatCard, StatGrid, formatNumber } from '../../design-system/StatCard'
import { TableCard } from '../../design-system/TableCard'
import { Chips } from '../../design-system/Tabs'
import { LoadingState, ErrorState, EmptyState } from '../../design-system/States'
import { shortDate } from '../leads/status'
import { funnelStage, FUNNEL_STAGE_LABEL, FUNNEL_STAGE_COLOR, type FunnelStage } from './funnel-stage'
import { ContentThumb } from './ContentThumb'
import type { ContentChartPoint, ConfidenceKey } from './types'
import { Tabs } from '../../design-system/Tabs'
import { SearchInput } from '../../design-system/SearchInput'
import { MonitorSection } from './MonitorSection'
import './instagram.css'
import { usePaged, PaginationBar } from '../../design-system/Pagination'
import { useCachedQuery } from '../../lib/use-cached-query'

type Period = '7' | '30' | '90' | '365' | 'all'
type Format = 'all' | 'clip' | 'media'
type StageFilter = 'all' | FunnelStage
type ConfFilter = 'all' | ConfidenceKey
type TableView = 'audience' | 'business'

const CONFIDENCE_CHIPS: { key: ConfFilter; label: string }[] = [
  { key: 'all', label: 'Tous les leads' },
  { key: 'tres_eleve', label: 'Très élevé' },
  { key: 'eleve', label: 'Élevé' },
  { key: 'moyen', label: 'Moyen' },
  { key: 'faible', label: 'Faible' },
  { key: 'insuffisant', label: 'Très faible' },
]
const CONF_LABEL: Record<ConfidenceKey, string> = { tres_eleve: 'très élevé', eleve: 'élevé', moyen: 'moyen', faible: 'faible', insuffisant: 'très faible' }

const PERIODS: { key: Period; label: string }[] = [
  { key: '7', label: '7 jours' },
  { key: '30', label: '30 jours' },
  { key: '90', label: '90 jours' },
  { key: '365', label: '1 an' },
  { key: 'all', label: 'Tout' },
]

const FORMATS: { key: Format; label: string }[] = [
  { key: 'all', label: 'Tous formats' },
  { key: 'clip', label: 'Réels' },
  { key: 'media', label: 'Publications' },
]

export function formatRate(rate: number | null): string {
  return rate === null ? '—' : `${(rate * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`
}

export function contentTypeLabel(type: string): string {
  return type === 'clip' ? 'Réel' : 'Publication'
}

export function ContentPage() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState<Period>('90')
  const [format, setFormat] = useState<Format>('all')
  const [stage, setStage] = useState<StageFilter>('all')
  const [conf, setConf] = useState<ConfFilter>('all')
  const [view, setView] = useState<TableView>('audience')
  const [search, setSearch] = useState('')

  const q = new URLSearchParams()
  if (period !== 'all') q.set('days', period)
  // Confidence counts are heavier to compute: only when the filter is used.
  if (conf !== 'all') q.set('confidence', '1')
  const chartQuery = useCachedQuery<{ data: ContentChartPoint[]; confidenceAvailable?: boolean }>(`/api/instagram/content/chart?${q.toString()}`, {
    screen: 'Content',
    staleMs: 5 * 60_000,
    keepPrevious: true,
  })
  const items = chartQuery.data?.data ?? null
  const confAvailable = chartQuery.data?.confidenceAvailable !== false
  const error = chartQuery.error
  const load = chartQuery.refresh

  const filtered = useMemo(() => {
    return (items ?? []).filter((c) => {
      if (format !== 'all' && c.contentType !== format) return false
      if (stage !== 'all' && (c.engagementRate === null || funnelStage(c.engagementRate) !== stage)) return false
      if (conf !== 'all' && !(c.confidence?.[conf] ?? 0)) return false
      return true
    })
  }, [items, format, stage, conf])

  const tableRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? filtered.filter((c) => (c.caption ?? '').toLowerCase().includes(q) || c.contentId.includes(q)) : filtered
  }, [filtered, search])

  const paged = usePaged(tableRows)

  const stageCounts = useMemo(() => {
    const counts: Record<FunnelStage, number> = { haut: 0, milieu: 0, bas: 0 }
    for (const c of items ?? []) {
      if (format !== 'all' && c.contentType !== format) continue
      if (c.engagementRate !== null) counts[funnelStage(c.engagementRate)] += 1
    }
    return counts
  }, [items, format])

  const totals = useMemo(() => {
    const withViews = filtered.filter((c) => c.views !== null)
    const views = withViews.reduce((s, c) => s + (c.views ?? 0), 0)
    const engagements = withViews.reduce((s, c) => s + c.likesCount + c.commentsCount, 0)
    return {
      reelViews: withViews.filter((c) => c.contentType === 'clip').reduce((sum, c) => sum + (c.views ?? 0), 0),
      contents: filtered.length,
      views,
      rate: views > 0 ? engagements / views : null,
      leads: filtered.reduce((s, c) => s + c.leadsCount, 0),
      identified: filtered.reduce((s, c) => s + c.identifiedLikers + c.identifiedCommenters, 0),
    }
  }, [filtered])

  const bestReel = useMemo(
    () => filtered.filter((c) => c.contentType === 'clip' && c.views !== null).sort((a, b) => (b.views ?? 0) - (a.views ?? 0))[0] ?? null,
    [filtered],
  )

  const scatterPoints: ScatterPoint[] = filtered
    .filter((c) => c.views !== null && c.engagementRate !== null)
    .map((c) => {
      const st = funnelStage(c.engagementRate as number)
      return {
        id: c.contentId,
        x: c.views as number,
        y: c.engagementRate as number,
        radius: conf === 'all' ? c.leadsCount : (c.confidence?.[conf] ?? 0),
        color: FUNNEL_STAGE_COLOR[st],
        label: c.contentId,
        onClick: () => navigate(`/instagram/content/${encodeURIComponent(c.contentId)}`),
        tooltip: (
          <div>
            <div className="scatter-tooltip-title">{c.caption ? c.caption.slice(0, 80) : `${contentTypeLabel(c.contentType)} · ${FUNNEL_STAGE_LABEL[st]}`}</div>
            <div>Vues : {formatNumber(c.views as number)}</div>
            <div>Taux d&apos;engagement : {formatRate(c.engagementRate)}</div>
            <div>
              {formatNumber(c.identifiedLikers)} likers et {formatNumber(c.identifiedCommenters)} commentaires identifiés
            </div>
            {conf !== 'all' ? (
              <div>
                Niveau de confiance {CONF_LABEL[conf]} : {c.confidence?.[conf] ?? 0} lead{(c.confidence?.[conf] ?? 0) > 1 ? 's' : ''}
              </div>
            ) : (
              <div>
                {c.leadsCount} lead{c.leadsCount > 1 ? 's' : ''}
              </div>
            )}
            <div>
              {contentTypeLabel(c.contentType)} · {shortDate(c.publishedAt)}
            </div>
          </div>
        ),
      }
    })

  return (
    <div className="ig-page">
      <div className="ig-page-header">
        <div>
          <h1>Contenu</h1>
          <p>Chaque post et réel, et ce que chacun a rapporté — pas seulement ce qu&apos;il a fait de vues.</p>
        </div>
        <Chips items={PERIODS} active={period} onChange={setPeriod} />
      </div>

      <MonitorSection />

      {items === null && !error && <LoadingState label="Chargement des contenus…" />}
      {error && <ErrorState message={error} onRetry={load} />}
      {items && items.length === 0 && (
        <EmptyState title="Aucun contenu analysé" description="Lancez une analyse de votre compte (Analyse › ciblage) pour voir quels contenus amènent des leads." />
      )}

      {items && items.length > 0 && (
        <>
          <StatGrid>
            <StatCard label="Vues gagnées par les réels" value={totals.reelViews} caption="pendant la période, tous réels confondus" />
            <StatCard
              label="Réel le plus vu"
              value={
                bestReel ? (
                  <span className="ig-stat-media">
                    <ContentThumb url={bestReel.thumbnailUrl} size={26} />
                    <span>Réel du {shortDate(bestReel.publishedAt)}</span>
                  </span>
                ) : (
                  '—'
                )
              }
              caption={bestReel ? `${formatNumber(bestReel.views ?? 0)} vues · ${formatRate(bestReel.engagementRate)}` : undefined}
              onClick={bestReel ? () => navigate(`/instagram/content/${encodeURIComponent(bestReel.contentId)}`) : undefined}
            />
            <StatCard label="Taux d'engagement" value={formatRate(totals.rate)} caption="(likes + commentaires) / vues, compteurs Instagram" />
            <StatCard label="Leads touchés" value={totals.leads} highlight caption={`${formatNumber(totals.identified)} interactions identifiées`} />
          </StatGrid>

          <TableCard title="Quel contenu amène des leads" subtitle="Un contenu par bulle, taille = leads touchés. Cliquez pour l'ouvrir.">
            <div className="ig-filter-rows">
              <span className="ig-filter-label">Forme</span>
              <Chips items={FORMATS} active={format} onChange={setFormat} />
              <span className="ig-filter-label">Étape</span>
              <Chips
                items={[
                  { key: 'all' as StageFilter, label: 'Toutes' },
                  { key: 'bas' as StageFilter, label: FUNNEL_STAGE_LABEL.bas, count: stageCounts.bas },
                  { key: 'milieu' as StageFilter, label: FUNNEL_STAGE_LABEL.milieu, count: stageCounts.milieu },
                  { key: 'haut' as StageFilter, label: FUNNEL_STAGE_LABEL.haut, count: stageCounts.haut },
                ]}
                active={stage}
                onChange={setStage}
              />
              <span className="ig-filter-label">Niveau de confiance</span>
              <Chips items={CONFIDENCE_CHIPS} active={conf} onChange={setConf} />
            </div>
            {conf !== 'all' && !confAvailable && <p className="ds-muted">Filtre indisponible tant que la migration 109 n&apos;est pas appliquée.</p>}
            <ScatterChart points={scatterPoints} />
            <div className="ig-content-legend">
              {(['bas', 'milieu', 'haut'] as FunnelStage[]).map((st) => (
                <span key={st}>
                  <i style={{ background: FUNNEL_STAGE_COLOR[st] }} /> {FUNNEL_STAGE_LABEL[st]}
                </span>
              ))}
            </div>
            <p className="ig-chart-note">
              Taux = (likes + commentaires) ÷ vues, compteurs Instagram. Les vues sont sur une échelle logarithmique (sans ça, neuf bulles sur dix
              s&apos;empileraient à gauche) : une distance horizontale ne se lit pas comme une distance. Le taux, lui, est linéaire : 2 % vaut deux fois 1 %.
            </p>
          </TableCard>

          <TableCard
            title="Tout le contenu, du plus récent au plus ancien"
            subtitle="Cliquez une ligne pour voir les profils et leads liés"
            toolbar={
              <>
                <SearchInput value={search} onChange={setSearch} placeholder="Rechercher un contenu" />
                <Tabs
                  items={[
                    { key: 'audience' as TableView, label: 'Audience' },
                    { key: 'business' as TableView, label: 'Business' },
                  ]}
                  active={view}
                  onChange={setView}
                />
              </>
            }
          >
            {tableRows.length === 0 ? (
              <EmptyState title="Aucun contenu pour ces filtres" />
            ) : (
              <table className="ds-table">
                <thead>
                  <tr>
                    <th className="ds-num-cell">#</th>
                    <th>Contenu</th>
                    <th>Type</th>
                    <th className="ds-num-cell">Publié</th>
                    <th className="ds-num-cell">Vues</th>
                    {view === 'audience' ? (
                      <>
                        <th className="ds-num-cell">Taux</th>
                        <th className="ds-num-cell">Likers</th>
                        <th className="ds-num-cell">Commentaires</th>
                      </>
                    ) : (
                      <>
                        <th>Étape</th>
                        <th className="ds-num-cell">Leads</th>
                        <th className="ds-num-cell">Leads / 1 000 vues</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {paged.pageRows.map((c, i) => {
                    const st = c.engagementRate === null ? null : funnelStage(c.engagementRate)
                    return (
                      <tr key={c.contentId} className="ds-row-clickable" onClick={() => navigate(`/instagram/content/${encodeURIComponent(c.contentId)}`)}>
                        <td className="ds-num-cell">
                          <span className="ds-muted">{(paged.page - 1) * paged.size + i + 1}</span>
                        </td>
                        <td>
                          <div className="ds-contact">
                            <ContentThumb url={c.thumbnailUrl} size={28} />
                            <div className="ds-contact-name ig-caption">{c.caption || contentTypeLabel(c.contentType)}</div>
                          </div>
                        </td>
                        <td>
                          <span className="ig-type-pill">{c.contentType === 'clip' ? 'Reel' : 'Post'}</span>
                        </td>
                        <td className="ds-num-cell">
                          <span className="ds-num">{shortDate(c.publishedAt)}</span>
                        </td>
                        <td className="ds-num-cell">
                          <span className="ds-num">{c.views === null ? '—' : formatNumber(c.views)}</span>
                        </td>
                        {view === 'audience' ? (
                          <>
                            <td className="ds-num-cell">
                              <span className="ds-num">{formatRate(c.engagementRate)}</span>
                            </td>
                            <td className="ds-num-cell">
                              <span className="ds-num">{formatNumber(c.identifiedLikers)}</span>
                            </td>
                            <td className="ds-num-cell">
                              <span className="ds-num">{formatNumber(c.identifiedCommenters)}</span>
                            </td>
                          </>
                        ) : (
                          <>
                            <td>
                              {st ? (
                                <span className="ig-stage-pill" style={{ color: FUNNEL_STAGE_COLOR[st], borderColor: FUNNEL_STAGE_COLOR[st] }}>
                                  {FUNNEL_STAGE_LABEL[st]}
                                </span>
                              ) : (
                                <span className="ds-muted">—</span>
                              )}
                            </td>
                            <td className="ds-num-cell">
                              <span className="ds-num">{formatNumber(c.leadsCount)}</span>
                            </td>
                            <td className="ds-num-cell">
                              <span className="ds-num">{c.views ? ((c.leadsCount / c.views) * 1000).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) : '—'}</span>
                            </td>
                          </>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            <PaginationBar total={paged.total} page={paged.page} pages={paged.pages} size={paged.size} onPage={paged.setPage} onSize={paged.setSize} />
          </TableCard>
        </>
      )}
    </div>
  )
}
