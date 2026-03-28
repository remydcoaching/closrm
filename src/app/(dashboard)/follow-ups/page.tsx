'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Plus, Search, CheckCircle, XCircle, ExternalLink, Trash2, Clock } from 'lucide-react'
import { FollowUp, Lead, FollowUpStatus, FollowUpChannel } from '@/types'
import FollowUpStatusBadge, { FU_STATUS_CONFIG } from '@/components/follow-ups/FollowUpStatusBadge'
import ChannelBadge from '@/components/follow-ups/ChannelBadge'
import AddFollowUpModal from '@/components/follow-ups/AddFollowUpModal'
import ConfirmModal from '@/components/shared/ConfirmModal'

type FUWithLead = FollowUp & { lead: Pick<Lead, 'id' | 'first_name' | 'last_name' | 'phone' | 'email' | 'status'> }
type Tab = 'pending' | 'overdue' | 'done' | 'all'

const TAB_CONFIG: Record<Tab, { label: string; color: string }> = {
  pending: { label: 'En attente', color: '#f59e0b' },
  overdue: { label: 'En retard', color: '#ef4444' },
  done: { label: 'Terminés', color: '#00C853' },
  all: { label: 'Tous', color: '#888' },
}

const th: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', fontSize: 10, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.15em', borderBottom: '1px solid rgba(255,255,255,0.06)' }
const td: React.CSSProperties = { padding: '12px', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' }

export default function FollowUpsPage() {
  const [followUps, setFollowUps] = useState<FUWithLead[]>([])
  const [meta, setMeta] = useState({ total: 0, page: 1, per_page: 25, total_pages: 0 })
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('pending')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [counts, setCounts] = useState({ pending: 0, overdue: 0, done: 0, all: 0 })
  const [showAdd, setShowAdd] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<FUWithLead | null>(null)

  const fetchFU = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('per_page', '25')
    params.set('sort', 'scheduled_at')

    const now = new Date().toISOString()
    if (tab === 'pending') { params.set('status', 'en_attente'); params.set('scheduled_after', now); params.set('order', 'asc') }
    else if (tab === 'overdue') { params.set('status', 'en_attente'); params.set('scheduled_before', now); params.set('order', 'desc') }
    else if (tab === 'done') { params.set('status', 'fait,annule'); params.set('order', 'desc') }
    else { params.set('order', 'desc') }

    if (search) params.set('search', search)

    const res = await fetch(`/api/follow-ups?${params.toString()}`)
    if (res.ok) { const j = await res.json(); setFollowUps(j.data); setMeta(j.meta) }
    setLoading(false)
  }, [tab, page, search])

  const fetchCounts = useCallback(async () => {
    const now = new Date().toISOString()
    const qs: [Tab, string][] = [
      ['pending', `status=en_attente&scheduled_after=${now}&per_page=1`],
      ['overdue', `status=en_attente&scheduled_before=${now}&per_page=1`],
      ['done', `status=fait,annule&per_page=1`],
      ['all', `per_page=1`],
    ]
    const r = await Promise.all(qs.map(async ([, q]) => { const res = await fetch(`/api/follow-ups?${q}`); if (res.ok) { const j = await res.json(); return j.meta.total }; return 0 }))
    setCounts({ pending: r[0], overdue: r[1], done: r[2], all: r[3] })
  }, [])

  useEffect(() => { fetchFU(); fetchCounts() }, [fetchFU, fetchCounts])
  useEffect(() => { setPage(1) }, [tab, search])

  async function markStatus(fu: FUWithLead, status: FollowUpStatus) {
    await fetch(`/api/follow-ups/${fu.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    fetchFU(); fetchCounts()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await fetch(`/api/follow-ups/${deleteTarget.id}`, { method: 'DELETE' })
    setDeleteTarget(null); fetchFU(); fetchCounts()
  }

  const now = new Date()

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>Follow-ups</h1>
          <p style={{ fontSize: 13, color: '#666', marginTop: 4 }}>Gestion de vos relances</p>
        </div>
        <button onClick={() => setShowAdd(true)} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10,
          background: '#00C853', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          <Plus size={15} />Créer un follow-up
        </button>
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

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 300, marginBottom: 20 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#555' }} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un lead..."
          style={{ width: '100%', background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '8px 12px 8px 34px', color: '#fff', fontSize: 12, outline: 'none' }} />
      </div>

      {/* Table */}
      <div style={{ background: '#0f0f11', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#555' }}>Chargement...</div>
        ) : followUps.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#555', fontSize: 13 }}>Aucun follow-up dans cette catégorie</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Date prévue</th>
                  <th style={th}>Lead</th>
                  <th style={th}>Raison</th>
                  <th style={th}>Canal</th>
                  <th style={th}>Statut</th>
                  <th style={{ ...th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {followUps.map((fu) => {
                  const scheduled = new Date(fu.scheduled_at)
                  const overdue = fu.status === 'en_attente' && scheduled < now
                  return (
                    <tr key={fu.id} onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                      <td style={td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {overdue && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />}
                          <div>
                            <div style={{ color: overdue ? '#ef4444' : '#fff', fontWeight: 500 }}>{format(scheduled, 'dd MMM yyyy', { locale: fr })}</div>
                            <div style={{ color: '#666', fontSize: 11, marginTop: 2 }}>{format(scheduled, "HH'h'mm", { locale: fr })}</div>
                          </div>
                        </div>
                      </td>
                      <td style={td}>
                        <Link href={`/leads/${fu.lead.id}`} style={{ color: '#fff', fontWeight: 500, textDecoration: 'none' }}>{fu.lead.first_name} {fu.lead.last_name}</Link>
                        <div style={{ color: '#666', fontSize: 11, marginTop: 2 }}>{fu.lead.phone || fu.lead.email || '—'}</div>
                      </td>
                      <td style={{ ...td, color: '#ccc', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fu.reason}</td>
                      <td style={td}><ChannelBadge channel={fu.channel} /></td>
                      <td style={td}><FollowUpStatusBadge status={fu.status} /></td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {fu.status === 'en_attente' && (
                            <>
                              <button onClick={() => markStatus(fu, 'fait')} title="Marquer fait" style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <CheckCircle size={14} color="#00C853" />
                              </button>
                              <button onClick={() => markStatus(fu, 'annule')} title="Annuler" style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <XCircle size={14} color="#f59e0b" />
                              </button>
                            </>
                          )}
                          <Link href={`/leads/${fu.lead.id}`} title="Voir fiche" style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ExternalLink size={14} color="#888" />
                          </Link>
                          <button onClick={() => setDeleteTarget(fu)} title="Supprimer" style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Trash2 size={14} color="#ef4444" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {meta.total_pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 16 }}>
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'transparent', color: page <= 1 ? '#444' : '#ccc', cursor: page <= 1 ? 'default' : 'pointer', fontSize: 12 }}>Précédent</button>
          <span style={{ fontSize: 12, color: '#888' }}>Page {meta.page} sur {meta.total_pages}</span>
          <button onClick={() => setPage(Math.min(meta.total_pages, page + 1))} disabled={page >= meta.total_pages} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'transparent', color: page >= meta.total_pages ? '#444' : '#ccc', cursor: page >= meta.total_pages ? 'default' : 'pointer', fontSize: 12 }}>Suivant</button>
        </div>
      )}

      {/* Modals */}
      {showAdd && <AddFollowUpModal onClose={() => setShowAdd(false)} onCreated={() => { fetchFU(); fetchCounts() }} />}
      {deleteTarget && <ConfirmModal title="Supprimer le follow-up" message={`Supprimer le follow-up pour ${deleteTarget.lead.first_name} ${deleteTarget.lead.last_name} ?`} confirmLabel="Supprimer" confirmDanger onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />}
    </div>
  )
}
