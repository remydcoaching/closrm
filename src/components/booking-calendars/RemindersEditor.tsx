'use client'

import { useState } from 'react'
import { Plus, X, Mail, MessageCircle, MessageSquare, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import type { CalendarReminder, ReminderChannel } from '@/types'

interface RemindersEditorProps {
  reminders: CalendarReminder[]
  onChange: (reminders: CalendarReminder[]) => void
}

const CHANNELS: { value: ReminderChannel; label: string; icon: typeof Mail; color: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: '#25D366' },
  { value: 'email', label: 'Email', icon: Mail, color: '#3b82f6' },
  { value: 'instagram_dm', label: 'Instagram', icon: MessageSquare, color: '#E1306C' },
]

const DEFAULT_MESSAGES: Record<ReminderChannel, string> = {
  email: 'Bonjour {{prenom}}, rappel : votre rendez-vous {{nom_calendrier}} est prévu le {{date_rdv}} à {{heure_rdv}}.',
  whatsapp: 'Bonjour {{prenom}}, petit rappel pour votre RDV de {{heure_rdv}} le {{date_rdv}}. À bientôt !',
  instagram_dm: 'Hey {{prenom}} ! Rappel pour ton RDV de {{heure_rdv}} le {{date_rdv}}.',
}

const QUICK_PRESETS = [
  { label: 'Confirmation', delay_value: 0, delay_unit: 'hours' as const, isConfirmation: true },
  { label: 'H-2', delay_value: 2, delay_unit: 'hours' as const },
  { label: 'H-24', delay_value: 24, delay_unit: 'hours' as const },
  { label: 'J-1 à 9h', delay_value: 1, delay_unit: 'days' as const, at_time: '09:00' },
  { label: 'J-2 à 9h', delay_value: 2, delay_unit: 'days' as const, at_time: '09:00' },
  { label: 'J-7 à 9h', delay_value: 7, delay_unit: 'days' as const, at_time: '09:00' },
]

const CONFIRMATION_MESSAGES: Record<ReminderChannel, string> = {
  email: 'Bonjour {{prenom}}, votre rendez-vous {{nom_calendrier}} est confirmé pour le {{date_rdv}} à {{heure_rdv}}. À bientôt !',
  whatsapp: 'Bonjour {{prenom}}, votre RDV du {{date_rdv}} à {{heure_rdv}} est confirmé. À bientôt !',
  instagram_dm: 'Hey {{prenom}} ! Ton RDV du {{date_rdv}} à {{heure_rdv}} est confirmé 🙌',
}

function formatDelay(r: CalendarReminder): string {
  if (r.delay_value === 0) return 'Confirmation'
  if (r.delay_unit === 'hours') return `H-${r.delay_value}`
  if (r.at_time) return `J-${r.delay_value} à ${r.at_time}`
  return `J-${r.delay_value}`
}

export default function RemindersEditor({ reminders, onChange }: RemindersEditorProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showPresets, setShowPresets] = useState(false)

  function addFromPreset(preset: typeof QUICK_PRESETS[0], channel: ReminderChannel = 'whatsapp') {
    const isConfirmation = 'isConfirmation' in preset && preset.isConfirmation
    const messages = isConfirmation ? CONFIRMATION_MESSAGES : DEFAULT_MESSAGES
    const newReminder: CalendarReminder = {
      id: crypto.randomUUID(),
      delay_value: preset.delay_value,
      delay_unit: preset.delay_unit,
      at_time: ('at_time' in preset ? preset.at_time : null) ?? null,
      channel,
      message: messages[channel],
    }
    onChange([...reminders, newReminder])
    setShowPresets(false)
  }

  function addCustom() {
    const newReminder: CalendarReminder = {
      id: crypto.randomUUID(),
      delay_value: 24,
      delay_unit: 'hours',
      at_time: null,
      channel: 'whatsapp',
      message: DEFAULT_MESSAGES.whatsapp,
    }
    onChange([...reminders, newReminder])
    setExpandedId(newReminder.id)
    setShowPresets(false)
  }

  function updateReminder(id: string, updates: Partial<CalendarReminder>) {
    onChange(reminders.map(r => r.id === id ? { ...r, ...updates } : r))
  }

  function removeReminder(id: string) {
    onChange(reminders.filter(r => r.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  function handleChannelChange(id: string, channel: ReminderChannel) {
    const existing = reminders.find(r => r.id === id)
    const updates: Partial<CalendarReminder> = { channel }
    if (existing && Object.values(DEFAULT_MESSAGES).includes(existing.message)) {
      updates.message = DEFAULT_MESSAGES[channel]
    }
    updateReminder(id, updates)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {reminders.length === 0 && !showPresets && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
          Aucun rappel configuré. Ajoutez-en pour notifier vos prospects avant leurs rendez-vous.
        </p>
      )}

      {/* Bulk channel selector */}
      {reminders.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Tous en :</span>
          {CHANNELS.map(c => {
            const CIcon = c.icon
            const allMatch = reminders.every(r => r.channel === c.value)
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => {
                  onChange(reminders.map(r => {
                    const isDefault = Object.values(DEFAULT_MESSAGES).includes(r.message) || Object.values(CONFIRMATION_MESSAGES).includes(r.message)
                    const messages = r.delay_value === 0 ? CONFIRMATION_MESSAGES : DEFAULT_MESSAGES
                    return {
                      ...r,
                      channel: c.value,
                      ...(isDefault ? { message: messages[c.value] } : {}),
                    }
                  }))
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '3px 10px', borderRadius: 6,
                  border: `1px solid ${allMatch ? c.color : 'var(--border-primary)'}`,
                  background: allMatch ? c.color + '14' : 'transparent',
                  color: allMatch ? c.color : 'var(--text-muted)',
                  cursor: 'pointer', fontSize: 11, fontWeight: 500,
                  transition: 'all 0.15s',
                }}
              >
                <CIcon size={11} />
                {c.label}
              </button>
            )
          })}
        </div>
      )}

      {/* Reminder list — compact rows */}
      {reminders.map((reminder) => {
        const channel = CHANNELS.find(c => c.value === reminder.channel) ?? CHANNELS[0]
        const Icon = channel.icon
        const isExpanded = expandedId === reminder.id

        return (
          <div key={reminder.id}>
            {/* Compact row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 10,
                border: `1px solid ${isExpanded ? 'var(--color-primary, #00C853)' : 'var(--border-primary)'}`,
                background: isExpanded ? 'rgba(var(--color-primary-rgb, 0,200,83), 0.04)' : 'var(--bg-input)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onClick={() => setExpandedId(isExpanded ? null : reminder.id)}
            >
              {/* Timing badge */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 6,
                background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
              }}>
                <Clock size={12} style={{ color: '#3b82f6' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#3b82f6' }}>
                  {formatDelay(reminder)}
                </span>
              </div>

              {/* Channel badge */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 6,
                background: channel.color + '14', border: `1px solid ${channel.color}30`,
              }}>
                <Icon size={12} style={{ color: channel.color }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: channel.color }}>
                  {channel.label}
                </span>
              </div>

              <div style={{ flex: 1 }} />

              {/* Expand/collapse */}
              {isExpanded ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}

              {/* Delete */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeReminder(reminder.id) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Expanded config */}
            {isExpanded && (
              <div style={{
                padding: '14px 16px',
                marginTop: -1,
                borderRadius: '0 0 10px 10px',
                border: '1px solid var(--color-primary, #00C853)',
                borderTop: '1px solid var(--border-primary)',
                background: 'var(--bg-elevated)',
                display: 'flex', flexDirection: 'column', gap: 12,
              }}>
                {/* Timing */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="number"
                    min={1}
                    value={reminder.delay_value}
                    onChange={(e) => updateReminder(reminder.id, { delay_value: parseInt(e.target.value) || 1 })}
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)', borderRadius: 8, padding: '6px 10px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', width: 60 }}
                  />
                  <select
                    value={reminder.delay_unit}
                    onChange={(e) => {
                      const unit = e.target.value as 'hours' | 'days'
                      const updates: Partial<CalendarReminder> = { delay_unit: unit }
                      if (unit === 'hours') updates.at_time = null
                      updateReminder(reminder.id, updates)
                    }}
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)', borderRadius: 8, padding: '6px 10px', fontSize: 13, color: 'var(--text-primary)', outline: 'none' }}
                  >
                    <option value="hours">heures avant</option>
                    <option value="days">jours avant</option>
                  </select>
                  {reminder.delay_unit === 'days' && (
                    <>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>à</span>
                      <input
                        type="time"
                        value={reminder.at_time ?? ''}
                        onChange={(e) => updateReminder(reminder.id, { at_time: e.target.value || null })}
                        style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)', borderRadius: 8, padding: '6px 10px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', colorScheme: 'dark', width: 100 }}
                      />
                    </>
                  )}
                </div>

                {/* Channel pills */}
                <div style={{ display: 'flex', gap: 6 }}>
                  {CHANNELS.map(c => {
                    const CIcon = c.icon
                    const isActive = reminder.channel === c.value
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => handleChannelChange(reminder.id, c.value)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '6px 12px', borderRadius: 8,
                          border: `1.5px solid ${isActive ? c.color : 'var(--border-primary)'}`,
                          background: isActive ? c.color + '14' : 'transparent',
                          color: isActive ? c.color : 'var(--text-muted)',
                          cursor: 'pointer', fontSize: 12, fontWeight: 500,
                          transition: 'all 0.15s',
                        }}
                      >
                        <CIcon size={13} />
                        {c.label}
                      </button>
                    )
                  })}
                </div>

                {/* Message */}
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                    Message — {'{{prenom}}'} {'{{nom}}'} {'{{date_rdv}}'} {'{{heure_rdv}}'} {'{{nom_calendrier}}'}
                  </div>
                  <textarea
                    value={reminder.message}
                    onChange={(e) => updateReminder(reminder.id, { message: e.target.value })}
                    rows={2}
                    style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)', border: '1px solid var(--border-primary)', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', resize: 'vertical' }}
                  />
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Add button / presets */}
      {showPresets ? (
        <div style={{
          padding: 14, borderRadius: 10,
          border: '1px solid var(--border-primary)',
          background: 'var(--bg-elevated)',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-label)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>
            Rappels rapides
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {QUICK_PRESETS.map(p => (
              <button
                key={p.label}
                type="button"
                onClick={() => addFromPreset(p)}
                style={{
                  padding: '6px 14px', borderRadius: 8,
                  border: '1px solid var(--border-primary)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer', fontSize: 12, fontWeight: 500,
                  transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <Clock size={12} style={{ color: '#3b82f6' }} />
                {p.label}
              </button>
            ))}
          </div>
          <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: 8, marginTop: 4 }}>
            <button
              type="button"
              onClick={addCustom}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-secondary)', fontSize: 12, padding: 0,
                textDecoration: 'underline',
              }}
            >
              Personnalisé...
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowPresets(false)}
            style={{
              position: 'absolute', right: 12, top: 12,
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
            }}
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowPresets(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 14px', borderRadius: 8,
            border: '1px dashed var(--border-primary)',
            background: 'transparent',
            color: 'var(--text-tertiary)',
            cursor: 'pointer', fontSize: 12,
            transition: 'all 0.15s',
          }}
        >
          <Plus size={14} />
          Ajouter un rappel
        </button>
      )}
    </div>
  )
}
