'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, X, ChevronDown } from 'lucide-react'
import { LeadStatus, LeadSource, WorkspaceMemberWithUser } from '@/types'

const STATUSES: { value: LeadStatus; label: string; color: string }[] = [
  { value: 'nouveau', label: 'Nouveau', color: '#a0a0a0' },
  { value: 'scripte', label: 'Scripté', color: '#06b6d4' },
  { value: 'setting_planifie', label: 'Setting planifié', color: '#3b82f6' },
  { value: 'no_show_setting', label: 'No-show Setting', color: '#f59e0b' },
  { value: 'closing_planifie', label: 'Closing planifié', color: '#a855f7' },
  { value: 'no_show_closing', label: 'No-show Closing', color: '#f97316' },
  { value: 'clos', label: 'Closé ✅', color: 'var(--color-primary)' },
  { value: 'dead', label: 'Dead ❌', color: '#ef4444' },
]

const SOURCES: { value: LeadSource; label: string; color: string }[] = [
  { value: 'facebook_ads', label: 'Facebook Ads', color: '#3b82f6' },
  { value: 'instagram_ads', label: 'Instagram Ads', color: '#e879f9' },
  { value: 'follow_ads', label: 'Follow Ads', color: '#a855f7' },
  { value: 'formulaire', label: 'Formulaire', color: '#06b6d4' },
  { value: 'manuel', label: 'Manuel', color: '#a0a0a0' },
]

interface LeadFiltersProps {
  onFiltersChange: (filters: { search: string; statuses: LeadStatus[]; sources: LeadSource[]; assigned_to?: string }) => void
  showSearch?: boolean
}

type OpenPanel = 'status' | 'source' | 'assignee' | null

export default function LeadFilters({ onFiltersChange, showSearch = true }: LeadFiltersProps) {
  const [search, setSearch] = useState('')
  const [selectedStatuses, setSelectedStatuses] = useState<LeadStatus[]>([])
  const [selectedSources, setSelectedSources] = useState<LeadSource[]>([])
  const [selectedAssignee, setSelectedAssignee] = useState<string>('')
  const [members, setMembers] = useState<WorkspaceMemberWithUser[]>([])
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onFiltersChange)
  onChangeRef.current = onFiltersChange

  useEffect(() => {
    async function fetchMembers() {
      try {
        const res = await fetch('/api/workspaces/members')
        if (res.ok) {
          const json = await res.json()
          setMembers(json.data ?? [])
        }
      } catch { /* silently ignore */ }
    }
    fetchMembers()
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenPanel(null)
      }
    }
    if (openPanel) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openPanel])

  useEffect(() => {
    onChangeRef.current({ search, statuses: selectedStatuses, sources: selectedSources, assigned_to: selectedAssignee || undefined })
  }, [search, selectedStatuses, selectedSources, selectedAssignee])

  function toggleStatus(s: LeadStatus) {
    setSelectedStatuses(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  function toggleSource(s: LeadSource) {
    setSelectedSources(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  const activeMember = members.find(m => m.user_id === selectedAssignee)
  const assigneeLabel = activeMember ? (activeMember.user.full_name || activeMember.user.email) : ''

  function renderTriggerButton(
    key: OpenPanel,
    label: string,
    count: number,
  ) {
    const isOpen = openPanel === key
    const active = count > 0
    return (
      <button
        onClick={() => setOpenPanel(isOpen ? null : key)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          border: isOpen || active
            ? '1px solid rgba(0,200,83,0.4)'
            : '1px solid var(--border-primary)',
          background: isOpen || active
            ? 'rgba(0,200,83,0.08)'
            : 'var(--bg-elevated)',
          color: active ? 'var(--color-primary)' : 'var(--text-tertiary)',
          cursor: 'pointer', transition: 'all 0.15s ease', whiteSpace: 'nowrap',
        }}
      >
        {label}
        {count > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            minWidth: 18, height: 18, padding: '0 5px', borderRadius: 99,
            fontSize: 10, fontWeight: 700,
            background: 'var(--color-primary)', color: '#000',
          }}>
            {count}
          </span>
        )}
        <ChevronDown size={13} style={{
          transition: 'transform 0.15s ease',
          transform: isOpen ? 'rotate(180deg)' : 'none',
        }} />
      </button>
    )
  }

  const panelStyle: React.CSSProperties = {
    position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 50,
    background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
    borderRadius: 12, padding: 16, minWidth: 260,
    boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
  }

  const activeCount = selectedStatuses.length + selectedSources.length + (selectedAssignee ? 1 : 0)

  return (
    <div ref={containerRef} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>

      {showSearch && (
        <div style={{ position: 'relative', width: 280 }}>
          <Search size={14} style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)', pointerEvents: 'none',
          }} />
          <input
            type="text"
            placeholder="Rechercher un lead..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '7px 10px 7px 32px',
              background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
              borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none',
            }}
          />
        </div>
      )}

      {/* Bouton Statut */}
      <div style={{ position: 'relative' }}>
        {renderTriggerButton('status', 'Statut', selectedStatuses.length)}
        {openPanel === 'status' && (
          <div style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Statut</span>
              {selectedStatuses.length > 0 && (
                <button onClick={() => setSelectedStatuses([])} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 11, color: '#ef4444', background: 'none', border: 'none',
                  cursor: 'pointer', padding: 0,
                }}>
                  <X size={11} /> Effacer
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {STATUSES.map(s => {
                const active = selectedStatuses.includes(s.value)
                return (
                  <button key={s.value} onClick={() => toggleStatus(s.value)} style={{
                    padding: '5px 11px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                    border: active ? `1px solid ${s.color}40` : '1px solid var(--border-primary)',
                    background: active ? `${s.color}18` : 'transparent',
                    color: active ? s.color : '#777',
                    cursor: 'pointer', transition: 'all 0.15s ease',
                  }}>
                    {s.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bouton Source */}
      <div style={{ position: 'relative' }}>
        {renderTriggerButton('source', 'Source', selectedSources.length)}
        {openPanel === 'source' && (
          <div style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Source</span>
              {selectedSources.length > 0 && (
                <button onClick={() => setSelectedSources([])} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 11, color: '#ef4444', background: 'none', border: 'none',
                  cursor: 'pointer', padding: 0,
                }}>
                  <X size={11} /> Effacer
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SOURCES.map(s => {
                const active = selectedSources.includes(s.value)
                return (
                  <button key={s.value} onClick={() => toggleSource(s.value)} style={{
                    padding: '5px 11px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                    border: active ? `1px solid ${s.color}40` : '1px solid var(--border-primary)',
                    background: active ? `${s.color}18` : 'transparent',
                    color: active ? s.color : '#777',
                    cursor: 'pointer', transition: 'all 0.15s ease',
                  }}>
                    {s.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bouton Assigné à */}
      <div style={{ position: 'relative' }}>
        {renderTriggerButton('assignee', 'Assigné à', selectedAssignee ? 1 : 0)}
        {openPanel === 'assignee' && (
          <div style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Assigné à</span>
              {selectedAssignee && (
                <button onClick={() => setSelectedAssignee('')} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 11, color: '#ef4444', background: 'none', border: 'none',
                  cursor: 'pointer', padding: 0,
                }}>
                  <X size={11} /> Effacer
                </button>
              )}
            </div>
            {members.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                Aucun membre disponible
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button
                  onClick={() => { setSelectedAssignee(''); setOpenPanel(null) }}
                  style={{
                    textAlign: 'left', padding: '7px 10px', borderRadius: 6,
                    fontSize: 12, fontWeight: 500,
                    border: '1px solid transparent',
                    background: !selectedAssignee ? 'rgba(59,130,246,0.12)' : 'transparent',
                    color: !selectedAssignee ? '#3b82f6' : 'var(--text-secondary)',
                    cursor: 'pointer', transition: 'all 0.15s ease',
                  }}
                >
                  Tous les membres
                </button>
                {members.filter(m => m.status === 'active').map(m => {
                  const active = selectedAssignee === m.user_id
                  return (
                    <button
                      key={m.user_id}
                      onClick={() => { setSelectedAssignee(m.user_id); setOpenPanel(null) }}
                      style={{
                        textAlign: 'left', padding: '7px 10px', borderRadius: 6,
                        fontSize: 12, fontWeight: 500,
                        border: '1px solid transparent',
                        background: active ? 'rgba(59,130,246,0.12)' : 'transparent',
                        color: active ? '#3b82f6' : 'var(--text-secondary)',
                        cursor: 'pointer', transition: 'all 0.15s ease',
                      }}
                    >
                      {m.user.full_name || m.user.email} <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>({m.role})</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chips actifs sous la barre */}
      {activeCount > 0 && !openPanel && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', width: '100%' }}>
          {selectedAssignee && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 600,
              background: 'rgba(59,130,246,0.08)', color: '#3b82f6',
              border: '1px solid rgba(59,130,246,0.2)',
            }}>
              {assigneeLabel || selectedAssignee}
              <button onClick={() => setSelectedAssignee('')} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', padding: 0,
              }}>
                <X size={10} />
              </button>
            </span>
          )}
          {selectedStatuses.map(s => {
            const cfg = STATUSES.find(x => x.value === s)!
            return (
              <span key={s} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                background: `${cfg.color}12`, color: cfg.color,
                border: `1px solid ${cfg.color}25`,
              }}>
                {cfg.label}
                <button onClick={() => toggleStatus(s)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: cfg.color, padding: 0,
                }}>
                  <X size={10} />
                </button>
              </span>
            )
          })}
          {selectedSources.map(s => {
            const cfg = SOURCES.find(x => x.value === s)!
            return (
              <span key={s} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                background: `${cfg.color}12`, color: cfg.color,
                border: `1px solid ${cfg.color}25`,
              }}>
                {cfg.label}
                <button onClick={() => toggleSource(s)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: cfg.color, padding: 0,
                }}>
                  <X size={10} />
                </button>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
