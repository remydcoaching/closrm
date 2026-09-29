// Campaign / ad set / ad table — parity with the web's ads-table-tab.tsx:
// search, default + custom saved views (localStorage), column picker with
// reorder (drag or ↑↓), 3-state sort, per-cell health tinting from the
// workspace thresholds, click-to-drill.
import { useEffect, useMemo, useRef, useState } from 'react'
import { TableCard } from '../../../design-system/TableCard'
import { SearchInput } from '../../../design-system/SearchInput'
import { Input } from '../../../design-system/Input'
import { StatusPill } from '../../../design-system/StatusPill'
import { EmptyState, LoadingState } from '../../../design-system/States'
import {
  ALL_COLUMNS,
  COLUMN_MAP,
  DEFAULT_COLUMNS,
  DEFAULT_VIEWS,
  columnValue,
  formatColumnValue,
  metaStatus,
  moveColumn,
  sanitizeColumns,
  type ColumnDef,
  type ColumnKey,
  type SavedView,
  type SortKey,
} from './columns'
import { evaluateHealthColor } from './health-thresholds'
import type { AdPerformanceRow, MetaBreakdownRow, ThresholdOverrides } from './types'

type TabKey = 'campaigns' | 'adsets' | 'ads'

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as unknown) : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable — keep in memory only */
  }
}

function loadCols(tabKey: TabKey): ColumnKey[] {
  return sanitizeColumns(readJson(`ads-cols-v2-${tabKey}`)) ?? sanitizeColumns(readJson(`ads-columns-${tabKey}`)) ?? DEFAULT_COLUMNS
}

function loadViews(tabKey: TabKey): SavedView[] {
  const raw = readJson(`ads-views-${tabKey}`)
  if (!Array.isArray(raw)) return []
  return raw.flatMap((v): SavedView[] => {
    if (!v || typeof v !== 'object') return []
    const rec = v as Record<string, unknown>
    const cols = sanitizeColumns(rec.columns)
    if (typeof rec.id !== 'string' || typeof rec.name !== 'string' || !cols) return []
    return [{ id: rec.id, name: rec.name, columns: cols }]
  })
}

function useOutsideClose(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open, close])
  return ref
}

const TITLES: Record<TabKey, string> = { campaigns: 'Campagnes', adsets: 'Ad sets', ads: 'Publicités' }

export function AdsTable({
  tabKey,
  rows,
  loading,
  crmMap,
  thresholds,
  subtitle,
  onRowClick,
}: {
  tabKey: TabKey
  rows: MetaBreakdownRow[] | null
  loading: boolean
  crmMap: Map<string, AdPerformanceRow> | undefined
  thresholds: ThresholdOverrides
  subtitle: string
  onRowClick: (row: MetaBreakdownRow) => void
}) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' } | null>(null)
  const [cols, setCols] = useState<ColumnKey[]>(() => loadCols(tabKey))
  const [customViews, setCustomViews] = useState<SavedView[]>(() => loadViews(tabKey))
  const [activeViewId, setActiveViewId] = useState<string | null>(null)
  const [viewsOpen, setViewsOpen] = useState(false)
  const [colsOpen, setColsOpen] = useState(false)
  const [newViewName, setNewViewName] = useState('')
  const [naming, setNaming] = useState(false)
  const [dragKey, setDragKey] = useState<ColumnKey | null>(null)
  const [overKey, setOverKey] = useState<ColumnKey | null>(null)

  // Each tab keeps its own columns/views (same keys as the web).
  useEffect(() => {
    setCols(loadCols(tabKey))
    setCustomViews(loadViews(tabKey))
    setActiveViewId(null)
    setSort(null)
    setSearch('')
  }, [tabKey])

  const viewsRef = useOutsideClose(viewsOpen, () => {
    setViewsOpen(false)
    setNaming(false)
    setNewViewName('')
  })
  const colsRef = useOutsideClose(colsOpen, () => setColsOpen(false))

  function updateCols(next: ColumnKey[]) {
    setCols(next)
    writeJson(`ads-cols-v2-${tabKey}`, next)
    setActiveViewId(null)
  }

  function applyView(view: SavedView) {
    const next = sanitizeColumns(view.columns) ?? DEFAULT_COLUMNS
    setCols(next)
    writeJson(`ads-cols-v2-${tabKey}`, next)
    setActiveViewId(view.id)
    setViewsOpen(false)
  }

  function saveView() {
    const name = newViewName.trim()
    if (!name) return
    const view: SavedView = { id: `custom-${Date.now()}`, name, columns: [...cols] }
    const next = [...customViews, view]
    setCustomViews(next)
    writeJson(`ads-views-${tabKey}`, next)
    setActiveViewId(view.id)
    setNewViewName('')
    setNaming(false)
  }

  function deleteView(id: string) {
    const next = customViews.filter((v) => v.id !== id)
    setCustomViews(next)
    writeJson(`ads-views-${tabKey}`, next)
    if (activeViewId === id) setActiveViewId(null)
  }

  function toggleColumn(key: ColumnKey) {
    if (key === 'name') return
    updateCols(cols.includes(key) ? cols.filter((k) => k !== key) : [...cols, key])
  }

  function handleSort(key: SortKey) {
    if (!sort || sort.key !== key) setSort({ key, dir: 'desc' })
    else if (sort.dir === 'desc') setSort({ key, dir: 'asc' })
    else setSort(null)
  }

  const columns = useMemo(() => cols.map((k) => COLUMN_MAP.get(k)).filter((c): c is ColumnDef => c !== undefined), [cols])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    const list = rows ?? []
    return q ? list.filter((r) => r.name.toLowerCase().includes(q)) : list
  }, [rows, search])

  const sorted = useMemo(() => {
    const key: SortKey = sort?.key ?? 'spend'
    const dir = sort?.dir ?? 'desc'
    return [...filtered].sort((a, b) => {
      const va = columnValue(a, crmMap?.get(a.id), key)
      const vb = columnValue(b, crmMap?.get(b.id), key)
      if (typeof va === 'string' && typeof vb === 'string') return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      const na = typeof va === 'number' ? va : 0
      const nb = typeof vb === 'number' ? vb : 0
      return dir === 'asc' ? na - nb : nb - na
    })
  }, [filtered, sort, crmMap])

  const allViews = [...DEFAULT_VIEWS, ...customViews]
  const activeView = activeViewId ? allViews.find((v) => v.id === activeViewId) : null
  const hidden = ALL_COLUMNS.filter((c) => !cols.includes(c.key))

  const toolbar = (
    <>
      <SearchInput value={search} onChange={setSearch} placeholder="Rechercher par nom…" />

      <div className="pub-popover-wrap" ref={viewsRef}>
        <button type="button" className="ds-pill-button" onClick={() => setViewsOpen((o) => !o)}>
          {activeView ? activeView.name : 'Vues'} ▾
        </button>
        {viewsOpen && (
          <div className="pub-popover">
            <div className="pub-popover-label">Vues par défaut</div>
            {DEFAULT_VIEWS.map((v) => (
              <button key={v.id} type="button" className={`pub-popover-item ${activeViewId === v.id ? 'pub-popover-item--active' : ''}`} onClick={() => applyView(v)}>
                {v.name}
              </button>
            ))}
            {customViews.length > 0 && (
              <>
                <div className="pub-popover-sep" />
                <div className="pub-popover-label">Mes vues</div>
                {customViews.map((v) => (
                  <div key={v.id} className="pub-popover-row">
                    <button type="button" className={`pub-popover-item ${activeViewId === v.id ? 'pub-popover-item--active' : ''}`} onClick={() => applyView(v)}>
                      {v.name}
                    </button>
                    <button type="button" className="pub-icon-btn" title="Supprimer la vue" onClick={() => deleteView(v.id)}>
                      ×
                    </button>
                  </div>
                ))}
              </>
            )}
            <div className="pub-popover-sep" />
            {naming ? (
              <div className="pub-inline-form">
                <Input
                  autoFocus
                  placeholder="Nom de la vue…"
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveView()
                  }}
                />
                <button type="button" className="ds-pill-button ds-pill-button--dark" disabled={!newViewName.trim()} onClick={saveView}>
                  OK
                </button>
              </div>
            ) : (
              <button type="button" className="pub-popover-item" onClick={() => setNaming(true)}>
                + Sauvegarder la vue actuelle
              </button>
            )}
          </div>
        )}
      </div>

      <div className="pub-popover-wrap" ref={colsRef}>
        <button type="button" className="ds-pill-button" onClick={() => setColsOpen((o) => !o)}>
          Colonnes ▾
        </button>
        {colsOpen && (
          <div className="pub-popover">
            <div className="pub-popover-label">Colonnes actives (glisser pour réordonner)</div>
            {cols.map((key, i) => {
              const col = COLUMN_MAP.get(key)
              if (!col) return null
              return (
                <div
                  key={key}
                  className={`pub-col-pill ${overKey === key && dragKey !== key ? 'pub-col-pill--over' : ''}`}
                  draggable
                  onDragStart={() => setDragKey(key)}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setOverKey(key)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (dragKey && dragKey !== key) updateCols(moveColumn(cols, dragKey, cols.indexOf(key)))
                    setDragKey(null)
                    setOverKey(null)
                  }}
                  onDragEnd={() => {
                    setDragKey(null)
                    setOverKey(null)
                  }}
                >
                  <span>⠿ {col.label}</span>
                  <button type="button" className="pub-icon-btn" disabled={i === 0} title="Monter" onClick={() => updateCols(moveColumn(cols, key, i - 1))}>
                    ↑
                  </button>
                  <button type="button" className="pub-icon-btn" disabled={i === cols.length - 1} title="Descendre" onClick={() => updateCols(moveColumn(cols, key, i + 1))}>
                    ↓
                  </button>
                  {key !== 'name' && (
                    <button type="button" className="pub-icon-btn" title="Masquer" onClick={() => toggleColumn(key)}>
                      ×
                    </button>
                  )}
                </div>
              )
            })}
            {hidden.length > 0 && (
              <>
                <div className="pub-popover-sep" />
                <div className="pub-popover-label">Colonnes masquées</div>
                {hidden.map((c) => (
                  <button key={c.key} type="button" className="pub-popover-item" onClick={() => toggleColumn(c.key)}>
                    + {c.label}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </>
  )

  function renderCell(row: MetaBreakdownRow, col: ColumnDef) {
    if (col.key === 'status') {
      const s = metaStatus(row.status)
      return (
        <td key={col.key}>
          <StatusPill label={s.label} color={s.color} bg={s.bg} />
        </td>
      )
    }
    if (col.key === 'name') {
      return (
        <td key={col.key}>
          <span className="pub-row-name pub-row-name--link" title={row.name}>
            {row.name} →
          </span>
        </td>
      )
    }
    const value = columnValue(row, crmMap?.get(row.id), col.key)
    const health = typeof value === 'number' && value !== 0 ? evaluateHealthColor(col.key, value, thresholds) : null
    const signClass =
      col.key === 'marge_brute' && typeof value === 'number' ? (value > 0 ? 'pub-positive' : value < 0 ? 'pub-negative' : '') : ''
    return (
      <td key={col.key} className={`ds-num-cell ${health ? `pub-cell--${health}` : ''}`}>
        <span className={`ds-num ${signClass}`}>{formatColumnValue(col.key, value)}</span>
      </td>
    )
  }

  return (
    <TableCard
      title={TITLES[tabKey]}
      subtitle={rows ? `${subtitle} · ${filtered.length} résultat${filtered.length !== 1 ? 's' : ''}` : subtitle}
      toolbar={toolbar}
    >
      {loading || !rows ? (
        <LoadingState label="Chargement des données Meta…" />
      ) : sorted.length === 0 ? (
        <EmptyState title={search ? 'Aucun résultat pour cette recherche' : 'Aucune donnée pour cette période'} />
      ) : (
        <table className="ds-table" style={{ width: 'max-content', minWidth: '100%' }}>
          <thead>
            <tr>
              {columns.map((col) => {
                const sortable = col.sortable && col.key !== 'status'
                const active = sort?.key === col.key
                return (
                  <th
                    key={col.key}
                    className={`${sortable ? 'ds-th-sortable' : ''} ${col.align === 'right' ? 'ds-num-cell' : ''}`}
                    onClick={sortable ? () => handleSort(col.key as SortKey) : undefined}
                  >
                    <span className="pub-th-inner">
                      {col.label}
                      <span className="pub-info" title={`${col.label} — ${col.infoText}`} onClick={(e) => e.stopPropagation()}>
                        i
                      </span>
                      {sortable && (
                        <span className={`ds-sort-indicator ${active ? 'ds-sort-indicator--active' : ''}`}>
                          {active ? (sort?.dir === 'asc' ? '▲' : '▼') : '⬍'}
                        </span>
                      )}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.id} className="ds-row-clickable" onClick={() => onRowClick(row)}>
                {columns.map((col) => renderCell(row, col))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </TableCard>
  )
}
