'use client'

import { useState, useCallback } from 'react'
import type { SprintWeek, SprintDayKpi, DayScheduleBlock } from '@/types/sprint'
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

const PRESET_COLORS = [
  { label: 'Rouge', value: '#E53E3E' },
  { label: 'Vert', value: '#38A169' },
  { label: 'Bleu', value: '#3B82F6' },
  { label: 'Orange', value: '#D69E2E' },
  { label: 'Violet', value: '#8B5CF6' },
  { label: 'Gris', value: '#6B7280' },
]

function emptyKpi(sprintId: string, date: string): SprintDayKpi {
  return {
    id: '', sprint_id: sprintId, date,
    ca_close: 0, calls_booked: 0, calls_done: 0,
    dms_sent: 0, reels_published: 0, leads_ads: 0, cpl: 0,
    notes: '', updated_at: '',
    focus_theme: null, focus_emoji: null, focus_description: null, schedule_blocks: null,
  }
}

function getBlocks(kpi: SprintDayKpi): DayScheduleBlock[] {
  if (kpi.schedule_blocks && kpi.schedule_blocks.length > 0) return kpi.schedule_blocks
  return DAY_BLOCKS.slice(1)
}

// ─── Block edit form ────────────────────────────────────────────────────────

function BlockEditForm({
  initial, onSave, onCancel, onDelete,
}: {
  initial: Partial<DayScheduleBlock>
  onSave: (b: DayScheduleBlock) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const [start, setStart] = useState(initial.start ?? '')
  const [end, setEnd] = useState(initial.end ?? '')
  const [label, setLabel] = useState(initial.label ?? '')
  const [sublabel, setSublabel] = useState(initial.sublabel ?? '')
  const [color, setColor] = useState(initial.color ?? '#6B7280')

  const inp = {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 4,
    padding: '4px 8px',
    fontSize: 12,
    color: 'var(--text-primary)',
    outline: 'none',
  }

  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--color-primary)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input placeholder="09:00" value={start} onChange={e => setStart(e.target.value)} style={{ ...inp, width: 60 }} />
        <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>→</span>
        <input placeholder="10:30" value={end} onChange={e => setEnd(e.target.value)} style={{ ...inp, width: 60 }} />
        <input placeholder="LABEL (ex: VENTES)" value={label} onChange={e => setLabel(e.target.value)} style={{ ...inp, flex: 1, minWidth: 100 }} />
      </div>
      <input placeholder="Description courte (optionnel)" value={sublabel} onChange={e => setSublabel(e.target.value)} style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} />
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Couleur :</span>
        {PRESET_COLORS.map(c => (
          <button key={c.value} type="button" onClick={() => setColor(c.value)} title={c.label}
            style={{ width: 18, height: 18, borderRadius: '50%', background: c.value, border: color === c.value ? '2px solid white' : '2px solid transparent', cursor: 'pointer', padding: 0, flexShrink: 0 }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
        <div>
          {onDelete && (
            <button type="button" onClick={onDelete}
              style={{ background: 'transparent', border: '1px solid rgba(229,62,62,0.4)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: '#E53E3E', cursor: 'pointer' }}>
              Supprimer
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={onCancel}
            style={{ background: 'transparent', border: '1px solid var(--border-primary)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            Annuler
          </button>
          <button type="button"
            onClick={() => { if (!start || !end || !label) return; onSave({ start, end, label: label.toUpperCase(), sublabel: sublabel || undefined, color }) }}
            style={{ background: 'var(--color-primary)', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
            Sauvegarder
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function SprintClient({ sprint, initialDayKpis }: Props) {
  const [selectedDay, setSelectedDay] = useState(0)
  const [dayKpis, setDayKpis] = useState<Record<string, SprintDayKpi>>(() => {
    const map: Record<string, SprintDayKpi> = {}
    for (const kpi of initialDayKpis) map[kpi.date] = kpi
    return map
  })
  const [editingFocusField, setEditingFocusField] = useState<'emoji' | 'theme' | 'description' | null>(null)
  const [editingBlockIdx, setEditingBlockIdx] = useState<number | null>(null)
  const [addingBlock, setAddingBlock] = useState(false)
  const [hoveredBlockIdx, setHoveredBlockIdx] = useState<number | null>(null)

  const kpiForDate = (date: string) => dayKpis[date] ?? emptyKpi(sprint.id, date)
  const totalCa = Object.values(dayKpis).reduce((sum, k) => sum + (k.ca_close ?? 0), 0)

  const saveField = useCallback(async (date: string, field: string, value: unknown) => {
    const res = await fetch(`/api/sprint/${sprint.slug}/days/${date}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    if (res.ok) {
      const updated = await res.json() as SprintDayKpi
      setDayKpis(prev => ({ ...prev, [date]: updated }))
    }
  }, [sprint.slug])

  function switchDay(i: number) {
    setSelectedDay(i)
    setEditingBlockIdx(null)
    setAddingBlock(false)
    setEditingFocusField(null)
  }

  const currentDay = SPRINT_DAYS[selectedDay]
  const currentKpi = kpiForDate(currentDay.date)
  const currentBlocks = getBlocks(currentKpi)

  const focusEmoji = currentKpi.focus_emoji ?? currentDay.focusEmoji
  const focusTheme = currentKpi.focus_theme ?? currentDay.focusTheme
  const focusDesc = currentKpi.focus_description ?? currentDay.focusDescription

  function handleBlockUpdate(idx: number, block: DayScheduleBlock) {
    const updated = [...currentBlocks]; updated[idx] = block
    saveField(currentDay.date, 'schedule_blocks', updated)
    setEditingBlockIdx(null)
  }
  function handleBlockDelete(idx: number) {
    saveField(currentDay.date, 'schedule_blocks', currentBlocks.filter((_, i) => i !== idx))
    setEditingBlockIdx(null)
  }
  function handleBlockAdd(block: DayScheduleBlock) {
    saveField(currentDay.date, 'schedule_blocks', [...currentBlocks, block])
    setAddingBlock(false)
  }

  const editPencil = (
    <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 400 }}>✎</span>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'inherit' }}>

      {/* Header */}
      <header style={{ padding: '20px 32px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{sprint.title}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>1 au 6 Juin 2026 · Rémy & Pierre · 9h–21h</p>
        </div>
        <div style={{ background: totalCa > 0 ? 'rgba(56,161,105,0.15)' : 'var(--bg-elevated)', border: `1px solid ${totalCa > 0 ? '#38A169' : 'var(--border-primary)'}`, borderRadius: 10, padding: '10px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>CA sprint</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: totalCa > 0 ? '#38A169' : 'var(--text-primary)' }}>{totalCa.toLocaleString('fr-FR')} €</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>objectif : 1 000 €</div>
        </div>
      </header>

      {/* KPI summary table */}
      <div style={{ padding: '16px 32px 0', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, border: '1px solid var(--border-primary)', borderRadius: 8, overflow: 'hidden' }}>
          <thead>
            <tr style={{ background: 'var(--bg-elevated)' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 500, borderBottom: '1px solid var(--border-primary)' }}>KPI</th>
              {SPRINT_DAYS.map(d => (
                <th key={d.date} style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 500, borderBottom: '1px solid var(--border-primary)', borderLeft: '1px solid var(--border-primary)', whiteSpace: 'nowrap' }}>{d.shortLabel}</th>
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
          const active = i === selectedDay
          return (
            <button key={d.date} type="button" onClick={() => switchDay(i)}
              style={{ background: active ? 'var(--color-primary)' : 'var(--bg-elevated)', color: active ? '#fff' : 'var(--text-secondary)', border: `1px solid ${active ? 'var(--color-primary)' : 'var(--border-primary)'}`, borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: active ? 600 : 500, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 80 }}>
              <span>{d.focusEmoji} {d.shortLabel}</span>
              {kpi.ca_close > 0 && <span style={{ fontSize: 11, color: active ? 'rgba(255,255,255,0.8)' : '#38A169' }}>{kpi.ca_close}€</span>}
            </button>
          )
        })}
      </div>

      {/* Main grid */}
      <div style={{ padding: '20px 32px 40px', display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>

        {/* Left: Schedule */}
        <div>

          {/* Focus section — editable */}
          <div style={{ background: 'rgba(229,62,62,0.08)', border: '1px solid rgba(229,62,62,0.3)', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: '#E53E3E', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, marginBottom: 8 }}>
              Session Focus — 09:00 à 10:30
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
              {editingFocusField === 'emoji' ? (
                <input autoFocus defaultValue={focusEmoji}
                  onBlur={e => { saveField(currentDay.date, 'focus_emoji', e.target.value); setEditingFocusField(null) }}
                  style={{ width: 48, fontSize: 22, background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: 4, padding: '2px 4px', outline: 'none', textAlign: 'center', color: 'var(--text-primary)' }}
                />
              ) : (
                <span onClick={() => setEditingFocusField('emoji')} style={{ fontSize: 24, cursor: 'pointer' }} title="Modifier l'emoji">
                  {focusEmoji}
                </span>
              )}
              {editingFocusField === 'theme' ? (
                <input autoFocus defaultValue={focusTheme}
                  onBlur={e => { saveField(currentDay.date, 'focus_theme', e.target.value); setEditingFocusField(null) }}
                  style={{ flex: 1, fontSize: 18, fontWeight: 700, background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: 4, padding: '4px 8px', color: 'var(--text-primary)', outline: 'none' }}
                />
              ) : (
                <span onClick={() => setEditingFocusField('theme')} style={{ fontSize: 18, fontWeight: 700, cursor: 'pointer', flex: 1 }} title="Modifier le titre">
                  {focusTheme}{editPencil}
                </span>
              )}
            </div>
            {editingFocusField === 'description' ? (
              <textarea autoFocus defaultValue={focusDesc}
                onBlur={e => { saveField(currentDay.date, 'focus_description', e.target.value); setEditingFocusField(null) }}
                style={{ width: '100%', fontSize: 13, background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: 4, padding: '6px 8px', color: 'var(--text-secondary)', outline: 'none', lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', minHeight: 60 }}
              />
            ) : (
              <p onClick={() => setEditingFocusField('description')} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0, cursor: 'pointer' }} title="Modifier la description">
                {focusDesc}{editPencil}
              </p>
            )}
          </div>

          {/* Schedule blocks */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {currentBlocks.map((block, idx) => (
              <div key={idx}>
                {editingBlockIdx === idx ? (
                  <BlockEditForm
                    initial={block}
                    onSave={b => handleBlockUpdate(idx, b)}
                    onCancel={() => setEditingBlockIdx(null)}
                    onDelete={() => handleBlockDelete(idx)}
                  />
                ) : (
                  <div
                    onMouseEnter={() => setHoveredBlockIdx(idx)}
                    onMouseLeave={() => setHoveredBlockIdx(null)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderLeft: `3px solid ${block.color}`, borderRadius: 8, position: 'relative' }}
                  >
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums', minWidth: 90 }}>
                      {block.start} – {block.end}
                    </span>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: block.color }}>{block.label}</span>
                      {block.sublabel && <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>{block.sublabel}</span>}
                    </div>
                    {hoveredBlockIdx === idx && (
                      <button type="button" onClick={() => setEditingBlockIdx(idx)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 13, padding: '2px 6px' }}>
                        ✎
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {addingBlock ? (
              <BlockEditForm initial={{}} onSave={handleBlockAdd} onCancel={() => setAddingBlock(false)} />
            ) : (
              <button type="button" onClick={() => setAddingBlock(true)}
                style={{ background: 'transparent', border: '1px dashed var(--border-primary)', borderRadius: 8, padding: '8px', fontSize: 12, color: 'var(--text-tertiary)', cursor: 'pointer', textAlign: 'center' }}>
                + Ajouter un bloc
              </button>
            )}
          </div>
        </div>

        {/* Right: day selector + KPIs + notes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* KPI form */}
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary)', marginBottom: 12 }}>
              KPIs — {currentDay.label}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {KPI_FIELDS.map(({ key, label, unit, isFloat }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <label style={{ fontSize: 13, color: 'var(--text-secondary)', flexShrink: 0 }}>{label}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="number" min={0} step={isFloat ? '0.01' : '1'}
                      defaultValue={currentKpi[key] ?? 0}
                      key={`${currentDay.date}-${key}`}
                      onBlur={e => {
                        const val = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value, 10)
                        if (!isNaN(val)) saveField(currentDay.date, key, val)
                      }}
                      style={{ width: 80, background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: 6, padding: '5px 8px', fontSize: 13, color: 'var(--text-primary)', textAlign: 'right', outline: 'none' }}
                    />
                    {unit && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{unit}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: 16, flex: 1 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary)', marginBottom: 8 }}>Notes</h3>
            <textarea
              key={`${currentDay.date}-notes`}
              defaultValue={currentKpi.notes ?? ''}
              placeholder="Décisions, idées, ce qui a marché..."
              onBlur={e => saveField(currentDay.date, 'notes', e.target.value)}
              style={{ width: '100%', minHeight: 120, background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: 6, padding: '8px 10px', fontSize: 13, color: 'var(--text-primary)', resize: 'vertical', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
