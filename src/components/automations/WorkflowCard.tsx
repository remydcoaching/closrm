'use client'

import { useState } from 'react'
import {
  Play, Pause, Trash2, Zap, UserPlus, ArrowRight, Tag,
  Phone, Clock, PhoneMissed, MessageCircle, Bell, Calendar,
  UserCheck, Hash, Activity,
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Workflow } from '@/types'
import WorkflowStatusBadge from './WorkflowStatusBadge'

export const triggerLabels: Record<string, string> = {
  new_lead: 'Nouveau lead',
  lead_imported: 'Leads importes',
  lead_status_changed: 'Changement de statut',
  tag_added: 'Tag ajoute',
  tag_removed: 'Tag supprime',
  deal_won: 'Deal gagne',
  lead_with_ig_handle: 'Lead avec pseudo IG',
  lead_inactive_x_days: 'Lead inactif',
  call_scheduled: 'Appel planifie',
  call_in_x_hours: 'Rappel avant appel',
  call_no_show: 'No-show appel',
  call_outcome_logged: "Resultat d'appel",
  followup_pending_x_days: 'Follow-up en attente',
  new_follower: 'Nouveau follower',
  dm_keyword: 'DM avec mot-cle',
  comment_keyword: 'Commentaire mot-cle',
  booking_created: 'Rendez-vous créé',
  booking_cancelled: 'Rendez-vous annulé',
  booking_no_show: 'No-show rendez-vous',
  booking_completed: 'Rendez-vous terminé',
  booking_in_x_hours: 'Rappel avant rendez-vous',
}

const triggerIcons: Record<string, typeof Zap> = {
  new_lead: UserPlus,
  lead_imported: UserPlus,
  lead_status_changed: ArrowRight,
  tag_added: Tag,
  tag_removed: Tag,
  deal_won: Activity,
  lead_with_ig_handle: Hash,
  lead_inactive_x_days: Clock,
  call_scheduled: Phone,
  call_in_x_hours: Clock,
  call_no_show: PhoneMissed,
  call_outcome_logged: Phone,
  followup_pending_x_days: Clock,
  new_follower: UserCheck,
  dm_keyword: MessageCircle,
  comment_keyword: MessageCircle,
  booking_created: Calendar,
  booking_cancelled: Calendar,
  booking_no_show: Bell,
  booking_completed: Calendar,
  booking_in_x_hours: Clock,
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
    ? format(new Date(workflow.last_run_at), 'dd MMM yyyy, HH:mm', { locale: fr })
    : 'Jamais'

  const TriggerIcon = triggerIcons[workflow.trigger_type] || Zap

  return (
    <div
      style={{
        background: hovered ? 'var(--bg-hover)' : 'var(--bg-elevated)',
        border: `1px solid ${hovered ? 'var(--border-secondary, #333)' : 'var(--border-primary)'}`,
        borderRadius: 14,
        padding: 0,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        overflow: 'hidden',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onClick(workflow.id)}
    >
      <div style={{ padding: '20px 22px' }}>
        {/* Header: name + badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <span style={{
            fontWeight: 600,
            color: 'var(--text-primary)',
            fontSize: 14,
            lineHeight: 1.4,
            flex: 1,
            marginRight: 10,
          }}>
            {workflow.name}
          </span>
          <WorkflowStatusBadge status={workflow.status} />
        </div>

        {/* Trigger chip */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 10px',
          borderRadius: 6,
          background: 'var(--bg-hover)',
          border: '1px solid var(--border-primary)',
          marginBottom: 10,
        }}>
          <TriggerIcon size={13} style={{ color: 'var(--text-secondary)' }} />
          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>
            {triggerLabels[workflow.trigger_type] || workflow.trigger_type}
          </span>
        </div>

        {/* Description */}
        {workflow.description && (
          <div style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            marginBottom: 10,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            lineHeight: 1.5,
          }}>
            {workflow.description}
          </div>
        )}

        {/* Stats row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginTop: 14,
          paddingTop: 14,
          borderTop: '1px solid var(--border-primary)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Activity size={12} style={{ color: 'var(--text-label)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-label)' }}>
              {workflow.execution_count ?? 0} exec.
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Clock size={12} style={{ color: 'var(--text-label)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-label)' }}>
              {lastRunFormatted}
            </span>
          </div>

          <div style={{ flex: 1 }} />

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
            {workflow.status !== 'actif' ? (
              <button
                title="Activer"
                style={{
                  width: 30, height: 30, borderRadius: 7,
                  border: '1px solid var(--border-primary)',
                  background: hoveredBtn === 'play' ? 'rgba(56,161,105,0.12)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: '#38A169',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={() => setHoveredBtn('play')}
                onMouseLeave={() => setHoveredBtn(null)}
                onClick={() => onActivate(workflow.id)}
              >
                <Play size={13} />
              </button>
            ) : (
              <button
                title="Desactiver"
                style={{
                  width: 30, height: 30, borderRadius: 7,
                  border: '1px solid var(--border-primary)',
                  background: hoveredBtn === 'pause' ? 'rgba(214,158,46,0.12)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: '#D69E2E',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={() => setHoveredBtn('pause')}
                onMouseLeave={() => setHoveredBtn(null)}
                onClick={() => onDeactivate(workflow.id)}
              >
                <Pause size={13} />
              </button>
            )}
            <button
              title="Supprimer"
              style={{
                width: 30, height: 30, borderRadius: 7,
                border: '1px solid var(--border-primary)',
                background: hoveredBtn === 'delete' ? 'rgba(239,68,68,0.10)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: hoveredBtn === 'delete' ? '#ef4444' : 'var(--text-label)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={() => setHoveredBtn('delete')}
              onMouseLeave={() => setHoveredBtn(null)}
              onClick={() => onDelete(workflow.id)}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
