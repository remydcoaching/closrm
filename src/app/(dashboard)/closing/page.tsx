'use client'

import { useState, useCallback, useEffect } from 'react'
import { List, CalendarDays } from 'lucide-react'
import { Call, Lead, CallType } from '@/types' // eslint-disable-line @typescript-eslint/no-unused-vars
import CallFilters from '@/components/closing/CallFilters'
import CallTable from '@/components/closing/CallTable'
import CallCalendar from '@/components/closing/CallCalendar'
import CallOutcomeModal from '@/components/closing/CallOutcomeModal'
import CallScheduleModal from '@/components/leads/CallScheduleModal'
import ConfirmModal from '@/components/shared/ConfirmModal'
import LeadSidePanel from '@/components/shared/LeadSidePanel'

type CallWithLead = Call & { lead: Pick<Lead, 'id' | 'first_name' | 'last_name' | 'phone' | 'email' | 'status'> }
type Tab = 'today' | 'upcoming' | 'overdue' | 'done' | 'cancelled'

const TAB_CONFIG: Record<Tab, { label: string; color: string }> = {
  today: { label: "Aujourd'hui", color: '#00C853' },
  upcoming: { label: 'À venir', color: '#3b82f6' },
  overdue: { label: 'À actualiser', color: '#ef4444' },
  done: { label: 'Traités', color: '#888' },
  cancelled: { label: 'Annulés / Absents', color: '#f97316' },
}

export default function ClosingPage() {
  const [calls, setCalls] = useState<CallWithLead[]>([])
  const [meta, setMeta] = useState({ total: 0, page: 1, per_page: 25, total_pages: 0 })
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('today')
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [filters, setFilters] = useState({ search: '', type: null as CallType | null, dateStart: '', dateEnd: '' })
  const [page, setPage] = useState(1)
  const [counts, setCounts] = useState({ today: 0, upcoming: 0, overdue: 0, done: 0, cancelled: 0 })
  const [outcomeTarget, setOutcomeTarget] = useState<CallWithLead | null>(null)
  const [rescheduleTarget, setRescheduleTarget] = useState<CallWithLead | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CallWithLead | null>(null)
  const [sidePanelLeadId, setSidePanelLeadId] = useState<string | null>(null)

  const buildParams = useCallback((t: Tab, p: number) => {
    const params = new URLSearchParams()
    params.set('page', String(p))
    params.set('per_page', '25')
    params.set('sort', 'scheduled_at')
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999)
    if (t === 'today') { params.set('outcome', 'pending'); params.set('scheduled_after', todayStart.toISOString()); params.set('scheduled_before', todayEnd.toISOString()); params.set('order', 'asc') }
    else if (t === 'upcoming') { params.set('outcome', 'pending'); params.set('scheduled_after', todayEnd.toISOString()); params.set('order', 'asc') }
    else if (t === 'overdue') { params.set('outcome', 'pending'); params.set('scheduled_before', todayStart.toISOString()); params.set('order', 'desc') }
    else if (t === 'done') { params.set('outcome', 'done'); params.set('order', 'desc') }
    else { params.set('outcome', 'cancelled,no_show'); params.set('order', 'desc') }
    if (filters.type) params.set('type', filters.type)
    if (filters.search) params.set('search', filters.search)
    return params
  }, [filters])

  const fetchCalls = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/calls?${buildParams(tab, page).toString()}`)
    if (res.ok) { const j = await res.json(); setCalls(j.data); setMeta(j.meta) }
    setLoading(false)
  }, [tab, page, buildParams])

  const fetchCounts = useCallback(async () => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999)
    const qs: [Tab, string][] = [
      ['today', `outcome=pending&scheduled_after=${todayStart.toISOString()}&scheduled_before=${todayEnd.toISOString()}&per_page=1`],
      ['upcoming', `outcome=pending&scheduled_after=${todayEnd.toISOString()}&per_page=1`],
      ['overdue', `outcome=pending&scheduled_before=${todayStart.toISOString()}&per_page=1`],
      ['done', `outcome=done&per_page=1`],
      ['cancelled', `outcome=cancelled,no_show&per_page=1`],
    ]
    const r = await Promise.all(qs.map(async ([, q]) => { const res = await fetch(`/api/calls?${q}`); if (res.ok) { const j = await res.json(); return j.meta.total }; return 0 }))
    setCounts({ today: r[0], upcoming: r[1], overdue: r[2], done: r[3], cancelled: r[4] })
  }, [])

  useEffect(() => { fetchCalls(); fetchCounts() }, [fetchCalls, fetchCounts])
  useEffect(() => { setPage(1) }, [tab, filters])

  async function handleDelete() {
    if (!deleteTarget) return
    await fetch(`/api/calls/${deleteTarget.id}`, { method: 'DELETE' })
    setDeleteTarget(null); fetchCalls(); fetchCounts()
  }

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>Closing</h1>
          <p style={{ fontSize: 13, color: '#666', marginTop: 4 }}>Gestion de vos appels de setting et closing</p>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['list', 'calendar'] as const).map((m) => {
            const active = view === m
            const Icon = m === 'list' ? List : CalendarDays
            return (
              <button key={m} onClick={() => setView(m)} style={{
                width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                border: active ? '1px solid rgba(0,200,83,0.3)' : '1px solid rgba(255,255,255,0.06)',
                background: active ? 'rgba(0,200,83,0.08)' : 'transparent',
              }}>
                <Icon size={16} color={active ? '#00C853' : '#888'} />
              </button>
            )
          })}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {(Object.keys(TAB_CONFIG) as Tab[]).map((t) => {
          const active = tab === t; const c = TAB_CONFIG[t]; const count = counts[t]
          return (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '10px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none',
              borderBottom: active ? `2px solid ${c.color}` : '2px solid transparent',
              background: active ? 'rgba(255,255,255,0.02)' : 'transparent', color: active ? '#fff' : '#888',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {c.label}
              {count > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: t === 'overdue' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)', color: t === 'overdue' ? '#ef4444' : '#888' }}>{count}</span>}
            </button>
          )
        })}
      </div>

      <div style={{ marginBottom: 20 }}><CallFilters onFiltersChange={setFilters} /></div>

      <div style={{ background: '#0f0f11', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, overflow: 'hidden' }}>
        {view === 'list' ? (
          <CallTable calls={calls} loading={loading} onOutcome={setOutcomeTarget} onReschedule={setRescheduleTarget} onDelete={setDeleteTarget} onLeadClick={setSidePanelLeadId} />
        ) : (
          <div style={{ padding: 16 }}><CallCalendar calls={calls} loading={loading} onCallClick={setOutcomeTarget} /></div>
        )}
      </div>

      {view === 'list' && meta.total_pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 16 }}>
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'transparent', color: page <= 1 ? '#444' : '#ccc', cursor: page <= 1 ? 'default' : 'pointer', fontSize: 12 }}>Précédent</button>
          <span style={{ fontSize: 12, color: '#888' }}>Page {meta.page} sur {meta.total_pages}</span>
          <button onClick={() => setPage(Math.min(meta.total_pages, page + 1))} disabled={page >= meta.total_pages} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'transparent', color: page >= meta.total_pages ? '#444' : '#ccc', cursor: page >= meta.total_pages ? 'default' : 'pointer', fontSize: 12 }}>Suivant</button>
        </div>
      )}

      {outcomeTarget && <CallOutcomeModal call={outcomeTarget} onClose={() => setOutcomeTarget(null)} onUpdated={() => { fetchCalls(); fetchCounts() }} />}
      {rescheduleTarget && <CallScheduleModal lead={rescheduleTarget.lead} onClose={() => setRescheduleTarget(null)} onScheduled={() => { fetch(`/api/calls/${rescheduleTarget.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ outcome: 'cancelled' }) }); setRescheduleTarget(null); fetchCalls(); fetchCounts() }} />}
      {deleteTarget && <ConfirmModal title="Supprimer l'appel" message={`Supprimer l'appel avec ${deleteTarget.lead.first_name} ${deleteTarget.lead.last_name} ?`} confirmLabel="Supprimer" confirmDanger onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />}
      {sidePanelLeadId && <LeadSidePanel leadId={sidePanelLeadId} onClose={() => setSidePanelLeadId(null)} />}
    </div>
  )
}
