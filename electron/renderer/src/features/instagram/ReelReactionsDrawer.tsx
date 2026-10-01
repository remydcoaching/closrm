// Content page › click a reel → « Qui a réagi » side panel (Insyder layout):
// the reel, how many people reacted, Instagram's counters, then the people
// for whom it is the first gesture ever seen (« Nouveaux leads ») and those
// who had reacted to an older publication (« Déjà leads »).
// GET /api/instagram/content/:id/reactions (src/lib/instagram/reel-reactions.ts).
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '../../design-system/Avatar'
import { StatusPill } from '../../design-system/StatusPill'
import { formatNumber } from '../../design-system/StatCard'
import { LoadingState, ErrorState } from '../../design-system/States'
import { useCachedQuery } from '../../lib/use-cached-query'
import { statusEntry } from '../leads/status'
import type { LeadStatus } from '../leads/types'
import { ContentThumb } from './ContentThumb'
import { contentTypeLabel } from './ContentPage'
import type { ContentChartPoint } from './types'
import '../../design-system/drawer.css'
import './reel-reactions.css'

interface ReactionPerson {
  username: string
  fullName: string | null
  profilePicUrl: string | null
  liked: boolean
  commentsCount: number
  commentText: string | null
  follows: boolean | null
  lead: { id: string; firstName: string; lastName: string; status: string } | null
}

interface ReelReactions {
  metrics: ContentChartPoint
  people: number
  firstTime: ReactionPerson[]
  returning: ReactionPerson[]
}

const PAGE = 30
const longDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '')

function PersonRow({ p }: { p: ReactionPerson }) {
  const navigate = useNavigate()
  const parts = [
    p.liked ? "1 j'aime" : null,
    p.commentsCount > 0 ? `${p.commentsCount} comm.` : null,
    p.follows === true ? 'te suit' : p.follows === false ? 'ne te suit pas' : null,
  ].filter(Boolean)
  const st = p.lead ? statusEntry(p.lead.status as LeadStatus) : null
  return (
    <button type="button" className="rr-person" onClick={() => navigate(p.lead ? `/leads/${p.lead.id}` : `/instagram/people/${encodeURIComponent(p.username)}`)} title={p.lead ? 'Ouvrir la fiche lead' : 'Ouvrir sa fiche (parcours)'}>
      <Avatar name={p.fullName || p.username} size={36} src={p.profilePicUrl} />
      <span className="rr-person-text">
        <span className="rr-person-name">
          @{p.username}
          {st && <StatusPill label={st.label} color={st.color} bg={st.bg} />}
        </span>
        <span className="rr-person-meta">
          {parts.join(' · ')}
          {p.commentText && (
            <>
              {parts.length > 0 ? ' · ' : ''}« {p.commentText} »
            </>
          )}
        </span>
      </span>
    </button>
  )
}

function PeopleSection({ title, hint, people }: { title: string; hint: string; people: ReactionPerson[] }) {
  const [shown, setShown] = useState(PAGE)
  if (people.length === 0) return null
  return (
    <section className="rr-section">
      <h3 className="rr-label">
        {title} · {formatNumber(people.length)}
      </h3>
      <p className="rr-hint">{hint}</p>
      <div className="rr-people">
        {people.slice(0, shown).map((p) => (
          <PersonRow key={p.username} p={p} />
        ))}
      </div>
      {people.length > shown && (
        <button type="button" className="rr-more" onClick={() => setShown((n) => n + PAGE)}>
          Et {formatNumber(people.length - shown)} autres · Voir plus
        </button>
      )}
    </section>
  )
}

export function ReelReactionsDrawer({ contentId, onClose }: { contentId: string; onClose: () => void }) {
  const navigate = useNavigate()
  const query = useCachedQuery<{ data: ReelReactions }>(`/api/instagram/content/${encodeURIComponent(contentId)}/reactions`, { screen: 'ReelReactions', staleMs: 60_000 })
  const r = query.data?.data ?? null
  const m = r?.metrics

  return (
    <div className="ds-drawer-overlay" onClick={onClose}>
      <aside className="ds-drawer rr-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="rr-top">
          <span className="rr-label">Qui a réagi</span>
          <button type="button" className="rr-close" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>
        <div className="rr-body">
          {!r && !query.error && <LoadingState label="Chargement…" />}
          {!r && query.error && <ErrorState message={query.error} onRetry={query.refresh} />}
          {r && m && (
            <>
              <header className="rr-head">
                <ContentThumb url={m.thumbnailUrl} size={84} />
                <div>
                  <div className="rr-title">
                    {contentTypeLabel(m.contentType, m.onGrid)} · {longDate(m.publishedAt)}
                  </div>
                  {m.caption && <p className="rr-caption">{m.caption}</p>}
                </div>
              </header>

              <div className="rr-big">{formatNumber(r.people)}</div>
              <p className="rr-big-sub">
                personnes ont aimé ou commenté · dont {formatNumber(r.firstTime.length)} jamais vues avant sur ce que ClosRM a lu
              </p>

              <section className="rr-section">
                <h3 className="rr-label">Chez Instagram</h3>
                <dl className="rr-stats">
                  <div>
                    <dt>Vues ({m.contentType === 'clip' ? 'reel' : 'post'})</dt>
                    <dd>{m.views === null ? '—' : formatNumber(m.views)}</dd>
                  </div>
                  <div>
                    <dt>J&apos;aime</dt>
                    <dd>{formatNumber(m.likesCount)}</dd>
                  </div>
                  <div>
                    <dt>Commentaires</dt>
                    <dd>{formatNumber(m.commentsCount)}</dd>
                  </div>
                  {m.saves != null && (
                    <div>
                      <dt>Enregistrements</dt>
                      <dd>{formatNumber(m.saves)}</dd>
                    </div>
                  )}
                  {m.shares != null && (
                    <div>
                      <dt>Partages</dt>
                      <dd>{formatNumber(m.shares)}</dd>
                    </div>
                  )}
                </dl>
              </section>

              {r.people === 0 && (
                <p className="rr-hint">
                  Personne n&apos;a encore été identifié sur ce réel : le suivi des publications (page Contenu) lit ses j&apos;aime, Meta ses commentaires.
                </p>
              )}
              <PeopleSection title="Nouveaux leads" hint="Cette publication est leur premier geste chez toi." people={r.firstTime} />
              <PeopleSection title="Déjà leads" hint="Ils avaient déjà réagi à une publication avant celle-ci." people={r.returning} />

              <button type="button" className="rr-more" onClick={() => navigate(`/instagram/content/${encodeURIComponent(contentId)}`)}>
                Ouvrir la page du réel (filtres, export)
              </button>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
