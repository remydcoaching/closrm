'use client'

import { useState } from 'react'
import {
  Mail,
  MessageCircle,
  Send,
  GitBranch,
  ArrowRight,
  Tag,
  Bell,
  BarChart,
  Clock,
  X,
} from 'lucide-react'
import { WorkflowStep, WorkflowActionType } from '@/types'

export const actionLabels: Record<string, string> = {
  send_email: 'Envoyer un email',
  send_whatsapp: 'Envoyer WhatsApp',
  send_dm_instagram: 'Envoyer DM Instagram',
  create_followup: 'Créer un follow-up',
  change_lead_status: 'Changer le statut',
  add_tag: 'Ajouter un tag',
  remove_tag: 'Supprimer un tag',
  send_notification: 'Notifier le coach',
  facebook_conversions_api: 'Facebook Conversions API',
}

const actionIcons: Record<string, typeof Mail> = {
  send_email: Mail,
  send_whatsapp: MessageCircle,
  send_dm_instagram: Send,
  create_followup: GitBranch,
  change_lead_status: ArrowRight,
  add_tag: Tag,
  remove_tag: Tag,
  send_notification: Bell,
  facebook_conversions_api: BarChart,
}

const delayUnitLabels: Record<string, string> = {
  minutes: 'minutes',
  hours: 'heures',
  days: 'jours',
}

interface Props {
  step: WorkflowStep
  selected: boolean
  onClick: () => void
  onDelete: () => void
}

function getActionConfigSummary(actionType: WorkflowActionType | null, config: Record<string, unknown>): string | null {
  if (!actionType) return null
  if (actionType === 'send_email' && config.subject) return `Objet : ${config.subject}`
  if (actionType === 'send_whatsapp' && config.template) return `Template : ${config.template}`
  if (actionType === 'change_lead_status' && config.new_status) return `Nouveau statut : ${config.new_status}`
  if ((actionType === 'add_tag' || actionType === 'remove_tag') && config.tag) return `Tag : ${config.tag}`
  if (actionType === 'create_followup' && config.reason) return `Raison : ${config.reason}`
  if (actionType === 'send_dm_instagram' && config.message) return `Message : ${String(config.message).slice(0, 40)}...`
  return null
}

export default function StepBlock({ step, selected, onClick, onDelete }: Props) {
  const [hovered, setHovered] = useState(false)

  if (step.step_type === 'delay') {
    return (
      <div
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'relative',
          background: 'rgba(214,158,46,0.1)',
          border: `1px solid ${selected ? '#D69E2E' : 'rgba(214,158,46,0.3)'}`,
          borderRadius: 10,
          padding: '12px 16px',
          minWidth: 280,
          cursor: 'pointer',
          transition: 'border-color 0.15s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={16} style={{ color: '#D69E2E' }} />
          <span style={{ fontSize: 13, color: '#D69E2E', fontWeight: 500 }}>
            Attendre {step.delay_value ?? '?'} {step.delay_unit ? delayUnitLabels[step.delay_unit] || step.delay_unit : '?'}
          </span>
        </div>

        {hovered && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            style={{
              position: 'absolute',
              top: -8,
              right: -8,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: '#1a1a22',
              border: `1px solid var(--border-primary)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#ef4444',
              padding: 0,
            }}
          >
            <X size={12} />
          </button>
        )}
      </div>
    )
  }

  if (step.step_type === 'condition') {
    return (
      <div
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'relative',
          background: 'rgba(91,155,245,0.1)',
          border: `1px solid ${selected ? '#5b9bf5' : 'rgba(91,155,245,0.3)'}`,
          borderRadius: 10,
          padding: '12px 16px',
          minWidth: 280,
          cursor: 'pointer',
          transition: 'border-color 0.15s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <GitBranch size={16} style={{ color: '#5b9bf5' }} />
          <span style={{ fontSize: 13, color: '#5b9bf5', fontWeight: 500 }}>
            Si {step.condition_field ?? '...'} {step.condition_operator ?? '...'} {step.condition_value ?? '...'}
          </span>
        </div>

        {hovered && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            style={{
              position: 'absolute',
              top: -8,
              right: -8,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: '#1a1a22',
              border: `1px solid var(--border-primary)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#ef4444',
              padding: 0,
            }}
          >
            <X size={12} />
          </button>
        )}
      </div>
    )
  }

  // action step
  const IconComponent = step.action_type ? actionIcons[step.action_type] || Bell : Bell
  const configSummary = getActionConfigSummary(step.action_type, step.action_config)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        background: 'var(--bg-elevated)',
        border: `2px solid ${selected ? 'var(--color-primary)' : 'var(--border-primary)'}`,
        borderRadius: 12,
        padding: '16px 20px',
        minWidth: 320,
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <IconComponent size={16} style={{ color: '#5b9bf5' }} />
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: '#5b9bf5',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          Action
        </span>
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
        {step.action_type ? actionLabels[step.action_type] || step.action_type : 'Action non configurée'}
      </div>

      {configSummary && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
          {configSummary}
        </div>
      )}

      {hovered && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          style={{
            position: 'absolute',
            top: -8,
            right: -8,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#1a1a22',
            border: '1px solid var(--border-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#ef4444',
            padding: 0,
          }}
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}
