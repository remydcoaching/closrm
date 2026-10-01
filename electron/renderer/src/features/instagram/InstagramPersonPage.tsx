// Fiche of an Instagram account that reacted to the coach — CRM lead or not
// (Insyder's lead page): identity, counts, first gesture and the journey of
// every gesture ClosRM saw. GET /api/instagram/people/:username.
import { useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Avatar } from '../../design-system/Avatar'
import { StatusPill } from '../../design-system/StatusPill'
import { StatCard, StatGrid, formatNumber } from '../../design-system/StatCard'
import { TableCard } from '../../design-system/TableCard'
import { LoadingState, ErrorState, EmptyState } from '../../design-system/States'
import { useCachedQuery } from '../../lib/use-cached-query'
import { shortDate, statusEntry } from '../leads/status'
import type { LeadStatus } from '../leads/types'
import { useSocialLeadCreation } from '../social/AcquisitionInbox'
import { ContentThumb } from './ContentThumb'
import { ReelReactionsDrawer } from './ReelReactionsDrawer'
import './instagram.css'
import './reel-reactions.css'

type GestureKind = 'like' | 'comment' | 'story_view' | 'story_like'

interface PersonGesture {
  kind: GestureKind
  at: string | null
  contentId: string | null
  storyPk: string | null
  title: string | null
  thumbnailUrl: string | null
  url: string | null
  text: string | null
}

interface InstagramPerson {
  username: string
  fullName: string | null
  profilePicUrl: string | null
  isVerified: boolean | null
  follows: boolean | null
  lead: { id: string; firstName: string; lastName: string; status: string } | null
  counts: { likes: number; comments: number; storyViews: number; storyLikes: number }
  firstGesture: PersonGesture | null
  gestures: PersonGesture[]
}

const KIND_LABEL: Record<GestureKind, string> = {
  like: 'A liké le réel',
  comment: 'A commenté',
  story_view: 'A vu la story',
  story_like: 'A liké la story',
}

function openProfile(username: string) {
  const url = `https://instagram.com/${encodeURIComponent(username)}`
  if (window.closrm?.openExternal) void window.closrm.openExternal(url)
  else window.open(url, '_blank', 'noopener,noreferrer')
}

export function InstagramPersonPage() {
  const { username = '' } = useParams()
  const navigate = useNavigate()
  const [openReel, setOpenReel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const createLead = useSocialLeadCreation(useCallback((msg: string) => setError(msg), []))
  const query = useCachedQuery<{ data: InstagramPerson }>(`/api/instagram/people/${encodeURIComponent(username)}`, { screen: 'InstagramPerson', staleMs: 60_000 })
  const p = query.data?.data ?? null

  if (!p) {
    return (
      <div className="ig-page">
        {query.error ? <ErrorState message={query.error} onRetry={query.refresh} /> : <LoadingState label="Chargement du profil…" />}
      </div>
    )
  }

  const name = p.fullName || p.username
  const st = p.lead ? statusEntry(p.lead.status as LeadStatus) : null
  const first = p.firstGesture

  return (
    <div className="ig-page">
      <button type="button" className="ds-pill-button ig-back" onClick={() => navigate(-1)}>
        ← Retour
      </button>

      <div className="ig-person-head">
        <Avatar name={name} size={64} src={p.profilePicUrl} />
        <div className="ig-person-id">
          <h1>
            @{p.username}
            {p.isVerified && <span className="ig-person-badge">Certifié</span>}
          </h1>
          {p.fullName && <p>{p.fullName}</p>}
          <div className="ig-person-tags">
            {st && <StatusPill label={st.label} color={st.color} bg={st.bg} />}
            {p.follows === true && <span className="ig-person-badge">Te suit</span>}
            {p.follows === false && <span className="ig-person-badge ig-person-badge--muted">Ne te suit pas</span>}
          </div>
        </div>
        <div className="ig-person-actions">
          <button type="button" className="ds-pill-button" onClick={() => openProfile(p.username)}>
            Instagram ↗
          </button>
          {p.lead ? (
            <button type="button" className="ds-pill-button ds-pill-button--dark" onClick={() => navigate(`/leads/${p.lead?.id}`)}>
              Fiche lead →
            </button>
          ) : (
            <button
              type="button"
              className="ds-pill-button ds-pill-button--dark"
              onClick={() =>
                void createLead({
                  username: p.username,
                  firstName: p.fullName?.split(' ')[0] || p.username,
                  lastName: p.fullName?.split(' ').slice(1).join(' ') ?? '',
                  source: 'manuel',
                  notes: `Ajouté depuis ClosRM Desktop — a réagi à ${p.counts.likes + p.counts.comments + p.counts.storyViews} contenus Instagram.`,
                })
              }
            >
              Ajouter en lead
            </button>
          )}
        </div>
      </div>
      {error && <p className="soc-error">{error}</p>}

      <StatGrid>
        <StatCard label="Réels likés" value={p.counts.likes} />
        <StatCard label="Commentaires" value={p.counts.comments} />
        <StatCard label="Stories vues" value={p.counts.storyViews} caption={p.counts.storyLikes > 0 ? `dont ${formatNumber(p.counts.storyLikes)} likées` : undefined} />
        <StatCard
          label="Premier geste"
          value={first?.at ? shortDate(first.at) : '—'}
          caption={first ? KIND_LABEL[first.kind] : 'Aucun geste daté'}
          onClick={first?.contentId ? () => setOpenReel(first.contentId) : undefined}
        />
      </StatGrid>

      <TableCard title="Parcours" subtitle="Chaque geste vu par ClosRM, du plus récent au plus ancien. Un j'aime n'est jamais daté par Instagram : il porte la date de la publication.">
        {p.gestures.length === 0 ? (
          <EmptyState title="Aucun geste enregistré" />
        ) : (
          <div className="rr-people">
            {p.gestures.map((g, i) => (
              <button
                type="button"
                key={`${g.kind}-${g.contentId ?? g.storyPk}-${i}`}
                className="rr-person"
                onClick={() => (g.contentId ? setOpenReel(g.contentId) : g.storyPk ? navigate(`/instagram/stories/${g.storyPk}`) : undefined)}
              >
                <ContentThumb url={g.thumbnailUrl} size={40} />
                <span className="rr-person-text">
                  <span className="rr-person-name">
                    {KIND_LABEL[g.kind]} · {g.at ? shortDate(g.at) : 'date inconnue'}
                  </span>
                  <span className="rr-person-meta">
                    {g.text ? `« ${g.text} »` : g.title ? g.title.slice(0, 140) : g.storyPk ? 'Story' : ''}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </TableCard>

      {openReel && <ReelReactionsDrawer contentId={openReel} onClose={() => setOpenReel(null)} />}
    </div>
  )
}
