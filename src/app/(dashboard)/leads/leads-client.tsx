'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, Settings2 } from 'lucide-react'
import LeadSidePanel from '@/components/shared/LeadSidePanel'
import { Lead, LeadStatus, LeadSource, WorkspaceMemberWithUser } from '@/types'
import LeadFilters from '@/components/leads/LeadFilters'
import LeadForm from '@/components/leads/LeadForm'
import ClosingModal from '@/components/leads/ClosingModal'
import ConfirmModal from '@/components/shared/ConfirmModal'
import CallScheduleModal from '@/components/leads/CallScheduleModal'
import DateRangePicker from '@/components/leads/DateRangePicker'
import ViewToggle from '@/components/leads/ViewToggle'
import LeadsListView from './views/LeadsListView'
import LeadsKanbanView from './views/LeadsKanbanView'
import KanbanColumnsConfigModal from './views/KanbanColumnsConfigModal'
import {
  loadView, saveView, loadColumns, saveColumns, loadDateFilter, saveDateFilter,
  type LeadsView, type KanbanColumnsPref, type DateFilterPref,
} from '@/lib/ui-prefs/leads-prefs'

interface Meta { total: number; page: number; per_page: number; total_pages: number }

interface LeadsClientProps {
  initialLeads: Lead[]
  initialTotal: number
}

const DEFAULT_COLUMNS: LeadStatus[] = [
  'nouveau', 'scripte', 'setting_planifie', 'no_show_setting',
  'closing_planifie', 'no_show_closing', 'clos', 'dead',
]

export default function LeadsClient({ initialLeads, initialTotal }: LeadsClientProps) {
  const [view, setView] = useState<LeadsView>('list')
  const [columnsPref, setColumnsPref] = useState<KanbanColumnsPref>({
    visible: [...DEFAULT_COLUMNS],
    order:   [...DEFAULT_COLUMNS],
  })
  const [dateFilter, setDateFilter] = useState<DateFilterPref>({ preset: 'all', field: 'created_at' })
  const [showColumnsModal, setShowColumnsModal] = useState(false)
  const [prefsHydrated, setPrefsHydrated] = useState(false)

  useEffect(() => {
    setView(loadView())
    setColumnsPref(loadColumns())
    setDateFilter(loadDateFilter())
    setPrefsHydrated(true)
  }, [])

  useEffect(() => { if (prefsHydrated) saveView(view) }, [view, prefsHydrated])
  useEffect(() => { if (prefsHydrated) saveColumns(columnsPref) }, [columnsPref, prefsHydrated])
  useEffect(() => { if (prefsHydrated) saveDateFilter(dateFilter) }, [dateFilter, prefsHydrated])

  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [meta, setMeta] = useState<Meta>({
    total: initialTotal, page: 1, per_page: 25,
    total_pages: Math.ceil(initialTotal / 25) || 1,
  })
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [confirm, setConfirm] = useState<{ title: string; message: string; danger?: boolean; onConfirm: () => void } | null>(null)
  const [scheduleTarget, setScheduleTarget] = useState<Lead | null>(null)
  const [closingTarget, setClosingTarget] = useState<Lead | null>(null)
  const [sidePanelLeadId, setSidePanelLeadId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const [members, setMembers] = useState<WorkspaceMemberWithUser[]>([])
  const memberMap = useRef(new Map<string, WorkspaceMemberWithUser>())
  useEffect(() => {
    async function fetchMembers() {
      try {
        const res = await fetch('/api/workspaces/members')
        if (res.ok) {
          const json = await res.json()
          const data: WorkspaceMemberWithUser[] = json.data ?? []
          setMembers(data)
          memberMap.current = new Map(data.map(m => [m.user_id, m]))
        }
      } catch { /* ignore */ }
    }
    fetchMembers()
  }, [])

  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statuses, setStatuses] = useState<LeadStatus[]>([])
  const [sources, setSources] = useState<LeadSource[]>([])
  const [assignedTo, setAssignedTo] = useState<string | undefined>(undefined)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitialMount = useRef(true)

  const handleFiltersChange = useCallback((f: { search: string; statuses: LeadStatus[]; sources: LeadSource[]; assigned_to?: string }) => {
    setStatuses(f.statuses)
    setSources(f.sources)
    setAssignedTo(f.assigned_to)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(f.search), 300)
  }, [])

  useEffect(() => {
    if (view !== 'list') return
    if (isInitialMount.current) { isInitialMount.current = false; return }
    let cancelled = false
    async function doFetch() {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('page', String(page))
        params.set('per_page', '25')
        if (debouncedSearch) params.set('search', debouncedSearch)
        if (statuses.length > 0) params.set('status', statuses.join(','))
        if (sources.length > 0) params.set('source', sources.join(','))
        if (assignedTo) params.set('assigned_to', assignedTo)
        if (dateFilter.from) params.set('date_from', dateFilter.from)
        if (dateFilter.to)   params.set('date_to', dateFilter.to)
        params.set('date_field', dateFilter.field)

        const res = await fetch(`/api/leads?${params.toString()}`)
        const json = await res.json()
        if (!cancelled && res.ok) { setLeads(json.data); setMeta(json.meta) }
      } finally { if (!cancelled) setLoading(false) }
    }
    doFetch()
    return () => { cancelled = true }
  }, [view, page, debouncedSearch, statuses, sources, assignedTo, dateFilter, refreshKey])

  useEffect(() => { setPage(1) }, [debouncedSearch, statuses, sources, assignedTo, dateFilter])

  function patchLead(id: string, patch: Partial<Lead>) {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))
    fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then(r => {
      if (!r.ok && view === 'kanban') setRefreshKey(k => k + 1)
    })
  }

  function onKanbanStatusChange(lead: Lead, newStatus: LeadStatus) {
    patchLead(lead.id, { status: newStatus })
  }

  function callLead(lead: Lead) {
    setConfirm({
      title: 'Enregistrer un appel',
      message: `Confirmer une tentative d'appel pour ${lead.first_name} ${lead.last_name} ? Le compteur passera à ${lead.call_attempts + 1}.`,
      onConfirm: () => {
        setConfirm(null)
        patchLead(lead.id, { call_attempts: lead.call_attempts + 1 })
      },
    })
  }

  function archiveLead(lead: Lead) {
    setConfirm({
      title: 'Archiver ce lead',
      message: `${lead.first_name} ${lead.last_name} sera archivé (statut Dead). Cette action est réversible depuis la fiche lead.`,
      danger: true,
      onConfirm: async () => {
        setConfirm(null)
        await fetch(`/api/leads/${lead.id}`, { method: 'DELETE' })
        setLeads(prev => prev.filter(l => l.id !== lead.id))
        setMeta(prev => ({ ...prev, total: prev.total - 1 }))
        if (view === 'kanban') setRefreshKey(k => k + 1)
      },
    })
  }

  function onLeadCreated(lead: Lead) {
    setLeads(prev => [lead, ...prev])
    setMeta(prev => ({ ...prev, total: prev.total + 1 }))
    if (view === 'kanban') setRefreshKey(k => k + 1)
  }

  const visibleKanbanStatuses = columnsPref.order.filter(s => columnsPref.visible.includes(s))

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Leads</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {view === 'list'
              ? (loading ? '...' : `${meta.total} lead${meta.total > 1 ? 's' : ''} au total`)
              : 'Vue kanban'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {view === 'kanban' && (
            <button onClick={() => setShowColumnsModal(true)} title="Configurer les colonnes" style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
              color: 'var(--text-tertiary)', cursor: 'pointer',
            }}>
              <Settings2 size={14} /> Colonnes
            </button>
          )}
          <ViewToggle value={view} onChange={setView} />
          <button onClick={() => setShowForm(true)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: 'var(--color-primary)', border: 'none', color: '#000', cursor: 'pointer',
          }}>
            <Plus size={15} /> Ajouter un lead
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <DateRangePicker value={dateFilter} onChange={setDateFilter} />
        <LeadFilters onFiltersChange={handleFiltersChange} />
      </div>

      {view === 'list' ? (
        <LeadsListView
          leads={leads}
          loading={loading}
          members={members}
          page={meta.page}
          totalPages={meta.total_pages}
          total={meta.total}
          onPageChange={setPage}
          onLeadClick={(id) => setSidePanelLeadId(id)}
          onPatch={(id, patch) => patchLead(id, patch)}
          onCall={callLead}
          onSchedule={setScheduleTarget}
          onArchive={archiveLead}
          onRequestClose={setClosingTarget}
        />
      ) : (
        <LeadsKanbanView
          visibleStatuses={visibleKanbanStatuses}
          search={debouncedSearch}
          sources={sources}
          assignedTo={assignedTo}
          dateFilter={dateFilter}
          refreshKey={refreshKey}
          memberMap={memberMap.current}
          onCardClick={(id) => setSidePanelLeadId(id)}
          onStatusChange={onKanbanStatusChange}
          onRequestClose={setClosingTarget}
        />
      )}

      {showForm && <LeadForm onClose={() => setShowForm(false)} onCreated={onLeadCreated} />}
      {scheduleTarget && (
        <CallScheduleModal
          lead={scheduleTarget}
          onClose={() => setScheduleTarget(null)}
          onScheduled={() => { setScheduleTarget(null); setRefreshKey(k => k + 1) }}
        />
      )}
      {confirm && (
        <ConfirmModal
          title={confirm.title} message={confirm.message}
          confirmLabel={confirm.danger ? 'Archiver' : 'Confirmer'}
          confirmDanger={confirm.danger}
          onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)}
        />
      )}
      {closingTarget && (
        <ClosingModal
          leadName={`${closingTarget.first_name} ${closingTarget.last_name}`}
          onClose={() => { setClosingTarget(null); if (view === 'kanban') setRefreshKey(k => k + 1) }}
          onConfirm={(data) => {
            patchLead(closingTarget.id, {
              status: 'clos',
              deal_amount: data.deal_amount,
              deal_installments: data.deal_installments,
              cash_collected: data.cash_collected,
              closed_at: new Date().toISOString(),
            } as Partial<Lead>)
            setClosingTarget(null)
            if (view === 'kanban') setRefreshKey(k => k + 1)
          }}
        />
      )}
      {sidePanelLeadId && (
        <LeadSidePanel leadId={sidePanelLeadId} onClose={() => setSidePanelLeadId(null)} />
      )}
      {showColumnsModal && (
        <KanbanColumnsConfigModal
          value={columnsPref}
          onClose={() => setShowColumnsModal(false)}
          onSave={setColumnsPref}
        />
      )}
    </div>
  )
}
