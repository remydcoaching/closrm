// YouTube › Acquisition / Inbox / Vidéos / Insights — port of the web's
// Yt*Tab components. Endpoints: /api/youtube/videos, /videos/:id,
// /snapshots?days=30, /comments?limit=, /sync.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api-client'
import { StatCard, StatGrid, formatNumber } from '../../design-system/StatCard'
import { TableCard } from '../../design-system/TableCard'
import { Chips } from '../../design-system/Tabs'
import { SearchInput } from '../../design-system/SearchInput'
import { Drawer } from '../../design-system/Drawer'
import { EmptyState, ErrorState, LoadingState } from '../../design-system/States'
import { AcquisitionInbox, useSocialLeadCreation, type InboxItem } from './AcquisitionInbox'
import { classifyIntent, fmtCompact, intentSortValue } from './social-utils'
import { errMsg } from './http'
import type { ListResponse, YtAccount, YtComment, YtSnapshot, YtVideo, YtVideoWithStats } from './types'

type Notify = (text: string, tone?: 'success' | 'danger' | 'info' | 'warning') => void

function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

function useYtInboxItems(comments: YtComment[], notify: Notify): InboxItem[] {
  const onError = useCallback((m: string) => notify(m, 'danger'), [notify])
  const createLead = useSocialLeadCreation(onError)
  return useMemo(
    () =>
      comments.map((c) => ({
        id: `yt-${c.id}`,
        source: 'comment' as const,
        username: c.author_name,
        avatarUrl: c.author_avatar_url,
        text: c.text,
        timestamp: c.published_at,
        context: c.yt_videos?.title ?? null,
        externalUrl: c.yt_videos?.yt_video_id ? `https://youtu.be/${c.yt_videos.yt_video_id}` : null,
        onCreateLead: () =>
          void createLead({
            username: c.author_name ?? '',
            source: 'manuel',
            notes: `Commentaire YouTube : "${c.text}"\nSur vidéo : ${c.yt_videos?.title ?? '—'}`,
          }),
      })),
    [comments, createLead],
  )
}

export function YtAcquisitionTab({ account, notify, onSeeInbox }: { account: YtAccount; notify: Notify; onSeeInbox: () => void }) {
  const [videos, setVideos] = useState<YtVideo[]>([])
  const [snapshots, setSnapshots] = useState<YtSnapshot[]>([])
  const [comments, setComments] = useState<YtComment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [v, s, c] = await Promise.all([
        api.get<ListResponse<YtVideo>>('/api/youtube/videos?per_page=50'),
        api.get<ListResponse<YtSnapshot>>('/api/youtube/snapshots?days=30'),
        api.get<ListResponse<YtComment>>('/api/youtube/comments?limit=100'),
      ])
      setVideos(v.data ?? [])
      setSnapshots(s.data ?? [])
      setComments(c.data ?? [])
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const items = useYtInboxItems(comments, notify)
  const hot = items.filter((i) => intentSortValue(classifyIntent(i.text)) >= 3)
  const latest = snapshots[snapshots.length - 1] ?? null
  const subscribers = latest?.subscribers ?? account.subscribers_baseline
  const top = [...videos]
    .sort((a, b) => {
      const ea = a.views > 0 ? (a.likes + a.comments * 2) / a.views : 0
      const eb = b.views > 0 ? (b.likes + b.comments * 2) / b.views : 0
      return eb - ea
    })
    .slice(0, 5)

  if (error) return <ErrorState message={error} onRetry={() => void load()} />

  return (
    <div className="soc-stack">
      <StatGrid>
        <StatCard label="Signaux d'intention" value={loading ? '—' : hot.length} highlight caption="Commentaires d’achat / RDV / info" onClick={onSeeInbox} />
        <StatCard label="Commentaires" value={loading ? '—' : comments.length} caption="100 derniers synchronisés" />
        <StatCard
          label="Vues (30 j)"
          value={loading || latest?.views_30d == null ? '—' : latest.views_30d}
          caption={latest?.watch_time_minutes_30d ? `${formatNumber(latest.watch_time_minutes_30d)} min de visionnage` : 'Synchronise pour mettre à jour'}
        />
        <StatCard
          label="Abonnés"
          value={loading || subscribers == null ? '—' : subscribers}
          caption={latest?.subscribers_gained_30d != null ? `+${formatNumber(latest.subscribers_gained_30d)} sur 30 j` : 'Croissance 30 j'}
        />
      </StatGrid>

      <section className="soc-card">
        <div className="soc-card-head">
          <div>
            <h2 className="soc-card-title">Inbox d'acquisition</h2>
            <p className="soc-card-sub">Commentaires triés par intention d'achat</p>
          </div>
          {items.length > 6 && (
            <button type="button" className="ds-pill-button" onClick={onSeeInbox}>
              Voir toute l’inbox →
            </button>
          )}
        </div>
        <AcquisitionInbox items={items} loading={loading} previewLimit={6} emptyLabel="Aucun commentaire synchronisé — utilise le bouton Synchroniser." />
      </section>

      <TableCard title="Top vidéos (engagement)" subtitle="(likes + 2 × commentaires) / vues">
        {loading ? (
          <LoadingState />
        ) : top.length === 0 ? (
          <EmptyState title="Aucune vidéo synchronisée pour l’instant." />
        ) : (
          <table className="ds-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Vidéo</th>
                <th className="ds-num-cell">Vues</th>
                <th className="ds-num-cell">Likes</th>
                <th className="ds-num-cell">Com.</th>
                <th className="ds-num-cell">Watch time</th>
                <th className="ds-num-cell">Engagement</th>
              </tr>
            </thead>
            <tbody>
              {top.map((v, i) => (
                <tr key={v.id} className="ds-row-clickable" onClick={() => window.open(v.video_url ?? `https://youtu.be/${v.yt_video_id}`, '_blank')}>
                  <td className="ds-num">{i + 1}</td>
                  <td style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{v.title ?? 'Sans titre'}</td>
                  <td className="ds-num-cell"><span className="ds-num">{fmtCompact(v.views)}</span></td>
                  <td className="ds-num-cell"><span className="ds-num">{fmtCompact(v.likes)}</span></td>
                  <td className="ds-num-cell"><span className="ds-num">{fmtCompact(v.comments)}</span></td>
                  <td className="ds-num-cell"><span className="ds-num">{v.watch_time_minutes > 0 ? `${fmtCompact(v.watch_time_minutes)} min` : '—'}</span></td>
                  <td className="ds-num-cell"><span className="ds-num">{v.views > 0 ? `${(((v.likes + v.comments * 2) / v.views) * 100).toFixed(1)} %` : '—'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableCard>
    </div>
  )
}

export function YtInboxTab({ notify }: { notify: Notify }) {
  const [comments, setComments] = useState<YtComment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await api.get<ListResponse<YtComment>>('/api/youtube/comments?limit=200')
      setComments(r.data ?? [])
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const items = useYtInboxItems(comments, notify)

  return (
    <section className="soc-card">
      <div>
        <h2 className="soc-card-title">Inbox d'acquisition YouTube</h2>
        <p className="soc-card-sub">Commentaires triés par intention. Repère les questions d'achat et convertis-les en leads.</p>
      </div>
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : <AcquisitionInbox items={items} loading={loading} showFilters emptyLabel="Aucun commentaire synchronisé." />}
    </section>
  )
}

export function YtVideosTab() {
  const [videos, setVideos] = useState<YtVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [format, setFormat] = useState<'all' | 'short' | 'long'>('all')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const p = new URLSearchParams({ per_page: '100' })
    if (format !== 'all') p.set('format', format)
    if (debounced) p.set('search', debounced)
    api
      .get<ListResponse<YtVideo>>(`/api/youtube/videos?${p.toString()}`)
      .then((r) => !cancelled && setVideos(r.data ?? []))
      .catch((e) => !cancelled && setError(errMsg(e)))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [format, debounced])

  return (
    <>
      <TableCard
        title="Vidéos"
        subtitle={loading ? 'Chargement…' : `${videos.length} vidéo${videos.length > 1 ? 's' : ''}`}
        toolbar={
          <div className="soc-row">
            <SearchInput value={search} onChange={setSearch} placeholder="Rechercher une vidéo…" />
            <Chips
              items={[
                { key: 'all', label: 'Tout' },
                { key: 'short', label: 'Shorts' },
                { key: 'long', label: 'Vidéos longues' },
              ]}
              active={format}
              onChange={setFormat}
            />
          </div>
        }
      >
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} />
        ) : videos.length === 0 ? (
          <EmptyState title={`Aucune vidéo ${search ? 'trouvée' : 'synchronisée'}.`} />
        ) : (
          <table className="ds-table">
            <thead>
              <tr>
                <th>Vidéo</th>
                <th className="ds-num-cell">Vues</th>
                <th className="ds-num-cell">Likes</th>
                <th className="ds-num-cell">Com.</th>
                <th className="ds-num-cell">Watch time</th>
                <th className="ds-num-cell">Revenu</th>
              </tr>
            </thead>
            <tbody>
              {videos.map((v) => (
                <tr key={v.id} className="ds-row-clickable" onClick={() => setSelected(v.id)}>
                  <td>
                    <div className="soc-row" style={{ flexWrap: 'nowrap' }}>
                      {v.thumbnail_url ? (
                        <img src={v.thumbnail_url} alt="" style={{ width: 80, height: 45, objectFit: 'cover', borderRadius: 6 }} />
                      ) : (
                        <div style={{ width: 80, height: 45, borderRadius: 6, background: 'var(--color-bg-muted)' }} />
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title ?? '(sans titre)'}</div>
                        <div className="ds-muted" style={{ fontSize: 11 }}>
                          {v.format === 'short' ? 'SHORT · ' : ''}
                          {v.published_at ? new Date(v.published_at).toLocaleDateString('fr-FR') : '—'} · {v.duration_seconds ? fmtDuration(v.duration_seconds) : '—'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="ds-num-cell"><span className="ds-num">{formatNumber(v.views)}</span></td>
                  <td className="ds-num-cell"><span className="ds-num">{formatNumber(v.likes)}</span></td>
                  <td className="ds-num-cell"><span className="ds-num">{formatNumber(v.comments)}</span></td>
                  <td className="ds-num-cell"><span className="ds-num">{formatNumber(v.watch_time_minutes)} min</span></td>
                  <td className="ds-num-cell"><span className="ds-num">{v.estimated_revenue != null ? `${v.estimated_revenue.toFixed(2)} €` : '—'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableCard>
      {selected && <YtVideoDrawer id={selected} onClose={() => setSelected(null)} />}
    </>
  )
}

function YtVideoDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [video, setVideo] = useState<YtVideoWithStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<{ data: YtVideoWithStats }>(`/api/youtube/videos/${id}`)
      .then((r) => setVideo(r.data))
      .catch((e) => setError(errMsg(e)))
  }, [id])

  const traffic = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of video?.traffic_sources ?? []) map.set(t.source_type, (map.get(t.source_type) ?? 0) + t.views)
    const total = [...map.values()].reduce((s, v) => s + v, 0)
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ k, v, pct: total ? (v / total) * 100 : 0 }))
  }, [video])

  const daily = video?.daily_stats ?? []
  const maxDaily = Math.max(1, ...daily.map((d) => d.views))

  return (
    <Drawer title="Détail vidéo" onClose={onClose}>
      {error ? (
        <ErrorState message={error} />
      ) : !video ? (
        <LoadingState />
      ) : (
        <div className="soc-stack">
          <h2 className="soc-card-title">{video.title ?? '(sans titre)'}</h2>
          <span className="soc-muted">
            {video.format === 'short' ? 'SHORT · ' : ''}
            {video.published_at ? new Date(video.published_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
            {video.duration_seconds != null && ` · ${fmtDuration(video.duration_seconds)}`}
            {video.privacy_status && ` · ${video.privacy_status}`}
          </span>
          <button type="button" className="ds-pill-button ds-pill-button--dark" onClick={() => window.open(video.video_url ?? `https://youtu.be/${video.yt_video_id}`, '_blank')}>
            Voir sur YouTube ↗
          </button>
          <StatGrid>
            <StatCard label="Vues" value={video.views} highlight />
            <StatCard label="Likes" value={video.likes} />
            <StatCard label="Commentaires" value={video.comments} />
            <StatCard label="Watch time" value={video.watch_time_minutes} unit="min" />
            <StatCard label="Durée moyenne" value={video.average_view_duration_sec} unit="s" caption={`${video.average_view_percentage.toFixed(1)} % vu`} />
            {video.estimated_revenue != null && <StatCard label="Revenu" value={`${video.estimated_revenue.toFixed(2)} €`} />}
          </StatGrid>
          {video.description && (
            <section className="soc-card">
              <h3 className="soc-card-title">Description</h3>
              <p style={{ margin: 0, fontSize: 13, whiteSpace: 'pre-wrap' }}>{video.description}</p>
            </section>
          )}
          {daily.length > 1 && (
            <section className="soc-card">
              <h3 className="soc-card-title">Vues — 30 derniers jours</h3>
              <svg className="soc-chart" viewBox="0 0 100 60" preserveAspectRatio="none">
                <polyline
                  fill="none"
                  stroke="#FF0000"
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                  points={daily.map((d, i) => `${((i / (daily.length - 1)) * 100).toFixed(1)},${(60 - (d.views / maxDaily) * 58).toFixed(1)}`).join(' ')}
                />
              </svg>
            </section>
          )}
          {traffic.length > 0 && (
            <section className="soc-card">
              <h3 className="soc-card-title">Sources de trafic</h3>
              {traffic.map((t) => (
                <div key={t.k} className="soc-field">
                  <div className="soc-label">
                    <span>{t.k}</span>
                    <span className="ds-num">{formatNumber(t.v)} · {t.pct.toFixed(1)} %</span>
                  </div>
                  <div className="soc-bar"><span style={{ width: `${t.pct}%` }} /></div>
                </div>
              ))}
            </section>
          )}
          {video.demographics.length > 0 && (
            <section className="soc-card">
              <h3 className="soc-card-title">Démographie</h3>
              {video.demographics.slice(0, 8).map((d) => (
                <div key={`${d.age_group}-${d.gender}`} className="soc-row" style={{ flexWrap: 'nowrap' }}>
                  <span className="soc-muted" style={{ width: 120 }}>{d.age_group.replace('age', '')} · {d.gender}</span>
                  <div className="soc-bar" style={{ flex: 1 }}><span style={{ width: `${d.viewer_percentage}%` }} /></div>
                  <span className="ds-num" style={{ width: 50, textAlign: 'right' }}>{d.viewer_percentage.toFixed(1)} %</span>
                </div>
              ))}
            </section>
          )}
        </div>
      )}
    </Drawer>
  )
}

export function YtInsightsTab() {
  return <EmptyState title="Insights & meilleur moment pour publier" description="Pas encore disponible sur le web non plus (prochaine itération : heures optimales, suggestions IA)." />
}
