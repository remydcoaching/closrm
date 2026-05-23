'use client'

import { useState, useCallback } from 'react'
import type { SprintWeek, SprintDayKpi } from '@/types/sprint'
import { SPRINT_DAYS, DAY_BLOCKS } from '@/types/sprint'

interface Props {
  sprint: SprintWeek
  initialDayKpis: SprintDayKpi[]
}

type KpiKey = 'ca_close' | 'calls_booked' | 'calls_done' | 'dms_sent' | 'reels_published' | 'leads_ads' | 'cpl'

const KPI_FIELDS: { key: KpiKey; label: string; unit?: string; isFloat?: boolean }[] = [
  { key: 'ca_close', label: 'CA closé', unit: '€', isFloat: true },
  { key: 'calls_booked', label: 'Calls bookés' },
  { key: 'calls_done', label: 'Calls faits' },
  { key: 'dms_sent', label: 'DMs envoyés' },
  { key: 'reels_published', label: 'Reels publiés' },
  { key: 'leads_ads', label: 'Leads pubs' },
  { key: 'cpl', label: 'CPL', unit: '€', isFloat: true },
]

function emptyKpi(sprintId: string, date: string): SprintDayKpi {
  return {
    id: '',
    sprint_id: sprintId,
    date,
    ca_close: 0,
    calls_booked: 0,
    calls_done: 0,
    dms_sent: 0,
    reels_published: 0,
    leads_ads: 0,
    cpl: 0,
    notes: '',
    updated_at: '',
  }
}

export default function SprintClient({ sprint, initialDayKpis }: Props) {
  const [selectedDay, setSelectedDay] = useState(0)
  const [dayKpis, setDayKpis] = useState<Record<string, SprintDayKpi>>(() => {
    const map: Record<string, SprintDayKpi> = {}
    for (const kpi of initialDayKpis) map[kpi.date] = kpi
    return map
  })

  const kpiForDate = (date: string) => dayKpis[date] ?? emptyKpi(sprint.id, date)

  const totalCa = Object.values(dayKpis).reduce((sum, k) => sum + (k.ca_close ?? 0), 0)

  const saveField = useCallback(
    async (date: string, field: string, value: number | string) => {
      const res = await fetch(`/api/sprint/${sprint.slug}/days/${date}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      if (res.ok) {
        const updated = await res.json() as SprintDayKpi
        setDayKpis(prev => ({ ...prev, [date]: updated }))
      }
    },
    [sprint.slug]
  )

  const currentDay = SPRINT_DAYS[selectedDay]
  const currentKpi = kpiForDate(currentDay.date)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'inherit' }}>

      {/* Header */}
      <header style={{
        padding: '20px 32px',
        borderBottom: '1px solid var(--border-primary)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{sprint.title}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            1 au 6 Juin 2026 · Rémy & Pierre · 9h–21h
          </p>
        </div>
        <div style={{
          background: totalCa > 0 ? 'rgba(56,161,105,0.15)' : 'var(--bg-elevated)',
          border: `1px solid ${totalCa > 0 ? '#38A169' : 'var(--border-primary)'}`,
          borderRadius: 10,
          padding: '10px 20px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>CA sprint</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: totalCa > 0 ? '#38A169' : 'var(--text-primary)' }}>
            {totalCa.toLocaleString('fr-FR')} €
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
            objectif : 1 000 €
          </div>
        </div>
      </header>

      {/* KPI summary table */}
      <div style={{ padding: '16px 32px 0', overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 13,
          border: '1px solid var(--border-primary)',
          borderRadius: 8,
          overflow: 'hidden',
        }}>
          <thead>
            <tr style={{ background: 'var(--bg-elevated)' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 500, borderBottom: '1px solid var(--border-primary)' }}>KPI</th>
              {SPRINT_DAYS.map(d => (
                <th key={d.date} style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 500, borderBottom: '1px solid var(--border-primary)', borderLeft: '1px solid var(--border-primary)', whiteSpace: 'nowrap' }}>
                  {d.shortLabel}
                </th>
              ))}
              <th style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-primary)', fontWeight: 600, borderBottom: '1px solid var(--border-primary)', borderLeft: '1px solid var(--border-primary)' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {KPI_FIELDS.map(({ key, label, unit }) => {
              const total = SPRINT_DAYS.reduce((sum, d) => sum + (kpiForDate(d.date)[key] ?? 0), 0)
              return (
                <tr key={key} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                  <td style={{ padding: '7px 12px', color: 'var(--text-secondary)' }}>{label}</td>
                  {SPRINT_DAYS.map(d => {
                    const val = kpiForDate(d.date)[key] ?? 0
                    return (
                      <td key={d.date} style={{ padding: '7px 12px', textAlign: 'center', borderLeft: '1px solid var(--border-primary)', color: val > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                        {val > 0 ? (unit ? `${val}${unit}` : val) : '—'}
                      </td>
                    )
                  })}
                  <td style={{ padding: '7px 12px', textAlign: 'center', borderLeft: '1px solid var(--border-primary)', fontWeight: 600, color: total > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                    {total > 0 ? (unit ? `${total}${unit}` : total) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Day tabs */}
      <div style={{ padding: '20px 32px 0', display: 'flex', gap: 8, overflowX: 'auto' }}>
        {SPRINT_DAYS.map((d, i) => {
          const kpi = kpiForDate(d.date)
          const hasCa = kpi.ca_close > 0
          const active = i === selectedDay
          return (
            <button
              key={d.date}
              type="button"
              onClick={() => setSelectedDay(i)}
              style={{
                background: active ? 'var(--color-primary)' : 'var(--bg-elevated)',
                color: active ? '#fff' : 'var(--text-secondary)',
                border: `1px solid ${active ? 'var(--color-primary)' : 'var(--border-primary)'}`,
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                minWidth: 80,
              }}
            >
              <span>{d.focusEmoji} {d.shortLabel}</span>
              {hasCa && (
                <span style={{ fontSize: 11, color: active ? 'rgba(255,255,255,0.8)' : '#38A169' }}>
                  {kpi.ca_close}€
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Day detail */}
      <div style={{ padding: '20px 32px 40px', display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>

        {/* Left: schedule */}
        <div>
          {/* Focus header */}
          <div style={{
            background: 'rgba(229,62,62,0.08)',
            border: '1px solid rgba(229,62,62,0.3)',
            borderRadius: 12,
            padding: '16px 20px',
            marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 24 }}>{currentDay.focusEmoji}</span>
              <div>
                <div style={{ fontSize: 11, color: '#E53E3E', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>Session Focus — 9h00 à 10h30</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{currentDay.focusTheme}</div>
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{currentDay.focusDescription}</p>
          </div>

          {/* Schedule blocks */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {DAY_BLOCKS.slice(1).map(block => (
              <div
                key={block.start}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 16px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-primary)',
                  borderLeft: `3px solid ${block.color}`,
                  borderRadius: 8,
                }}
              >
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums', minWidth: 90 }}>
                  {block.start} – {block.end}
                </span>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: block.color }}>{block.label}</span>
                  {block.sublabel && (
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>{block.sublabel}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: KPIs + notes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-primary)',
            borderRadius: 12,
            padding: 16,
          }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary)', marginBottom: 12 }}>
              KPIs — {currentDay.label}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {KPI_FIELDS.map(({ key, label, unit, isFloat }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <label style={{ fontSize: 13, color: 'var(--text-secondary)', flexShrink: 0 }}>{label}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="number"
                      min={0}
                      step={isFloat ? '0.01' : '1'}
                      defaultValue={currentKpi[key] ?? 0}
                      key={`${currentDay.date}-${key}`}
                      onBlur={e => {
                        const val = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value, 10)
                        if (!isNaN(val)) saveField(currentDay.date, key, val)
                      }}
                      style={{
                        width: 80,
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 6,
                        padding: '5px 8px',
                        fontSize: 13,
                        color: 'var(--text-primary)',
                        textAlign: 'right',
                        outline: 'none',
                      }}
                    />
                    {unit && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{unit}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-primary)',
            borderRadius: 12,
            padding: 16,
            flex: 1,
          }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Notes
            </h3>
            <textarea
              key={`${currentDay.date}-notes`}
              defaultValue={currentKpi.notes ?? ''}
              placeholder="Décisions, idées, ce qui a marché..."
              onBlur={e => saveField(currentDay.date, 'notes', e.target.value)}
              style={{
                width: '100%',
                minHeight: 120,
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-primary)',
                borderRadius: 6,
                padding: '8px 10px',
                fontSize: 13,
                color: 'var(--text-primary)',
                resize: 'vertical',
                outline: 'none',
                fontFamily: 'inherit',
                lineHeight: 1.5,
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
