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
import type { ContentChartPoint } from './types'
import './instagram.css'

type Period = '7' | '30' | '90' | '365' | 'all'
type Format = 'all' | 'clip' | 'media'
type StageFilter = 'all' | FunnelStage

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
  const [items, setItems] = useState<ContentChartPoint[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setError(null)
    setItems(null)
    try {
      const params = period === 'all' ? '' : `?days=${period}`
      const res = await api.get<{ data: ContentChartPoint[] }>(`/api/instagram/content/chart${params}`)
      setItems(res.data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inconnue')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period])

  const filtered = useMemo(() => {
    return (items ?? []).filter((c) => {
      if (format !== 'all' && c.contentType !== format) return false
      if (stage !== 'all' && (c.engagementRate === null || funnelStage(c.engagementRate) !== stage)) return false
      return true
    })
  }, [items, format, stage])

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
        radius: c.leadsCount,
        color: FUNNEL_STAGE_COLOR[st],
        label: c.contentId,
        onClick: () => navigate(`/instagram/content/${encodeURIComponent(c.contentId)}`),
        tooltip: (
          <div>
            <div className="scatter-tooltip-title">
              {contentTypeLabel(c.contentType)} · {FUNNEL_STAGE_LABEL[st]}
            </div>
            <div>Vues : {formatNumber(c.views as number)}</div>
            <div>Taux d&apos;engagement : {formatRate(c.engagementRate)}</div>
            <div>
              {formatNumber(c.identifiedLikers)} likers et {formatNumber(c.identifiedCommenters)} commentaires identifiés
            </div>
            <div>
              {c.leadsCount} lead{c.leadsCount > 1 ? 's' : ''}
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
            </div>
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

          <TableCard title="Tout le contenu, du plus récent au plus ancien" subtitle="Cliquez une ligne pour voir les profils et leads liés">
            {filtered.length === 0 ? (
              <EmptyState title="Aucun contenu pour ces filtres" />
            ) : (
              <table className="ds-table">
                <thead>
                  <tr>
                    <th>Contenu</th>
                    <th>Étape</th>
                    <th className="ds-num-cell">Publié le</th>
                    <th className="ds-num-cell">Vues</th>
                    <th className="ds-num-cell">Taux</th>
                    <th className="ds-num-cell">Likers identifiés</th>
                    <th className="ds-num-cell">Commentaires</th>
                    <th className="ds-num-cell">Leads</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const st = c.engagementRate === null ? null : funnelStage(c.engagementRate)
                    return (
                      <tr key={c.contentId} className="ds-row-clickable" onClick={() => navigate(`/instagram/content/${encodeURIComponent(c.contentId)}`)}>
                        <td>
                          <div className="ds-contact">
                            <ContentThumb url={c.thumbnailUrl} size={30} />
                            <div className="ds-contact-text">
                              <div className="ds-contact-name">{contentTypeLabel(c.contentType)}</div>
                              <div className="ds-muted">{c.contentId}</div>
                            </div>
                          </div>
                        </td>
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
                          <span className="ds-num">{shortDate(c.publishedAt)}</span>
                        </td>
                        <td className="ds-num-cell">
                          <span className="ds-num">{c.views === null ? '—' : formatNumber(c.views)}</span>
                        </td>
                        <td className="ds-num-cell">
                          <span className="ds-num">{formatRate(c.engagementRate)}</span>
                        </td>
                        <td className="ds-num-cell">
                          <span className="ds-num">{formatNumber(c.identifiedLikers)}</span>
                        </td>
                        <td className="ds-num-cell">
                          <span className="ds-num">{formatNumber(c.identifiedCommenters)}</span>
                        </td>
                        <td className="ds-num-cell">
                          <span className="ds-num">{formatNumber(c.leadsCount)}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </TableCard>
        </>
      )}
    </div>
  )
}
