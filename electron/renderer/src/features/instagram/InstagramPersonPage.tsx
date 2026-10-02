// Fiche of an Instagram account that reacted to the coach — CRM lead or not
// (Insyder's lead page): score / confidence / engagement / potential, the
// journey day by day, comments and « Pourquoi ce score ».
// GET /api/instagram/people/:username (src/lib/instagram/person.ts).
import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Avatar } from '../../design-system/Avatar'
import { StatusPill } from '../../design-system/StatusPill'
import { StatCard, StatGrid, formatNumber } from '../../design-system/StatCard'
import { TableCard } from '../../design-system/TableCard'
import { Chips } from '../../design-system/Tabs'
import { LoadingState, ErrorState, EmptyState } from '../../design-system/States'
import { useCachedQuery } from '../../lib/use-cached-query'
import { shortDate, statusEntry } from '../leads/status'
import type { LeadStatus } from '../leads/types'
import { CONFIDENCE_LABEL, type ConfidenceLevel } from '../leads/confidence'
import { useSocialLeadCreation } from '../social/AcquisitionInbox'
import { ContentThumb } from './ContentThumb'
import { ReelReactionsDrawer } from './ReelReactionsDrawer'
import { CONFIDENCE_BAR } from './InstagramLeadsPage'
import '../../design-system/drawer.css'
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
  score: number
  confidence: ConfidenceLevel
  engagementRate: number | null
  lastAt: string | null
  potential: 'tres_fort' | 'fort' | 'moyen' | 'faible'
  factors: { key: string; label: string; value: number }[]
  commentLevels: { fort: number; moyen: number; faible: number }
}

const KIND_LABEL: Record<GestureKind, string> = {
  like: 'A liké le réel',
  comment: 'A commenté',
  story_view: 'A vu la story',
  story_like: 'A liké la story',
}

const POTENTIAL: Record<InstagramPerson['potential'], { label: string; text: string; color: string }> = {
  tres_fort: { label: 'Très fort', text: 'Il vous fait confiance et réagit presque à tout. À contacter en premier.', color: '#1a9f5b' },
  fort: { label: 'Fort', text: 'Il revient régulièrement sur vos contenus : un bon moment pour lui écrire.', color: '#5fbf3f' },
  moyen: { label: 'Moyen', text: 'Il réagit de temps en temps : à nourrir avant de le contacter.', color: '#e0a31b' },
  faible: { label: 'Faible', text: 'Peu de gestes pour l’instant : il vient de vous découvrir ou reste discret.', color: '#8a8e96' },
}

type Range = 'all' | '30' | '7'
const RANGES: { key: Range; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: '30', label: '30 jours' },
  { key: '7', label: '7 jours' },
]

function openProfile(username: string) {
  const url = `https://instagram.com/${encodeURIComponent(username)}`
  if (window.closrm?.openExternal) void window.closrm.openExternal(url)
  else window.open(url, '_blank', 'noopener,noreferrer')
}

/** Gestures grouped by day (oldest → newest), with the day's summary like Insyder's journey. */
function journeyDays(gestures: PersonGesture[], range: Range) {
  const since = range === 'all' ? '' : new Date(Date.now() - Number(range) * 86_400_000).toISOString()
  const byDay = new Map<string, PersonGesture[]>()
  for (const g of gestures) {
    if (!g.at || g.at < since) continue
    const day = g.at.slice(0, 10)
    byDay.set(day, [...(byDay.get(day) ?? []), g])
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, list]) => {
      const n = (k: GestureKind) => list.filter((g) => g.kind === k).length
      const parts = [
        n('comment') ? `${n('comment')} commentaire${n('comment') > 1 ? 's' : ''}` : null,
        n('like') ? `${n('like')} j'aime` : null,
        n('story_view') ? `${n('story_view')} vue${n('story_view') > 1 ? 's' : ''} de story` : null,
        n('story_like') ? `${n('story_like')} j'aime de story` : null,
      ].filter(Boolean)
      return { day, list, summary: parts.join(' · ') }
    })
}

export function InstagramPersonPage() {
  const { username = '' } = useParams()
  const navigate = useNavigate()
  const [openReel, setOpenReel] = useState<string | null>(null)
  const [why, setWhy] = useState(false)
  const [range, setRange] = useState<Range>('all')
  const [error, setError] = useState<string | null>(null)
  const createLead = useSocialLeadCreation(useCallback((msg: string) => setError(msg), []))
  const query = useCachedQuery<{ data: InstagramPerson }>(`/api/instagram/people/${encodeURIComponent(username)}`, { screen: 'InstagramPerson', staleMs: 60_000 })
  const p = query.data?.data ?? null
  const days = useMemo(() => (p ? journeyDays(p.gestures, range) : []), [p, range])

  if (!p) {
    return <div className="ig-page">{query.error ? <ErrorState message={query.error} onRetry={query.refresh} /> : <LoadingState label="Chargement du profil…" />}</div>
  }

  const name = p.fullName || p.username
  const st = p.lead ? statusEntry(p.lead.status as LeadStatus) : null
  const bar = CONFIDENCE_BAR[p.confidence]
  const pot = POTENTIAL[p.potential]
  const comments = p.gestures.filter((g) => g.kind === 'comment')
  const totalComments = p.commentLevels.fort + p.commentLevels.moyen + p.commentLevels.faible

  return (
    <div className="ig-page">
      <button type="button" className="ds-pill-button ig-back" onClick={() => navigate(-1)}>
        ← Retour
      </button>

      <div className="ig-person-head">
        <span className="ig-person-ring">
          <Avatar name={name} size={84} src={p.profilePicUrl} />
        </span>
        <div className="ig-person-id">
          <h1>
            {name} <span className="ig-person-handle">@{p.username}</span>
            {p.isVerified && <span className="ig-person-badge">Certifié</span>}
            {p.follows === true && <span className="ig-person-badge">Abonné</span>}
            {p.follows === false && <span className="ig-person-badge ig-person-badge--muted">Pas abonné</span>}
          </h1>
          <div className="ig-person-tags">{st && <StatusPill label={st.label} color={st.color} bg={st.bg} />}</div>
        </div>
        <div className="ig-person-actions">
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
                  notes: `Ajouté depuis ClosRM Desktop — score Instagram ${p.score}/100 (${CONFIDENCE_LABEL[p.confidence]}).`,
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
        <StatCard label="Score" value={`${p.score} / 100`} caption="selon vos règles · pourquoi ?" onClick={() => setWhy(true)} />
        <StatCard
          label="Niveau de confiance"
          value={CONFIDENCE_LABEL[p.confidence]}
          caption={
            <span className="ig-confidence ig-confidence--wide">
              <i style={{ width: `${bar.width}%`, background: bar.color }} />
            </span>
          }
          onClick={() => setWhy(true)}
        />
        <StatCard label="Engagement" value={p.engagementRate === null ? '—' : `${(p.engagementRate * 100).toFixed(1).replace('.', ',')} %`} caption="vos publications et stories touchées" />
        <StatCard
          label="Premier geste"
          value={p.firstGesture?.at ? shortDate(p.firstGesture.at) : '—'}
          caption={p.firstGesture ? KIND_LABEL[p.firstGesture.kind] : undefined}
          onClick={p.firstGesture?.contentId ? () => setOpenReel(p.firstGesture?.contentId ?? null) : undefined}
        />
      </StatGrid>
      <StatGrid>
        <StatCard label="Dernier geste" value={p.lastAt ? shortDate(p.lastAt) : '—'} />
        <StatCard label="Commentaires" value={p.counts.comments} caption={`${formatNumber(p.counts.likes)} j'aime · ${formatNumber(p.counts.storyViews)} stories vues`} />
        <StatCard label="Potentiel d'achat" value={pot.label} caption={pot.text} onClick={() => setWhy(true)} />
        <StatCard label="Contacter sur Instagram" value="Ouvrir son profil" caption={`@${p.username}`} onClick={() => openProfile(p.username)} />
      </StatGrid>

      <TableCard title="Son parcours" subtitle="Chaque jour où il s'est passé quelque chose. Un j'aime n'est jamais daté par Instagram : il porte la date de la publication." toolbar={<Chips items={RANGES} active={range} onChange={setRange} />}>
        {days.length === 0 ? (
          <EmptyState title="Aucun geste daté sur cette période" />
        ) : (
          <div className="ig-journey">
            {days.map((d) => (
              <div key={d.day} className="ig-journey-day">
                <div className="ig-journey-date">{new Date(`${d.day}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</div>
                <div className="ig-journey-thumbs">
                  {d.list.slice(0, 3).map((g, i) => (
                    <button key={i} type="button" onClick={() => (g.contentId ? setOpenReel(g.contentId) : g.storyPk ? navigate(`/instagram/stories/${g.storyPk}`) : undefined)} title={KIND_LABEL[g.kind]}>
                      <ContentThumb url={g.thumbnailUrl} size={26} />
                    </button>
                  ))}
                  {d.list.length > 3 && <span className="ig-journey-more">+{d.list.length - 3}</span>}
                </div>
                <div className="ig-journey-summary">{d.summary}</div>
                <i className="ig-journey-dot" />
              </div>
            ))}
          </div>
        )}
      </TableCard>

      <div className="ig-person-columns">
        <TableCard title={`Par contenu · ${formatNumber(p.gestures.length)}`} subtitle="Du plus récent au plus ancien">
          <div className="rr-people">
            {p.gestures.slice(0, 200).map((g, i) => (
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
                  <span className="rr-person-meta">{g.text ? `« ${g.text} »` : g.title ? g.title.slice(0, 140) : g.storyPk ? 'Story' : ''}</span>
                </span>
              </button>
            ))}
          </div>
        </TableCard>

        <TableCard title="Niveau d'engagement de ses commentaires" subtitle={totalComments ? `${totalComments} commentaire${totalComments > 1 ? 's' : ''}` : 'Aucun commentaire'}>
          {(['fort', 'moyen', 'faible'] as const).map((k) => {
            const pct = totalComments ? Math.round((p.commentLevels[k] / totalComments) * 100) : 0
            const meta = { fort: ['Fort', '#1a9f5b', 'pose une question · écrit une vraie phrase'], moyen: ['Moyen', '#e0a31b', 'quelques mots'], faible: ['Faible', '#e0533b', 'emoji seul · vide'] }[k]
            return (
              <div key={k} className="ig-comment-level">
                <div className="ig-comment-level-head">
                  <span>
                    <i style={{ background: meta[1] }} /> {meta[0]}
                  </span>
                  <b>{pct} %</b>
                </div>
                <span className="ig-confidence ig-confidence--wide">
                  <i style={{ width: `${pct}%`, background: meta[1] }} />
                </span>
                <span className="ds-muted">{meta[2]}</span>
              </div>
            )
          })}
          {comments.slice(0, 10).map((c, i) => (
            <p key={i} className="ig-comment-quote">
              « {c.text} » <span className="ds-muted">· {c.at ? shortDate(c.at) : ''}</span>
            </p>
          ))}
        </TableCard>
      </div>

      {why && (
        <div className="ds-drawer-overlay" onClick={() => setWhy(false)}>
          <aside className="ds-drawer rr-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="rr-top">
              <span className="rr-label">Pourquoi ce score</span>
              <button type="button" className="rr-close" onClick={() => setWhy(false)} aria-label="Fermer">
                ×
              </button>
            </div>
            <div className="rr-body">
              <div className="ig-why-score">
                <span className="ig-confidence ig-confidence--wide">
                  <i style={{ width: `${p.score}%`, background: bar.color }} />
                </span>
                <b>
                  {p.score} / 100 · {CONFIDENCE_LABEL[p.confidence]}
                </b>
              </div>
              <section className="rr-section">
                <h3 className="rr-label">Potentiel d&apos;achat</h3>
                <p className="ig-why-potential">
                  <b style={{ color: pot.color }}>{pot.label}</b> — {pot.text}
                </p>
                <p className="rr-hint">Il a interagi avec {formatNumber(new Set(p.gestures.map((g) => g.contentId ?? g.storyPk)).size)} de vos contenus.</p>
              </section>
              <section className="rr-section">
                <h3 className="rr-label">Ce qui a compté</h3>
                {p.factors.map((f) => (
                  <div key={f.key} className={`ig-why-row ${f.value === 0 ? 'ig-why-row--off' : ''}`}>
                    <span>{f.label}</span>
                    <span className="ig-confidence">
                      <i style={{ width: `${Math.round(f.value * 100)}%`, background: '#c837ab' }} />
                    </span>
                  </div>
                ))}
              </section>
              <button type="button" className="rr-more" onClick={() => openProfile(p.username)}>
                Contacter sur Instagram
              </button>
            </div>
          </aside>
        </div>
      )}

      {openReel && <ReelReactionsDrawer contentId={openReel} onClose={() => setOpenReel(null)} />}
    </div>
  )
}
