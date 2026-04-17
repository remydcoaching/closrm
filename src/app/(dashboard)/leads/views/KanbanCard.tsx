'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Phone, Tag as TagIcon } from 'lucide-react'
import type { Lead, WorkspaceMemberWithUser } from '@/types'
import SourceBadge from '@/components/leads/SourceBadge'

interface KanbanCardProps {
  lead: Lead
  memberMap: Map<string, WorkspaceMemberWithUser>
  onClick: () => void
}

export default function KanbanCard({ lead, memberMap, onClick }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: lead.id, data: { type: 'card', status: lead.status } })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-primary)',
    borderRadius: 10,
    padding: 10,
    cursor: 'grab',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  }

  const assignee = lead.assigned_to ? memberMap.get(lead.assigned_to) : null
  const contact = lead.phone || lead.email || '—'

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (!isDragging) {
          e.stopPropagation()
          onClick()
        }
      }}
    >
      <div style={{
        fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {lead.first_name} {lead.last_name}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <SourceBadge source={lead.source} />
        <span style={{
          fontSize: 11, color: 'var(--text-muted)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {contact}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--text-label)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Phone size={11} color={lead.call_attempts > 0 ? '#3b82f6' : 'var(--text-label)'} />
          {lead.call_attempts}
        </span>
        {lead.tags.length > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <TagIcon size={11} />
            {lead.tags[0]}{lead.tags.length > 1 ? ` +${lead.tags.length - 1}` : ''}
          </span>
        )}
        {assignee && (
          <span style={{
            marginLeft: 'auto', fontSize: 10, color: 'var(--text-tertiary)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120,
          }}>
            {assignee.user.full_name || assignee.user.email}
          </span>
        )}
      </div>
    </div>
  )
}
