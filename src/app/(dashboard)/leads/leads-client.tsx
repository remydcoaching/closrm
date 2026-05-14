'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Settings2, Search, Upload, Download, Clock } from 'lucide-react'
import { Lead, LeadStatus, LeadSource, WorkspaceMemberWithUser } from '@/types'
import LeadFilters from '@/components/leads/LeadFilters'
import DateRangePicker from '@/components/leads/DateRangePicker'
import ViewToggle from '@/components/leads/ViewToggle'
import LeadsListView from './views/LeadsListView'

// Modales et vues lourdes : lazy-load pour réduire le bundle initial.
// Chacune ne charge son code qu'au moment où elle s'affiche.
const LeadSidePanel = dynamic(() => import('@/components/shared/LeadSidePanel'), { ssr: false })
const LeadForm = dynamic(() => import('@/components/leads/LeadForm'), { ssr: false })
const ClosingModal = dynamic(() => import('@/components/leads/ClosingModal'), { ssr: false })
const ConfirmModal = dynamic(() => import('@/components/shared/ConfirmModal'), { ssr: false })
const CallScheduleModal = dynamic(() => import('@/components/leads/CallScheduleModal'), { ssr: false })
const LeadActionModal = dynamic(() => import('@/components/leads/LeadActionModal'), { ssr: false })
const LeadsKanbanView = dynamic(() => import('./views/LeadsKanbanView'), { ssr: false })
const KanbanColumnsConfigModal = dynamic(() => import('./views/KanbanColumnsConfigModal'), { ssr: false })

import type { LeadAction } from '@/components/leads/LeadActionModal'
import {
  loadView, saveView, loadDateFilter, saveDateFilter,
  type LeadsView, type DateFilterPref,
} from '@/lib/ui-prefs/leads-prefs'
import { useStatusConfig, useWorkspaceConfig } from '@/lib/workspace/config-context'

interface Meta { total: number; page: number; per_page: number; total_pages: number }

interface LeadsClientProps {
  initialLeads: Lead[]
  initialTotal: number
}

export default function LeadsClient({ initialLeads, initialTotal }: LeadsClientProps) {
  const router = useRouter()
  const urlParams = useSearchParams()
  const metaAdId = urlParams?.get('meta_ad_id') ?? undefined
  const metaAdsetId = urlParams?.get('meta_adset_id') ?? undefined
  const metaCampaignId = urlParams?.get('meta_campaign_id') ?? undefined
  const metaFilter = useMemo(
    () => ({ ad_id: metaAdId, adset_id: metaAdsetId, campaign_id: metaCampaignId }),
    [metaAdId, metaAdsetId, metaCampaignId],
  )
  const statusConfig = useStatusConfig()
  const { updateStatusConfig } = useWorkspaceConfig()
  const [view, setView] = useState<LeadsView>('list')
  const [dateFilter, setDateFilter] = useState<DateFilterPref>({ preset: 'all', field: 'created_at' })
  const [showColumnsModal, setShowColumnsModal] = useState(false)
  const [prefsHydrated, setPrefsHydrated] = useState(false)

  useEffect(() => {
    setView(loadView())
    setDateFilter(loadDateFilter())
    setPrefsHydrated(true)
  }, [])

  useEffect(() => { if (prefsHydrated) saveView(view) }, [view, prefsHydrated])
  useEffect(() => { if (prefsHydrated) saveDateFilter(dateFilter) }, [dateFilter, prefsHydrated])

  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [meta, setMeta] = useState<Meta>({
    total: initialTotal, page: 1, per_page: 25,
    total_pages: Math.ceil(initialTotal / 25) || 1,
  })
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [showActionsMenu, setShowActionsMenu] = useState(false)
  const actionsMenuRef = useRef<HTMLDivElement>(null)
  const [confirm, setConfirm] = useState<{ title: string; message: string; danger?: boolean; onConfirm: () => void } | null>(null)
  const [scheduleTarget, setScheduleTarget] = useState<Lead | null>(null)
  const [treatTarget, setTreatTarget] = useState<Lead | null>(null)
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

  // Fermer le menu actions au clic en dehors
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
        setShowActionsMenu(false)
      }
    }
    if (showActionsMenu) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showActionsMenu])

  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statuses, setStatuses] = useState<LeadStatus[]>([])
  const [sources, setSources] = useState<LeadSource[]>([])
  const [assignedTo, setAssignedTo] = useState<string | undefined>(undefined)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitialMount = useRef(true)

  // Debounce recherche
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(searchInput), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchInput])

  const handleFiltersChange = useCallback((f: { search: string; statuses: LeadStatus[]; sources: LeadSource[]; assigned_to?: string }) => {
    setStatuses(f.statuses)
    setSources(f.sources)
    setAssignedTo(f.assigned_to)
  }, [])

  useEffect(() => {
    if (view !== 'list') return
    const hasUrlFilter = !!(metaFilter.ad_id || metaFilter.adset_id || metaFilter.campaign_id)
    if (isInitialMount.current && !hasUrlFilter) { isInitialMount.current = false; return }
    if (isInitialMount.current) isInitialMount.current = false
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
        if (metaFilter.ad_id) params.set('meta_ad_id', metaFilter.ad_id)
        if (metaFilter.adset_id) params.set('meta_adset_id', metaFilter.adset_id)
        if (metaFilter.campaign_id) params.set('meta_campaign_id', metaFilter.campaign_id)

        const res = await fetch(`/api/leads?${params.toString()}`)
        const json = await res.json()
        if (!cancelled && res.ok) { setLeads(json.data); setMeta(json.meta) }
      } finally { if (!cancelled) setLoading(false) }
    }
    doFetch()
    return () => { cancelled = true }
  }, [view, page, debouncedSearch, statuses, sources, assignedTo, dateFilter, metaFilter, refreshKey])

  useEffect(() => { setPage(1) }, [debouncedSearch, statuses, sources, assignedTo, dateFilter, metaFilter])

  // Refs pour permettre des callbacks stables (useCallback sans dep) qui
  // accèdent à la dernière valeur de view sans casser le memo de LeadsListView.
  const viewRef = useRef(view)
  useEffect(() => { viewRef.current = view }, [view])

  const patchLead = useCallback((id: string, patch: Partial<Lead>) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))
    fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then(r => {
      if (!r.ok && viewRef.current === 'kanban') setRefreshKey(k => k + 1)
    })
  }, [])

  const onKanbanStatusChange = useCallback((lead: Lead, newStatus: LeadStatus) => {
    patchLead(lead.id, { status: newStatus })
  }, [patchLead])

  const callLead = useCallback((lead: Lead) => {
    setConfirm({
      title: 'Enregistrer un appel',
      message: `Confirmer une tentative d'appel pour ${lead.first_name} ${lead.last_name} ? Le compteur passera à ${lead.call_attempts + 1}.`,
      onConfirm: () => {
        setConfirm(null)
        patchLead(lead.id, { call_attempts: lead.call_attempts + 1 })
      },
    })
  }, [patchLead])

  const archiveLead = useCallback((lead: Lead) => {
    setConfirm({
      title: 'Archiver ce lead',
      message: `${lead.first_name} ${lead.last_name} sera archivé (statut Dead). Cette action est réversible depuis la fiche lead.`,
      danger: true,
      onConfirm: async () => {
        setConfirm(null)
        await fetch(`/api/leads/${lead.id}`, { method: 'DELETE' })
        setLeads(prev => prev.filter(l => l.id !== lead.id))
        setMeta(prev => ({ ...prev, total: prev.total - 1 }))
        if (viewRef.current === 'kanban') setRefreshKey(k => k + 1)
      },
    })
  }, [])

  const onLeadClick = useCallback((id: string) => setSidePanelLeadId(id), [])
  const onTreat = useCallback((lead: Lead) => setTreatTarget(lead), [])
  const onRequestClose = useCallback((lead: Lead) => setClosingTarget(lead), [])

  async function handleLeadAction(lead: Lead, action: LeadAction) {
    if (action.type === 'schedule_call') {
      setScheduleTarget(lead)
    } else if (action.type === 'follow_up') {
      await fetch('/api/follow-ups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: lead.id, reason: action.reason, scheduled_at: action.date, channel: action.channel }),
      })
      // pas de refresh liste : la relance est créée, le lead lui-même n'a pas changé
    } else if (action.type === 'won') {
      await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id,
          amount: action.amount,
          cash_collected: action.cash_collected,
          installments: action.installments,
          duration_months: action.duration_months,
          closer_id: action.closer_id,
          setter_id: action.setter_id,
        }),
      })
      setRefreshKey(k => k + 1)
    } else if (action.type === 'dead') {
      patchLead(lead.id, { status: 'dead' })
    }
  }

  function onLeadCreated(lead: Lead) {
    setLeads(prev => [lead, ...prev])
    setMeta(prev => ({ ...prev, total: prev.total + 1 }))
    if (view === 'kanban') setRefreshKey(k => k + 1)
  }

  const visibleKanbanStatuses = statusConfig.filter((e) => e.visible).map((e) => e.key)

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
          <div ref={actionsMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowActionsMenu((v) => !v)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 38, height: 38, borderRadius: 8,
                background: 'var(--color-primary)', border: 'none', color: '#000', cursor: 'pointer',
              }}
            >
              <Plus size={18} strokeWidth={2.5} />
            </button>
            {showActionsMenu && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 6,
                width: 240, borderRadius: 10, overflow: 'hidden',
                background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
                boxShadow: 'var(--shadow-dropdown)', zIndex: 50,
              }}>
                {[
                  { icon: <Plus size={15} />, label: 'Ajouter un lead', onClick: () => { setShowForm(true); setShowActionsMenu(false) } },
                  { icon: <Upload size={15} />, label: 'Importer des leads', onClick: () => { router.push('/leads/import'); setShowActionsMenu(false) } },
                  { icon: <Download size={15} />, label: 'Exporter des leads', onClick: () => { router.push('/base-de-donnees'); setShowActionsMenu(false) } },
                  { icon: <Clock size={15} />, label: 'Historique des imports', onClick: () => { router.push('/leads/import/history'); setShowActionsMenu(false) } },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={item.onClick}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      padding: '11px 14px', fontSize: 13, color: 'var(--text-primary)',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      textAlign: 'left', transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <span style={{ color: 'var(--text-secondary)', display: 'flex' }}>{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        {/* Gauche : recherche */}
        <div style={{ position: 'relative', width: 280 }}>
          <Search size={14} style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)', pointerEvents: 'none',
          }} />
          <input
            type="text"
            placeholder="Rechercher un lead..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '7px 10px 7px 32px',
              background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
              borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none',
            }}
          />
        </div>

        {/* Milieu : dates */}
        <DateRangePicker value={dateFilter} onChange={setDateFilter} />

        {/* Droite : filtres */}
        <div style={{ marginLeft: 'auto' }}>
          <LeadFilters onFiltersChange={handleFiltersChange} showSearch={false} />
        </div>
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
          onLeadClick={onLeadClick}
          onPatch={patchLead}
          onCall={callLead}
          onTreat={onTreat}
          onArchive={archiveLead}
          onRequestClose={onRequestClose}
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

      {treatTarget && (
        <LeadActionModal
          lead={treatTarget}
          onClose={() => setTreatTarget(null)}
          onAction={(action) => handleLeadAction(treatTarget, action)}
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
          config={statusConfig}
          onClose={() => setShowColumnsModal(false)}
          onSave={(next) => { updateStatusConfig(next) }}
        />
      )}
    </div>
  )
}
