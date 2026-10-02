// Leads Instagram — Insyder's « Leads » page: everyone who reacted to the
// account (story viewers, reel likers, commenters), CRM lead or not, scored
// with the CRM's engagement rules. « Qui contacter en priorité ».
// GET /api/instagram/people (src/lib/instagram/people.ts).
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api-client'
import { downloadCsv } from '../../lib/csv'
import { useCachedQuery } from '../../lib/use-cached-query'
import { StatCard, StatGrid, formatNumber } from '../../design-system/StatCard'
import { TableCard, ContactCell } from '../../design-system/TableCard'
import { Chips } from '../../design-system/Tabs'
import { Avatar } from '../../design-system/Avatar'
import { StatusPill } from '../../design-system/StatusPill'
import { SearchInput } from '../../design-system/SearchInput'
import { PaginationBar } from '../../design-system/Pagination'
import { LoadingState, ErrorState, EmptyState } from '../../design-system/States'
import { shortDate, statusEntry } from '../leads/status'
import type { LeadStatus } from '../leads/types'
import { CONFIDENCE_LABEL, type ConfidenceLevel } from '../leads/confidence'
import './instagram.css'

type Tab = 'actifs' | 'nouveaux' | 'confiance' | 'certifies' | 'lurkers'
type Period = '7' | '30' | '90' | '365'
type PageSize = 10 | 20 | 50 | 100

interface PersonRow {
  username: string
  fullName: string | null
  profilePicUrl: string | null
  isVerified: boolean | null
  follows: boolean | null
  score: number
  confidence: ConfidenceLevel
  interactions: number
  storyViews: number
  likes: number
  comments: number
  firstAt: string | null
  firstSource: 'story' | 'reel' | 'post' | 'comment' | null
  lastAt: string | null
  recentStoriesSeen: number
  contacted: boolean
  lead: { id: string; status: string } | null
}

interface PeopleResponse {
  kpis: { active: number; activePrevious: number; veryHighNeverContacted: number; buyerLurkers: number; becameVeryHigh: number }
  recentStoriesCount: number
  total: number
  rows: PersonRow[]
}

const PERIODS: { key: Period; label: string }[] = [
  { key: '7', label: '7 j' },
  { key: '30', label: '30 j' },
  { key: '90', label: '90 j' },
  { key: '365', label: '1 an' },
]

const TABS: { key: Tab; label: string }[] = [
  { key: 'actifs', label: 'Actifs' },
  { key: 'nouveaux', label: 'Nouveaux leads' },
  { key: 'confiance', label: 'Niveau de confiance' },
  { key: 'certifies', label: 'Certifiés' },
  { key: 'lurkers', label: 'Stories' },
]

const TAB_TITLE: Record<Tab, string> = {
  actifs: 'Tous les leads',
  nouveaux: 'Nouveaux leads',
  confiance: 'Par niveau de confiance',
  certifies: 'Comptes certifiés',
  lurkers: 'Lurkers acheteurs',
}

const LEVEL_CHIPS: { key: ConfidenceLevel | 'all'; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'tres_eleve', label: 'Très élevé' },
  { key: 'eleve', label: 'Élevé' },
  { key: 'moyen', label: 'Moyen' },
  { key: 'faible', label: 'Faible' },
]

export const CONFIDENCE_BAR: Record<ConfidenceLevel, { width: number; color: string }> = {
  tres_eleve: { width: 100, color: '#1a9f5b' },
  eleve: { width: 75, color: '#5fbf3f' },
  moyen: { width: 50, color: '#e0a31b' },
  faible: { width: 22, color: '#e0533b' },
  insuffisant: { width: 8, color: '#b9bcc4' },
}

const SOURCE_LABEL: Record<NonNullable<PersonRow['firstSource']>, string> = { story: 'Story', reel: 'Réel', post: 'Post', comment: 'Commentaire' }

function pctDelta(cur: number, prev: number): string | null {
  if (prev <= 0) return null
  const d = Math.round(((cur - prev) / prev) * 100)
  return `${d >= 0 ? '▲ +' : '▼ '}${d} % vs période précédente`
}

export function InstagramLeadsPage() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState<Period>('30')
  const [tab, setTab] = useState<Tab>('actifs')
  const [level, setLevel] = useState<ConfidenceLevel | 'all'>('all')
  const [uncontacted, setUncontacted] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [size, setSize] = useState<PageSize>(20)
  const [exporting, setExporting] = useState(false)

  const params = new URLSearchParams({ period_days: period, tab, page: String(page), per_page: String(size) })
  if (level !== 'all') params.set('level', level)
  if (uncontacted) params.set('uncontacted', '1')
  if (search.trim()) params.set('q', search.trim())
  const query = useCachedQuery<{ data: PeopleResponse }>(`/api/instagram/people?${params.toString()}`, { screen: 'InstagramLeads', staleMs: 60_000, keepPrevious: true })
  const d = query.data?.data ?? null
  const k = d?.kpis

  const go = (next: { tab: Tab; level?: ConfidenceLevel | 'all'; uncontacted?: boolean }) => {
    setTab(next.tab)
    setLevel(next.level ?? 'all')
    setUncontacted(next.uncontacted ?? false)
    setPage(1)
  }

  async function exportCsv() {
    setExporting(true)
    try {
      const p = new URLSearchParams(params)
      p.set('page', '1')
      p.set('per_page', '200')
      p.set('all', '1')
      const res = await api.get<{ data: PeopleResponse }>(`/api/instagram/people?${p.toString()}`)
      downloadCsv(`leads-instagram-${tab}.csv`, [
        ['username', 'nom', 'profil', 'score', 'niveau de confiance', 'interactions', 'stories vues', "j'aime", 'commentaires', 'premier geste', 'source', 'dernière activité', 'certifié', 'abonné', 'contacté', 'lead CRM'],
        ...res.data.rows.map((r) => [
          r.username,
          r.fullName,
          `https://instagram.com/${r.username}`,
          r.score,
          CONFIDENCE_LABEL[r.confidence],
          r.interactions,
          r.storyViews,
          r.likes,
          r.comments,
          r.firstAt?.slice(0, 10),
          r.firstSource ? SOURCE_LABEL[r.firstSource] : '',
          r.lastAt?.slice(0, 10),
          r.isVerified ? 'oui' : '',
          r.follows === null ? '' : r.follows ? 'oui' : 'non',
          r.contacted ? 'oui' : 'non',
          r.lead ? statusEntry(r.lead.status as LeadStatus).label : '',
        ]),
      ])
    } finally {
      setExporting(false)
    }
  }

  const openPerson = (r: PersonRow) => navigate(r.lead ? `/leads/${r.lead.id}` : `/instagram/people/${encodeURIComponent(r.username)}`)
  const sinceIso = new Date(Date.now() - Number(period) * 86_400_000).toISOString()

  return (
    <div className="ig-page">
      <div className="ig-page-header">
        <div>
          <h1>Leads Instagram</h1>
          <p>Qui contacter en priorité, et ce qu&apos;on estime que ça vaut</p>
        </div>
        <Chips items={PERIODS} active={period} onChange={(p) => { setPeriod(p); setPage(1) }} />
      </div>

      {!d && !query.error && <LoadingState label="Chargement…" />}
      {!d && query.error && <ErrorState message={query.error} onRetry={query.refresh} />}

      {k && (
        <StatGrid>
          <StatCard label="Leads actifs" value={k.active} caption={pctDelta(k.active, k.activePrevious) ?? 'ont agi au moins une fois sur la période'} onClick={() => go({ tab: 'actifs' })} />
          <StatCard
            label="Niveau de confiance très élevé, jamais contactés"
            value={k.veryHighNeverContacted}
            highlight
            caption="actifs sur la période, personne ne leur a écrit"
            onClick={() => go({ tab: 'confiance', level: 'tres_eleve', uncontacted: true })}
          />
          <StatCard
            label="Lurkers acheteurs"
            value={k.buyerLurkers}
            unit="profils"
            caption={d && d.recentStoriesCount > 0 ? `sur vos ${d.recentStoriesCount} dernières stories · jamais contactés` : 'aucune story collectée pour l’instant'}
            onClick={() => go({ tab: 'lurkers' })}
          />
          <StatCard label="Passés au niveau de confiance très élevé" value={k.becameVeryHigh} caption="ils n'y étaient pas au début de la période" onClick={() => go({ tab: 'confiance', level: 'tres_eleve' })} />
        </StatGrid>
      )}

      {d && (
        <TableCard
          title={`${TAB_TITLE[tab]} · ${PERIODS.find((p) => p.key === period)?.label}`}
          subtitle={`${formatNumber(d.total)} personne${d.total > 1 ? 's' : ''}${uncontacted ? ' · jamais contactées' : ''} — clique une ligne pour voir son parcours`}
          toolbar={
            <>
              <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Rechercher un contact" />
              <Chips items={TABS} active={tab} onChange={(t) => go({ tab: t })} />
              <button type="button" className="ds-pill-button" onClick={() => void exportCsv()} disabled={exporting}>
                {exporting ? 'Export…' : 'Exporter'}
              </button>
            </>
          }
        >
          {tab === 'confiance' && (
            <div className="ig-filter-rows">
              <span className="ig-filter-label">Niveau</span>
              <Chips items={LEVEL_CHIPS} active={level} onChange={(l) => { setLevel(l); setPage(1) }} />
              <label className="ig-check">
                <input type="checkbox" checked={uncontacted} onChange={(e) => { setUncontacted(e.target.checked); setPage(1) }} /> Jamais contactés
              </label>
            </div>
          )}
          {d.rows.length === 0 ? (
            <EmptyState
              title="Personne dans cette vue"
              description={tab === 'lurkers' ? 'Les lurkers acheteurs ont vu au moins la moitié de vos dernières stories sans jamais liker ni commenter. Il faut que l’app ait collecté les spectateurs de vos stories.' : undefined}
            />
          ) : (
            <table className="ds-table">
              <thead>
                <tr>
                  <th>Contact</th>
                  {(tab === 'actifs' || tab === 'nouveaux') && <th>Source</th>}
                  {tab === 'confiance' && <th>Gestes</th>}
                  {tab === 'lurkers' && <th className="ds-num-cell">Assiduité</th>}
                  {(tab === 'certifies' || tab === 'lurkers') && <th>Abonné</th>}
                  {tab !== 'lurkers' && <th className="ds-num-cell">Créé le</th>}
                  <th className="ds-num-cell">Score</th>
                  {(tab === 'confiance' || tab === 'actifs') && <th>Niveau de confiance</th>}
                  <th className="ds-num-cell">Dernière activité</th>
                  {tab === 'confiance' && <th className="ds-num-cell">Interactions</th>}
                </tr>
              </thead>
              <tbody>
                {d.rows.map((r) => {
                  const name = r.fullName || r.username
                  const st = r.lead ? statusEntry(r.lead.status as LeadStatus) : null
                  const bar = CONFIDENCE_BAR[r.confidence]
                  const isNew = (r.firstAt ?? '') >= sinceIso
                  return (
                    <tr key={r.username} className="ds-row-clickable" onClick={() => openPerson(r)}>
                      <td>
                        <div className="ig-lead-contact">
                          <ContactCell name={`${name}${r.isVerified ? ' ✓' : ''}`} handle={r.username} avatar={<Avatar name={name} size={28} src={r.profilePicUrl} />} />
                          {isNew && tab !== 'lurkers' && <span className="ig-new-badge">Nouveau</span>}
                          {st && <StatusPill label={st.label} color={st.color} bg={st.bg} />}
                        </div>
                      </td>
                      {(tab === 'actifs' || tab === 'nouveaux') && <td>{r.firstSource ? <span className="ig-type-pill">{SOURCE_LABEL[r.firstSource]}</span> : '—'}</td>}
                      {tab === 'confiance' && (
                        <td className="ig-gestures">
                          <span title="Stories vues" className={r.storyViews ? 'on' : ''}>👁 {r.storyViews}</span>
                          <span title="J'aime" className={r.likes ? 'on' : ''}>♥ {r.likes}</span>
                          <span title="Commentaires" className={r.comments ? 'on' : ''}>💬 {r.comments}</span>
                        </td>
                      )}
                      {tab === 'lurkers' && (
                        <td className="ds-num-cell">
                          <span className="ds-num">
                            {r.recentStoriesSeen} sur {d.recentStoriesCount}
                          </span>
                        </td>
                      )}
                      {(tab === 'certifies' || tab === 'lurkers') && <td>{r.follows === null ? '—' : r.follows ? 'Oui' : 'Non'}</td>}
                      {tab !== 'lurkers' && (
                        <td className="ds-num-cell">
                          <span className="ds-num">{shortDate(r.firstAt)}</span>
                        </td>
                      )}
                      <td className="ds-num-cell">
                        <span className="ds-num">{r.score}</span>
                      </td>
                      {(tab === 'confiance' || tab === 'actifs') && (
                        <td>
                          <span className="ig-confidence" title={CONFIDENCE_LABEL[r.confidence]}>
                            <i style={{ width: `${bar.width}%`, background: bar.color }} />
                          </span>
                        </td>
                      )}
                      <td className="ds-num-cell">
                        <span className="ds-num">{shortDate(r.lastAt)}</span>
                      </td>
                      {tab === 'confiance' && (
                        <td className="ds-num-cell">
                          <span className="ds-num">{r.interactions}</span>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          <PaginationBar total={d.total} page={page} pages={Math.max(1, Math.ceil(d.total / size))} size={size} onPage={setPage} onSize={(s) => { setSize(s); setPage(1) }} />
        </TableCard>
      )}
    </div>
  )
}
