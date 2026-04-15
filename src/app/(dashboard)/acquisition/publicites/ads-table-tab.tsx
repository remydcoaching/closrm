'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Layers, Save, X, Plus } from 'lucide-react'
import type { MetaInsightsResponse } from '@/app/api/meta/insights/route'

interface AdsTableTabProps {
  data: MetaInsightsResponse | null
  loading: boolean
  tabKey: string
  campaignType?: string
  dateFrom?: string
  dateTo?: string
  onRowClick?: (id: string, name: string) => void
}

type ColumnKey = 'name' | 'status' | 'spend' | 'impressions' | 'clicks' | 'ctr' | 'leads' | 'cpl'
type SortKey = Exclude<ColumnKey, 'status'>
type SortState = { key: SortKey; dir: 'asc' | 'desc' } | null

interface ColumnDef {
  key: ColumnKey
  label: string
  sortable: boolean
  align: 'left' | 'right'
  defaultVisible: boolean
}

/* ── Saved views ─────────────────────────────────────────────── */

interface SavedView {
  id: string
  name: string
  columns: ColumnKey[]
}

const ALL_COLUMN_KEYS: ColumnKey[] = ['name', 'status', 'spend', 'impressions', 'clicks', 'ctr', 'leads', 'cpl']

const DEFAULT_VIEWS: SavedView[] = [
  { id: 'essential', name: 'Essentiel', columns: ['name', 'status', 'spend', 'impressions', 'clicks', 'ctr', 'leads', 'cpl'] },
  { id: 'video', name: 'Performance vidéo', columns: ['name', 'status', 'spend', 'impressions', 'clicks', 'ctr'] },
  { id: 'funnel', name: 'Funnel complet', columns: ['name', 'status', 'spend', 'leads', 'cpl', 'clicks', 'ctr'] },
]

function loadCustomViews(tabKey: string): SavedView[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(`ads-views-${tabKey}`)
    if (raw) return JSON.parse(raw) as SavedView[]
  } catch { /* ignore */ }
  return []
}

function saveCustomViews(tabKey: string, views: SavedView[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`ads-views-${tabKey}`, JSON.stringify(views))
  }
}

/* ── Column definitions ──────────────────────────────────────── */

const ALL_COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Nom', sortable: true, align: 'left', defaultVisible: true },
  { key: 'status', label: 'Statut', sortable: false, align: 'left', defaultVisible: true },
  { key: 'spend', label: 'Dépensé', sortable: true, align: 'right', defaultVisible: true },
  { key: 'impressions', label: 'Impressions', sortable: true, align: 'right', defaultVisible: true },
  { key: 'clicks', label: 'Clics', sortable: true, align: 'right', defaultVisible: true },
  { key: 'ctr', label: 'CTR', sortable: true, align: 'right', defaultVisible: true },
  { key: 'leads', label: 'Leads', sortable: true, align: 'right', defaultVisible: true },
  { key: 'cpl', label: 'CPL', sortable: true, align: 'right', defaultVisible: true },
]

const COLUMN_MAP = new Map(ALL_COLUMNS.map(c => [c.key, c]))

/* ── Helpers ─────────────────────────────────────────────────── */

function formatEuro(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€'
}

function formatNumber(n: number): string {
  return n.toLocaleString('fr-FR')
}

function getStatusLabel(status: string): { label: string; bg: string; color: string } {
  switch (status) {
    case 'ACTIVE':
      return { label: 'Actif', bg: 'rgba(0,200,83,0.1)', color: 'var(--color-primary)' }
    case 'PAUSED':
    case 'CAMPAIGN_PAUSED':
    case 'ADSET_PAUSED':
      return { label: 'Pausé', bg: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }
    case 'DELETED':
    case 'ARCHIVED':
      return { label: 'Archivé', bg: 'rgba(229,62,62,0.08)', color: '#E53E3E' }
    case 'IN_PROCESS':
    case 'PENDING_REVIEW':
    case 'PENDING_BILLING_INFO':
      return { label: 'En cours', bg: 'rgba(214,158,46,0.1)', color: '#D69E2E' }
    case 'WITH_ISSUES':
    case 'DISAPPROVED':
      return { label: 'Problème', bg: 'rgba(229,62,62,0.08)', color: '#E53E3E' }
    default:
      return { label: 'Brouillon', bg: 'rgba(100,100,100,0.1)', color: '#888' }
  }
}

/* ── Styles ──────────────────────────────────────────────────── */

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-muted)',
  textAlign: 'left',
  userSelect: 'none',
  borderBottom: '1px solid var(--border-primary)',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 12,
  color: 'var(--text-secondary)',
  borderBottom: '1px solid rgba(255,255,255,0.04)',
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-primary)',
  borderRadius: 6,
  padding: '7px 12px',
  color: 'var(--text-primary)',
  fontSize: 12,
  outline: 'none',
  width: 220,
}

/* ── Sortable column pill (in column picker) ─────────────────── */

function SortableColumnPill({ colKey, label, onRemove }: { colKey: ColumnKey; label: string; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: colKey })

  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 8px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    background: isDragging ? '#1a1a2e' : 'rgba(255,255,255,0.05)',
    border: '1px solid',
    borderColor: isDragging ? '#3b82f6' : 'var(--border-primary)',
    cursor: isDragging ? 'grabbing' : 'grab',
    opacity: isDragging ? 0.8 : 1,
    boxShadow: isDragging ? '0 4px 12px rgba(59,130,246,0.3)' : 'none',
    transform: CSS.Transform.toString(transform),
    transition,
    userSelect: 'none',
  }

  return (
    <span ref={setNodeRef} style={style} {...attributes} {...listeners}>
      ⠿ {label}
      {colKey !== 'name' && (
        <button
          onClick={e => { e.stopPropagation(); onRemove() }}
          onPointerDown={e => e.stopPropagation()}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 0,
            fontSize: 12,
            lineHeight: 1,
            display: 'flex',
          }}
        >
          <X size={10} />
        </button>
      )}
    </span>
  )
}

/* ── Sortable table header cell ──────────────────────────────── */

function SortableHeaderCell({
  col,
  sortArrow,
  onSort,
}: {
  col: ColumnDef
  sortArrow: string
  onSort: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.key })

  const style: React.CSSProperties = {
    ...thStyle,
    textAlign: col.align,
    cursor: col.sortable ? 'pointer' : 'grab',
    transform: CSS.Transform.toString(transform),
    transition,
    background: isDragging ? 'rgba(59,130,246,0.08)' : 'transparent',
    boxShadow: isDragging ? '0 2px 8px rgba(59,130,246,0.2)' : 'none',
    opacity: isDragging ? 0.85 : 1,
    position: 'relative',
    zIndex: isDragging ? 10 : 'auto',
  }

  return (
    <th
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={e => {
        // Only trigger sort on click, not on drag
        if (col.sortable && col.key !== 'status') {
          onSort()
        }
      }}
    >
      {col.label}{col.sortable && col.key !== 'status' ? sortArrow : ''}
    </th>
  )
}

/* ── Main component ──────────────────────────────────────────── */

export default function AdsTableTab({ data, loading, tabKey, onRowClick }: AdsTableTabProps) {
  const [sort, setSort] = useState<SortState>(null)
  const [search, setSearch] = useState('')

  // Ordered columns (replaces visibleCols Set — maintains order)
  const [orderedCols, setOrderedCols] = useState<ColumnKey[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`ads-cols-v2-${tabKey}`)
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as ColumnKey[]
          // Validate keys
          if (parsed.every(k => ALL_COLUMN_KEYS.includes(k))) return parsed
        } catch { /* ignore */ }
      }
      // Fallback: try legacy format
      const legacy = localStorage.getItem(`ads-columns-${tabKey}`)
      if (legacy) {
        try {
          return JSON.parse(legacy) as ColumnKey[]
        } catch { /* ignore */ }
      }
    }
    return ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key)
  })

  const [showColumnPicker, setShowColumnPicker] = useState(false)

  // ── Views state ──
  const [customViews, setCustomViews] = useState<SavedView[]>(() => loadCustomViews(tabKey))
  const [activeViewId, setActiveViewId] = useState<string | null>(null)
  const [showViewDropdown, setShowViewDropdown] = useState(false)
  const [newViewName, setNewViewName] = useState('')
  const [showNewViewInput, setShowNewViewInput] = useState(false)
  const viewDropdownRef = useRef<HTMLDivElement>(null)

  // ── Drag state (for column picker & header) ──
  const [pickerDragId, setPickerDragId] = useState<string | null>(null)
  const [headerDragId, setHeaderDragId] = useState<string | null>(null)

  const pickerSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const headerSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Close view dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (viewDropdownRef.current && !viewDropdownRef.current.contains(e.target as Node)) {
        setShowViewDropdown(false)
        setShowNewViewInput(false)
        setNewViewName('')
      }
    }
    if (showViewDropdown) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [showViewDropdown])

  // Persist column order
  const persistCols = useCallback((cols: ColumnKey[]) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`ads-cols-v2-${tabKey}`, JSON.stringify(cols))
    }
  }, [tabKey])

  function updateCols(cols: ColumnKey[]) {
    setOrderedCols(cols)
    persistCols(cols)
    setActiveViewId(null) // custom change = no longer tracking a view
  }

  function toggleColumn(key: ColumnKey) {
    if (key === 'name') return
    const idx = orderedCols.indexOf(key)
    let next: ColumnKey[]
    if (idx >= 0) {
      next = orderedCols.filter(k => k !== key)
    } else {
      next = [...orderedCols, key]
    }
    updateCols(next)
  }

  // ── View actions ──
  function applyView(view: SavedView) {
    // Filter to valid columns only
    const cols = view.columns.filter(k => ALL_COLUMN_KEYS.includes(k))
    setOrderedCols(cols)
    persistCols(cols)
    setActiveViewId(view.id)
    setShowViewDropdown(false)
  }

  function saveCurrentView() {
    const name = newViewName.trim()
    if (!name) return
    const view: SavedView = {
      id: `custom-${Date.now()}`,
      name,
      columns: [...orderedCols],
    }
    const next = [...customViews, view]
    setCustomViews(next)
    saveCustomViews(tabKey, next)
    setActiveViewId(view.id)
    setNewViewName('')
    setShowNewViewInput(false)
  }

  function deleteView(id: string) {
    const next = customViews.filter(v => v.id !== id)
    setCustomViews(next)
    saveCustomViews(tabKey, next)
    if (activeViewId === id) setActiveViewId(null)
  }

  // ── Column picker drag ──
  function handlePickerDragStart(e: DragStartEvent) {
    setPickerDragId(e.active.id as string)
  }

  function handlePickerDragEnd(e: DragEndEvent) {
    setPickerDragId(null)
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = orderedCols.indexOf(active.id as ColumnKey)
    const newIdx = orderedCols.indexOf(over.id as ColumnKey)
    if (oldIdx < 0 || newIdx < 0) return
    const next = arrayMove(orderedCols, oldIdx, newIdx)
    updateCols(next)
  }

  // ── Header drag ──
  function handleHeaderDragStart(e: DragStartEvent) {
    setHeaderDragId(e.active.id as string)
  }

  function handleHeaderDragEnd(e: DragEndEvent) {
    setHeaderDragId(null)
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = orderedCols.indexOf(active.id as ColumnKey)
    const newIdx = orderedCols.indexOf(over.id as ColumnKey)
    if (oldIdx < 0 || newIdx < 0) return
    const next = arrayMove(orderedCols, oldIdx, newIdx)
    updateCols(next)
  }

  // Derive visible ColumnDefs from orderedCols
  const columns = useMemo(() => {
    return orderedCols
      .map(k => COLUMN_MAP.get(k))
      .filter((c): c is ColumnDef => c !== undefined)
  }, [orderedCols])

  // Filter by search
  const filtered = useMemo(() => {
    if (!data) return []
    const q = search.toLowerCase().trim()
    if (!q) return data.breakdown
    return data.breakdown.filter(row => row.name.toLowerCase().includes(q))
  }, [data, search])

  // Sort
  const sorted = useMemo(() => {
    const rows = [...filtered]
    const sortKey = sort?.key ?? 'spend'
    const sortDir = sort?.dir ?? 'desc'

    return rows.sort((a, b) => {
      const valA = a[sortKey] ?? 0
      const valB = b[sortKey] ?? 0
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
      }
      return sortDir === 'asc'
        ? (valA as number) - (valB as number)
        : (valB as number) - (valA as number)
    })
  }, [filtered, sort])

  if (loading || !data) {
    return <TableSkeleton />
  }

  function handleSort(key: SortKey) {
    if (!sort || sort.key !== key) {
      setSort({ key, dir: 'desc' })
    } else if (sort.dir === 'desc') {
      setSort({ key, dir: 'asc' })
    } else {
      setSort(null)
    }
  }

  function arrow(key: SortKey): string {
    if (!sort || sort.key !== key) return ''
    return sort.dir === 'asc' ? ' ↑' : ' ↓'
  }

  function renderCell(row: (typeof sorted)[0], col: ColumnDef) {
    switch (col.key) {
      case 'name':
        return (
          <span style={{ fontWeight: 500, color: onRowClick ? '#1877F2' : 'var(--text-primary)' }}>
            {row.name}{onRowClick ? ' →' : ''}
          </span>
        )
      case 'status': {
        const s = getStatusLabel(row.status)
        return (
          <span style={{
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 4,
            background: s.bg,
            color: s.color,
          }}>
            {s.label}
          </span>
        )
      }
      case 'spend':
        return formatEuro(row.spend)
      case 'impressions':
        return formatNumber(row.impressions)
      case 'clicks':
        return formatNumber(row.clicks)
      case 'ctr':
        return row.ctr.toFixed(2) + '%'
      case 'leads':
        return <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{row.leads}</span>
      case 'cpl':
        return row.cpl !== null ? formatEuro(row.cpl) : '—'
    }
  }

  // Find the active view label for the button
  const allViews = [...DEFAULT_VIEWS, ...customViews]
  const activeView = activeViewId ? allViews.find(v => v.id === activeViewId) : null

  // Dragging header overlay content
  const draggedHeaderCol = headerDragId ? COLUMN_MAP.get(headerDragId as ColumnKey) : null

  return (
    <div>
      {/* Toolbar: search + views + column picker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <input
          type="text"
          placeholder="Rechercher par nom..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={inputStyle}
        />

        {/* Views dropdown */}
        <div style={{ position: 'relative' }} ref={viewDropdownRef}>
          <button
            onClick={() => setShowViewDropdown(p => !p)}
            style={{
              padding: '7px 14px',
              borderRadius: 6,
              border: '1px solid var(--border-primary)',
              background: activeViewId ? 'rgba(24,119,242,0.1)' : 'transparent',
              color: activeViewId ? '#1877F2' : 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Layers size={13} />
            {activeView ? activeView.name : 'Vues'}
            <span style={{ fontSize: 10, opacity: 0.6 }}>▾</span>
          </button>

          {showViewDropdown && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-primary)',
              borderRadius: 8,
              padding: 6,
              zIndex: 50,
              minWidth: 220,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              {/* Default views */}
              <div style={{ padding: '4px 8px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Vues par défaut
              </div>
              {DEFAULT_VIEWS.map(view => (
                <button
                  key={view.id}
                  onClick={() => applyView(view)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: 4,
                    border: 'none',
                    background: activeViewId === view.id ? 'rgba(24,119,242,0.12)' : 'transparent',
                    color: activeViewId === view.id ? '#1877F2' : 'var(--text-secondary)',
                    fontSize: 12,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {view.name}
                </button>
              ))}

              {/* Custom views */}
              {customViews.length > 0 && (
                <>
                  <div style={{ height: 1, background: 'var(--border-primary)', margin: '6px 0' }} />
                  <div style={{ padding: '4px 8px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Mes vues
                  </div>
                  {customViews.map(view => (
                    <div
                      key={view.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <button
                        onClick={() => applyView(view)}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          padding: '6px 8px',
                          borderRadius: 4,
                          border: 'none',
                          background: activeViewId === view.id ? 'rgba(24,119,242,0.12)' : 'transparent',
                          color: activeViewId === view.id ? '#1877F2' : 'var(--text-secondary)',
                          fontSize: 12,
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        {view.name}
                      </button>
                      <button
                        onClick={() => deleteView(view.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '4px',
                          borderRadius: 4,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        title="Supprimer la vue"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </>
              )}

              {/* Save new view */}
              <div style={{ height: 1, background: 'var(--border-primary)', margin: '6px 0' }} />
              {showNewViewInput ? (
                <div style={{ display: 'flex', gap: 4, padding: '4px' }}>
                  <input
                    type="text"
                    placeholder="Nom de la vue..."
                    value={newViewName}
                    onChange={e => setNewViewName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveCurrentView() }}
                    autoFocus
                    style={{
                      flex: 1,
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: 4,
                      padding: '4px 8px',
                      color: 'var(--text-primary)',
                      fontSize: 11,
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={saveCurrentView}
                    disabled={!newViewName.trim()}
                    style={{
                      background: newViewName.trim() ? '#1877F2' : 'rgba(255,255,255,0.05)',
                      border: 'none',
                      borderRadius: 4,
                      padding: '4px 6px',
                      color: '#fff',
                      cursor: newViewName.trim() ? 'pointer' : 'default',
                      display: 'flex',
                      alignItems: 'center',
                      opacity: newViewName.trim() ? 1 : 0.4,
                    }}
                  >
                    <Save size={12} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewViewInput(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: 4,
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={12} />
                  Sauvegarder la vue actuelle
                </button>
              )}
            </div>
          )}
        </div>

        {/* Column picker */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowColumnPicker(p => !p)}
            style={{
              padding: '7px 14px',
              borderRadius: 6,
              border: '1px solid var(--border-primary)',
              background: showColumnPicker ? 'rgba(24,119,242,0.1)' : 'transparent',
              color: showColumnPicker ? '#1877F2' : 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Colonnes ▾
          </button>
          {showColumnPicker && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-primary)',
              borderRadius: 8,
              padding: 8,
              zIndex: 50,
              minWidth: 260,
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            }}>
              {/* Active columns — draggable to reorder */}
              <div style={{ padding: '2px 8px 6px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Colonnes actives (glisser pour réordonner)
              </div>
              <DndContext
                sensors={pickerSensors}
                collisionDetection={closestCenter}
                onDragStart={handlePickerDragStart}
                onDragEnd={handlePickerDragEnd}
              >
                <SortableContext items={orderedCols} strategy={verticalListSortingStrategy}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
                    {orderedCols.map(key => {
                      const col = COLUMN_MAP.get(key)
                      if (!col) return null
                      return (
                        <SortableColumnPill
                          key={key}
                          colKey={key}
                          label={col.label}
                          onRemove={() => toggleColumn(key)}
                        />
                      )
                    })}
                  </div>
                </SortableContext>
                <DragOverlay>
                  {pickerDragId ? (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 500,
                      color: '#fff',
                      background: '#1a1a2e',
                      border: '1px solid #3b82f6',
                      boxShadow: '0 6px 16px rgba(59,130,246,0.35)',
                      cursor: 'grabbing',
                    }}>
                      ⠿ {COLUMN_MAP.get(pickerDragId as ColumnKey)?.label ?? pickerDragId}
                    </span>
                  ) : null}
                </DragOverlay>
              </DndContext>

              {/* Inactive columns — toggle to add */}
              {ALL_COLUMNS.filter(c => !orderedCols.includes(c.key)).length > 0 && (
                <>
                  <div style={{ height: 1, background: 'var(--border-primary)', margin: '4px 0 6px' }} />
                  <div style={{ padding: '2px 8px 4px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Colonnes masquées
                  </div>
                  {ALL_COLUMNS.filter(c => !orderedCols.includes(c.key)).map(col => (
                    <button
                      key={col.key}
                      onClick={() => toggleColumn(col.key)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        width: '100%',
                        padding: '4px 8px',
                        borderRadius: 4,
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--text-muted)',
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      <Plus size={10} /> {col.label}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      {sorted.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: 60,
          color: 'var(--text-muted)',
          fontSize: 13,
        }}>
          {search ? 'Aucun résultat pour cette recherche' : 'Aucune donnée pour cette période'}
        </div>
      ) : (
        <div style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-primary)',
          borderRadius: 10,
          overflow: 'hidden',
        }}>
          <DndContext
            sensors={headerSensors}
            collisionDetection={closestCenter}
            onDragStart={handleHeaderDragStart}
            onDragEnd={handleHeaderDragEnd}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <SortableContext items={orderedCols} strategy={horizontalListSortingStrategy}>
                    {columns.map(col => (
                      <SortableHeaderCell
                        key={col.key}
                        col={col}
                        sortArrow={col.sortable && col.key !== 'status' ? arrow(col.key as SortKey) : ''}
                        onSort={() => col.sortable && col.key !== 'status' && handleSort(col.key as SortKey)}
                      />
                    ))}
                  </SortableContext>
                </tr>
              </thead>
              <tbody>
                {sorted.map(row => (
                  <tr
                    key={row.id}
                    style={{
                      transition: 'background 0.1s',
                      cursor: onRowClick ? 'pointer' : 'default',
                    }}
                    onClick={() => onRowClick?.(row.id, row.name)}
                    onMouseEnter={e => (e.currentTarget.style.background = onRowClick ? 'rgba(24,119,242,0.04)' : 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {columns.map(col => (
                      <td key={col.key} style={{ ...tdStyle, textAlign: col.align }}>
                        {renderCell(row, col)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <DragOverlay>
              {draggedHeaderCol ? (
                <div style={{
                  padding: '8px 12px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#3b82f6',
                  background: 'rgba(59,130,246,0.1)',
                  border: '1px solid rgba(59,130,246,0.3)',
                  borderRadius: 6,
                  boxShadow: '0 4px 16px rgba(59,130,246,0.25)',
                  whiteSpace: 'nowrap',
                  cursor: 'grabbing',
                }}>
                  {draggedHeaderCol.label}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      )}
    </div>
  )
}

function TableSkeleton() {
  const skeletonRow: React.CSSProperties = {
    height: 42,
    background: 'var(--bg-elevated)',
    animation: 'pulse 1.5s ease-in-out infinite',
  }
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-primary)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{ ...skeletonRow, borderBottom: '1px solid var(--border-primary)' }} />
      ))}
    </div>
  )
}
