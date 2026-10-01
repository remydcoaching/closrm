// Audience › Qui like vos réels — every like identified by the publication
// monitor, one row per Instagram account (GET /api/instagram/audience/likers).
// Instagram never dates a like: "Vu" is when ClosRM first saw the latest one.
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TableCard, ContactCell } from '../../design-system/TableCard'
import { Chips } from '../../design-system/Tabs'
import { Avatar } from '../../design-system/Avatar'
import { StatusPill } from '../../design-system/StatusPill'
import { formatNumber } from '../../design-system/StatCard'
import { LoadingState, ErrorState, EmptyState } from '../../design-system/States'
import { usePaged, PaginationBar } from '../../design-system/Pagination'
import { useCachedQuery } from '../../lib/use-cached-query'
import { relativeTime, shortDate, statusEntry } from '../leads/status'
import type { LeadStatus } from '../leads/types'

interface LikerRow {
  instagramUserId: string
  username: string
  fullName: string | null
  profilePicUrl: string | null
  likes: number
  lastSeenAt: string
  lead: { id: string; first_name: string; last_name: string; status: LeadStatus; instagram_profile_pic_url: string | null } | null
}

interface LikersSummary {
  people: number
  likes: number
  leads: number
  publications: number
  rows: LikerRow[]
}

type Filter = 'all' | 'leads' | 'others'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'leads', label: 'Leads' },
  { key: 'others', label: 'Pas encore leads' },
]

export function LikersSection() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('all')
  const query = useCachedQuery<{ data: LikersSummary }>('/api/instagram/audience/likers', { screen: 'AudienceLikers', staleMs: 60_000 })
  const summary = query.data?.data ?? null
  const rows = useMemo(
    () => (summary?.rows ?? []).filter((r) => (filter === 'leads' ? !!r.lead : filter === 'others' ? !r.lead : true)),
    [summary, filter],
  )
  const paged = usePaged(rows)

  return (
    <TableCard
      title="Qui like vos réels"
      subtitle={
        summary && summary.people > 0
          ? `${formatNumber(summary.people)} personnes · ${formatNumber(summary.likes)} j'aime identifiés sur ${formatNumber(summary.publications)} réels · dont ${formatNumber(summary.leads)} leads`
          : "Les j'aime identifiés par le suivi de vos publications"
      }
      toolbar={summary && summary.people > 0 ? <Chips items={FILTERS} active={filter} onChange={setFilter} /> : undefined}
    >
      {!summary && !query.error && <LoadingState label="Chargement…" />}
      {!summary && query.error && <ErrorState message={query.error} onRetry={query.refresh} />}
      {summary && summary.people === 0 && (
        <EmptyState
          title="Aucun j'aime identifié pour l'instant"
          description="Activez le suivi de vos publications (page Contenu) puis récupérez l'historique des j'aime : chaque personne qui like vos réels apparaîtra ici."
        />
      )}
      {summary && summary.people > 0 && rows.length === 0 && <EmptyState title="Personne dans ce filtre" />}
      {rows.length > 0 && (
        <table className="ds-table">
          <thead>
            <tr>
              <th>Personne</th>
              <th className="ds-num-cell">Réels likés</th>
              <th>Lead</th>
              <th className="ds-num-cell">Vu</th>
            </tr>
          </thead>
          <tbody>
            {paged.pageRows.map((r) => {
              const leadName = r.lead ? `${r.lead.first_name} ${r.lead.last_name}`.trim() : ''
              const name = leadName || r.fullName || r.username
              const st = r.lead ? statusEntry(r.lead.status) : null
              return (
                <tr
                  key={r.instagramUserId}
                  className="ds-row-clickable"
                  onClick={() => navigate(r.lead ? `/leads/${r.lead.id}` : `/instagram/people/${encodeURIComponent(r.username)}`)}
                  title={r.lead ? 'Ouvrir la fiche lead' : 'Ouvrir sa fiche (parcours)'}
                >
                  <td>
                    <ContactCell name={name} handle={r.username} avatar={<Avatar name={name} size={28} src={r.lead?.instagram_profile_pic_url || r.profilePicUrl} />} />
                  </td>
                  <td className="ds-num-cell">
                    <span className="ds-num">{formatNumber(r.likes)}</span>
                  </td>
                  <td>{st ? <StatusPill label={st.label} color={st.color} bg={st.bg} /> : <span className="ds-muted">—</span>}</td>
                  <td className="ds-num-cell">
                    <span className="ds-num" title={`Vu par ClosRM ${relativeTime(r.lastSeenAt)} (Instagram ne date pas les j'aime)`}>
                      {shortDate(r.lastSeenAt)}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      {rows.length > 0 && <PaginationBar total={paged.total} page={paged.page} pages={paged.pages} size={paged.size} onPage={paged.setPage} onSize={paged.setSize} />}
    </TableCard>
  )
}
