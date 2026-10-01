// Instagram › Acquisition + Inbox — port of IgAcquisitionTab.tsx / IgInboxTab.tsx.
// Same endpoints: /api/instagram/conversations, /snapshots, /comments, /reels,
// /pillars; lead creation via /api/leads (+ PATCH conversation lead_id).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api-client'
import { swrGet, swrMany } from '../../lib/query-cache'
import { openWeb } from '../../lib/web-link'
import { StatCard, StatGrid, formatNumber } from '../../design-system/StatCard'
import { EmptyState, ErrorState, LoadingState } from '../../design-system/States'
import { AcquisitionInbox, useSocialLeadCreation, type InboxItem } from './AcquisitionInbox'
import { classifyIntent, fmtCompact, intentSortValue, reelUrl } from './social-utils'
import { errMsg, http } from './http'
import type { ContentPillar, IgComment, IgConversation, IgReel, IgSnapshot, ListResponse } from './types'

type Notify = (text: string, tone?: 'success' | 'danger' | 'info' | 'warning') => void

function useInboxItems(conversations: IgConversation[], comments: IgComment[], notify: Notify): InboxItem[] {
  const onError = useCallback((m: string) => notify(m, 'danger'), [notify])
  const createLead = useSocialLeadCreation(onError)
  return useMemo(() => {
    const dms: InboxItem[] = conversations.map((c) => {
      const username = c.participant_username ?? c.participant_name ?? ''
      return {
        id: `dm-${c.id}`,
        source: 'dm',
        username: c.participant_username ?? c.participant_name ?? null,
        avatarUrl: c.participant_avatar_url,
        text: c.last_message_text,
        timestamp: c.last_message_at,
        hasLead: !!c.lead_id,
        onOpen: () => void openWeb(`/messages?conversation=${c.id}`),
        onCreateLead: c.lead_id
          ? undefined
          : () =>
              void createLead({
                username,
                firstName: c.participant_name?.split(' ')[0] ?? username,
                lastName: c.participant_name?.split(' ').slice(1).join(' '),
                source: 'instagram_ads',
                notes: `Importé depuis DM Instagram (@${username})`,
                afterCreate: async (leadId) => {
                  await api.patch(`/api/instagram/conversations/${c.id}`, { lead_id: leadId }).catch(() => null)
                },
              }),
      }
    })
    const cms: InboxItem[] = comments.map((c) => ({
      id: `cm-${c.id}`,
      source: 'comment',
      username: c.username,
      text: c.text,
      timestamp: c.timestamp,
      context: c.media_caption ?? null,
      onCreateLead: () =>
        void createLead({
          username: c.username ?? '',
          source: 'instagram_ads',
          notes: `Commentaire Instagram : "${c.text}"\nSur post : ${c.media_caption ?? '—'}`,
        }),
    }))
    return [...dms, ...cms]
  }, [conversations, comments, createLead])
}

export function IgAcquisitionTab({ notify, onSeeInbox }: { notify: Notify; onSeeInbox: () => void }) {
  const [conversations, setConversations] = useState<IgConversation[]>([])
  const [comments, setComments] = useState<IgComment[]>([])
  const [reels, setReels] = useState<IgReel[]>([])
  const [snapshots, setSnapshots] = useState<IgSnapshot[]>([])
  const [pillars, setPillars] = useState<ContentPillar[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      // Last known values at once, fresh ones right after.
      await swrMany<[ListResponse<IgConversation>, ListResponse<IgSnapshot>]>(['/api/instagram/conversations?per_page=30', '/api/instagram/snapshots'], ([conv, snaps]) => {
        setConversations(conv.data ?? [])
        setSnapshots(snaps.data ?? [])
        setLoading(false)
      })
      await Promise.all([
        swrGet<ListResponse<IgComment>>('/api/instagram/comments', (r) => setComments(r.data ?? [])).catch(() => setComments([])),
        swrGet<ListResponse<IgReel>>('/api/instagram/reels?per_page=50', (r) => setReels(r.data ?? [])).catch(() => setReels([])),
        swrGet<ListResponse<ContentPillar>>('/api/instagram/pillars', (r) => setPillars(r.data ?? [])).catch(() => setPillars([])),
      ])
    } catch (e) {
      setError(errMsg(e))
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const items = useInboxItems(conversations, comments, notify)
  const hotSignals = useMemo(() => items.filter((i) => intentSortValue(classifyIntent(i.text)) >= 3), [items])

  const latest = snapshots[snapshots.length - 1] ?? null
  const newFollowers30d = useMemo(() => {
    if (snapshots.length < 2) return latest?.new_followers ?? null
    const last = snapshots[snapshots.length - 1]
    const ref = snapshots.find((s) => (Date.parse(last.snapshot_date) - Date.parse(s.snapshot_date)) / 86400000 <= 30)
    return ref ? last.followers - ref.followers : null
  }, [snapshots, latest])

  const reels30d = useMemo(() => {
    const cutoff = Date.now() - 30 * 86400000
    return reels.filter((r) => r.published_at && Date.parse(r.published_at) >= cutoff)
  }, [reels])
  const avgEng30d = reels30d.length > 0 ? reels30d.reduce((s, r) => s + r.engagement_rate, 0) / reels30d.length : null
  const topReels = useMemo(() => [...reels].sort((a, b) => b.engagement_rate - a.engagement_rate).slice(0, 5), [reels])

  const pillarStats = useMemo(() => {
    const map = new Map<string, { pillar: ContentPillar; count: number; views: number; eng: number }>()
    for (const p of pillars) map.set(p.id, { pillar: p, count: 0, views: 0, eng: 0 })
    for (const r of reels) {
      const s = r.pillar_id ? map.get(r.pillar_id) : undefined
      if (!s) continue
      s.count += 1
      s.views += r.views
      s.eng += r.engagement_rate
    }
    return [...map.values()]
      .filter((s) => s.count > 0)
      .map((s) => ({ pillar: s.pillar, count: s.count, avgViews: s.views / s.count, avgEng: s.eng / s.count }))
      .sort((a, b) => b.avgEng - a.avgEng)
  }, [pillars, reels])

  if (error) return <ErrorState message={error} onRetry={() => void load()} />

  return (
    <div className="soc-stack">
      <StatGrid>
        <StatCard label="Signaux d'intention" value={loading ? '—' : hotSignals.length} highlight caption="DMs + commentaires (RDV / Prix / Info)" onClick={onSeeInbox} />
        <StatCard label="Conversations" value={loading ? '—' : conversations.length} caption="DMs avec ton compte (30 dernières)" />
        <StatCard
          label="Engagement moyen"
          value={loading || avgEng30d === null ? '—' : `${avgEng30d.toFixed(1)} %`}
          caption={`${reels30d.length} reels publiés (30 j)`}
        />
        <StatCard
          label="Followers"
          value={loading || !latest ? '—' : latest.followers}
          caption={newFollowers30d === null ? 'Pas assez de snapshots' : `${newFollowers30d >= 0 ? '+' : ''}${formatNumber(newFollowers30d)} sur 30 j`}
        />
      </StatGrid>

      <section className="soc-card">
        <div className="soc-card-head">
          <div>
            <h2 className="soc-card-title">Inbox d'acquisition</h2>
            <p className="soc-card-sub">DMs et commentaires triés par intention d'achat</p>
          </div>
          {items.length > 6 && (
            <button type="button" className="ds-pill-button" onClick={onSeeInbox}>
              Voir toute l’inbox →
            </button>
          )}
        </div>
        <AcquisitionInbox
          items={items}
          loading={loading}
          previewLimit={6}
          emptyLabel="Pas encore de message à traiter — synchronise tes DMs et commentaires depuis le bouton Synchroniser."
        />
      </section>

      <div className="soc-grid-2">
        <section className="soc-card">
          <div>
            <h2 className="soc-card-title">Top contenu (engagement)</h2>
            <p className="soc-card-sub">Top 5 reels — ce qui fonctionne le mieux</p>
          </div>
          {topReels.length === 0 ? (
            <EmptyState title="Aucun reel synchronisé pour l’instant." />
          ) : (
            <div className="soc-thumbs">
              {topReels.map((r, idx) => (
                <ReelThumb key={r.id} reel={r} rank={idx + 1} pillar={pillars.find((p) => p.id === r.pillar_id)} />
              ))}
            </div>
          )}
        </section>
        <section className="soc-card">
          <div>
            <h2 className="soc-card-title">Performance par pilier</h2>
            <p className="soc-card-sub">Quel angle convertit le mieux</p>
          </div>
          {pillarStats.length === 0 ? (
            <EmptyState title="Assigne tes reels à des piliers pour voir leur performance." />
          ) : (
            pillarStats.slice(0, 6).map((s) => (
              <div key={s.pillar.id} className="soc-field">
                <div className="soc-label">
                  <span className="soc-row">
                    <span className="soc-dot" style={{ background: s.pillar.color }} />
                    {s.pillar.name}
                  </span>
                  <span className="ds-num">{s.avgEng.toFixed(1)} %</span>
                </div>
                <div className="soc-bar">
                  <span style={{ width: `${pillarStats[0].avgEng > 0 ? (s.avgEng / pillarStats[0].avgEng) * 100 : 0}%`, background: s.pillar.color }} />
                </div>
                <span className="soc-muted" style={{ fontSize: 11 }}>
                  {s.count} reels · {fmtCompact(s.avgViews)} vues moy.
                </span>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  )
}

export function ReelThumb({ reel, rank, pillar, onClick }: { reel: IgReel; rank?: number; pillar?: ContentPillar; onClick?: () => void }) {
  const [broken, setBroken] = useState(false)
  const url = reelUrl(reel.ig_media_id)
  return (
    <button
      type="button"
      className="soc-thumb"
      title={reel.caption ?? 'Reel'}
      onClick={onClick ?? (() => url && window.open(url, '_blank'))}
    >
      {reel.thumbnail_url && !broken ? (
        <img src={reel.thumbnail_url} alt="" referrerPolicy="no-referrer" loading="lazy" onError={() => setBroken(true)} />
      ) : (
        <span className="soc-thumb-caption">{reel.caption?.slice(0, 120) || 'Sans légende'}</span>
      )}
      <span className="soc-thumb-top">
        <span className="soc-thumb-badge">{rank ? `#${rank}` : ''}</span>
        <span className="soc-thumb-badge">{reel.engagement_rate.toFixed(1)} %</span>
      </span>
      <span className="soc-thumb-bottom">
        {pillar && <span style={{ color: pillar.color, textTransform: 'uppercase' }}>{pillar.name}</span>}
        <span>
          {fmtCompact(reel.views)} vues · {fmtCompact(reel.likes)} ♥ · {fmtCompact(reel.comments)} com.
        </span>
      </span>
    </button>
  )
}

export function IgInboxTab({ notify }: { notify: Notify }) {
  const [conversations, setConversations] = useState<IgConversation[]>([])
  const [comments, setComments] = useState<IgComment[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // NB: the web asks per_page=100 but the zod schema caps it at 50 (the web
  // request errors) — we use the real max.
  const load = useCallback(async () => {
    setError(null)
    try {
      await swrMany<[ListResponse<IgConversation>, ListResponse<IgComment>]>(['/api/instagram/conversations?per_page=50', '/api/instagram/comments'], ([conv, com]) => {
        setConversations(conv.data ?? [])
        setComments(com.data ?? [])
        setLoading(false)
      })
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const items = useInboxItems(conversations, comments, notify)

  async function sync() {
    setSyncing(true)
    try {
      await Promise.all([
        api.get('/api/instagram/conversations?sync=true&per_page=1'),
        http('POST', '/api/instagram/comments/sync'),
      ])
      await load()
      notify('Inbox synchronisée')
    } catch (e) {
      notify(`Erreur lors de la synchronisation : ${errMsg(e)}`, 'danger')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <section className="soc-card">
      <div className="soc-card-head">
        <div>
          <h2 className="soc-card-title">Inbox d'acquisition</h2>
          <p className="soc-card-sub">DMs et commentaires unifiés, classifiés par intention. Convertis en leads en un clic.</p>
        </div>
        <button type="button" className="ds-pill-button ds-pill-button--dark" onClick={() => void sync()} disabled={syncing}>
          {syncing ? 'Sync…' : 'Synchroniser'}
        </button>
      </div>
      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : loading ? (
        <LoadingState />
      ) : (
        <AcquisitionInbox items={items} showFilters emptyLabel="Pas encore de message à traiter — synchronise tes DMs et commentaires." />
      )}
    </section>
  )
}
