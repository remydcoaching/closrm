'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, X, ChevronDown } from 'lucide-react'
import { LeadStatus, LeadSource, ContactFilters, ContactGroupBy } from '@/types'

const STATUSES: { value: LeadStatus; label: string; color: string }[] = [
  { value: 'nouveau', label: 'Nouveau', color: '#a0a0a0' },
  { value: 'scripte', label: 'Scripté', color: '#06b6d4' },
  { value: 'setting_planifie', label: 'Setting planifié', color: '#3b82f6' },
  { value: 'no_show_setting', label: 'No-show Setting', color: '#f59e0b' },
  { value: 'closing_planifie', label: 'Closing planifié', color: '#a855f7' },
  { value: 'no_show_closing', label: 'No-show Closing', color: '#f97316' },
  { value: 'clos', label: 'Closé', color: 'var(--color-primary)' },
  { value: 'dead', label: 'Dead', color: '#ef4444' },
]

const SOURCES: { value: LeadSource; label: string }[] = [
  { value: 'facebook_ads', label: 'Facebook Ads' },
  { value: 'instagram_ads', label: 'Instagram Ads' },
  { value: 'follow_ads', label: 'Follow Ads' },
  { value: 'formulaire', label: 'Formulaire' },
  { value: 'manuel', label: 'Manuel' },
]

const GROUP_OPTIONS: { value: ContactGroupBy | ''; label: string }[] = [
  { value: '', label: 'Aucun' },
  { value: 'status', label: 'Statut' },
  { value: 'source', label: 'Source' },
]

const REACHED_OPTIONS = [
  { value: 'all' as const, label: 'Tous' },
  { value: 'true' as const, label: 'Joint' },
  { value: 'false' as const, label: 'Non joint' },
]

interface Props {
  onFiltersChange: (filters: ContactFilters) => void
}

type DropdownType = 'status' | 'source' | 'date' | 'reached' | 'group'

const dropdownBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5,
  padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
  background: 'var(--bg-subtle)', border: '1px solid var(--border-primary)',
  color: 'var(--text-tertiary)', cursor: 'pointer', whiteSpace: 'nowrap',
}

const dropdownPanel: React.CSSProperties = {
  position: 'fixed', zIndex: 9999,
  background: '#1a1a1c', border: '1px solid var(--border-primary)',
  borderRadius: 10, padding: 8,
  boxShadow: '0 8px 32px var(--shadow-dropdown)', minWidth: 180,
}

export default function DatabaseFilters({ onFiltersChange }: Props) {
  const [search, setSearch] = useState('')
  const [statuses, setStatuses] = useState<LeadStatus[]>([])
  const [sources, setSources] = useState<LeadSource[]>([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [reached, setReached] = useState<'all' | 'true' | 'false'>('all')
  const [groupBy, setGroupBy] = useState<ContactGroupBy | ''>('')
  const [openDropdown, setOpenDropdown] = useState<{ type: DropdownType; top: number; left: number } | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fermer le dropdown si clic en dehors
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null)
      }
    }
    if (openDropdown) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [openDropdown])

  // Debounce + propagation
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onFiltersChange({ search, statuses, sources, tags: [], date_from: dateFrom, date_to: dateTo, reached, group_by: groupBy })
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search, statuses, sources, dateFrom, dateTo, reached, groupBy, onFiltersChange])

  function openDd(e: React.MouseEvent<HTMLButtonElement>, type: DropdownType) {
    if (openDropdown?.type === type) { setOpenDropdown(null); return }
    const rect = e.currentTarget.getBoundingClientRect()
    setOpenDropdown({ type, top: rect.bottom + 4, left: rect.left })
  }

  function toggleStatus(s: LeadStatus) {
    setStatuses(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  function toggleSource(s: LeadSource) {
    setSources(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  const hasActiveFilters = search !== '' || statuses.length > 0 || sources.length > 0 || dateFrom || dateTo || reached !== 'all' || groupBy !== ''

  function resetAll() {
    setStatuses([]); setSources([])
    setDateFrom(''); setDateTo(''); setReached('all'); setGroupBy('')
    setSearch('')
  }

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {/* Recherche */}
      <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
        <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher nom, email, téléphone..."
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '7px 10px 7px 30px', borderRadius: 8, fontSize: 12,
            background: 'var(--bg-hover)', border: '1px solid var(--border-primary)',
            color: 'var(--text-primary)', outline: 'none',
          }}
        />
      </div>

      {/* Statut */}
      <button onClick={e => openDd(e, 'status')} style={{
        ...dropdownBtn,
        ...(statuses.length > 0 ? { borderColor: 'rgba(0,200,83,0.4)', color: 'var(--color-primary)' } : {}),
      }}>
        Statut {statuses.length > 0 && `(${statuses.length})`} <ChevronDown size={11} />
      </button>

      {/* Source */}
      <button onClick={e => openDd(e, 'source')} style={{
        ...dropdownBtn,
        ...(sources.length > 0 ? { borderColor: 'rgba(0,200,83,0.4)', color: 'var(--color-primary)' } : {}),
      }}>
        Source {sources.length > 0 && `(${sources.length})`} <ChevronDown size={11} />
      </button>

      {/* Date */}
      <button onClick={e => openDd(e, 'date')} style={{
        ...dropdownBtn,
        ...((dateFrom || dateTo) ? { borderColor: 'rgba(0,200,83,0.4)', color: 'var(--color-primary)' } : {}),
      }}>
        Date de création {(dateFrom || dateTo) ? '●' : ''} <ChevronDown size={11} />
      </button>

      {/* Joint */}
      <button onClick={e => openDd(e, 'reached')} style={{
        ...dropdownBtn,
        ...(reached !== 'all' ? { borderColor: 'rgba(0,200,83,0.4)', color: 'var(--color-primary)' } : {}),
      }}>
        {reached === 'all' ? 'Joint' : reached === 'true' ? 'Joint (oui)' : 'Non joint'} <ChevronDown size={11} />
      </button>

      {/* Grouper par */}
      <button onClick={e => openDd(e, 'group')} style={{
        ...dropdownBtn,
        ...(groupBy ? { borderColor: 'rgba(0,200,83,0.4)', color: 'var(--color-primary)' } : {}),
      }}>
        {groupBy ? `Groupé: ${GROUP_OPTIONS.find(o => o.value === groupBy)?.label}` : 'Grouper par'} <ChevronDown size={11} />
      </button>

      {/* Reset */}
      {hasActiveFilters && (
        <button onClick={resetAll} style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '7px 10px', borderRadius: 8, fontSize: 12,
          background: 'transparent', border: '1px solid rgba(239,68,68,0.3)',
          color: '#ef4444', cursor: 'pointer',
        }}>
          <X size={11} /> Réinitialiser
        </button>
      )}

      {/* Dropdown panel */}
      {openDropdown && (
        <div ref={dropdownRef} style={{ ...dropdownPanel, top: openDropdown.top, left: openDropdown.left }}>
          {openDropdown.type === 'status' && STATUSES.map(s => (
            <button key={s.value} onClick={() => toggleStatus(s.value)} style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '6px 10px', borderRadius: 7, fontSize: 12, fontWeight: 500,
              border: 'none', textAlign: 'left', cursor: 'pointer',
              background: statuses.includes(s.value) ? `${s.color}18` : 'transparent',
              color: statuses.includes(s.value) ? s.color : '#aaa',
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              {s.label}
            </button>
          ))}

          {openDropdown.type === 'source' && SOURCES.map(s => (
            <button key={s.value} onClick={() => toggleSource(s.value)} style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '6px 10px', borderRadius: 7, fontSize: 12, fontWeight: 500,
              border: 'none', textAlign: 'left', cursor: 'pointer',
              background: sources.includes(s.value) ? 'rgba(0,200,83,0.12)' : 'transparent',
              color: sources.includes(s.value) ? 'var(--color-primary)' : '#aaa',
            }}>
              {s.label}
            </button>
          ))}

          {openDropdown.type === 'date' && (
            <div style={{ padding: '4px 2px', minWidth: 220 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8, padding: '0 4px' }}>Plage de dates</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Depuis</div>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{
                    width: '100%', boxSizing: 'border-box', padding: '5px 8px',
                    background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
                    borderRadius: 6, color: 'var(--text-primary)', fontSize: 11, outline: 'none',
                  }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Jusqu'au</div>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{
                    width: '100%', boxSizing: 'border-box', padding: '5px 8px',
                    background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
                    borderRadius: 6, color: 'var(--text-primary)', fontSize: 11, outline: 'none',
                  }} />
                </div>
                {(dateFrom || dateTo) && (
                  <button onClick={() => { setDateFrom(''); setDateTo('') }} style={{
                    padding: '4px 8px', borderRadius: 6, fontSize: 11,
                    background: 'transparent', border: '1px solid rgba(239,68,68,0.3)',
                    color: '#ef4444', cursor: 'pointer',
                  }}>Effacer</button>
                )}
              </div>
            </div>
          )}

          {openDropdown.type === 'reached' && REACHED_OPTIONS.map(o => (
            <button key={o.value} onClick={() => { setReached(o.value); setOpenDropdown(null) }} style={{
              display: 'block', width: '100%', padding: '6px 10px', borderRadius: 7,
              fontSize: 12, fontWeight: 500, border: 'none', textAlign: 'left', cursor: 'pointer',
              background: reached === o.value ? 'rgba(0,200,83,0.12)' : 'transparent',
              color: reached === o.value ? 'var(--color-primary)' : '#aaa',
            }}>
              {o.label}
            </button>
          ))}

          {openDropdown.type === 'group' && GROUP_OPTIONS.map(o => (
            <button key={String(o.value)} onClick={() => { setGroupBy(o.value); setOpenDropdown(null) }} style={{
              display: 'block', width: '100%', padding: '6px 10px', borderRadius: 7,
              fontSize: 12, fontWeight: 500, border: 'none', textAlign: 'left', cursor: 'pointer',
              background: groupBy === o.value ? 'rgba(0,200,83,0.12)' : 'transparent',
              color: groupBy === o.value ? 'var(--color-primary)' : '#aaa',
            }}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
