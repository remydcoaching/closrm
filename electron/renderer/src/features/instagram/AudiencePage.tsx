// Instagram > Audience — "comment votre communauté interagit avec vous".
// - Segments (actifs / jamais contactés / ne vous suivent pas / lurkers) from
//   GET /api/instagram/audience + drill-down /audience/leads (same
//   definitions, src/lib/instagram/audience-segments.ts);
// - Quand publier: engagement rate by weekday × slot of the coach's own
//   scanned contents (publish-timing.ts);
// - Vos réels: best reels by engagement rate (GET /api/instagram/content/chart);
// - Vos stories: gallery from the coach's own Instagram archive (StoriesGallery).
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../../lib/api-client'
import { StatCard, StatGrid, formatNumber } from '../../design-system/StatCard'
import { TableCard, ContactCell } from '../../design-system/TableCard'
import { Chips } from '../../design-system/Tabs'
import { Avatar } from '../../design-system/Avatar'
import { StatusPill } from '../../design-system/StatusPill'
import { LoadingState, ErrorState, EmptyState } from '../../design-system/States'
import { relativeTime, shortDate, statusEntry } from '../leads/status'
import type { LeadStatus } from '../leads/types'
import { ContentThumb } from './ContentThumb'
import { formatRate } from './ContentPage'
import { publishTiming, bestSlots, SLOTS, WEEKDAYS, MIN_SAMPLES } from './publish-timing'
import { StoryViewersSection } from './StoryViewersSection'
import { StoriesGallery } from './StoriesPage'
import type { ContentChartPoint } from './types'
import './instagram.css'
import { usePaged, PaginationBar } from '../../design-system/Pagination'

interface AudienceCounts {
  actifs: number
  actifsJamaisContactes: number
  neVousSuiventPas: number
  lurkers: number
  totalEngaged: number
}

interface AudienceLeadRow {
  id: string
  first_name: string
  last_name: string
  instagram_handle: string | null
  instagram_profile_pic_url: string | null
  status: LeadStatus
  call_attempts: number
  follows_target: boolean | null
  interactions_count: number
  last_seen_at: string | null
}


type Segment = 'actifs' | 'actifs_jamais_contactes' | 'ne_vous_suivent_pas' | 'lurkers'
type Period = '7' | '30' | '90' | '365'

const PERIODS: { key: Period; label: string }[] = [
  { key: '7', label: '7 j' },
  { key: '30', label: '30 j' },
  { key: '90', label: '90 j' },
  { key: '365', label: '1 an' },
]

const SEGMENT_LABEL: Record<Segment, string> = {
  actifs: 'Leads actifs',
  actifs_jamais_contactes: 'Actifs, jamais contactés',
  ne_vous_suivent_pas: 'Ne vous suivent pas',
  lurkers: 'Lurkers (jamais contactés)',
}

export function AudiencePage() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState<Period>('30')
  const [counts, setCounts] = useState<AudienceCounts | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [segment, setSegment] = useState<Segment>('actifs_jamais_contactes')
  const [segmentLeads, setSegmentLeads] = useState<AudienceLeadRow[] | null>(null)
  const [contents, setContents] = useState<ContentChartPoint[] | null>(null)

  async function load() {
    setError(null)
    setCounts(null)
    try {
      const res = await api.get<{ data: AudienceCounts }>(`/api/instagram/audience?period_days=${period}`)
      setCounts(res.data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inconnue')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period])

  useEffect(() => {
    setSegmentLeads(null)
    api
      .get<{ data: AudienceLeadRow[] }>(`/api/instagram/audience/leads?segment=${segment}&period_days=${period}`)
      .then((res) => setSegmentLeads(res.data))
      .catch(() => setSegmentLeads([]))
  }, [segment, period])

  useEffect(() => {
    api
      .get<{ data: ContentChartPoint[] }>('/api/instagram/content/chart?days=365')
      .then((res) => setContents(res.data))
      .catch(() => setContents([]))
  }, [])

  const paged = usePaged(segmentLeads ?? [])

  const timing = useMemo(() => publishTiming(contents ?? []), [contents])
  const best = useMemo(() => bestSlots(timing), [timing])
  const maxRate = Math.max(0, ...timing.map((c) => c.avgRate ?? 0))
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

      {counts === null && !error && <LoadingState label="Chargement…" />}
      {error && <ErrorState message={error} onRetry={load} />}

      {counts && (
        <StatGrid>
          <StatCard label="Personnes actives" value={counts.actifs} caption={`au moins une interaction sur ${period} j`} onClick={() => setSegment('actifs')} />
          <StatCard
            label="Actives, jamais contactées"
            value={counts.actifsJamaisContactes}
            highlight
            caption="personne ne leur a écrit"
            onClick={() => setSegment('actifs_jamais_contactes')}
          />
          <StatCard label="Ne vous suivent pas" value={counts.neVousSuiventPas} caption="interagissent sans être abonnées" onClick={() => setSegment('ne_vous_suivent_pas')} />
          <StatCard label="Lurkers" value={counts.lurkers} unit="profils" caption="ont interagi, jamais contactés" onClick={() => setSegment('lurkers')} />
        </StatGrid>
      )}

      <StoryViewersSection />

      <TableCard title="Quand publier" subtitle="Taux d'engagement moyen de vos contenus selon le jour et l'heure de publication (12 derniers mois)">
        {contents === null ? (
          <LoadingState label="Chargement…" />
        ) : contents.length === 0 ? (
          <EmptyState title="Pas encore de contenu analysé" description="Lancez une analyse de votre compte pour voir vos meilleurs créneaux." />
        ) : (
          <>
            {best.length > 0 && (
              <p className="ig-timing-best">
                Meilleurs créneaux :{' '}
                {best.map((c, i) => (
                  <strong key={i}>
                    {i > 0 && ' · '}
                    {WEEKDAYS[c.weekday]} {SLOTS[c.slot].label} ({formatRate(c.avgRate)})
                  </strong>
                ))}
              </p>
            )}
            <div className="ig-timing-grid">
              <span />
              {WEEKDAYS.map((d) => (
                <span key={d} className="ig-timing-head">
                  {d}
                </span>
              ))}
              {SLOTS.map((slot, si) => (
                <div key={slot.key} className="ig-timing-row">
                  <span className="ig-timing-head">{slot.label}</span>
                  {WEEKDAYS.map((_, wd) => {
                    const cell = timing.find((c) => c.weekday === wd && c.slot === si)!
                    const intensity = cell.avgRate && maxRate > 0 ? cell.avgRate / maxRate : 0
                    return (
                      <span
                        key={wd}
                        className={`ig-timing-cell ${cell.count > 0 && cell.count < MIN_SAMPLES ? 'ig-timing-cell--weak' : ''}`}
                        style={{ background: cell.avgRate === null ? undefined : `rgba(200, 55, 171, ${0.08 + intensity * 0.8})` }}
                        title={cell.count === 0 ? 'Aucun contenu' : `${cell.count} contenu${cell.count > 1 ? 's' : ''} · ${formatRate(cell.avgRate)}`}
                      >
                        {cell.avgRate === null ? '' : formatRate(cell.avgRate)}
                      </span>
                    )
                  })}
                </div>
              ))}
            </div>
          </>
        )}
      </TableCard>

      <TableCard>
        <StoriesGallery />
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

      <TableCard
        title={`${SEGMENT_LABEL[segment]} · ${period} j`}
        subtitle={segmentLeads ? `${formatNumber(segmentLeads.length)} contact${segmentLeads.length > 1 ? 's' : ''}` : '…'}
        toolbar={
          <Chips
            items={(Object.keys(SEGMENT_LABEL) as Segment[]).map((k) => ({ key: k, label: SEGMENT_LABEL[k] }))}
            active={segment}
            onChange={setSegment}
          />
        }
      >
        {segmentLeads === null && <LoadingState label="Chargement…" />}
        {segmentLeads && segmentLeads.length === 0 && <EmptyState title="Aucun lead dans ce segment" />}
        {segmentLeads && segmentLeads.length > 0 && (
          <table className="ds-table">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Statut</th>
                <th className="ds-num-cell">Interactions</th>
                <th>Abonné</th>
                <th className="ds-num-cell">Dernière activité</th>
              </tr>
            </thead>
            <tbody>
              {paged.pageRows.map((l) => {
                const name = `${l.first_name} ${l.last_name}`.trim() || l.instagram_handle || '—'
                const st = statusEntry(l.status)
                return (
                  <tr key={l.id} className="ds-row-clickable" onClick={() => navigate(`/leads/${l.id}`)}>
                    <td>
                      <ContactCell name={name} handle={l.instagram_handle} avatar={<Avatar name={name} size={28} src={l.instagram_profile_pic_url} />} />
                    </td>
                    <td>
                      <StatusPill label={st.label} color={st.color} bg={st.bg} />
                    </td>
                    <td className="ds-num-cell">
                      <span className="ds-num">{formatNumber(l.interactions_count)}</span>
                    </td>
                    <td>{l.follows_target === null ? '—' : l.follows_target ? 'Oui' : 'Non'}</td>
                    <td className="ds-num-cell">
                      <span className="ds-num" title={l.last_seen_at ? relativeTime(l.last_seen_at) : undefined}>
                        {shortDate(l.last_seen_at)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        <PaginationBar total={paged.total} page={paged.page} pages={paged.pages} size={paged.size} onPage={paged.setPage} onSize={paged.setSize} />
      </TableCard>
    </div>
  )
}
