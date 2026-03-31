'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import DatabaseFilters from '@/components/database/DatabaseFilters'
import DatabaseTable from '@/components/database/DatabaseTable'
import ExportModal from '@/components/database/ExportModal'
import LeadSidePanel from '@/components/shared/LeadSidePanel'
import { ContactRow, ContactFilters } from '@/types'

interface Meta {
  total: number
  page: number
  per_page: number
  total_pages: number
}

const DEFAULT_FILTERS: ContactFilters = {
  search: '',
  statuses: [],
  sources: [],
  tags: [],
  date_from: '',
  date_to: '',
  reached: 'all',
  group_by: '',
}

export default function BaseDeDonneesPage() {
  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, per_page: 25, total_pages: 1 })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<ContactFilters>(DEFAULT_FILTERS)
  const [showExport, setShowExport] = useState(false)
  const [sidePanelLeadId, setSidePanelLeadId] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const fetchContacts = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('per_page', '25')
      if (filters.search) params.set('search', filters.search)
      if (filters.statuses.length > 0) params.set('status', filters.statuses.join(','))
      if (filters.sources.length > 0) params.set('source', filters.sources.join(','))
      if (filters.tags.length > 0) params.set('tags', filters.tags.join(','))
      if (filters.date_from) params.set('date_from', filters.date_from)
      if (filters.date_to) params.set('date_to', filters.date_to)
      if (filters.reached !== 'all') params.set('reached', filters.reached)
      if (filters.group_by) params.set('group_by', filters.group_by)

      const res = await fetch(`/api/contacts?${params.toString()}`)
      const json = await res.json()
      if (res.ok) {
        setContacts(json.data)
        setMeta(json.meta)
      } else {
        setFetchError(json.error ?? 'Erreur lors du chargement des contacts')
      }
    } catch {
      setFetchError('Impossible de contacter le serveur')
    } finally {
      setLoading(false)
    }
  }, [page, filters])

  useEffect(() => { fetchContacts() }, [fetchContacts])
  useEffect(() => { setPage(1) }, [filters])

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Base de données</h1>
          <p style={{ fontSize: 13, color: 'var(--text-label)', marginTop: 4 }}>
            {loading ? '...' : `${meta.total} contact${meta.total > 1 ? 's' : ''} au total`}
          </p>
        </div>
        <button
          onClick={() => setShowExport(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: 'rgba(0,200,83,0.12)', border: '1px solid rgba(0,200,83,0.3)',
            color: 'var(--color-primary)', cursor: 'pointer',
          }}
        >
          <Download size={14} />
          Export CSV
        </button>
      </div>

      {/* Filtres */}
      <div style={{ marginBottom: 16 }}>
        <DatabaseFilters onFiltersChange={setFilters} />
      </div>

      {/* Erreur */}
      {fetchError && (
        <div style={{
          marginBottom: 16, padding: '10px 14px', borderRadius: 8,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          color: '#ef4444', fontSize: 12,
        }}>
          {fetchError}
        </div>
      )}

      {/* Tableau */}
      <DatabaseTable
        contacts={contacts}
        loading={loading}
        groupBy={filters.group_by}
        onViewContact={setSidePanelLeadId}
      />

      {/* Pagination */}
      {meta.total_pages > 1 && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginTop: 12,
        }}>
          <span style={{ fontSize: 12, color: 'var(--text-label)' }}>
            Page {meta.page} sur {meta.total_pages} — {meta.total} résultats
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              style={{
                padding: '5px 10px', borderRadius: 6, fontSize: 12,
                background: 'var(--bg-hover)', border: '1px solid var(--border-primary)',
                color: page <= 1 ? '#333' : 'var(--text-tertiary)', cursor: page <= 1 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <ChevronLeft size={13} /> Préc.
            </button>
            <button
              disabled={page >= meta.total_pages}
              onClick={() => setPage(p => p + 1)}
              style={{
                padding: '5px 10px', borderRadius: 6, fontSize: 12,
                background: 'var(--bg-hover)', border: '1px solid var(--border-primary)',
                color: page >= meta.total_pages ? '#333' : 'var(--text-tertiary)',
                cursor: page >= meta.total_pages ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              Suiv. <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Modale export */}
      {showExport && (
        <ExportModal
          filters={filters}
          total={meta.total}
          onClose={() => setShowExport(false)}
        />
      )}

      {/* Panneau latéral lead */}
      {sidePanelLeadId && (
        <LeadSidePanel
          leadId={sidePanelLeadId}
          onClose={() => setSidePanelLeadId(null)}
        />
      )}
    </div>
  )
}
