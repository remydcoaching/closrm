// One story: the visual (video playable), its numbers, and every identified
// viewer — leads first with their score and confidence ("Ils connaissaient
// déjà le compte"). Data: GET /api/instagram/story-views?story=<pk>; the
// media comes from the archive (fresh URL), passed by the Stories page or
// re-read from the archive on reload.
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../../lib/api-client'
import { StatCard, formatNumber } from '../../design-system/StatCard'
import { TableCard, ContactCell } from '../../design-system/TableCard'
import { Chips } from '../../design-system/Tabs'
import { Avatar } from '../../design-system/Avatar'
import { SearchInput } from '../../design-system/SearchInput'
import { LoadingState, ErrorState, EmptyState } from '../../design-system/States'
import { usePaged, PaginationBar } from '../../design-system/Pagination'
import { shortDate } from '../leads/status'
import { confidenceLevel, CONFIDENCE_LABEL } from '../leads/confidence'
import { useStoryArchive, type ArchivedStory } from './stories-data'
import './stories.css'

interface DetailViewer {
  userId: string
  username: string
  fullName: string | null
  profilePicUrl: string | null
  isVerified: boolean | null
  hasLiked: boolean | null
  seenAt: string
  lead: {
    id: string
    name: string
    status: string
    createdAt: string
    score: number
    totalInteractions: number
    distinctContentCount: number
    lastInteractionAt: string | null
  } | null
}

interface StoryDetail {
  story: { taken_at: string; media_type: string | null; viewer_count: number | null; viewers_collected: number } | null
  viewers: DetailViewer[]
  counts: { viewers: number; reactions: number; leads: number }
}

type Filter = 'leads' | 'all' | 'reactions' | 'not_leads'

const CONFIDENCE_COLOR: Record<string, string> = {
  tres_eleve: '#35c759',
  eleve: '#5ac85a',
  moyen: '#e0a100',
  faible: '#e0625a',
  insuffisant: '#b5b8be',
}

function confidenceOf(lead: NonNullable<DetailViewer['lead']>) {
  return confidenceLevel({
    score: lead.score,
    totalInteractions: lead.totalInteractions,
    distinctContentCount: lead.distinctContentCount,
    lastInteractionAt: lead.lastInteractionAt,
    firstInteractionAt: null,
    likesCount: 0,
    commentsCount: 0,
    dmCount: 0,
    mentionCount: 0,
    signals: [],
  })
}

export function StoryDetailPage() {
  const { pk = '' } = useParams<{ pk: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const passed = (location.state as { story?: ArchivedStory } | null)?.story
  const { stories: archive } = useStoryArchive()
  const media = passed ?? archive?.find((s) => s.pk === pk) ?? null
  const [detail, setDetail] = useState<StoryDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('leads')
  const [search, setSearch] = useState('')
  const [mediaBroken, setMediaBroken] = useState(false)
  const [targeting, setTargeting] = useState<string | null>(null)

  // "Cibler": link the viewer to their lead or create one; their story views
  // then appear in the lead's journey and score.
  async function target(v: DetailViewer) {
    setTargeting(v.userId)
    try {
      const res = await api.post<{ data: { leadId: string } }>('/api/instagram/story-viewers/target', { instagramUserId: v.userId })
      navigate(`/leads/${res.data.leadId}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ciblage impossible')
      setTargeting(null)
    }
  }

  useEffect(() => {
    api
      .get<{ data: StoryDetail }>(`/api/instagram/story-views?story=${encodeURIComponent(pk)}`)
      .then((res) => setDetail(res.data))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur inconnue'))
  }, [pk])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (detail?.viewers ?? []).filter((v) => {
      if (q && !v.username.toLowerCase().includes(q) && !(v.fullName ?? '').toLowerCase().includes(q) && !(v.lead?.name ?? '').toLowerCase().includes(q)) return false
      if (filter === 'leads') return !!v.lead
      if (filter === 'not_leads') return !v.lead
      if (filter === 'reactions') return !!v.hasLiked
      return true
    })
  }, [detail, filter, search])
  const paged = usePaged(rows)

  const takenAt = media?.takenAt ?? detail?.story?.taken_at ?? null
  const views = media?.viewerCount ?? detail?.story?.viewer_count ?? null
  const counts = detail?.counts

  return (
    <div className="ig-page">
      <button type="button" className="ds-pill-button ig-back" onClick={() => navigate('/instagram/audience')}>
        ← Audience
      </button>

      <div className="story-detail-hero">
        <div className="story-detail-media">
          {media?.mediaType === 'video' && media.videoUrl && !mediaBroken ? (
            <video src={media.videoUrl} poster={media.imageUrl ?? undefined} controls autoPlay muted loop playsInline onError={() => setMediaBroken(true)} />
          ) : media?.imageUrl && !mediaBroken ? (
            <img src={media.imageUrl} alt="" referrerPolicy="no-referrer" onError={() => setMediaBroken(true)} />
          ) : (
            <div className="story-card-placeholder">Visuel indisponible</div>
          )}
        </div>
        <div className="story-detail-info">
          <h1>Story</h1>
          <div className="story-detail-cards">
            <StatCard label="Forme" value={media?.mediaType === 'video' ? 'Vidéo' : media?.mediaType === 'image' ? 'Image' : 'Story'} />
            <StatCard label="Publiée" value={takenAt ? shortDate(takenAt) : '—'} caption={takenAt ? new Date(takenAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : undefined} />
            <StatCard label="Vues" value={views ?? '—'} caption="comptées par Instagram" />
            <StatCard
              label="Spectateurs identifiés"
              value={counts?.viewers ?? '—'}
              caption={views ? `ceux qu'on a pu nommer, sur ${formatNumber(views)} vues` : 'collectés depuis votre session'}
            />
            <StatCard
              label="Réactions"
              value={media?.likeCount ?? counts?.reactions ?? '—'}
              caption={media?.likeCount != null ? "j'aime comptés par Instagram" : 'cœurs envoyés sur la story'}
            />
            <StatCard label="Leads" value={counts?.leads ?? '—'} highlight caption="spectateurs déjà dans votre CRM" />
          </div>
        </div>
      </div>

      <TableCard
        title="Ils ont regardé cette story"
        subtitle={detail ? `${formatNumber(rows.length)} sur ${formatNumber(detail.viewers.length)} spectateurs identifiés` : undefined}
        toolbar={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder="Rechercher un contact" />
            <Chips
              items={[
                { key: 'leads' as Filter, label: 'Déjà leads', count: counts?.leads },
                { key: 'reactions' as Filter, label: 'Réactions', count: counts?.reactions },
                { key: 'not_leads' as Filter, label: 'Pas encore leads', count: detail ? detail.viewers.length - detail.counts.leads : undefined },
                { key: 'all' as Filter, label: 'Tous', count: counts?.viewers },
              ]}
              active={filter}
              onChange={setFilter}
            />
          </>
        }
      >
        {!detail && !error && <LoadingState label="Chargement des spectateurs…" />}
        {error && <ErrorState message={error} />}
        {detail && detail.viewers.length === 0 && (
          <EmptyState
            title="Aucun spectateur collecté"
            description={
              takenAt && Date.now() - new Date(takenAt).getTime() > 48 * 3_600_000
                ? "Instagram ne montre les spectateurs d'une story que pendant 48 h après sa publication. Celle-ci est plus ancienne et ClosRM n'était pas ouvert pendant ce délai : ses spectateurs ne sont plus récupérables. Ses j'aime restent visibles ci-dessus."
                : 'Les spectateurs sont collectés automatiquement toutes les 30 min tant que la story est en ligne, que l’app est ouverte et que la session Instagram est connectée.'
            }
          />
        )}
        {detail && detail.viewers.length > 0 && rows.length === 0 && <EmptyState title="Personne dans ce filtre" />}
        {rows.length > 0 && (
          <table className="ds-table">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Geste</th>
                <th className="ds-num-cell">Lead créé le</th>
                <th className="ds-num-cell">Score</th>
                <th>Niveau de confiance</th>
                <th className="ds-num-cell">Dernière activité</th>
                <th className="ds-num-cell">Interactions</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {paged.pageRows.map((v) => {
                const name = v.lead?.name || v.fullName || v.username
                const level = v.lead ? confidenceOf(v.lead) : null
                return (
                  <tr key={v.userId} className={v.lead ? 'ds-row-clickable' : undefined} onClick={() => v.lead && navigate(`/leads/${v.lead.id}`)}>
                    <td>
                      <ContactCell name={`${name}${v.isVerified ? ' ✓' : ''}`} handle={v.username} avatar={<Avatar name={name} size={28} src={v.profilePicUrl} />} />
                    </td>
                    <td>
                      <span className="story-gesture story-gesture--on" title="A vu">
                        👁
                      </span>
                      <span className={`story-gesture ${v.hasLiked ? 'story-gesture--on' : ''}`} title={v.hasLiked ? 'A réagi ♥' : 'Pas de réaction'}>
                        ♥
                      </span>
                    </td>
                    <td className="ds-num-cell">
                      <span className="ds-num">{v.lead ? shortDate(v.lead.createdAt) : '—'}</span>
                    </td>
                    <td className="ds-num-cell">
                      <span className="ds-num">{v.lead ? v.lead.score : '—'}</span>
                    </td>
                    <td>
                      {level ? (
                        <span className="story-confidence" title={CONFIDENCE_LABEL[level]}>
                          <span className="story-confidence-track">
                            <span style={{ width: `${v.lead?.score ?? 0}%`, background: CONFIDENCE_COLOR[level] }} />
                          </span>
                          <span className="ds-muted">{CONFIDENCE_LABEL[level]}</span>
                        </span>
                      ) : (
                        <span className="ds-muted">Pas encore lead</span>
                      )}
                    </td>
                    <td className="ds-num-cell">
                      <span className="ds-num">{shortDate(v.lead?.lastInteractionAt ?? v.seenAt)}</span>
                    </td>
                    <td className="ds-num-cell">
                      <span className="ds-num">{v.lead ? formatNumber(v.lead.totalInteractions) : '—'}</span>
                    </td>
                    <td className="ds-num-cell">
                      {!v.lead && (
                        <button
                          type="button"
                          className="ds-pill-button ds-pill-button--dark"
                          disabled={targeting === v.userId}
                          onClick={(e) => {
                            e.stopPropagation()
                            target(v)
                          }}
                        >
                          {targeting === v.userId ? 'Ciblage…' : 'Cibler'}
                        </button>
                      )}
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
