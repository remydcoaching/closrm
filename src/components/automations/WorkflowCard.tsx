'use client'

import { useState } from 'react'
import { Play, Pause, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Workflow } from '@/types'
import WorkflowStatusBadge from './WorkflowStatusBadge'

export const triggerLabels: Record<string, string> = {
  new_lead: 'Nouveau lead',
  lead_status_changed: 'Changement de statut',
  tag_added: 'Tag ajouté',
  tag_removed: 'Tag supprimé',
  deal_won: 'Deal gagné',
  call_scheduled: 'Appel planifié',
  call_in_x_hours: 'Rappel avant appel',
  call_no_show: 'No-show',
  call_outcome_logged: 'Résultat d\'appel',
  followup_pending_x_days: 'Follow-up en attente',
  new_follower: 'Nouveau follower',
  dm_keyword: 'DM avec mot-clé',
  comment_keyword: 'Commentaire avec mot-clé',
  booking_created: 'Réservation créée',
  booking_cancelled: 'Réservation annulée',
}

interface Props {
  workflow: Workflow
  onActivate: (id: string) => void
  onDeactivate: (id: string) => void
  onDelete: (id: string) => void
  onClick: (id: string) => void
}

export default function WorkflowCard({ workflow, onActivate, onDeactivate, onDelete, onClick }: Props) {
  const [hovered, setHovered] = useState(false)
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null)

  const lastRunFormatted = workflow.last_run_at
    ? format(new Date(workflow.last_run_at), 'dd MMM yyyy à HH:mm', { locale: fr })
    : 'Jamais'

  return (
    <div
      style={{
        background: hovered ? 'var(--bg-hover)' : 'var(--bg-elevated)',
        border: '1px solid var(--border-primary)',
        borderRadius: 12,
        padding: 20,
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onClick(workflow.id)}
    >
      {/* Top row: name + badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{workflow.name}</span>
        <WorkflowStatusBadge status={workflow.status} />
      </div>

      {/* Trigger type */}
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>
        {triggerLabels[workflow.trigger_type] || workflow.trigger_type}
      </div>

      {/* Description */}
      {workflow.description && (
        <div style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          marginTop: 6,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}>
          {workflow.description}
        </div>
      )}

      {/* Bottom row: stats + actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
        <span style={{ fontSize: 11, color: 'var(--text-label)' }}>
          {'\u25B6'} {workflow.execution_count} exécutions · {lastRunFormatted}
        </span>

        <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
          {workflow.status !== 'actif' ? (
            <button
              title="Activer"
              style={{
                width: 28, height: 28, borderRadius: 6,
                border: '1px solid var(--border-primary)',
                background: hoveredBtn === 'play' ? 'rgba(0,200,83,0.1)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--color-primary)',
              }}
              onMouseEnter={() => setHoveredBtn('play')}
              onMouseLeave={() => setHoveredBtn(null)}
              onClick={() => onActivate(workflow.id)}
            >
              <Play size={14} />
            </button>
          ) : (
            <button
              title="Désactiver"
              style={{
                width: 28, height: 28, borderRadius: 6,
                border: '1px solid var(--border-primary)',
                background: hoveredBtn === 'pause' ? 'rgba(214,158,46,0.1)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#D69E2E',
              }}
              onMouseEnter={() => setHoveredBtn('pause')}
              onMouseLeave={() => setHoveredBtn(null)}
              onClick={() => onDeactivate(workflow.id)}
            >
              <Pause size={14} />
            </button>
          )}
          <button
            title="Supprimer"
            style={{
              width: 28, height: 28, borderRadius: 6,
              border: '1px solid var(--border-primary)',
              background: hoveredBtn === 'delete' ? 'rgba(239,68,68,0.1)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#ef4444',
            }}
            onMouseEnter={() => setHoveredBtn('delete')}
            onMouseLeave={() => setHoveredBtn(null)}
            onClick={() => onDelete(workflow.id)}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
