'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Plus, Zap, Clock, GitBranch, Timer,
  Mail, MessageCircle, Camera, Tag, TagIcon, Bell,
  ListChecks, StickyNote, PhoneCall, Webhook, UserCog, Flag,
} from 'lucide-react'
import { WorkflowStepType, WorkflowActionType } from '@/types'

export interface AddStepPayload {
  stepType: WorkflowStepType
  actionType?: WorkflowActionType
  actionConfig?: Record<string, unknown>
}

interface Props {
  onAdd: (payload: AddStepPayload) => void
}

type CategoryKey = WorkflowStepType

interface Category {
  key: CategoryKey
  label: string
  desc: string
  icon: typeof Zap
  color: string
  bg: string
}

const CATEGORIES: Category[] = [
  { key: 'action',         label: 'Action',    desc: 'Envoyer / modifier',  icon: Zap,       color: '#5b9bf5', bg: 'rgba(91,155,245,0.12)' },
  { key: 'delay',          label: 'Délai',     desc: 'Attendre X temps',    icon: Clock,     color: '#D69E2E', bg: 'rgba(214,158,46,0.12)' },
  { key: 'condition',      label: 'Condition', desc: 'Si / sinon',          icon: GitBranch, color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
  { key: 'wait_for_event', label: 'Attendre',  desc: 'Avant un événement',  icon: Timer,     color: '#F97316', bg: 'rgba(249,115,22,0.12)' },
]

interface SubItem {
  actionType?: WorkflowActionType
  actionConfig?: Record<string, unknown>
  label: string
  desc: string
  icon: typeof Zap
  color: string
  bg: string
}

const ACTION_ITEMS: SubItem[] = [
  { actionType: 'send_email',         label: 'Envoyer un email',    desc: 'Template personnalisable',   icon: Mail,          color: '#5b9bf5', bg: 'rgba(91,155,245,0.15)' },
  { actionType: 'send_whatsapp',      label: 'Envoyer WhatsApp',    desc: 'Via Meta Cloud API',         icon: MessageCircle, color: '#38A169', bg: 'rgba(56,161,105,0.15)' },
  { actionType: 'send_dm_instagram',  label: 'Instagram DM',        desc: 'Message direct auto',        icon: Camera,        color: '#EC4899', bg: 'rgba(236,72,153,0.15)' },
  { actionType: 'change_lead_status', label: 'Changer le statut',   desc: 'Mettre à jour le pipeline',  icon: Flag,          color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' },
  { actionType: 'add_tag',            label: 'Ajouter un tag',      desc: 'Tagger le lead',             icon: Tag,           color: '#38A169', bg: 'rgba(56,161,105,0.15)' },
  { actionType: 'remove_tag',         label: 'Retirer un tag',      desc: 'Enlever un tag du lead',     icon: TagIcon,       color: '#E53E3E', bg: 'rgba(229,62,62,0.15)' },
  { actionType: 'create_followup',    label: 'Créer un follow-up',  desc: 'Programmer une relance',     icon: ListChecks,    color: '#F97316', bg: 'rgba(249,115,22,0.15)' },
  { actionType: 'send_notification',  label: 'Notifier le coach',   desc: 'Telegram ou WhatsApp',       icon: Bell,          color: '#E53E3E', bg: 'rgba(229,62,62,0.15)' },
  { actionType: 'add_note',           label: 'Ajouter une note',    desc: 'Sur la fiche du lead',       icon: StickyNote,    color: '#D69E2E', bg: 'rgba(214,158,46,0.15)' },
  { actionType: 'schedule_call',      label: 'Planifier un appel',  desc: 'Créer un RDV',               icon: PhoneCall,     color: '#5b9bf5', bg: 'rgba(91,155,245,0.15)' },
  { actionType: 'update_lead_field',  label: 'MAJ champ du lead',   desc: 'Ex: email, téléphone…',      icon: UserCog,       color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' },
  { actionType: 'webhook',            label: 'Webhook',             desc: 'POST vers une URL externe',  icon: Webhook,       color: '#9CA3AF', bg: 'rgba(160,160,160,0.12)' },
]

const WAIT_ITEMS: SubItem[] = [
  { actionConfig: { event_type: 'before_call',    hours_before: 24 }, label: 'Avant un appel',   desc: 'X heures avant l\'appel prévu', icon: PhoneCall, color: '#F97316', bg: 'rgba(249,115,22,0.15)' },
  { actionConfig: { event_type: 'before_booking', hours_before: 24 }, label: 'Avant un RDV',     desc: 'X heures avant le rendez-vous', icon: Timer,     color: '#F97316', bg: 'rgba(249,115,22,0.15)' },
  { actionConfig: { event_type: 'lead_status_is' },                   label: 'Statut du lead',   desc: 'Jusqu\'à un certain statut',    icon: Flag,      color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' },
  { actionConfig: { event_type: 'tag_present' },                      label: 'Tag présent',      desc: 'Jusqu\'à ce qu\'un tag existe', icon: Tag,       color: '#38A169', bg: 'rgba(56,161,105,0.15)' },
]

export default function AddStepButton({ onAdd }: Props) {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [category, setCategory] = useState<CategoryKey>('action')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function pick(payload: AddStepPayload) {
    onAdd(payload)
    setOpen(false)
  }

  const activeCat = CATEGORIES.find(c => c.key === category)!

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
      <button
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label="Ajouter une étape"
        style={{
          width: 32, height: 32, borderRadius: '50%',
          border: `2px dashed ${hovered || open ? '#E53E3E' : 'var(--border-primary)'}`,
          background: hovered || open ? 'rgba(229,62,62,0.06)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          color: hovered || open ? '#E53E3E' : 'var(--text-label)',
          transition: 'all 0.2s ease',
          padding: 0,
        }}
      >
        <Plus size={16} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 40,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-primary)',
            borderRadius: 14,
            padding: 14,
            zIndex: 20,
            width: 560,
            maxWidth: 'calc(100vw - 40px)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon
              const active = cat.key === category
              return (
                <button
                  key={cat.key}
                  onClick={() => setCategory(cat.key)}
                  style={{
                    background: active ? cat.bg : 'var(--bg-surface)',
                    border: `1px solid ${active ? cat.color : 'var(--border-primary)'}`,
                    borderRadius: 10,
                    padding: '10px 6px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                  }}
                >
                  <div style={{
                    width: 30, height: 30, borderRadius: 7,
                    background: cat.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 6px',
                  }}>
                    <Icon size={15} style={{ color: cat.color }} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: active ? cat.color : 'var(--text-primary)' }}>
                    {cat.label}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                    {cat.desc}
                  </div>
                </button>
              )
            })}
          </div>

          <div style={{
            fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em',
            color: 'var(--text-muted)', marginBottom: 8, padding: '0 4px',
          }}>
            {category === 'action' && 'Actions disponibles'}
            {category === 'wait_for_event' && 'Types d\'événement'}
            {category === 'delay' && 'Configuration'}
            {category === 'condition' && 'Configuration'}
          </div>

          {category === 'action' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
              {ACTION_ITEMS.map((it) => (
                <SubItemButton key={it.actionType} item={it} onClick={() => pick({ stepType: 'action', actionType: it.actionType })} />
              ))}
            </div>
          )}

          {category === 'wait_for_event' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {WAIT_ITEMS.map((it) => (
                <SubItemButton
                  key={it.label}
                  item={it}
                  onClick={() => pick({ stepType: 'wait_for_event', actionConfig: it.actionConfig })}
                />
              ))}
            </div>
          )}

          {category === 'delay' && (
            <button
              onClick={() => pick({ stepType: 'delay' })}
              style={bigCtaStyle(activeCat.color, activeCat.bg)}
            >
              <Clock size={16} style={{ color: activeCat.color }} />
              <span>Ajouter un délai</span>
            </button>
          )}

          {category === 'condition' && (
            <button
              onClick={() => pick({ stepType: 'condition' })}
              style={bigCtaStyle(activeCat.color, activeCat.bg)}
            >
              <GitBranch size={16} style={{ color: activeCat.color }} />
              <span>Ajouter une condition Si / Sinon</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function SubItemButton({ item, onClick }: { item: SubItem; onClick: () => void }) {
  const Icon = item.icon
  const [h, setH] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: 10, borderRadius: 8,
        background: h ? 'var(--bg-hover)' : 'var(--bg-surface)',
        border: `1px solid ${h ? 'var(--border-primary)' : 'transparent'}`,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.12s',
        width: '100%',
      }}
    >
      <div style={{
        width: 30, height: 30, borderRadius: 7,
        background: item.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={14} style={{ color: item.color }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{item.desc}</div>
      </div>
    </button>
  )
}

function bigCtaStyle(color: string, bg: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    width: '100%', padding: '14px',
    background: bg, border: `1px solid ${color}`, borderRadius: 10,
    color, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  }
}
