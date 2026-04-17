import type { LeadStatus } from '@/types'

const DEFAULT_COLUMN_ORDER: LeadStatus[] = [
  'nouveau', 'scripte', 'setting_planifie', 'no_show_setting',
  'closing_planifie', 'no_show_closing', 'clos', 'dead',
]

export type LeadsView = 'list' | 'kanban'

export interface KanbanColumnsPref {
  visible: LeadStatus[]
  order: LeadStatus[]
}

export type DateField = 'created_at' | 'updated_at' | 'closed_at'
export type DatePreset = 'today' | 'yesterday' | '7d' | '30d' | 'custom' | 'all'

export interface DateFilterPref {
  preset: DatePreset
  from?: string
  to?: string
  field: DateField
}

const KEYS = {
  view:       'closrm.leads.view',
  columns:    'closrm.leads.kanban.columns',
  dateFilter: 'closrm.leads.dateFilter',
} as const

function readJSON<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJSON(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch { /* quota, ignore */ }
}

export function loadView(): LeadsView {
  return readJSON<LeadsView>(KEYS.view) ?? 'list'
}
export function saveView(v: LeadsView) { writeJSON(KEYS.view, v) }

export function loadColumns(): KanbanColumnsPref {
  const stored = readJSON<KanbanColumnsPref>(KEYS.columns)
  if (stored && Array.isArray(stored.visible) && Array.isArray(stored.order)) {
    return stored
  }
  return { visible: [...DEFAULT_COLUMN_ORDER], order: [...DEFAULT_COLUMN_ORDER] }
}
export function saveColumns(p: KanbanColumnsPref) { writeJSON(KEYS.columns, p) }

export function loadDateFilter(): DateFilterPref {
  return readJSON<DateFilterPref>(KEYS.dateFilter)
    ?? { preset: 'all', field: 'created_at' }
}
export function saveDateFilter(p: DateFilterPref) { writeJSON(KEYS.dateFilter, p) }

/** Calcule from/to ISO depuis un preset, dans le fuseau local. */
export function computeRange(preset: DatePreset, custom?: { from?: string; to?: string }):
  { from?: string; to?: string } {
  const now = new Date()
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
  const endOfDay   = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)

  switch (preset) {
    case 'today':
      return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() }
    case 'yesterday': {
      const y = new Date(now); y.setDate(y.getDate() - 1)
      return { from: startOfDay(y).toISOString(), to: endOfDay(y).toISOString() }
    }
    case '7d': {
      const from = new Date(now); from.setDate(from.getDate() - 6)
      return { from: startOfDay(from).toISOString(), to: endOfDay(now).toISOString() }
    }
    case '30d': {
      const from = new Date(now); from.setDate(from.getDate() - 29)
      return { from: startOfDay(from).toISOString(), to: endOfDay(now).toISOString() }
    }
    case 'custom':
      return { from: custom?.from, to: custom?.to }
    case 'all':
    default:
      return {}
  }
}
