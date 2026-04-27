'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Lead, LeadStatus, WorkspaceMemberWithUser } from '@/types'
import { useStatusEntry } from '@/lib/workspace/config-context'
import KanbanCard from './KanbanCard'

interface KanbanColumnProps {
  status: LeadStatus
  leads: Lead[]
  total: number
  memberMap: Map<string, WorkspaceMemberWithUser>
  onCardClick: (leadId: string) => void
  onLoadMore?: () => void
  loadingMore?: boolean
}

export default function KanbanColumn({
  status, leads, total, memberMap, onCardClick, onLoadMore, loadingMore,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status}`, data: { type: 'column', status } })
  const cfg = useStatusEntry(status)
  const hasMore = total > leads.length

  return (
    <div
      ref={setNodeRef}
      style={{
        minWidth: 280, maxWidth: 280, flexShrink: 0,
        background: isOver ? 'var(--bg-hover)' : 'transparent',
        border: 'none',
        borderRadius: 0, padding: 0,
        display: 'flex', flexDirection: 'column', gap: 10,
        maxHeight: 'calc(100vh - 220px)',
        transition: 'background 0.1s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color as string, flexShrink: 0 }} />
        <span style={{
          fontSize: 12, fontWeight: 700, color: 'var(--text-primary)',
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          {cfg.label}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-label)' }}>
          {total}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', paddingRight: 2 }}>
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map(l => (
            <KanbanCard key={l.id} lead={l} memberMap={memberMap} onClick={() => onCardClick(l.id)} />
          ))}
        </SortableContext>

        {hasMore && (
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            style={{
              padding: '7px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600,
              background: 'transparent', border: '1px dashed var(--border-primary)',
              color: 'var(--text-label)', cursor: loadingMore ? 'wait' : 'pointer',
            }}
          >
            {loadingMore ? 'Chargement…' : `Voir plus (+${total - leads.length})`}
          </button>
        )}
      </div>
    </div>
  )
}
