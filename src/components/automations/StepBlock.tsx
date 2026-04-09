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
  GripVertical,
  StickyNote,
  PhoneCall,
  CheckCircle,
  Globe,
  ListPlus,
  Timer,
} from 'lucide-react'
import { WorkflowStep, WorkflowActionType } from '@/types'

export const actionLabels: Record<string, string> = {
  send_email: 'Envoyer un email',
  send_whatsapp: 'Envoyer WhatsApp',
  send_dm_instagram: 'Envoyer DM Instagram',
  create_followup: 'Creer un follow-up',
  change_lead_status: 'Changer le statut',
  add_tag: 'Ajouter un tag',
  remove_tag: 'Supprimer un tag',
  send_notification: 'Notifier le coach',
  facebook_conversions_api: 'Facebook Conversions API',
  enroll_in_sequence: 'Inscrire dans une sequence',
  add_note: 'Ajouter une note',
  set_reached: 'Marquer comme joint',
  schedule_call: 'Planifier un appel',
  webhook: 'Appeler un webhook',
  create_google_meet: 'Creer un Google Meet',
  update_lead_field: 'Modifier un champ',
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
  enroll_in_sequence: ListPlus,
  add_note: StickyNote,
  set_reached: CheckCircle,
  schedule_call: PhoneCall,
  webhook: Globe,
  create_google_meet: Globe,
  update_lead_field: ArrowRight,
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
  dragHandleRef?: (node: HTMLElement | null) => void
  dragHandleListeners?: Record<string, unknown>
}

function getActionConfigSummary(actionType: WorkflowActionType | null, config: Record<string, unknown>): string | null {
  if (!actionType) return null
  if (actionType === 'send_email' && config.subject) return `Objet : ${config.subject}`
  if (actionType === 'send_whatsapp' && config.template) return `Template : ${config.template}`
  if (actionType === 'change_lead_status' && config.new_status) return `Nouveau statut : ${config.new_status}`
  if ((actionType === 'add_tag' || actionType === 'remove_tag') && config.tag) return `Tag : ${config.tag}`
  if (actionType === 'create_followup' && config.reason) return `Raison : ${config.reason}`
  if (actionType === 'send_dm_instagram' && config.message) return `Message : ${String(config.message).slice(0, 40)}...`
  if (actionType === 'add_note' && config.note) return `Note : ${String(config.note).slice(0, 40)}...`
  if (actionType === 'schedule_call' && config.call_type) return `Type : ${config.call_type === 'setting' ? 'Setting' : 'Closing'}`
  if (actionType === 'set_reached') return 'Joint = Oui'
  if (actionType === 'webhook' && config.url) return `URL : ${String(config.url).slice(0, 40)}...`
  return null
}

function DragHandle({ handleRef, listeners }: { handleRef?: (node: HTMLElement | null) => void; listeners?: Record<string, unknown> }) {
  return (
    <div
      ref={handleRef}
      {...listeners}
      style={{
        cursor: 'grab',
        color: 'var(--text-label)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 2px',
        touchAction: 'none',
        opacity: 0.5,
        transition: 'opacity 0.15s',
      }}
    >
      <GripVertical size={14} />
    </div>
  )
}

function DeleteButton({ onClick, visible }: { onClick: () => void; visible: boolean }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      style={{
        position: 'absolute', top: -8, right: -8,
        width: 22, height: 22, borderRadius: '50%',
        background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: '#ef4444', padding: 0,
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1)' : 'scale(0.8)',
        transition: 'all 0.15s ease',
        pointerEvents: visible ? 'auto' : 'none',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <X size={12} />
    </button>
  )
}

export default function StepBlock({ step, selected, onClick, onDelete, dragHandleRef, dragHandleListeners }: Props) {
  const [hovered, setHovered] = useState(false)

  if (step.step_type === 'delay') {
    return (
      <div
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'relative',
          background: selected ? 'rgba(214,158,46,0.12)' : 'rgba(214,158,46,0.06)',
          border: `2px solid ${selected ? '#D69E2E' : 'rgba(214,158,46,0.2)'}`,
          borderRadius: 12,
          padding: '14px 18px',
          minWidth: 280,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: selected ? '0 0 0 3px rgba(214,158,46,0.06)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <DragHandle handleRef={dragHandleRef} listeners={dragHandleListeners} />
          <div style={{
            width: 26, height: 26, borderRadius: 6,
            background: 'rgba(214,158,46,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Clock size={14} style={{ color: '#D69E2E' }} />
          </div>
          <span style={{ fontSize: 13, color: '#D69E2E', fontWeight: 500 }}>
            Attendre {step.delay_value ?? '?'} {step.delay_unit ? delayUnitLabels[step.delay_unit] || step.delay_unit : '?'}
          </span>
        </div>

        <DeleteButton onClick={onDelete} visible={hovered} />
      </div>
    )
  }

  if (step.step_type === 'wait_for_event') {
    const eventLabels: Record<string, string> = {
      before_call: 'avant l\'appel',
      before_booking: 'avant le RDV',
      lead_status_is: 'statut du lead =',
      tag_present: 'tag present :',
    }
    const eventType = (step.action_config?.event_type as string) || ''
    const hoursBefore = (step.action_config?.hours_before as number) || 0

    return (
      <div
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'relative',
          background: selected ? 'rgba(249,115,22,0.12)' : 'rgba(249,115,22,0.06)',
          border: `2px solid ${selected ? '#F97316' : 'rgba(249,115,22,0.2)'}`,
          borderRadius: 12,
          padding: '14px 18px',
          minWidth: 280,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: selected ? '0 0 0 3px rgba(249,115,22,0.06)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {dragHandleRef && <DragHandle handleRef={dragHandleRef} listeners={dragHandleListeners} />}
          <div style={{
            width: 26, height: 26, borderRadius: 6,
            background: 'rgba(249,115,22,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Timer size={14} style={{ color: '#F97316' }} />
          </div>
          <span style={{ fontSize: 13, color: '#F97316', fontWeight: 500 }}>
            {hoursBefore}h {eventLabels[eventType] || eventType || 'evenement...'}
          </span>
        </div>

        <DeleteButton onClick={onDelete} visible={hovered} />
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
          background: selected ? 'rgba(139,92,246,0.12)' : 'rgba(139,92,246,0.06)',
          border: `2px solid ${selected ? '#8B5CF6' : 'rgba(139,92,246,0.2)'}`,
          borderRadius: 12,
          padding: '14px 18px',
          minWidth: 280,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: selected ? '0 0 0 3px rgba(139,92,246,0.06)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <DragHandle handleRef={dragHandleRef} listeners={dragHandleListeners} />
          <div style={{
            width: 26, height: 26, borderRadius: 6,
            background: 'rgba(139,92,246,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <GitBranch size={14} style={{ color: '#8B5CF6' }} />
          </div>
          <span style={{ fontSize: 13, color: '#8B5CF6', fontWeight: 500 }}>
            Si {step.condition_field ?? '...'} {step.condition_operator ?? '...'} {step.condition_value ?? '...'}
          </span>
        </div>

        <DeleteButton onClick={onDelete} visible={hovered} />
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
        background: selected ? 'rgba(91,155,245,0.06)' : 'var(--bg-elevated)',
        border: `2px solid ${selected ? '#5b9bf5' : 'var(--border-primary)'}`,
        borderRadius: 14,
        padding: '18px 22px',
        minWidth: 320,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: selected ? '0 0 0 3px rgba(91,155,245,0.06)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <DragHandle handleRef={dragHandleRef} listeners={dragHandleListeners} />
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: 'rgba(91,155,245,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <IconComponent size={14} style={{ color: '#5b9bf5' }} />
        </div>
        <span
          style={{
            fontSize: 10, fontWeight: 700, color: '#5b9bf5',
            textTransform: 'uppercase', letterSpacing: '0.12em',
          }}
        >
          Action
        </span>
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', paddingLeft: 36 }}>
        {step.action_type ? actionLabels[step.action_type] || step.action_type : 'Action non configuree'}
      </div>

      {configSummary && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, paddingLeft: 36 }}>
          {configSummary}
        </div>
      )}

      <DeleteButton onClick={onDelete} visible={hovered} />
    </div>
  )
}
