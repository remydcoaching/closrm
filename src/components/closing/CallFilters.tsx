'use client'

import { useState, useEffect, useRef } from 'react'
import { Search } from 'lucide-react'
import { CallType } from '@/types'

interface Filters {
  search: string
  type: CallType | null
  dateStart: string
  dateEnd: string
}

interface Props {
  onFiltersChange: (filters: Filters) => void
}

export default function CallFilters({ onFiltersChange }: Props) {
  const [search, setSearch] = useState('')
  const [type, setType] = useState<CallType | null>(null)
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const debounce = useRef<NodeJS.Timeout>(null)

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => {
      onFiltersChange({ search, type, dateStart, dateEnd })
    }, 300)
    return () => { if (debounce.current) clearTimeout(debounce.current) }
  }, [search, type, dateStart, dateEnd, onFiltersChange])

  const tabBtn = (label: string, value: CallType | null) => {
    const active = type === value
    return (
      <button key={label} onClick={() => setType(value)} style={{
        padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer',
        border: active ? '1px solid rgba(0,200,83,0.3)' : '1px solid var(--border-primary)',
        background: active ? 'rgba(0,200,83,0.08)' : 'transparent',
        color: active ? 'var(--color-primary)' : 'var(--text-tertiary)',
      }}>
        {label}
      </button>
    )
  }

  const dateInput: React.CSSProperties = {
    background: 'var(--bg-input)', border: '1px solid var(--border-primary)',
    borderRadius: 8, padding: '6px 10px', color: 'var(--text-primary)', fontSize: 12, outline: 'none',
    colorScheme: 'dark',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      {/* Search */}
      <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-label)' }} />
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un lead..."
          style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-primary)', borderRadius: 8, padding: '8px 12px 8px 34px', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }}
        />
      </div>

      {/* Type toggle */}
      <div style={{ display: 'flex', gap: 4 }}>
        {tabBtn('Tous', null)}
        {tabBtn('Setting', 'setting')}
        {tabBtn('Closing', 'closing')}
      </div>

      {/* Date range */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} style={dateInput} />
        <span style={{ color: 'var(--text-label)', fontSize: 12 }}>→</span>
        <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} style={dateInput} />
      </div>
    </div>
  )
}
