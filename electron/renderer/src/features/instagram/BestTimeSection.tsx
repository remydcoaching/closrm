// Audience › « Quand publier » (Insyder layout): for reels, the hour with the
// best median views / likes / comments; for stories, the weekday with the
// best median views / likes. Only hours / days with enough contents compete.
import { useMemo, useState } from 'react'
import { TableCard } from '../../design-system/TableCard'
import { formatNumber } from '../../design-system/StatCard'
import { useCachedQuery } from '../../lib/use-cached-query'
import { bestHour, bestWeekday, WEEKDAY_LABELS, WEEKDAY_SHORT, type BucketBest, type TimedValue } from './best-time'
import type { ContentChartPoint } from './types'

interface StoryTiming {
  storyPk: string
  takenAt: string
  views: number | null
  likes: number
}

function Bars({ b, labels, ticks }: { b: BucketBest; labels: string[]; ticks?: Record<number, string> }) {
  const max = Math.max(1, ...b.medians.map((m) => m ?? 0))
  return (
    <div className="bt-bars-wrap">
      <div className="bt-bars">
        {b.medians.map((m, i) => (
          <span key={i} title={`${labels[i]} · ${m === null ? `${b.counts[i]} contenu(s), pas assez pour comparer` : `${formatNumber(Math.round(m))} en médiane · ${b.counts[i]} contenus`}`}>
            <i className={i === b.best ? 'bt-best' : m === null ? 'bt-off' : ''} style={{ height: `${m === null ? 3 : Math.max(6, (m / max) * 100)}%` }} />
          </span>
        ))}
      </div>
      {ticks && (
        <div className="bt-ticks">
          {Object.entries(ticks).map(([i, t]) => (
            <span key={i} style={{ left: `${(Number(i) / b.medians.length) * 100}%` }}>
              {t}
            </span>
          ))}
        </div>
      )}
      {!ticks && (
        <div className="bt-day-ticks">
          {labels.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      )}
    </div>
  )
}

function Card({ title, b, unit, kind, extra }: { title: string; b: BucketBest; unit: string; kind: 'hour' | 'day'; extra?: React.ReactNode }) {
  const what = kind === 'hour' ? 'reels' : 'stories'
  return (
    <div className="bt-card">
      <div className="bt-title">{title}</div>
      {b.best === null ? (
        <p className="bt-empty">Pas encore assez de {what} pour comparer ({kind === 'hour' ? '2 par heure' : '2 par jour'} au moins).</p>
      ) : (
        <>
          <div className="bt-best-label">{kind === 'hour' ? `${b.best} h–${b.best + 1} h` : WEEKDAY_LABELS[b.best]}</div>
          <div className="bt-value">
            <b>
              {formatNumber(Math.round(b.bestMedian ?? 0))} {unit} en médiane
            </b>{' '}
            · sur {b.bestCount} {what}
          </div>
        </>
      )}
      <Bars
        b={b}
        labels={kind === 'hour' ? b.medians.map((_, i) => `${i} h`) : WEEKDAY_LABELS}
        ticks={kind === 'hour' ? { 0: '0 h', 6: '6 h', 12: '12 h', 18: '18 h' } : undefined}
      />
      <div className="bt-foot">
        {b.compared} {kind === 'hour' ? 'heures' : 'jours'} comparé{b.compared > 1 ? 's' : ''}
        {extra}
      </div>
    </div>
  )
}

export function BestTimeSection({ contents, periodDays }: { contents: ContentChartPoint[] | null; periodDays: number }) {
  const storiesQuery = useCachedQuery<{ data: StoryTiming[] }>('/api/instagram/audience/stories-timing', { screen: 'StoriesTiming', staleMs: 5 * 60_000 })
  // Fixed for the life of the screen: the period is in days, a render later doesn't change it.
  const [now] = useState(() => Date.now())
  const storyRows = storiesQuery.data?.data

  const { reels, stories, rViews, rLikes, rComments, rViewsDay, sViews, sLikes } = useMemo(() => {
    const since = new Date(now - periodDays * 86_400_000).toISOString()
    const reels = (contents ?? []).filter((c) => c.contentType === 'clip' && c.publishedAt && c.publishedAt >= since)
    const series = (pick: (c: ContentChartPoint) => number | null): TimedValue[] =>
      reels.flatMap((c) => {
        const v = pick(c)
        return v === null || !c.publishedAt ? [] : [{ at: c.publishedAt, value: v }]
      })
    const stories = (storyRows ?? []).filter((s) => s.takenAt >= since)
    return {
      reels,
      stories,
      rViews: bestHour(series((c) => c.views)),
      rLikes: bestHour(series((c) => c.likesCount)),
      rComments: bestHour(series((c) => c.commentsCount)),
      rViewsDay: bestWeekday(series((c) => c.views)),
      sViews: bestWeekday(stories.flatMap((s) => (s.views === null ? [] : [{ at: s.takenAt, value: s.views }]))),
      sLikes: bestWeekday(stories.map((s) => ({ at: s.takenAt, value: s.likes }))),
    }
  }, [contents, storyRows, periodDays, now])

  const bestDay =
    rViewsDay.best !== null ? (
      <span>
        {' '}
        · Meilleur jour : <b>{WEEKDAY_LABELS[rViewsDay.best]}</b> · {formatNumber(Math.round(rViewsDay.bestMedian ?? 0))} vues en médiane
      </span>
    ) : null

  return (
    <TableCard title="Quand publier" subtitle="Ce que vos contenus ont obtenu selon le moment où vous les avez publiés — vos habitudes, pas une loi. Heures locales.">
      <div className="bt-group">
        <div className="bt-group-head">
          <h3>Vos reels</h3>
          <span className="ds-muted">{reels.length} reels sur la période</span>
        </div>
        <div className="bt-grid">
          <Card title="Pour le plus de vues" b={rViews} unit="vues" kind="hour" extra={bestDay} />
          <Card title="Pour le plus de j'aime" b={rLikes} unit="j'aime" kind="hour" />
          <Card title="Pour le plus de commentaires" b={rComments} unit="commentaires" kind="hour" />
        </div>
      </div>
      <div className="bt-group">
        <div className="bt-group-head">
          <h3>Vos stories</h3>
          <span className="ds-muted">{stories.length} stories collectées sur la période</span>
        </div>
        <div className="bt-grid">
          <Card title="Pour le plus de vues" b={sViews} unit="vues" kind="day" />
          <Card title="Pour le plus de j'aime" b={sLikes} unit="j'aime" kind="day" />
          <div className="bt-card bt-card--muted">
            <div className="bt-title">Pour le plus de réponses</div>
            <p className="bt-empty">Les réponses et réactions aux stories arrivent par la messagerie Meta, disponible après validation de l&apos;app par Meta.</p>
            <div className="bt-day-ticks">
              {WEEKDAY_SHORT.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </TableCard>
  )
}
