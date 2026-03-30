'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { LeadStatus, LeadSource } from '@/types'

const STATUSES: { value: LeadStatus; label: string; color: string }[] = [
  { value: 'nouveau', label: 'Nouveau', color: '#a0a0a0' },
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
  { value: 'formulaire', label: 'Formulaire', color: '#06b6d4' },
  { value: 'manuel', label: 'Manuel', color: '#a0a0a0' },
]

interface LeadFiltersProps {
  onFiltersChange: (filters: { search: string; statuses: LeadStatus[]; sources: LeadSource[] }) => void
}

export default function LeadFilters({ onFiltersChange }: LeadFiltersProps) {
  const [search, setSearch] = useState('')
  const [selectedStatuses, setSelectedStatuses] = useState<LeadStatus[]>([])
  const [selectedSources, setSelectedSources] = useState<LeadSource[]>([])
  const [panelOpen, setPanelOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Fermer le panneau si clic en dehors
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false)
      }
    }
    if (panelOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [panelOpen])

  // Debounce sur la recherche + changements de filtres
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onFiltersChange({ search, statuses: selectedStatuses, sources: selectedSources })
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search, selectedStatuses, selectedSources, onFiltersChange])

  function toggleStatus(s: LeadStatus) {
    setSelectedStatuses(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    )
  }

  function toggleSource(s: LeadSource) {
    setSelectedSources(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    )
  }

  function clearAll() {
    setSelectedStatuses([])
    setSelectedSources([])
  }

  const activeCount = selectedStatuses.length + selectedSources.length

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>

      {/* Barre de recherche */}
      <div style={{ position: 'relative', width: 280 }}>
        <Search size={14} style={{
          position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
          color: '#555', pointerEvents: 'none',
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

      {/* Bouton filtres */}
      <div style={{ position: 'relative' }} ref={panelRef}>
        <button
          onClick={() => setPanelOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            border: panelOpen || activeCount > 0
              ? '1px solid rgba(0,200,83,0.4)'
              : '1px solid var(--border-primary)',
            background: panelOpen || activeCount > 0
              ? 'rgba(0,200,83,0.08)'
              : 'var(--bg-elevated)',
            color: activeCount > 0 ? 'var(--color-primary)' : 'var(--text-tertiary)',
            cursor: 'pointer', transition: 'all 0.15s ease', whiteSpace: 'nowrap',
          }}
        >
          <SlidersHorizontal size={14} />
          Filtres
          {activeCount > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 18, height: 18, borderRadius: '50%', fontSize: 10, fontWeight: 700,
              background: 'var(--color-primary)', color: '#000',
            }}>
              {activeCount}
            </span>
          )}
        </button>

        {/* Panneau déroulant */}
        {panelOpen && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 50,
            background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
            borderRadius: 12, padding: 20, minWidth: 320,
            boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
          }}>
            {/* Header panneau */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Filtres</span>
              {activeCount > 0 && (
                <button onClick={clearAll} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 11, color: '#ef4444', background: 'none', border: 'none',
                  cursor: 'pointer', padding: 0,
                }}>
                  <X size={11} /> Tout effacer
                </button>
              )}
            </div>

            {/* Section Statuts */}
            <div style={{ marginBottom: 18 }}>
              <p style={{
                fontSize: 10, fontWeight: 700, color: '#555',
                textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10,
              }}>
                Statut
              </p>
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

            {/* Section Sources */}
            <div>
              <p style={{
                fontSize: 10, fontWeight: 700, color: '#555',
                textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10,
              }}>
                Source
              </p>
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

            {/* Chips des filtres actifs */}
            {activeCount > 0 && (
              <div style={{
                marginTop: 16, paddingTop: 14,
                borderTop: '1px solid var(--border-primary)',
                display: 'flex', flexWrap: 'wrap', gap: 6,
              }}>
                {selectedStatuses.map(s => {
                  const cfg = STATUSES.find(x => x.value === s)!
                  return (
                    <span key={s} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                      background: `${cfg.color}15`, color: cfg.color,
                      border: `1px solid ${cfg.color}30`,
                    }}>
                      {cfg.label}
                      <button onClick={() => toggleStatus(s)} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: cfg.color, padding: 0, lineHeight: 1,
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
                      background: `${cfg.color}15`, color: cfg.color,
                      border: `1px solid ${cfg.color}30`,
                    }}>
                      {cfg.label}
                      <button onClick={() => toggleSource(s)} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: cfg.color, padding: 0, lineHeight: 1,
                      }}>
                        <X size={10} />
                      </button>
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chips actifs visibles sous la barre (hors panneau) */}
      {activeCount > 0 && !panelOpen && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', width: '100%' }}>
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
