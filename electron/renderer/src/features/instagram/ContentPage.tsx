// Instagram > Content — the engagement-vs-views chart (log-x, linear-y
// scatter, see ScatterChart.tsx) reads GET /api/instagram/content/chart,
// itself joining discovery_contents (migration 103, view counts from Hiker
// scans) with instagram_content_summary (099, observed interaction counts
// for both Hiker and Apify). The list below reads GET /api/instagram/content
// (the aggregation-only view) for content without a captured view count.
// Funnel stage is a documented proxy from engagement rate (see
// funnel-stage.ts) — never derived from fabricated lead-confidence links.
import { useEffect, useMemo, useState } from 'react'
import { api, ApiError } from '../../lib/api-client'
import { ScatterChart, type ScatterPoint } from '../../design-system/ScatterChart'
import { LoadingState, ErrorState, EmptyState } from '../../design-system/States'
import { safeExternalUrl } from '../../lib/safe-url'
import { funnelStage, FUNNEL_STAGE_LABEL, FUNNEL_STAGE_COLOR, type FunnelStage } from './funnel-stage'
import type { InstagramContentSummary, ContentChartPoint } from './types'
import './instagram.css'

const PERIOD_OPTIONS = [
  { key: '7', label: '7 jours' },
  { key: '30', label: '30 jours' },
  { key: '90', label: '90 jours' },
  { key: '365', label: '1 an' },
  { key: '', label: 'Tout' },
]

const STAGE_OPTIONS: { key: FunnelStage; label: string }[] = [
  { key: 'haut', label: FUNNEL_STAGE_LABEL.haut },
  { key: 'milieu', label: FUNNEL_STAGE_LABEL.milieu },
  { key: 'bas', label: FUNNEL_STAGE_LABEL.bas },
]

const PlaceholderThumb = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M21 15l-5-5L5 21" />
  </svg>
)

export function ContentPage() {
  const [period, setPeriod] = useState('365')
  const [stageFilter, setStageFilter] = useState<FunnelStage | null>(null)
  const [chartPoints, setChartPoints] = useState<ContentChartPoint[] | null>(null)
  const [chartError, setChartError] = useState<string | null>(null)
  const [items, setItems] = useState<InstagramContentSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadChart() {
    setChartError(null)
    try {
      const params = period ? `?days=${period}` : ''
      const res = await api.get<{ data: ContentChartPoint[] }>(`/api/instagram/content/chart${params}`)
      setChartPoints(res.data)
    } catch (err) {
      setChartError(err instanceof ApiError ? err.message : 'Erreur inconnue')
    }
  }

  async function loadList() {
    setError(null)
    try {
      const res = await api.get<{ data: InstagramContentSummary[] }>('/api/instagram/content?per_page=50')
      setItems(res.data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inconnue')
    }
  }

  useEffect(() => {
    loadChart()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period])

  useEffect(() => {
    loadList()
  }, [])

  const filteredChartPoints = useMemo(() => {
    if (!chartPoints) return []
    if (!stageFilter) return chartPoints
    return chartPoints.filter((p) => funnelStage(p.engagementRate) === stageFilter)
  }, [chartPoints, stageFilter])

  const scatterPoints: ScatterPoint[] = filteredChartPoints.map((p) => {
    const stage = funnelStage(p.engagementRate)
    const safeUrl = safeExternalUrl(p.contentUrl)
    return {
      id: p.contentId,
      x: p.views,
      y: p.engagementRate,
      radius: p.leadsCount,
      color: FUNNEL_STAGE_COLOR[stage],
      label: p.contentId,
      onClick: safeUrl ? () => window.open(safeUrl, '_blank', 'noopener,noreferrer') : undefined,
      tooltip: (
        <div>
          <div className="scatter-tooltip-title">{FUNNEL_STAGE_LABEL[stage]}</div>
          <div>Vues : {p.views.toLocaleString('fr-FR')}</div>
          <div>Taux d'engagement : {(p.engagementRate * 100).toFixed(2)}%</div>
          <div>
            {p.likesCount} like{p.likesCount > 1 ? 's' : ''} et {p.commentsCount} commentaire{p.commentsCount > 1 ? 's' : ''} identifiés
          </div>
          <div>{p.leadsCount} lead{p.leadsCount > 1 ? 's' : ''} généré{p.leadsCount > 1 ? 's' : ''}</div>
        </div>
      ),
    }
  })

  return (
    <div className="ig-page">
      <div className="ig-page-header">
        <div>
          <h1>Content</h1>
          <p>Quel contenu amène des leads — un point par contenu, taille = leads générés.</p>
        </div>
      </div>

      <div className="ig-page-filters">
        {PERIOD_OPTIONS.map((opt) => (
          <button key={opt.key} className={`ig-filter-chip ${period === opt.key ? 'ig-filter-chip--active' : ''}`} onClick={() => setPeriod(opt.key)}>
            {opt.label}
          </button>
        ))}
        <span className="ig-filter-divider" />
        <button className={`ig-filter-chip ${!stageFilter ? 'ig-filter-chip--active' : ''}`} onClick={() => setStageFilter(null)}>
          Tous les niveaux
        </button>
        {STAGE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            className={`ig-filter-chip ${stageFilter === opt.key ? 'ig-filter-chip--active' : ''}`}
            style={stageFilter === opt.key ? { borderColor: FUNNEL_STAGE_COLOR[opt.key], color: FUNNEL_STAGE_COLOR[opt.key] } : undefined}
            onClick={() => setStageFilter(opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {chartError && <ErrorState message={chartError} onRetry={loadChart} />}
      {chartPoints === null && !chartError && <LoadingState label="Chargement du graphique…" />}
      {chartPoints && (
        <div className="ig-chart-section">
          {scatterPoints.length === 0 ? (
            <EmptyState title="Aucun contenu avec des vues connues" description="Lancez une analyse Ciblage pour capturer les vues de vos contenus." />
          ) : (
            <ScatterChart points={scatterPoints} />
          )}
          <p className="ig-chart-note">
            Vues en échelle logarithmique (axe X) — sans ça, la plupart des contenus se retrouveraient tassés à gauche. Le taux d'engagement (axe Y)
            reste linéaire : 2% vaut deux fois 1%.
          </p>
        </div>
      )}

      <div className="ig-page-section">
        <h2>Tout le contenu ayant généré des interactions</h2>
        {items === null && !error && <LoadingState label="Chargement…" />}
        {error && <ErrorState message={error} onRetry={loadList} />}
        {items && items.length === 0 && <EmptyState title="Aucun contenu" description="Lancez une analyse pour découvrir du contenu engageant." />}

        {items && items.length > 0 && (
          <div className="ig-content-grid">
            {items.map((item) => {
              const safeUrl = safeExternalUrl(item.source_post_url)
              return (
                <div key={item.source_post_id} className="ig-content-card">
                  {safeUrl ? (
                    <a
                      href={safeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ig-content-thumb ig-content-thumb--clickable"
                      title="Ouvrir le post sur Instagram — aucune miniature Hiker disponible aujourd'hui"
                    >
                      {PlaceholderThumb}
                    </a>
                  ) : (
                    <div className="ig-content-thumb">{PlaceholderThumb}</div>
                  )}
                  <div className="ig-content-body">
                    <div className="ig-content-provider">
                      {item.source_provider === 'hiker' ? 'Hiker' : item.source_provider === 'apify' ? 'Apify' : '—'}
                    </div>
                    <div className="ig-content-stats">
                      <span>
                        {item.leads_count} prospect{item.leads_count > 1 ? 's' : ''}
                      </span>
                      <span>
                        {item.likes_count} like{item.likes_count > 1 ? 's' : ''} observé{item.likes_count > 1 ? 's' : ''}
                      </span>
                      <span>
                        {item.comments_count} commentaire{item.comments_count > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="ig-content-date">Dernière interaction : {new Date(item.last_interaction_at).toLocaleDateString('fr-FR')}</div>
                    {safeUrl && (
                      <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="ig-content-link">
                        Voir sur Instagram
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
