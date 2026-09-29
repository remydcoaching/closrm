// Instagram > Contenu > one content — GET /api/instagram/content/:contentId.
// Everything about one reel/post: Instagram counters at the last scan,
// identified likers/commenters, and each profile (abonné ?, déjà lead ?,
// activité sur le compte). Clicking a profile opens a side panel; "Cibler"
// converts it into a lead through the existing Ciblage target endpoint.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../../lib/api-client'
import { safeExternalUrl } from '../../lib/safe-url'
import { StatCard, StatGrid, formatNumber } from '../../design-system/StatCard'
import { TableCard, ContactCell } from '../../design-system/TableCard'
import { Chips } from '../../design-system/Tabs'
import { Avatar } from '../../design-system/Avatar'
import { StatusPill } from '../../design-system/StatusPill'
import { Drawer } from '../../design-system/Drawer'
import { SearchInput } from '../../design-system/SearchInput'
import { LoadingState, ErrorState, EmptyState } from '../../design-system/States'
import { shortDate, statusEntry } from '../leads/status'
import { funnelStage, FUNNEL_STAGE_LABEL, FUNNEL_STAGE_COLOR } from './funnel-stage'
import { ContentThumb } from './ContentThumb'
import { contentTypeLabel, formatRate } from './ContentPage'
import type { ContentDetail, ContentProfile } from './types'
import './instagram.css'
import { usePaged, PaginationBar } from '../../design-system/Pagination'

type Filter = 'all' | 'commenters' | 'likers' | 'leads' | 'not_leads' | 'not_following'

export function ContentDetailPage() {
  const { contentId = '' } = useParams<{ contentId: string }>()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<ContentDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<ContentProfile | null>(null)
  const [targeting, setTargeting] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      const res = await api.get<{ data: ContentDetail }>(`/api/instagram/content/${encodeURIComponent(contentId)}`)
      setDetail(res.data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inconnue')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentId])

  async function target(profile: ContentProfile) {
    if (profile.lead) {
      navigate(`/leads/${profile.lead.id}`)
      return
    }
    if (!profile.runId || !profile.discoveryProfileId) return
    setTargeting(profile.username)
    try {
      const res = await api.post<{ data: { leadId: string } }>(`/api/instagram/discovery/${profile.runId}/profiles/${profile.discoveryProfileId}/target`, {})
      navigate(`/leads/${res.data.leadId}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ciblage impossible')
      setTargeting(null)
    }
  }

  const profiles = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (detail?.profiles ?? []).filter((p) => {
      if (q && !p.username.toLowerCase().includes(q) && !(p.fullName ?? '').toLowerCase().includes(q)) return false
      switch (filter) {
        case 'commenters':
          return p.commented
        case 'likers':
          return p.liked
        case 'leads':
          return !!p.lead
        case 'not_leads':
          return !p.lead
        case 'not_following':
          return p.followsTarget === false
        default:
          return true
      }
    })
  }, [detail, filter, search])

  const paged = usePaged(profiles)

  if (error && !detail) return <ErrorState message={error} onRetry={load} />
  if (!detail) return <LoadingState label="Chargement du contenu…" />

  const m = detail.metrics
  const stage = m.engagementRate === null ? null : funnelStage(m.engagementRate)
  const url = safeExternalUrl(m.contentUrl)
  const all = detail.profiles

  return (
    <div className="ig-page">
      <button type="button" className="ds-pill-button ig-back" onClick={() => navigate('/instagram/content')}>
        ← Contenu
      </button>

      <div className="ig-content-hero">
        <ContentThumb url={m.thumbnailUrl} size={96} />
        <div>
          <h1>
            {contentTypeLabel(m.contentType)} du {shortDate(m.publishedAt)}
          </h1>
          <p className="ds-muted">
            {url ? (
              <a href={url} target="_blank" rel="noopener noreferrer">
                {url}
              </a>
            ) : (
              m.contentId
            )}
          </p>
          {stage && (
            <span className="ig-stage-pill" style={{ color: FUNNEL_STAGE_COLOR[stage], borderColor: FUNNEL_STAGE_COLOR[stage] }}>
              {FUNNEL_STAGE_LABEL[stage]}
            </span>
          )}
        </div>
      </div>

      <StatGrid>
        <StatCard label="Vues" value={m.views ?? '—'} caption="compteur Instagram au dernier scan" />
        <StatCard label="Taux d'engagement" value={formatRate(m.engagementRate)} caption={`${formatNumber(m.likesCount)} likes · ${formatNumber(m.commentsCount)} commentaires`} />
        <StatCard label="Likers identifiés" value={m.identifiedLikers} unit="profils" caption={`et ${formatNumber(m.identifiedCommenters)} commentaires identifiés`} />
        <StatCard label="Leads" value={m.leadsCount} highlight caption="profils déjà dans votre CRM" />
      </StatGrid>

      <TableCard
        title="Profils qui ont réagi"
        subtitle={`${profiles.length} sur ${all.length} profil${all.length > 1 ? 's' : ''}`}
        toolbar={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder="Rechercher un contact" />
            <Chips
              items={[
                { key: 'all' as Filter, label: 'Tous', count: all.length },
                { key: 'commenters' as Filter, label: 'Commentaires', count: all.filter((p) => p.commented).length },
                { key: 'likers' as Filter, label: 'Likes', count: all.filter((p) => p.liked).length },
                { key: 'not_leads' as Filter, label: 'Pas encore leads', count: all.filter((p) => !p.lead).length },
                { key: 'leads' as Filter, label: 'Leads', count: all.filter((p) => p.lead).length },
                { key: 'not_following' as Filter, label: 'Ne suivent pas', count: all.filter((p) => p.followsTarget === false).length },
              ]}
              active={filter}
              onChange={setFilter}
            />
          </>
        }
      >
        {error && <p className="lead-create-error">{error}</p>}
        {all.length === 0 ? (
          <EmptyState
            title="Aucun profil identifié"
            description="Relancez une analyse de votre compte : les likers et commentateurs de chaque contenu sont enregistrés depuis la dernière mise à jour."
          />
        ) : (
          <table className="ds-table">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Geste</th>
                <th>Abonné</th>
                <th className="ds-num-cell">Activité sur le compte</th>
                <th>Lead</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {paged.pageRows.map((p) => {
                const name = p.lead ? `${p.lead.firstName} ${p.lead.lastName}`.trim() || p.fullName || p.username : p.fullName || p.username
                const st = p.lead ? statusEntry(p.lead.status) : null
                return (
                  <tr key={p.username} className="ds-row-clickable" onClick={() => setSelected(p)}>
                    <td>
                      <ContactCell name={name} handle={p.username} avatar={<Avatar name={name} size={28} src={p.profilePicUrl} />} />
                    </td>
                    <td>{[p.liked && 'A liké', p.commented && 'A commenté'].filter(Boolean).join(' · ')}</td>
                    <td>{p.followsTarget === null ? '—' : p.followsTarget ? 'Oui' : 'Non'}</td>
                    <td className="ds-num-cell">
                      <span className="ds-num">{p.totalLikes === null ? '—' : `${formatNumber(p.totalLikes)} likes · ${formatNumber(p.totalComments ?? 0)} com.`}</span>
                    </td>
                    <td>{st ? <StatusPill label={st.label} color={st.color} bg={st.bg} /> : <span className="ds-muted">Non</span>}</td>
                    <td className="ds-num-cell">
                      {(p.lead || p.discoveryProfileId) && (
                        <button
                          type="button"
                          className={`ds-pill-button ${p.lead ? '' : 'ds-pill-button--dark'}`}
                          disabled={targeting === p.username}
                          onClick={(e) => {
                            e.stopPropagation()
                            target(p)
                          }}
                        >
                          {targeting === p.username ? 'Ciblage…' : p.lead ? 'Voir le lead' : 'Cibler'}
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

      {selected && (
        <Drawer title={selected.fullName || `@${selected.username}`} onClose={() => setSelected(null)}>
          <div className="ig-profile-panel">
            <Avatar name={selected.fullName || selected.username} size={72} src={selected.profilePicUrl} />
            <div className="ds-contact-handle">@{selected.username}</div>
            <dl className="ig-profile-facts">
              <dt>Sur ce contenu</dt>
              <dd>{[selected.liked && 'a liké', selected.commented && 'a commenté'].filter(Boolean).join(' et ')}</dd>
              <dt>Vous suit</dt>
              <dd>{selected.followsTarget === null ? 'Inconnu' : selected.followsTarget ? 'Oui' : 'Non'}</dd>
              <dt>Activité sur le compte</dt>
              <dd>
                {selected.totalLikes === null
                  ? 'Inconnue'
                  : `${formatNumber(selected.totalLikes)} contenus likés, ${formatNumber(selected.totalComments ?? 0)} commentés (dernier scan)`}
              </dd>
              <dt>Certifié</dt>
              <dd>{selected.isVerified ? 'Oui' : 'Non'}</dd>
              <dt>Déjà lead</dt>
              <dd>{selected.lead ? `Oui — ${statusEntry(selected.lead.status).label}` : 'Non'}</dd>
            </dl>
            <div className="ig-profile-actions">
              <a className="ds-pill-button" href={`https://instagram.com/${encodeURIComponent(selected.username)}`} target="_blank" rel="noopener noreferrer">
                Contacter sur Instagram
              </a>
              {(selected.lead || selected.discoveryProfileId) && (
                <button type="button" className="ds-pill-button ds-pill-button--dark" onClick={() => target(selected)} disabled={targeting === selected.username}>
                  {selected.lead ? 'Voir le lead' : 'Cibler'}
                </button>
              )}
            </div>
          </div>
        </Drawer>
      )}
    </div>
  )
}
