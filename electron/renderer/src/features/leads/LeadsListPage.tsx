// Desktop-first Leads list — reproduces what ClosRM web already does
// (src/app/(dashboard)/leads/leads-client.tsx + LeadsListView.tsx):
// search/status/source filters via GET /api/leads query params, server-side
// sort/pagination (leadFiltersSchema on the backend). Clicking a row
// navigates to the lead's own full page (/leads/:id, see LeadDetailPage.tsx)
// rather than opening a docked side panel — explicit feedback. No new
// business logic: same endpoint, same query params, same status/source
// vocabulary.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../../lib/api-client'
import { SearchInput } from '../../design-system/SearchInput'
import { FilterMenu } from '../../design-system/FilterMenu'
import { StatusPill } from '../../design-system/StatusPill'
import { Avatar } from '../../design-system/Avatar'
import { Button } from '../../design-system/Button'
import { LoadingState, ErrorState, EmptyState } from '../../design-system/States'
import { STATUS_CONFIG, SOURCE_CONFIG, statusEntry, sourceEntry, displayName, relativeTime } from './status'
import { LeadCreateModal } from './LeadCreateModal'
import type { Lead, LeadsListResponse } from './types'
import './leads-list.css'

const PER_PAGE = 50

type SortField = 'created_at' | 'updated_at' | 'first_name' | 'last_name' | 'status'

export function LeadsListPage() {
  const navigate = useNavigate()
  const [leads, setLeads] = useState<Lead[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState({ total: 0, page: 1, per_page: PER_PAGE, total_pages: 1 })
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statuses, setStatuses] = useState<string[]>([])
  const [sources, setSources] = useState<string[]>([])
  const [sort, setSort] = useState<SortField>('created_at')
  const [order, setOrder] = useState<'asc' | 'desc'>('desc')
  const [showCreate, setShowCreate] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(searchInput), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, statuses, sources, sort, order])

  async function load() {
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('per_page', String(PER_PAGE))
      params.set('sort', sort)
      params.set('order', order)
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (statuses.length > 0) params.set('status', statuses.join(','))
      if (sources.length > 0) params.set('source', sources.join(','))

      const res = await api.get<LeadsListResponse>(`/api/leads?${params.toString()}`)
      setLeads(res.data)
      setMeta(res.meta)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inconnue')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, statuses, sources, sort, order])

  function toggleSort(field: SortField) {
    if (sort === field) {
      setOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
    } else {
      setSort(field)
      setOrder('desc')
    }
  }

  return (
    <div className="leads-page">
      <div className="leads-page-header">
        <div>
          <h1>Leads</h1>
          <p>{leads === null ? '…' : `${meta.total} prospect${meta.total > 1 ? 's' : ''}`}</p>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          + Nouveau lead
        </Button>
      </div>

      <div className="leads-page-filters">
        <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Rechercher un lead…" />
        <FilterMenu
          label="Statut"
          options={STATUS_CONFIG.map((s) => ({ key: s.key, label: s.label, color: s.color }))}
          selected={statuses}
          onChange={setStatuses}
        />
        <FilterMenu
          label="Source"
          options={SOURCE_CONFIG.map((s) => ({ key: s.key, label: s.label, color: s.color }))}
          selected={sources}
          onChange={setSources}
        />
      </div>

      <div className="leads-page-body">
        <div className="leads-list-pane">
          {leads === null && !error && <LoadingState label="Chargement des leads…" />}
          {error && <ErrorState message={error} onRetry={load} />}
          {leads && leads.length === 0 && <EmptyState title="Aucun lead" description="Créez votre premier lead pour commencer." />}

          {leads && leads.length > 0 && (
            <div className="leads-table-wrap">
              <table className="leads-table">
                <thead>
                  <tr>
                    <th />
                    <SortableHeader label="Nom / Instagram" field="first_name" sort={sort} order={order} onClick={toggleSort} />
                    <SortableHeader label="Statut" field="status" sort={sort} order={order} onClick={toggleSort} />
                    <th>Source</th>
                    <th>Tags</th>
                    <th>Activité</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => {
                    const status = statusEntry(lead.status)
                    const source = sourceEntry(lead.source)
                    const name = displayName(lead.first_name, lead.last_name, lead.instagram_handle ?? 'Sans nom')
                    return (
                      <tr key={lead.id} onClick={() => navigate(`/leads/${lead.id}`)}>
                        <td className="leads-cell-avatar">
                          <Avatar name={name} size={30} />
                        </td>
                        <td>
                          <div className="leads-cell-name">{name}</div>
                          {lead.instagram_handle && <div className="leads-cell-handle">@{lead.instagram_handle}</div>}
                        </td>
                        <td>
                          <StatusPill label={status.label} color={status.color} bg={status.bg} />
                        </td>
                        <td>
                          <StatusPill label={source.label} color={source.color} bg={source.bg} />
                        </td>
                        <td>
                          {lead.tags.length > 0 ? (
                            <span className="leads-cell-tags">
                              {lead.tags.slice(0, 2).join(', ')}
                              {lead.tags.length > 2 && ` +${lead.tags.length - 2}`}
                            </span>
                          ) : (
                            <span className="leads-cell-muted">—</span>
                          )}
                        </td>
                        <td className="leads-cell-muted">{relativeTime(lead.last_activity_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {meta.total_pages > 1 && (
                <div className="leads-pagination">
                  <span>
                    Page {meta.page} sur {meta.total_pages} — {meta.total} résultats
                  </span>
                  <div className="leads-pagination-buttons">
                    <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                      Précédent
                    </button>
                    <button disabled={page >= meta.total_pages} onClick={() => setPage((p) => p + 1)}>
                      Suivant
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <LeadCreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            load()
          }}
        />
      )}
    </div>
  )
}

function SortableHeader({
  label,
  field,
  sort,
  order,
  onClick,
}: {
  label: string
  field: SortField
  sort: SortField
  order: 'asc' | 'desc'
  onClick: (field: SortField) => void
}) {
  const active = sort === field
  return (
    <th className="leads-th-sortable" onClick={() => onClick(field)}>
      {label}
      {active && <span className="leads-sort-arrow">{order === 'asc' ? '↑' : '↓'}</span>}
    </th>
  )
}
