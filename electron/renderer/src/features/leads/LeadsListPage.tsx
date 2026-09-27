// Leads — Insyder-style layout on top of ClosRM's existing contracts:
// 1. KPI row from GET /api/instagram/audience (real segments, see
//    src/lib/instagram/audience-segments.ts) for the selected period;
// 2. the leads table from GET /api/leads (same search/status/source
//    filters, server-side sort/pagination as the web's LeadsListView).
// Clicking a row opens the lead's own full page (/leads/:id).
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../../lib/api-client'
import { downloadCsv } from '../../lib/csv'
import { SearchInput } from '../../design-system/SearchInput'
import { FilterMenu } from '../../design-system/FilterMenu'
import { StatusPill } from '../../design-system/StatusPill'
import { Avatar } from '../../design-system/Avatar'
import { StatCard, StatGrid } from '../../design-system/StatCard'
import { TableCard, SortHeader, ContactCell } from '../../design-system/TableCard'
import { Chips } from '../../design-system/Tabs'
import { LoadingState, ErrorState, EmptyState } from '../../design-system/States'
import { STATUS_CONFIG, SOURCE_CONFIG, statusEntry, sourceEntry, displayName, shortDate } from './status'
import { LeadCreateModal } from './LeadCreateModal'
import { LeadPicturesButton } from './LeadPicturesButton'
import { useStoryLurkers } from '../instagram/StoryViewersSection'
import type { Lead, LeadsListResponse } from './types'
import './leads-list.css'
import { useCachedQuery } from '../../lib/use-cached-query'
import { getCached, isStale, revalidate } from '../../lib/query-cache'

/** Hovering a row warms the lead page (one aggregated request, deduplicated). */
function prefetchLead(id: string) {
  const key = `/api/desktop/leads/${id}/intelligence`
  if (isStale(getCached(key), 30_000)) revalidate(key).catch(() => {})
}

const PER_PAGE = 50

type SortField = 'created_at' | 'last_activity_at' | 'first_name' | 'status'
type Period = '7' | '30' | '90' | '365' | 'custom'

const PERIODS: { key: Period; label: string }[] = [
  { key: '7', label: '7 j' },
  { key: '30', label: '30 j' },
  { key: '90', label: '90 j' },
  { key: '365', label: '1 an' },
  { key: 'custom', label: 'Personnalisé' },
]

interface AudienceSegments {
  totalEngaged: number
  actifs: number
  actifsJamaisContactes: number
  neVousSuiventPas: number
  lurkers: number
}

export function LeadsListPage() {
  const navigate = useNavigate()
  const [exportError, setExportError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statuses, setStatuses] = useState<string[]>([])
  const [sources, setSources] = useState<string[]>([])
  const [sort, setSort] = useState<SortField>('created_at')
  const [order, setOrder] = useState<'asc' | 'desc'>('desc')
  const [showCreate, setShowCreate] = useState(false)
  const [period, setPeriod] = useState<Period>('30')
  const [customStart, setCustomStart] = useState(() => new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10))
  // "Personnalisé" = from a chosen date up to today.
  const periodDays = period === 'custom' ? Math.max(1, Math.ceil((Date.now() - new Date(customStart).getTime()) / 86_400_000)) : Number(period)
  const [exporting, setExporting] = useState(false)
  const { data: storyLurkers } = useStoryLurkers(10, null)
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

  const segmentsQuery = useCachedQuery<{ data: AudienceSegments }>(`/api/instagram/audience?period_days=${periodDays}`, { screen: 'LeadsCards', staleMs: 60_000 })
  const segments = segmentsQuery.data?.data ?? null

  function buildParams(p: number, perPage: number) {
    const params = new URLSearchParams()
    params.set('page', String(p))
    params.set('per_page', String(perPage))
    params.set('sort', sort)
    params.set('order', order)
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (statuses.length > 0) params.set('status', statuses.join(','))
    if (sources.length > 0) params.set('source', sources.join(','))
    return params
  }

  // Cache first: returning to Leads shows the last list instantly.
  const listQuery = useCachedQuery<LeadsListResponse>(`/api/leads?${buildParams(page, PER_PAGE).toString()}`, { screen: 'Leads', staleMs: 20_000, keepPrevious: true })
  const leads = listQuery.data?.data ?? null
  const meta = listQuery.data?.meta ?? { total: 0, page: 1, per_page: PER_PAGE, total_pages: 1 }
  const error = listQuery.error ?? exportError
  const load = listQuery.refresh

  function toggleSort(field: SortField) {
    if (sort === field) {
      setOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
    } else {
      setSort(field)
      setOrder('desc')
    }
  }

  // Exports every lead matching the current filters, not just this page.
  async function exportCsv() {
    setExporting(true)
    try {
      const all: Lead[] = []
      for (let p = 1; ; p++) {
        const res = await api.get<LeadsListResponse>(`/api/leads?${buildParams(p, 100).toString()}`)
        all.push(...res.data)
        if (p >= res.meta.total_pages) break
      }
      downloadCsv(`leads-${new Date().toISOString().slice(0, 10)}.csv`, [
        ['Prénom', 'Nom', 'Instagram', 'Téléphone', 'Email', 'Statut', 'Source', 'Tags', 'Créé le', 'Dernière activité'],
        ...all.map((l) => [
          l.first_name,
          l.last_name,
          l.instagram_handle,
          l.phone,
          l.email,
          statusEntry(l.status).label,
          sourceEntry(l.source).label,
          l.tags.join(', '),
          l.created_at,
          l.last_activity_at,
        ]),
      ])
    } catch (err) {
      setExportError(err instanceof ApiError ? err.message : 'Export impossible')
    } finally {
      setExporting(false)
    }
  }

  const periodLabel = period === 'custom' ? `depuis le ${shortDate(customStart)}` : `${periodDays} j`
  const activeFilters = statuses.length + sources.length

  return (
    <div className="leads-page">
      <div className="leads-page-header">
        <div>
          <h1>Leads</h1>
          <p>Qui contacter en priorité, et ce qu&apos;on estime que ça vaut</p>
        </div>
        <div className="leads-page-header-actions">
          <Chips items={PERIODS} active={period} onChange={setPeriod} />
          {period === 'custom' && (
            <input
              type="date"
              className="leads-custom-date"
              value={customStart}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => e.target.value && setCustomStart(e.target.value)}
            />
          )}
          <button type="button" className="ds-pill-button ds-pill-button--dark" onClick={() => setShowCreate(true)}>
            + Nouveau lead
          </button>
        </div>
      </div>

      <StatGrid>
        <StatCard
          label="Leads actifs"
          value={segments ? segments.actifs : '—'}
          caption={`vus agir au moins une fois sur ${periodLabel}`}
          onClick={() => navigate('/instagram/audience')}
        />
        <StatCard
          label="Actifs, jamais contactés"
          value={segments ? segments.actifsJamaisContactes : '—'}
          highlight
          caption="actifs sur la période, personne ne leur a écrit"
          onClick={() => navigate('/instagram/audience')}
        />
        {storyLurkers && storyLurkers.totalStories > 0 ? (
          <StatCard
            label="Lurkers acheteurs"
            value={storyLurkers.lurkers}
            unit="profils"
            caption={`sur vos ${storyLurkers.totalStories} dernières stories · jamais contactés`}
            onClick={() => navigate('/instagram/audience')}
          />
        ) : (
          <StatCard
            label="Lurkers"
            value={segments ? segments.lurkers : '—'}
            unit={segments ? 'profils' : undefined}
            caption="ont interagi, jamais contactés"
            onClick={() => navigate('/instagram/audience')}
          />
        )}
        <StatCard
          label="Ne vous suivent pas"
          value={segments ? segments.neVousSuiventPas : '—'}
          caption="au dernier ciblage de votre compte"
          onClick={() => navigate('/instagram/audience')}
        />
      </StatGrid>

      <TableCard
        title={`Tous les leads · ${leads === null ? '…' : new Intl.NumberFormat('fr-FR').format(meta.total)}`}
        subtitle={activeFilters > 0 ? `${activeFilters} filtre${activeFilters > 1 ? 's' : ''} actif${activeFilters > 1 ? 's' : ''}` : 'Aucun filtre'}
        toolbar={
          <>
            <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Rechercher un contact" />
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
            <button type="button" className="ds-pill-button" onClick={exportCsv} disabled={exporting || !leads?.length}>
              {exporting ? 'Export…' : 'Exporter'}
            </button>
            <LeadPicturesButton onDone={load} />
          </>
        }
      >
        {leads === null && !error && <LoadingState label="Chargement des leads…" />}
        {error && <ErrorState message={error} onRetry={load} />}
        {leads && leads.length === 0 && <EmptyState title="Aucun lead" description="Créez votre premier lead pour commencer." />}

        {leads && leads.length > 0 && (
          <>
            <table className="ds-table">
              <thead>
                <tr>
                  <SortHeader label="Contact" active={sort === 'first_name'} order={order} onClick={() => toggleSort('first_name')} />
                  <SortHeader label="Statut" active={sort === 'status'} order={order} onClick={() => toggleSort('status')} />
                  <th>Source</th>
                  <th>Tags</th>
                  <SortHeader label="Créé le" align="right" active={sort === 'created_at'} order={order} onClick={() => toggleSort('created_at')} />
                  <SortHeader
                    label="Dernière activité"
                    align="right"
                    active={sort === 'last_activity_at'}
                    order={order}
                    onClick={() => toggleSort('last_activity_at')}
                  />
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => {
                  const status = statusEntry(lead.status)
                  const source = sourceEntry(lead.source)
                  const name = displayName(lead.first_name, lead.last_name, lead.instagram_handle ?? 'Sans nom')
                  return (
                    <tr
                      key={lead.id}
                      className="ds-row-clickable"
                      onClick={() => navigate(`/leads/${lead.id}`)}
                      onMouseEnter={() => prefetchLead(lead.id)}
                    >
                      <td>
                        <ContactCell
                          name={name}
                          handle={lead.instagram_handle}
                          avatar={<Avatar name={name} size={28} src={lead.instagram_profile_pic_url} />}
                        />
                      </td>
                      <td>
                        <StatusPill label={status.label} color={status.color} bg={status.bg} />
                      </td>
                      <td>
                        <StatusPill label={source.label} color={source.color} bg={source.bg} />
                      </td>
                      <td>
                        {lead.tags.length > 0 ? (
                          <span className="ds-muted">
                            {lead.tags.slice(0, 2).join(', ')}
                            {lead.tags.length > 2 && ` +${lead.tags.length - 2}`}
                          </span>
                        ) : (
                          <span className="ds-muted">—</span>
                        )}
                      </td>
                      <td className="ds-num-cell">
                        <span className="ds-num">{shortDate(lead.created_at)}</span>
                      </td>
                      <td className="ds-num-cell">
                        <span className="ds-num">{shortDate(lead.last_activity_at)}</span>
                      </td>
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
          </>
        )}
      </TableCard>

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
