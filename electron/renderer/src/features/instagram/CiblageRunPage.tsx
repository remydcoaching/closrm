// Ciblage results — every profile OBSERVED during one scan (GET
// /api/instagram/discovery/:runId/profiles, paginated, searchable, filterable)
// with likes/comments, "Assiduité" (contents liked out of contents analysed),
// follow status and whether each is already a lead. "Cibler" (POST
// .../target) converts one profile into a lead — the only place a scan
// turns into a lead.
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../../lib/api-client'
import { downloadCsv } from '../../lib/csv'
import { Avatar } from '../../design-system/Avatar'
import { SearchInput } from '../../design-system/SearchInput'
import { StatCard, StatGrid, formatNumber } from '../../design-system/StatCard'
import { TableCard, ContactCell, SortHeader } from '../../design-system/TableCard'
import { Chips } from '../../design-system/Tabs'
import { LoadingState, ErrorState, EmptyState } from '../../design-system/States'
import { shortDate } from '../leads/status'
import type { DiscoveryProfile } from './types'
import './instagram.css'
import '../leads/leads-list.css'

type Filter = 'all' | 'not_leads' | 'leads' | 'following' | 'not_following' | 'commenters'
type Sort = 'likes_count' | 'comments_count' | 'instagram_username'

interface RunInfo {
  instagram_username: string
  status: string
  started_at: string
  completed_at: string | null
  contents_found: number | null
  users_found: number | null
}

interface ProfilesResponse {
  data: DiscoveryProfile[]
  run: RunInfo | null
  counts: Record<Filter, number>
  meta: { total: number; page: number; per_page: number; total_pages: number }
}

const FILTER_LABEL: Record<Filter, string> = {
  all: 'Tous',
  not_leads: 'À cibler',
  leads: 'Déjà leads',
  following: 'Vous suivent',
  not_following: 'Ne suivent pas',
  commenters: 'Ont commenté',
}

const PER_PAGE = 50

export function CiblageRunPage() {
  const { runId } = useParams<{ runId: string }>()
  const navigate = useNavigate()
  const [res, setRes] = useState<ProfilesResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [targeting, setTargeting] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('not_leads')
  const [sort, setSort] = useState<Sort>('likes_count')
  const [order, setOrder] = useState<'asc' | 'desc'>('desc')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => setPage(1), [filter, sort, order, search])

  function params(p: number, perPage: number) {
    const q = new URLSearchParams({ page: String(p), per_page: String(perPage), filter, sort, order })
    if (search) q.set('search', search)
    return q.toString()
  }

  async function load() {
    if (!runId) return
    setError(null)
    try {
      setRes(await api.get<ProfilesResponse>(`/api/instagram/discovery/${runId}/profiles?${params(page, PER_PAGE)}`))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inconnue')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, page, filter, sort, order, search])

  function toggleSort(field: Sort) {
    if (sort === field) setOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
    else {
      setSort(field)
      setOrder(field === 'instagram_username' ? 'asc' : 'desc')
    }
  }

  async function handleTarget(profile: DiscoveryProfile) {
    if (profile.matched_lead_id) {
      navigate(`/leads/${profile.matched_lead_id}`)
      return
    }
    if (!runId) return
    setTargeting(profile.id)
    try {
      const r = await api.post<{ data: { leadId: string } }>(`/api/instagram/discovery/${runId}/profiles/${profile.id}/target`, {})
      setRes((prev) =>
        prev ? { ...prev, data: prev.data.map((p) => (p.id === profile.id ? { ...p, matched_lead_id: r.data.leadId, targeted_at: new Date().toISOString() } : p)) } : prev,
      )
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ciblage impossible')
    } finally {
      setTargeting(null)
    }
  }

  async function exportCsv() {
    if (!runId) return
    setExporting(true)
    try {
      const all: DiscoveryProfile[] = []
      for (let p = 1; ; p++) {
        const r = await api.get<ProfilesResponse>(`/api/instagram/discovery/${runId}/profiles?${params(p, 200)}`)
        all.push(...r.data)
        if (p >= r.meta.total_pages) break
      }
      downloadCsv(`ciblage-${res?.run?.instagram_username ?? runId}.csv`, [
        ['Pseudo', 'Nom', 'Likes', 'Commentaires', 'Vous suit', 'Déjà lead', 'Certifié'],
        ...all.map((p) => [p.instagram_username, p.full_name, p.likes_count, p.comments_count, p.follows_target ? 'Oui' : 'Non', p.matched_lead_id ? 'Oui' : 'Non', p.is_verified ? 'Oui' : 'Non']),
      ])
    } finally {
      setExporting(false)
    }
  }

  const run = res?.run
  const counts = res?.counts
  const contentsAnalysed = run?.contents_found ?? null

  return (
    <div className="ig-page">
      <button type="button" className="ds-pill-button ig-back" onClick={() => navigate('/instagram/discovery')}>
        ← Analyses
      </button>
      <div className="ig-page-header">
        <div>
          <h1>{run ? `@${run.instagram_username}` : 'Profils à cibler'}</h1>
          <p>Ils ont aimé ou commenté ses contenus, en public{run ? ` — analyse du ${shortDate(run.started_at)}` : ''}.</p>
        </div>
      </div>

      {counts && (
        <StatGrid>
          <StatCard label="Profils observés" value={counts.all} caption={contentsAnalysed ? `sur ${formatNumber(contentsAnalysed)} contenus analysés` : undefined} />
          <StatCard label="À cibler" value={counts.not_leads} highlight caption="pas encore dans vos leads" onClick={() => setFilter('not_leads')} />
          <StatCard label="Ont commenté" value={counts.commenters} caption="signal d'intention le plus fort" onClick={() => setFilter('commenters')} />
          <StatCard label="Ne vous suivent pas" value={counts.not_following} caption="interagissent sans être abonnés" onClick={() => setFilter('not_following')} />
        </StatGrid>
      )}

      <TableCard
        title={`${FILTER_LABEL[filter]} · ${res ? formatNumber(res.meta.total) : '…'}`}
        subtitle="Cliquez sur « Cibler » pour ajouter un profil à vos leads"
        toolbar={
          <>
            <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Rechercher un contact" />
            <Chips
              items={(Object.keys(FILTER_LABEL) as Filter[]).map((k) => ({ key: k, label: FILTER_LABEL[k], count: counts?.[k] }))}
              active={filter}
              onChange={setFilter}
            />
            <button type="button" className="ds-pill-button" onClick={exportCsv} disabled={exporting || !res?.meta.total}>
              {exporting ? 'Export…' : 'Exporter'}
            </button>
          </>
        }
      >
        {res === null && !error && <LoadingState label="Chargement des profils…" />}
        {error && <ErrorState message={error} onRetry={load} />}
        {res && res.data.length === 0 && <EmptyState title="Aucun profil" description="Aucun profil ne correspond à ce filtre." />}

        {res && res.data.length > 0 && (
          <>
            <table className="ds-table">
              <thead>
                <tr>
                  <SortHeader label="Contact" active={sort === 'instagram_username'} order={order} onClick={() => toggleSort('instagram_username')} />
                  <SortHeader label="Assiduité" align="right" active={sort === 'likes_count'} order={order} onClick={() => toggleSort('likes_count')} />
                  <SortHeader label="Commentaires" align="right" active={sort === 'comments_count'} order={order} onClick={() => toggleSort('comments_count')} />
                  <th>Abonné</th>
                  <th>Déjà lead</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {res.data.map((profile) => {
                  const name = profile.full_name || profile.instagram_username
                  return (
                    <tr key={profile.id}>
                      <td>
                        <ContactCell
                          name={`${name}${profile.is_verified ? ' ✓' : ''}`}
                          handle={profile.instagram_username}
                          avatar={<Avatar name={name} size={28} src={profile.profile_pic_url} />}
                        />
                      </td>
                      <td className="ds-num-cell">
                        <span className="ds-num">
                          {contentsAnalysed ? `${formatNumber(profile.likes_count)} sur ${formatNumber(contentsAnalysed)}` : formatNumber(profile.likes_count)}
                        </span>
                      </td>
                      <td className="ds-num-cell">
                        <span className="ds-num">{formatNumber(profile.comments_count)}</span>
                      </td>
                      <td>{profile.follows_target ? 'Oui' : 'Non'}</td>
                      <td>{profile.matched_lead_id ? 'Oui' : 'Non'}</td>
                      <td className="ds-num-cell">
                        <button
                          type="button"
                          className={`ds-pill-button ${profile.matched_lead_id ? '' : 'ds-pill-button--dark'}`}
                          disabled={targeting === profile.id}
                          onClick={() => handleTarget(profile)}
                        >
                          {targeting === profile.id ? 'Ciblage…' : profile.matched_lead_id ? 'Voir le lead' : 'Cibler'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {res.meta.total_pages > 1 && (
              <div className="leads-pagination">
                <span>
                  Page {page} sur {res.meta.total_pages} — {formatNumber(res.meta.total)} profils
                </span>
                <div className="leads-pagination-buttons">
                  <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Précédent
                  </button>
                  <button disabled={page >= res.meta.total_pages} onClick={() => setPage((p) => p + 1)}>
                    Suivant
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </TableCard>
    </div>
  )
}
