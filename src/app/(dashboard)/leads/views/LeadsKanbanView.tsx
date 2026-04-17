'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import type { Lead, LeadStatus, LeadSource, WorkspaceMemberWithUser } from '@/types'
import KanbanColumn from './KanbanColumn'
import KanbanCard from './KanbanCard'
import type { DateFilterPref } from '@/lib/ui-prefs/leads-prefs'

interface ColumnData {
  leads: Lead[]
  total: number
  loadedCount: number
}

export interface LeadsKanbanViewProps {
  visibleStatuses: LeadStatus[]
  search: string
  sources: LeadSource[]
  assignedTo?: string
  dateFilter: DateFilterPref
  refreshKey: number
  memberMap: Map<string, WorkspaceMemberWithUser>
  onCardClick: (leadId: string) => void
  onStatusChange: (lead: Lead, newStatus: LeadStatus) => void
  onRequestClose: (lead: Lead) => void
}

const LIMIT = 25

export default function LeadsKanbanView(props: LeadsKanbanViewProps) {
  const {
    visibleStatuses, search, sources, assignedTo, dateFilter, refreshKey,
    memberMap, onCardClick, onStatusChange, onRequestClose,
  } = props

  const [columns, setColumns] = useState<Record<string, ColumnData>>({})
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState<Record<string, boolean>>({})
  const [activeCardId, setActiveCardId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const buildCommonParams = useCallback(() => {
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    if (sources.length > 0) p.set('source', sources.join(','))
    if (assignedTo) p.set('assigned_to', assignedTo)
    if (dateFilter.from) p.set('date_from', dateFilter.from)
    if (dateFilter.to)   p.set('date_to', dateFilter.to)
    p.set('date_field', dateFilter.field)
    return p
  }, [search, sources, assignedTo, dateFilter])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const params = buildCommonParams()
        params.set('limit_per_status', String(LIMIT))
        const res = await fetch(`/api/leads/grouped?${params.toString()}`)
        const json = await res.json()
        if (cancelled || !res.ok) return
        const cols: Record<string, ColumnData> = {}
        for (const status of visibleStatuses) {
          const c = json.columns?.[status]
          cols[status] = {
            leads: c?.leads ?? [],
            total: c?.total ?? 0,
            loadedCount: (c?.leads ?? []).length,
          }
        }
        setColumns(cols)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [buildCommonParams, visibleStatuses, refreshKey])

  async function loadMore(status: LeadStatus) {
    const col = columns[status]
    if (!col) return
    setLoadingMore(m => ({ ...m, [status]: true }))
    try {
      const params = buildCommonParams()
      params.set('status', status)
      params.set('per_page', String(LIMIT))
      params.set('page', String(Math.floor(col.loadedCount / LIMIT) + 1))
      const res = await fetch(`/api/leads?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) return
      setColumns(prev => ({
        ...prev,
        [status]: {
          leads: [...prev[status].leads, ...(json.data ?? [])],
          total: prev[status].total,
          loadedCount: prev[status].loadedCount + (json.data?.length ?? 0),
        },
      }))
    } finally {
      setLoadingMore(m => ({ ...m, [status]: false }))
    }
  }

  const leadById = useMemo(() => {
    const m = new Map<string, { lead: Lead; status: LeadStatus }>()
    for (const status of Object.keys(columns) as LeadStatus[]) {
      for (const lead of columns[status].leads) m.set(lead.id, { lead, status })
    }
    return m
  }, [columns])

  function onDragStart(e: DragStartEvent) {
    setActiveCardId(String(e.active.id))
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveCardId(null)
    const { active, over } = e
    if (!over) return
    const entry = leadById.get(String(active.id))
    if (!entry) return

    let targetStatus: LeadStatus | null = null
    if (typeof over.id === 'string' && over.id.startsWith('col:')) {
      targetStatus = over.id.slice(4) as LeadStatus
    } else {
      const overEntry = leadById.get(String(over.id))
      if (overEntry) targetStatus = overEntry.status
    }
    if (!targetStatus || targetStatus === entry.status) return

    if (targetStatus === 'clos') {
      onRequestClose(entry.lead)
      return
    }

    moveCardOptimistically(entry.lead.id, entry.status, targetStatus)
    onStatusChange(entry.lead, targetStatus)
  }

  function moveCardOptimistically(leadId: string, from: LeadStatus, to: LeadStatus) {
    setColumns(prev => {
      const src = prev[from]
      const dst = prev[to]
      if (!src || !dst) return prev
      const leadIndex = src.leads.findIndex(l => l.id === leadId)
      if (leadIndex < 0) return prev
      const lead = { ...src.leads[leadIndex], status: to }
      return {
        ...prev,
        [from]: {
          ...src,
          leads: src.leads.filter(l => l.id !== leadId),
          total: src.total - 1,
          loadedCount: src.loadedCount - 1,
        },
        [to]: {
          ...dst,
          leads: [lead, ...dst.leads],
          total: dst.total + 1,
          loadedCount: dst.loadedCount + 1,
        },
      }
    })
  }

  const activeCard = activeCardId ? leadById.get(activeCardId)?.lead : null

  if (loading && Object.keys(columns).length === 0) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-label)' }}>Chargement du kanban…</div>
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
        {visibleStatuses.map(status => {
          const col = columns[status] ?? { leads: [], total: 0, loadedCount: 0 }
          return (
            <KanbanColumn
              key={status}
              status={status}
              leads={col.leads}
              total={col.total}
              memberMap={memberMap}
              onCardClick={onCardClick}
              onLoadMore={() => loadMore(status)}
              loadingMore={loadingMore[status]}
            />
          )
        })}
      </div>
      <DragOverlay>
        {activeCard
          ? <KanbanCard lead={activeCard} memberMap={memberMap} onClick={() => {}} />
          : null}
      </DragOverlay>
    </DndContext>
  )
}
