'use client'

import { useState, useEffect } from 'react'
import type { EmailBroadcastFilters, LeadStatus, LeadSource } from '@/types'

const STATUSES: { value: LeadStatus; label: string }[] = [
  { value: 'nouveau', label: 'Nouveau' },
  { value: 'setting_planifie', label: 'Setting planifié' },
  { value: 'no_show_setting', label: 'No-show setting' },
  { value: 'closing_planifie', label: 'Closing planifié' },
  { value: 'no_show_closing', label: 'No-show closing' },
  { value: 'clos', label: 'Closé' },
  { value: 'dead', label: 'Dead' },
]

const SOURCES: { value: LeadSource; label: string }[] = [
  { value: 'facebook_ads', label: 'Facebook Ads' },
  { value: 'instagram_ads', label: 'Instagram Ads' },
  { value: 'formulaire', label: 'Formulaire' },
  { value: 'manuel', label: 'Manuel' },
]

interface Props {
  filters: EmailBroadcastFilters
  onChange: (filters: EmailBroadcastFilters) => void
}

export default function BroadcastFilterBuilder({ filters, onChange }: Props) {
  const [recipientCount, setRecipientCount] = useState<number | null>(null)
  const [counting, setCounting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(async () => {
      setCounting(true)
      try {
        const res = await fetch('/api/emails/broadcasts/preview-count/preview-count', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(filters),
        })
        // Fallback: count via a simpler endpoint
        if (!res.ok) {
          // Try direct count
          const r2 = await fetch('/api/emails/broadcasts/count', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(filters),
          })
          if (r2.ok) {
            const d = await r2.json()
            setRecipientCount(d.count)
          }
        } else {
          const data = await res.json()
          setRecipientCount(data.count)
        }
      } catch {
        setRecipientCount(null)
      }
      setCounting(false)
    }, 500)
    return () => clearTimeout(timer)
  }, [filters])

  function toggleStatus(status: LeadStatus) {
    const current = filters.statuses || []
    const updated = current.includes(status)
      ? current.filter(s => s !== status)
      : [...current, status]
    onChange({ ...filters, statuses: updated })
  }

  function toggleSource(source: LeadSource) {
    const current = filters.sources || []
    const updated = current.includes(source)
      ? current.filter(s => s !== source)
      : [...current, source]
    onChange({ ...filters, sources: updated })
  }

  return (
    <div>
      {/* Recipient count */}
      <div style={{
        background: '#141414', border: '1px solid #262626', borderRadius: 10,
        padding: '12px 16px', marginBottom: 16, textAlign: 'center',
      }}>
        <span style={{ fontSize: 13, color: '#888' }}>Destinataires : </span>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>
          {counting ? '...' : recipientCount !== null ? recipientCount : '—'}
        </span>
      </div>

      {/* Status filter */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 6 }}>Statut pipeline</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {STATUSES.map(s => {
            const active = (filters.statuses || []).includes(s.value)
            return (
              <button
                key={s.value}
                onClick={() => toggleStatus(s.value)}
                style={{
                  padding: '5px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
                  background: active ? 'var(--color-primary)' : '#1a1a1a',
                  color: active ? '#fff' : '#888',
                  border: `1px solid ${active ? 'var(--color-primary)' : '#333'}`,
                }}
              >
                {s.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Source filter */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 6 }}>Source</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {SOURCES.map(s => {
            const active = (filters.sources || []).includes(s.value)
            return (
              <button
                key={s.value}
                onClick={() => toggleSource(s.value)}
                style={{
                  padding: '5px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
                  background: active ? 'var(--color-primary)' : '#1a1a1a',
                  color: active ? '#fff' : '#888',
                  border: `1px solid ${active ? 'var(--color-primary)' : '#333'}`,
                }}
              >
                {s.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Date range */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 4 }}>Créé après</label>
          <input
            type="date"
            value={filters.date_from || ''}
            onChange={e => onChange({ ...filters, date_from: e.target.value || undefined })}
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 4 }}>Créé avant</label>
          <input
            type="date"
            value={filters.date_to || ''}
            onChange={e => onChange({ ...filters, date_to: e.target.value || undefined })}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Reached filter */}
      <div>
        <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 4 }}>Joint</label>
        <select
          value={filters.reached || 'all'}
          onChange={e => onChange({ ...filters, reached: e.target.value as 'all' | 'true' | 'false' })}
          style={inputStyle}
        >
          <option value="all">Tous</option>
          <option value="true">Oui</option>
          <option value="false">Non</option>
        </select>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 13,
  background: '#0a0a0a', border: '1px solid #333', borderRadius: 8,
  color: '#fff', outline: 'none',
}
