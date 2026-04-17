'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus, ChevronLeft, ChevronRight, Archive, Phone, ChevronDown, X, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { Lead, LeadStatus, WorkspaceMemberWithUser } from '@/types'
import StatusBadge, { STATUS_CONFIG } from '@/components/leads/StatusBadge'
import SourceBadge from '@/components/leads/SourceBadge'
import MemberAssignDropdown from '@/components/shared/MemberAssignDropdown'

function InstagramIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
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

const card: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-primary)',
  borderRadius: 14,
}

interface DropdownState {
  id: string
  type: 'attempts' | 'status' | 'tags'
  top: number
  left: number
}

export interface LeadsListViewProps {
  leads: Lead[]
  loading: boolean
  members: WorkspaceMemberWithUser[]
  page: number
  totalPages: number
  total: number
  onPageChange: (p: number) => void
  onLeadClick: (leadId: string) => void
  onPatch: (leadId: string, patch: Partial<Lead>) => void
  onCall: (lead: Lead) => void
  onSchedule: (lead: Lead) => void
  onArchive: (lead: Lead) => void
  onRequestClose: (lead: Lead) => void
}

export default function LeadsListView(props: LeadsListViewProps) {
  const {
    leads, loading, members, page, totalPages, total,
    onPageChange, onLeadClick, onPatch, onCall, onSchedule, onArchive, onRequestClose,
  } = props

  const [dropdown, setDropdown] = useState<DropdownState | null>(null)
  const [tagInput, setTagInput] = useState('')
  const dropdownPanelRef = useRef<HTMLDivElement>(null)
  const tagInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownPanelRef.current && !dropdownPanelRef.current.contains(e.target as Node)) {
        setDropdown(null)
      }
    }
    if (dropdown) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [dropdown])

  function openDropdown(e: React.MouseEvent<HTMLButtonElement>, id: string, type: 'attempts' | 'status' | 'tags') {
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
    onPatch(lead.id, { call_attempts: value })
  }

  function setStatus(lead: Lead, status: LeadStatus) {
    setDropdown(null)
    if (status === 'clos') {
      onRequestClose(lead)
      return
    }
    onPatch(lead.id, { status })
  }

  function addTag(lead: Lead) {
    const t = tagInput.trim().toLowerCase()
    if (!t || lead.tags.includes(t)) { setTagInput(''); return }
    onPatch(lead.id, { tags: [...lead.tags, t] })
    setTagInput('')
    tagInputRef.current?.focus()
  }

  function removeTag(lead: Lead, tag: string) {
    onPatch(lead.id, { tags: lead.tags.filter(t => t !== tag) })
  }

  function toggleReached(lead: Lead) {
    onPatch(lead.id, { reached: !lead.reached })
  }

  const activeLead = dropdown ? leads.find(l => l.id === dropdown.id) : null

  return (
    <>
      <div style={card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '88px' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '50px' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '12%' }} />
              <col />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                {['Date', 'Nom', 'Téléphone', 'Email', 'Source', 'Tentatives', 'Joint', 'Statut', 'Assigné à', 'Tags', 'Actions'].map(h => (
                  <th key={h} style={{
                    padding: '10px 8px', textAlign: 'left',
                    fontSize: 11, fontWeight: 600, color: 'var(--text-label)',
                    textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap',
                    overflow: 'hidden',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-label)' }}>
                    Chargement...
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-label)' }}>
                    Aucun lead trouvé
                  </td>
                </tr>
              ) : leads.map((lead, i) => (
                <tr key={lead.id} style={{
                  borderBottom: i < leads.length - 1 ? '1px solid var(--bg-hover)' : 'none',
                  transition: 'background 0.1s',
                  cursor: 'pointer',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => onLeadClick(lead.id)}
                >
                  <td style={{ padding: '10px 8px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {format(new Date(lead.created_at), 'dd MMM yyyy', { locale: fr })}
                  </td>
                  <td style={{ padding: '10px 8px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {lead.first_name} {lead.last_name}
                  </td>
                  <td style={{ padding: '10px 8px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {lead.phone || <span style={{ color: 'var(--text-label)' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 8px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {lead.email || <span style={{ color: 'var(--text-label)' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 8px', overflow: 'hidden' }}>
                    <SourceBadge source={lead.source} />
                  </td>
                  <td style={{ padding: '10px 8px' }} onClick={e => e.stopPropagation()}>
                    <button
                      onClick={e => openDropdown(e, lead.id, 'attempts')}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                        border: '1px solid var(--border-primary)',
                        background: dropdown?.id === lead.id && dropdown?.type === 'attempts'
                          ? 'var(--border-primary)' : 'var(--bg-subtle)',
                        color: lead.call_attempts > 0 ? 'var(--text-primary)' : 'var(--text-label)',
                        cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      <Phone size={11} color={lead.call_attempts > 0 ? '#3b82f6' : 'var(--text-label)'} />
                      {attemptsLabel(lead.call_attempts)}
                      <ChevronDown size={10} color="var(--text-label)" />
                    </button>
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => toggleReached(lead)}
                      style={{
                        width: 36, height: 20, borderRadius: 99, border: 'none', cursor: 'pointer',
                        background: lead.reached ? 'var(--color-primary)' : 'var(--border-primary)',
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
                  <td style={{ padding: '10px 8px' }} onClick={e => e.stopPropagation()}>
                    <button
                      onClick={e => openDropdown(e, lead.id, 'status')}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
                      }}
                    >
                      <StatusBadge status={lead.status} />
                      <ChevronDown size={10} color="var(--text-label)" />
                    </button>
                  </td>
                  <td style={{ padding: '10px 8px', whiteSpace: 'nowrap', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                    <MemberAssignDropdown
                      assignedTo={lead.assigned_to}
                      members={members}
                      onAssign={(userId) => onPatch(lead.id, { assigned_to: userId })}
                      compact
                    />
                  </td>
                  <td style={{ padding: '10px 8px', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap', alignItems: 'center', overflow: 'hidden' }}>
                      {lead.tags.slice(0, 1).map(tag => (
                        <span key={tag} style={{
                          padding: '2px 7px', borderRadius: 99, fontSize: 10, fontWeight: 600,
                          background: 'var(--border-primary)', color: 'var(--text-tertiary)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 80,
                        }}>
                          {tag}
                        </span>
                      ))}
                      {lead.tags.length > 1 && (
                        <span style={{ fontSize: 10, color: 'var(--text-label)', flexShrink: 0 }}>+{lead.tags.length - 1}</span>
                      )}
                      <button
                        onClick={e => openDropdown(e, lead.id, 'tags')}
                        title="Gérer les tags"
                        style={{
                          width: 18, height: 18, borderRadius: '50%', border: '1px solid var(--border-primary)',
                          background: dropdown?.id === lead.id && dropdown?.type === 'tags'
                            ? 'var(--border-primary)' : 'transparent',
                          color: 'var(--text-label)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Plus size={10} />
                      </button>
                    </div>
                  </td>
                  <td style={{ padding: '10px 8px' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                      <button onClick={() => onCall(lead)} title="Appeler" style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '5px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.20)',
                        color: '#3b82f6', cursor: 'pointer', whiteSpace: 'nowrap',
                      }}>
                        <Phone size={11} /> Appeler
                      </button>
                      <button onClick={() => onSchedule(lead)} title="Planifier" style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '5px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: 'rgba(0,200,83,0.10)', border: '1px solid rgba(0,200,83,0.20)',
                        color: 'var(--color-primary)', cursor: 'pointer', whiteSpace: 'nowrap',
                      }}>
                        <Calendar size={11} /> Planifier
                      </button>
                      {lead.instagram_handle && (
                        <a
                          href={`https://instagram.com/${lead.instagram_handle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Profil @${lead.instagram_handle}`}
                          style={{
                            display: 'inline-flex', alignItems: 'center',
                            padding: '5px 7px', borderRadius: 6,
                            background: 'rgba(225,48,108,0.10)', border: '1px solid rgba(225,48,108,0.20)',
                            color: '#E1306C', cursor: 'pointer',
                          }}
                          onClick={e => e.stopPropagation()}
                        >
                          <InstagramIcon size={11} />
                        </a>
                      )}
                      <button onClick={() => onArchive(lead)} title="Archiver" style={{
                        display: 'inline-flex', alignItems: 'center',
                        padding: '5px 7px', borderRadius: 6,
                        background: 'transparent', border: '1px solid var(--border-primary)',
                        color: 'var(--text-label)', cursor: 'pointer',
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

        {totalPages > 1 && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 16px', borderTop: '1px solid var(--border-primary)',
          }}>
            <span style={{ fontSize: 12, color: 'var(--text-label)' }}>
              Page {page} sur {totalPages} — {total} résultats
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button disabled={page <= 1} onClick={() => onPageChange(page - 1)} style={{
                padding: '5px 10px', borderRadius: 6, fontSize: 12,
                background: 'var(--bg-hover)', border: '1px solid var(--border-primary)',
                color: page <= 1 ? 'var(--text-disabled)' : 'var(--text-tertiary)',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <ChevronLeft size={13} /> Préc.
              </button>
              <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} style={{
                padding: '5px 10px', borderRadius: 6, fontSize: 12,
                background: 'var(--bg-hover)', border: '1px solid var(--border-primary)',
                color: page >= totalPages ? 'var(--text-disabled)' : 'var(--text-tertiary)',
                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                Suiv. <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {dropdown && activeLead && (
        <div
          ref={dropdownPanelRef}
          style={{
            position: 'fixed',
            top: dropdown.top,
            left: dropdown.left,
            zIndex: 9999,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-primary)',
            borderRadius: 10,
            padding: 5,
            boxShadow: '0 8px 32px var(--shadow-dropdown)',
            minWidth: dropdown.type === 'status' ? 200 : 160,
          }}
        >
          {dropdown.type === 'attempts' && ATTEMPTS_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setAttempts(activeLead, opt.value)} style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '7px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600,
              border: 'none', textAlign: 'left',
              background: activeLead.call_attempts === opt.value ? 'rgba(59,130,246,0.15)' : 'transparent',
              color: activeLead.call_attempts === opt.value ? '#3b82f6' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}>
              {opt.value === 0
                ? <X size={12} color={activeLead.call_attempts === 0 ? '#3b82f6' : 'var(--text-label)'} />
                : <Phone size={12} color={activeLead.call_attempts === opt.value ? '#3b82f6' : 'var(--text-label)'} />
              }
              {opt.label}
            </button>
          ))}

          {dropdown.type === 'tags' && (
            <div style={{ minWidth: 220 }}>
              {activeLead.tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10, padding: '4px 4px 0' }}>
                  {activeLead.tags.map(tag => (
                    <span key={tag} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '3px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                      background: 'var(--border-primary)', color: 'var(--text-tertiary)',
                      border: '1px solid var(--border-primary)',
                    }}>
                      {tag}
                      <button onClick={() => removeTag(activeLead, tag)} style={{
                        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-label)', padding: 0, lineHeight: 1,
                      }}>
                        <X size={9} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 5, padding: '0 2px 2px' }}>
                <input
                  ref={tagInputRef}
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(activeLead) } }}
                  placeholder="Nouveau tag..."
                  style={{
                    flex: 1, padding: '6px 9px',
                    background: 'var(--bg-hover)', border: '1px solid var(--border-primary)',
                    borderRadius: 7, color: 'var(--text-primary)', fontSize: 12, outline: 'none',
                  }}
                />
                <button onClick={() => addTag(activeLead)} style={{
                  padding: '6px 9px', borderRadius: 7, border: '1px solid var(--border-primary)',
                  background: 'rgba(0,200,83,0.10)', color: 'var(--color-primary)', cursor: 'pointer',
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
              color: activeLead.status === value ? cfg.color : 'var(--text-secondary)',
              cursor: 'pointer',
            }}>
              {cfg.label}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
