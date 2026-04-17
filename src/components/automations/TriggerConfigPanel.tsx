'use client'

import { useState, useEffect } from 'react'
import {
  Zap, Users, Calendar, ListChecks, Camera,
  Sparkles, Package, RefreshCw, Tag, TagIcon, Clock,
  DollarSign, CalendarPlus, CalendarX,
  CalendarClock, UserPlus, MessageCircle, Hash, PhoneCall, CheckCircle2,
} from 'lucide-react'
import type { WorkflowTriggerType, BookingCalendar } from '@/types'

interface Props {
  triggerType: WorkflowTriggerType
  triggerConfig: Record<string, unknown>
  onChange: (triggerType: WorkflowTriggerType, triggerConfig: Record<string, unknown>) => void
}

type CategoryKey = 'leads' | 'rdv' | 'followup' | 'instagram'

interface Category {
  key: CategoryKey
  label: string
  icon: typeof Zap
  color: string
  bg: string
}

const CATEGORIES: Category[] = [
  { key: 'leads',     label: 'Leads',     icon: Users,      color: '#5b9bf5', bg: 'rgba(91,155,245,0.12)' },
  { key: 'rdv',       label: 'RDV',       icon: Calendar,   color: '#F97316', bg: 'rgba(249,115,22,0.12)' },
  { key: 'followup',  label: 'Follow-up', icon: ListChecks, color: '#D69E2E', bg: 'rgba(214,158,46,0.12)' },
  { key: 'instagram', label: 'Instagram', icon: Camera,     color: '#EC4899', bg: 'rgba(236,72,153,0.12)' },
]

interface TriggerItem {
  type: WorkflowTriggerType
  label: string
  desc: string
  icon: typeof Zap
  color: string
  bg: string
}

const TRIGGERS_BY_CATEGORY: Record<CategoryKey, TriggerItem[]> = {
  leads: [
    { type: 'new_lead',             label: 'Nouveau lead',           desc: 'Un lead vient d\'arriver',         icon: Sparkles,  color: '#E53E3E', bg: 'rgba(229,62,62,0.15)' },
    { type: 'lead_imported',        label: 'Leads importés en bulk', desc: 'Après un import CSV/Meta',         icon: Package,   color: '#5b9bf5', bg: 'rgba(91,155,245,0.15)' },
    { type: 'lead_status_changed',  label: 'Changement de statut',   desc: 'Lead passe d\'un état à l\'autre', icon: RefreshCw, color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' },
    { type: 'tag_added',            label: 'Tag ajouté',             desc: 'Un tag est attribué',              icon: Tag,       color: '#38A169', bg: 'rgba(56,161,105,0.15)' },
    { type: 'tag_removed',          label: 'Tag retiré',             desc: 'Un tag est enlevé',                icon: TagIcon,   color: '#E53E3E', bg: 'rgba(229,62,62,0.15)' },
    { type: 'lead_inactive_x_days', label: 'Lead inactif X jours',   desc: 'Aucune activité depuis N jours',   icon: Clock,     color: '#D69E2E', bg: 'rgba(214,158,46,0.15)' },
    { type: 'lead_with_ig_handle',  label: 'Lead avec pseudo IG',    desc: 'Handle Instagram détecté',         icon: Camera,    color: '#EC4899', bg: 'rgba(236,72,153,0.15)' },
    { type: 'deal_won',             label: 'Deal gagné',             desc: 'Lead passe au statut closé',       icon: DollarSign, color: '#38A169', bg: 'rgba(56,161,105,0.15)' },
  ],
  rdv: [
    { type: 'booking_created',      label: 'RDV créé',                 desc: 'Un rendez-vous est pris',     icon: CalendarPlus,  color: '#38A169', bg: 'rgba(56,161,105,0.15)' },
    { type: 'booking_in_x_hours',   label: 'Avant un RDV',             desc: 'Rappel X heures avant',       icon: CalendarClock, color: '#F97316', bg: 'rgba(249,115,22,0.15)' },
    { type: 'booking_cancelled',    label: 'RDV annulé',               desc: 'Un rendez-vous est annulé',   icon: CalendarX,     color: '#E53E3E', bg: 'rgba(229,62,62,0.15)' },
    { type: 'booking_no_show',      label: 'No-show RDV',              desc: 'Le prospect ne vient pas',    icon: CalendarX,     color: '#E53E3E', bg: 'rgba(229,62,62,0.15)' },
    { type: 'call_outcome_logged',  label: 'Résultat d\'appel loggé',  desc: 'Le closer note un résultat',  icon: PhoneCall,     color: '#5b9bf5', bg: 'rgba(91,155,245,0.15)' },
  ],
  followup: [
    { type: 'followup_pending_x_days', label: 'Follow-up en attente', desc: 'Follow-up non traité depuis X jours', icon: Clock, color: '#D69E2E', bg: 'rgba(214,158,46,0.15)' },
  ],
  instagram: [
    { type: 'new_follower',     label: 'Nouveau follower',     desc: 'Quelqu\'un te suit',                icon: UserPlus,      color: '#EC4899', bg: 'rgba(236,72,153,0.15)' },
    { type: 'dm_keyword',       label: 'DM avec mot-clé',      desc: 'Message contenant un mot-clé',      icon: MessageCircle, color: '#EC4899', bg: 'rgba(236,72,153,0.15)' },
    { type: 'comment_keyword',  label: 'Commentaire mot-clé',  desc: 'Commentaire contenant un mot-clé',  icon: Hash,          color: '#EC4899', bg: 'rgba(236,72,153,0.15)' },
  ],
}

const LEAD_STATUSES = [
  { value: 'nouveau', label: 'Nouveau' },
  { value: 'scripte', label: 'Scripté' },
  { value: 'setting_planifie', label: 'Setting planifié' },
  { value: 'no_show_setting', label: 'No-show setting' },
  { value: 'closing_planifie', label: 'Closing planifié' },
  { value: 'no_show_closing', label: 'No-show closing' },
  { value: 'clos', label: 'Closé' },
  { value: 'dead', label: 'Dead' },
]

const SOURCES = [
  { value: 'instagram_ads', label: '📸 Instagram Ads' },
  { value: 'facebook_ads',  label: '📘 Facebook Ads' },
  { value: 'follow_ads',    label: '🎯 Follow Ads' },
  { value: 'formulaire',    label: '📝 Formulaire' },
  { value: 'manuel',        label: '✋ Manuel' },
]

function findCategory(triggerType: WorkflowTriggerType): CategoryKey {
  for (const [cat, triggers] of Object.entries(TRIGGERS_BY_CATEGORY) as [CategoryKey, TriggerItem[]][]) {
    if (triggers.some(t => t.type === triggerType)) return cat
  }
  return 'leads'
}

export default function TriggerConfigPanel({ triggerType, triggerConfig, onChange }: Props) {
  const [category, setCategory] = useState<CategoryKey>(findCategory(triggerType))
  const [calendars, setCalendars] = useState<Pick<BookingCalendar, 'id' | 'name'>[]>([])

  useEffect(() => {
    setCategory(findCategory(triggerType))
  }, [triggerType])

  useEffect(() => {
    fetch('/api/booking-calendars')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(json => setCalendars(json.data ?? []))
      .catch(() => {})
  }, [])

  const updateConfig = (key: string, value: unknown) => {
    onChange(triggerType, { ...triggerConfig, [key]: value })
  }

  const activeTrigger = TRIGGERS_BY_CATEGORY[category].find(t => t.type === triggerType)

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 18, paddingBottom: 14,
        borderBottom: '1px solid var(--border-primary)',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'rgba(229,62,62,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Zap size={15} style={{ color: '#E53E3E' }} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            Déclencheur
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Quand ce workflow démarre
          </div>
        </div>
      </div>

      <div style={sectionLabel}>Catégorie</div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 6, marginBottom: 14,
      }}>
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
                padding: '10px 4px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.12s',
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: 7,
                background: cat.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 5px',
              }}>
                <Icon size={14} style={{ color: cat.color }} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: active ? cat.color : 'var(--text-primary)' }}>
                {cat.label}
              </div>
            </button>
          )
        })}
      </div>

      <div style={sectionLabel}>Déclencheurs disponibles</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 18 }}>
        {TRIGGERS_BY_CATEGORY[category].map((t) => (
          <TriggerCard
            key={t.type}
            item={t}
            selected={t.type === triggerType}
            onClick={() => onChange(t.type, {})}
          />
        ))}
      </div>

      {activeTrigger && (
        <div style={{ paddingTop: 14, borderTop: '1px dashed var(--border-primary)' }}>
          <div style={sectionLabel}>Config · {activeTrigger.label}</div>
          <TriggerConfigFields
            triggerType={triggerType}
            triggerConfig={triggerConfig}
            updateConfig={updateConfig}
            calendars={calendars}
          />
        </div>
      )}
    </div>
  )
}

function TriggerCard({ item, selected, onClick }: {
  item: TriggerItem
  selected: boolean
  onClick: () => void
}) {
  const Icon = item.icon
  const [h, setH] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', borderRadius: 8,
        background: selected ? item.bg : (h ? 'var(--bg-hover)' : 'var(--bg-surface)'),
        border: `1px solid ${selected ? item.color : (h ? 'var(--border-primary)' : 'transparent')}`,
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
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: selected ? item.color : 'var(--text-primary)' }}>
          {item.label}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{item.desc}</div>
      </div>
      {selected && <CheckCircle2 size={14} style={{ color: item.color, flexShrink: 0 }} />}
    </button>
  )
}

function TriggerConfigFields({
  triggerType, triggerConfig, updateConfig, calendars,
}: {
  triggerType: WorkflowTriggerType
  triggerConfig: Record<string, unknown>
  updateConfig: (key: string, value: unknown) => void
  calendars: Pick<BookingCalendar, 'id' | 'name'>[]
}) {
  switch (triggerType) {
    case 'new_lead':
    case 'lead_imported':
      return (
        <div>
          <label style={fieldLabel}>Source</label>
          <ToggleGroup
            value={(triggerConfig.source as string) || ''}
            onChange={(v) => updateConfig('source', v || null)}
            options={[{ value: '', label: 'Toutes' }, ...SOURCES]}
          />
        </div>
      )

    case 'lead_status_changed':
      return (
        <>
          <label style={fieldLabel}>Ancien statut</label>
          <ToggleGroup
            value={(triggerConfig.from_status as string) || ''}
            onChange={(v) => updateConfig('from_status', v || null)}
            options={[{ value: '', label: 'Tous' }, ...LEAD_STATUSES]}
            cols={3}
          />
          <label style={{ ...fieldLabel, marginTop: 12 }}>Nouveau statut</label>
          <ToggleGroup
            value={(triggerConfig.to_status as string) || ''}
            onChange={(v) => updateConfig('to_status', v || null)}
            options={[{ value: '', label: 'Tous' }, ...LEAD_STATUSES]}
            cols={3}
          />
        </>
      )

    case 'tag_added':
    case 'tag_removed':
      return (
        <div>
          <label style={fieldLabel}>Tag</label>
          <input
            type="text"
            style={inputStyle}
            placeholder="Ex: VIP, chaud..."
            value={(triggerConfig.tag as string) || ''}
            onChange={(e) => updateConfig('tag', e.target.value)}
          />
        </div>
      )

    case 'lead_inactive_x_days':
      return (
        <div>
          <label style={fieldLabel}>Inactif depuis (jours)</label>
          <input
            type="number"
            style={inputStyle}
            min={1}
            value={(triggerConfig.days as number) ?? 30}
            onChange={(e) => updateConfig('days', parseInt(e.target.value) || 30)}
          />
        </div>
      )

    case 'booking_created':
    case 'booking_cancelled':
    case 'booking_no_show':
      return (
        <CalendarPicker
          calendars={calendars}
          value={(triggerConfig.calendar_id as string) || ''}
          onChange={(v) => updateConfig('calendar_id', v || null)}
        />
      )

    case 'booking_in_x_hours':
      return (
        <>
          <CalendarPicker
            calendars={calendars}
            value={(triggerConfig.calendar_id as string) || ''}
            onChange={(v) => updateConfig('calendar_id', v || null)}
          />
          <label style={{ ...fieldLabel, marginTop: 12 }}>Heures avant le rendez-vous</label>
          <input
            type="number"
            style={inputStyle}
            min={1}
            value={(triggerConfig.hours_before as number) ?? 24}
            onChange={(e) => updateConfig('hours_before', parseInt(e.target.value) || 1)}
          />
        </>
      )

    case 'followup_pending_x_days':
      return (
        <div>
          <label style={fieldLabel}>Jours en attente</label>
          <input
            type="number"
            style={inputStyle}
            min={1}
            value={(triggerConfig.days_pending as number) ?? 3}
            onChange={(e) => updateConfig('days_pending', parseInt(e.target.value) || 1)}
          />
        </div>
      )

    case 'dm_keyword':
    case 'comment_keyword':
      return (
        <div>
          <label style={fieldLabel}>Mot-clé</label>
          <input
            type="text"
            style={inputStyle}
            placeholder="Ex: info, prix..."
            value={(triggerConfig.keyword as string) || ''}
            onChange={(e) => updateConfig('keyword', e.target.value)}
          />
        </div>
      )

    default:
      return (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          Aucune configuration supplémentaire
        </div>
      )
  }
}

function CalendarPicker({ calendars, value, onChange }: {
  calendars: Pick<BookingCalendar, 'id' | 'name'>[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label style={fieldLabel}>Calendrier</label>
      <ToggleGroup
        value={value}
        onChange={onChange}
        options={[
          { value: '', label: 'Tous' },
          ...calendars.map(c => ({ value: c.id, label: c.name })),
        ]}
        cols={2}
      />
    </div>
  )
}

function ToggleGroup({ value, onChange, options, cols = 2 }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  cols?: number
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 6 }}>
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value || '_all'}
            onClick={() => onChange(opt.value)}
            style={{
              padding: '8px 10px',
              background: active ? 'rgba(91,155,245,0.12)' : 'var(--bg-surface)',
              border: `1px solid ${active ? '#5b9bf5' : 'var(--border-primary)'}`,
              borderRadius: 7,
              fontSize: 11,
              fontWeight: active ? 600 : 500,
              color: active ? '#5b9bf5' : 'var(--text-secondary)',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.12s',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

const sectionLabel: React.CSSProperties = {
  fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em',
  color: 'var(--text-muted)', marginBottom: 8, padding: '0 2px',
  fontWeight: 600,
}

const fieldLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)',
  marginBottom: 6, display: 'block',
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-input)',
  border: '1px solid var(--border-primary)',
  borderRadius: 8,
  padding: '10px 12px',
  color: 'var(--text-primary)',
  fontSize: 13,
  width: '100%',
  outline: 'none',
}
