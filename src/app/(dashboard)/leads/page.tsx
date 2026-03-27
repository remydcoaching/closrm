'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Plus, ChevronLeft, ChevronRight, ExternalLink, Archive, Phone, ChevronDown, X, Calendar } from 'lucide-react'
import { Lead, LeadStatus, LeadSource } from '@/types'
import StatusBadge, { STATUS_CONFIG } from '@/components/leads/StatusBadge'
import SourceBadge from '@/components/leads/SourceBadge'
import LeadFilters from '@/components/leads/LeadFilters'
import LeadForm from '@/components/leads/LeadForm'
import ConfirmModal from '@/components/shared/ConfirmModal'
import CallScheduleModal from '@/components/leads/CallScheduleModal'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const card: React.CSSProperties = {
  background: '#0f0f11',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 14,
}

interface Meta {
  total: number
  page: number
  per_page: number
  total_pages: number
}

interface DropdownState {
  id: string
  type: 'attempts' | 'status' | 'tags'
  top: number
  left: number
}

const ATTEMPTS_OPTIONS = [
  { value: 0, label: "Pas d'appel" },
  { value: 1, label: '1er Appel' },
  { value: 2, label: '2ème Appel' },
  { value: 3, label: '3ème Appel' },
  { value: 4, label: '4ème Appel' },
  { value: 5, label: '5ème Appel' },
]

function attemptsLabel(n: number) {
  if (n === 0) return "Pas d'appel"
  if (n === 1) return '1er Appel'
  return `${n}ème Appel`
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, per_page: 25, total_pages: 1 })
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filters, setFilters] = useState<{ search: string; statuses: LeadStatus[]; sources: LeadSource[] }>({
    search: '', statuses: [], sources: [],
  })
  const [page, setPage] = useState(1)
  const [dropdown, setDropdown] = useState<DropdownState | null>(null)
  const [tagInput, setTagInput] = useState('')
  const [confirm, setConfirm] = useState<{ title: string; message: string; danger?: boolean; onConfirm: () => void } | null>(null)
  const [scheduleTarget, setScheduleTarget] = useState<Lead | null>(null)
  const dropdownPanelRef = useRef<HTMLDivElement>(null)
  const tagInputRef = useRef<HTMLInputElement>(null)

  // Fermer le dropdown si clic en dehors
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownPanelRef.current && !dropdownPanelRef.current.contains(e.target as Node)) {
        setDropdown(null)
      }
    }
    if (dropdown) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [dropdown])

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('per_page', '25')
      if (filters.search) params.set('search', filters.search)
      if (filters.statuses.length > 0) params.set('status', filters.statuses.join(','))
      if (filters.sources.length > 0) params.set('source', filters.sources.join(','))

      const res = await fetch(`/api/leads?${params.toString()}`)
      const json = await res.json()
      if (res.ok) {
        setLeads(json.data)
        setMeta(json.meta)
      }
    } finally {
      setLoading(false)
    }
  }, [page, filters])

  useEffect(() => { fetchLeads() }, [fetchLeads])
  useEffect(() => { setPage(1) }, [filters])

  function patchLead(id: string, patch: Partial<Lead>) {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))
    fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
  }

  function toggleReached(lead: Lead) {
    patchLead(lead.id, { reached: !lead.reached })
  }

  function openDropdown(e: React.MouseEvent<HTMLButtonElement>, id: string, type: 'attempts' | 'status' | 'tags') {
    // Si déjà ouvert sur ce bouton, fermer
    if (dropdown?.id === id && dropdown?.type === type) {
      setDropdown(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    setDropdown({ id, type, top: rect.bottom + 4, left: rect.left })
    setTagInput('')
    if (type === 'tags') {
      setTimeout(() => tagInputRef.current?.focus(), 50)
    }
  }

  function setAttempts(lead: Lead, value: number) {
    setDropdown(null)
    patchLead(lead.id, { call_attempts: value })
  }

  function setStatus(lead: Lead, status: LeadStatus) {
    setDropdown(null)
    patchLead(lead.id, { status })
  }

  function addTag(lead: Lead) {
    const t = tagInput.trim().toLowerCase()
    if (!t || lead.tags.includes(t)) { setTagInput(''); return }
    patchLead(lead.id, { tags: [...lead.tags, t] })
    setTagInput('')
    tagInputRef.current?.focus()
  }

  function removeTag(lead: Lead, tag: string) {
    patchLead(lead.id, { tags: lead.tags.filter(t => t !== tag) })
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
      },
    })
  }

  function onLeadCreated(lead: Lead) {
    setLeads(prev => [lead, ...prev])
    setMeta(prev => ({ ...prev, total: prev.total + 1 }))
  }

  // Lead concerné par le dropdown ouvert
  const activeLead = dropdown ? leads.find(l => l.id === dropdown.id) : null

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 }}>Leads</h1>
          <p style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
            {loading ? '...' : `${meta.total} lead${meta.total > 1 ? 's' : ''} au total`}
          </p>
        </div>
        <button onClick={() => setShowForm(true)} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          background: '#00C853', border: 'none', color: '#000', cursor: 'pointer',
        }}>
          <Plus size={15} />
          Ajouter un lead
        </button>
      </div>

      {/* Filtres */}
      <div style={{ marginBottom: 16 }}>
        <LeadFilters onFiltersChange={setFilters} />
      </div>

      {/* Tableau */}
      <div style={card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Date', 'Nom', 'Téléphone', 'Email', 'Source', 'Tentatives', 'Joint', 'Statut', 'Tags', 'Actions'].map(h => (
                  <th key={h} style={{
                    padding: '12px 16px', textAlign: 'left',
                    fontSize: 11, fontWeight: 600, color: '#555',
                    textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{ padding: '48px 16px', textAlign: 'center', color: '#555' }}>
                    Chargement...
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '48px 16px', textAlign: 'center', color: '#555' }}>
                    Aucun lead trouvé
                  </td>
                </tr>
              ) : leads.map((lead, i) => (
                <tr key={lead.id} style={{
                  borderBottom: i < leads.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  transition: 'background 0.1s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Date */}
                  <td style={{ padding: '12px 16px', color: '#666', whiteSpace: 'nowrap' }}>
                    {format(new Date(lead.created_at), 'dd MMM yyyy', { locale: fr })}
                  </td>

                  {/* Nom */}
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap' }}>
                    {lead.first_name} {lead.last_name}
                  </td>

                  {/* Téléphone */}
                  <td style={{ padding: '12px 16px', color: '#aaa', whiteSpace: 'nowrap' }}>
                    {lead.phone || <span style={{ color: '#444' }}>—</span>}
                  </td>

                  {/* Email */}
                  <td style={{ padding: '12px 16px', color: '#aaa', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {lead.email || <span style={{ color: '#444' }}>—</span>}
                  </td>

                  {/* Source */}
                  <td style={{ padding: '12px 16px' }}>
                    <SourceBadge source={lead.source} />
                  </td>

                  {/* Tentatives */}
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      onClick={e => openDropdown(e, lead.id, 'attempts')}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: dropdown?.id === lead.id && dropdown?.type === 'attempts'
                          ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
                        color: lead.call_attempts > 0 ? '#fff' : '#555',
                        cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      <Phone size={11} color={lead.call_attempts > 0 ? '#3b82f6' : '#444'} />
                      {attemptsLabel(lead.call_attempts)}
                      <ChevronDown size={10} color="#555" />
                    </button>
                  </td>

                  {/* Joint (toggle) */}
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <button
                      onClick={() => toggleReached(lead)}
                      style={{
                        width: 36, height: 20, borderRadius: 99, border: 'none', cursor: 'pointer',
                        background: lead.reached ? '#00C853' : 'rgba(255,255,255,0.08)',
                        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                      }}
                      title={lead.reached ? 'Joint' : 'Non joint'}
                    >
                      <span style={{
                        position: 'absolute', top: 2, width: 16, height: 16, borderRadius: '50%',
                        background: '#fff', transition: 'left 0.2s',
                        left: lead.reached ? 18 : 2,
                      }} />
                    </button>
                  </td>

                  {/* Statut */}
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      onClick={e => openDropdown(e, lead.id, 'status')}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
                      }}
                    >
                      <StatusBadge status={lead.status} />
                      <ChevronDown size={10} color="#555" />
                    </button>
                  </td>

                  {/* Tags */}
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                      {lead.tags.slice(0, 3).map(tag => (
                        <span key={tag} style={{
                          padding: '2px 7px', borderRadius: 99, fontSize: 10, fontWeight: 600,
                          background: 'rgba(255,255,255,0.06)', color: '#777',
                        }}>
                          {tag}
                        </span>
                      ))}
                      {lead.tags.length > 3 && (
                        <span style={{ fontSize: 10, color: '#555' }}>+{lead.tags.length - 3}</span>
                      )}
                      <button
                        onClick={e => openDropdown(e, lead.id, 'tags')}
                        title="Gérer les tags"
                        style={{
                          width: 18, height: 18, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)',
                          background: dropdown?.id === lead.id && dropdown?.type === 'tags'
                            ? 'rgba(255,255,255,0.10)' : 'transparent',
                          color: '#555', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Plus size={10} />
                      </button>
                    </div>
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                      <button onClick={() => callLead(lead)} title="Appeler" style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '5px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.20)',
                        color: '#3b82f6', cursor: 'pointer', whiteSpace: 'nowrap',
                      }}>
                        <Phone size={11} /> Appeler
                      </button>
                      <button onClick={() => setScheduleTarget(lead)} title="Planifier" style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '5px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: 'rgba(0,200,83,0.10)', border: '1px solid rgba(0,200,83,0.20)',
                        color: '#00C853', cursor: 'pointer', whiteSpace: 'nowrap',
                      }}>
                        <Calendar size={11} /> Planifier
                      </button>
                      <Link href={`/leads/${lead.id}`} title="Voir la fiche" style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
                        color: '#ccc', textDecoration: 'none', whiteSpace: 'nowrap',
                      }}>
                        <ExternalLink size={11} /> Voir
                      </Link>
                      <button onClick={() => archiveLead(lead)} title="Archiver" style={{
                        display: 'inline-flex', alignItems: 'center',
                        padding: '5px 7px', borderRadius: 6,
                        background: 'transparent', border: '1px solid rgba(255,255,255,0.06)',
                        color: '#555', cursor: 'pointer',
                      }}>
                        <Archive size={11} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta.total_pages > 1 && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)',
          }}>
            <span style={{ fontSize: 12, color: '#555' }}>
              Page {meta.page} sur {meta.total_pages} — {meta.total} résultats
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{
                padding: '5px 10px', borderRadius: 6, fontSize: 12,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                color: page <= 1 ? '#333' : '#888', cursor: page <= 1 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <ChevronLeft size={13} /> Préc.
              </button>
              <button disabled={page >= meta.total_pages} onClick={() => setPage(p => p + 1)} style={{
                padding: '5px 10px', borderRadius: 6, fontSize: 12,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                color: page >= meta.total_pages ? '#333' : '#888',
                cursor: page >= meta.total_pages ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                Suiv. <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dropdown rendu en position fixed — jamais coupé par overflow */}
      {dropdown && activeLead && (
        <div
          ref={dropdownPanelRef}
          style={{
            position: 'fixed',
            top: dropdown.top,
            left: dropdown.left,
            zIndex: 9999,
            background: '#1a1a1c',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 10,
            padding: 5,
            boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
            minWidth: dropdown.type === 'status' ? 200 : 160,
          }}
        >
          {dropdown.type === 'attempts' && ATTEMPTS_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setAttempts(activeLead, opt.value)} style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '7px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600,
              border: 'none', textAlign: 'left',
              background: activeLead.call_attempts === opt.value ? 'rgba(59,130,246,0.15)' : 'transparent',
              color: activeLead.call_attempts === opt.value ? '#3b82f6' : '#aaa',
              cursor: 'pointer',
            }}>
              {opt.value === 0
                ? <X size={12} color={activeLead.call_attempts === 0 ? '#3b82f6' : '#555'} />
                : <Phone size={12} color={activeLead.call_attempts === opt.value ? '#3b82f6' : '#555'} />
              }
              {opt.label}
            </button>
          ))}

          {dropdown.type === 'tags' && (
            <div style={{ minWidth: 220 }}>
              {/* Tags existants */}
              {activeLead.tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10, padding: '4px 4px 0' }}>
                  {activeLead.tags.map(tag => (
                    <span key={tag} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '3px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                      background: 'rgba(255,255,255,0.06)', color: '#888',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}>
                      {tag}
                      <button onClick={() => removeTag(activeLead, tag)} style={{
                        background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 0, lineHeight: 1,
                      }}>
                        <X size={9} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {/* Input ajout tag */}
              <div style={{ display: 'flex', gap: 5, padding: '0 2px 2px' }}>
                <input
                  ref={tagInputRef}
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(activeLead) } }}
                  placeholder="Nouveau tag..."
                  style={{
                    flex: 1, padding: '6px 9px',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 7, color: '#fff', fontSize: 12, outline: 'none',
                  }}
                />
                <button onClick={() => addTag(activeLead)} style={{
                  padding: '6px 9px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(0,200,83,0.10)', color: '#00C853', cursor: 'pointer',
                  display: 'flex', alignItems: 'center',
                }}>
                  <Plus size={13} />
                </button>
              </div>
            </div>
          )}

          {dropdown.type === 'status' && (Object.entries(STATUS_CONFIG) as [LeadStatus, typeof STATUS_CONFIG[LeadStatus]][]).map(([value, cfg]) => (
            <button key={value} onClick={() => setStatus(activeLead, value)} style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '7px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600,
              border: 'none',
              background: activeLead.status === value ? `${cfg.color}18` : 'transparent',
              color: activeLead.status === value ? cfg.color : '#aaa',
              cursor: 'pointer',
            }}>
              {cfg.label}
            </button>
          ))}
        </div>
      )}

      {/* Modale ajout lead */}
      {showForm && (
        <LeadForm onClose={() => setShowForm(false)} onCreated={onLeadCreated} />
      )}

      {/* Modale planifier depuis la liste */}
      {scheduleTarget && (
        <CallScheduleModal
          lead={scheduleTarget}
          onClose={() => setScheduleTarget(null)}
          onScheduled={() => { setScheduleTarget(null); fetchLeads() }}
        />
      )}

      {/* Modale de confirmation */}
      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.danger ? 'Archiver' : 'Confirmer'}
          confirmDanger={confirm.danger}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
