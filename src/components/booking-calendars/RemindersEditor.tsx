'use client'

import { Plus, X, Mail, MessageCircle, MessageSquare } from 'lucide-react'
import type { CalendarReminder, ReminderChannel } from '@/types'

interface RemindersEditorProps {
  reminders: CalendarReminder[]
  onChange: (reminders: CalendarReminder[]) => void
}

const CHANNEL_OPTIONS: { value: ReminderChannel; label: string; icon: typeof Mail }[] = [
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { value: 'instagram_dm', label: 'Instagram DM', icon: MessageSquare },
]

const DEFAULT_MESSAGES: Record<ReminderChannel, string> = {
  email: 'Bonjour {{prenom}}, rappel : votre rendez-vous {{nom_calendrier}} est prévu le {{date_rdv}} à {{heure_rdv}}.',
  whatsapp: 'Bonjour {{prenom}}, petit rappel pour votre RDV de {{heure_rdv}} le {{date_rdv}}. À bientôt !',
  instagram_dm: 'Hey {{prenom}} ! Rappel pour ton RDV de {{heure_rdv}} le {{date_rdv}}.',
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-input)',
  border: '1px solid var(--border-primary)',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 13,
  color: 'var(--text-primary)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

export default function RemindersEditor({ reminders, onChange }: RemindersEditorProps) {
  function addReminder() {
    const newReminder: CalendarReminder = {
      id: crypto.randomUUID(),
      delay_value: 24,
      delay_unit: 'hours',
      at_time: null,
      channel: 'whatsapp',
      message: DEFAULT_MESSAGES.whatsapp,
    }
    onChange([...reminders, newReminder])
  }

  function updateReminder(id: string, updates: Partial<CalendarReminder>) {
    onChange(reminders.map(r => r.id === id ? { ...r, ...updates } : r))
  }

  function removeReminder(id: string) {
    onChange(reminders.filter(r => r.id !== id))
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
        Configurez les rappels envoyés automatiquement avant chaque rendez-vous.
      </p>

      {reminders.map((reminder, index) => (
        <div
          key={reminder.id}
          style={{
            padding: 16,
            borderRadius: 10,
            border: '1px solid var(--border-primary)',
            background: 'var(--bg-input)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>
              Rappel {index + 1}
            </span>
            <button
              type="button"
              onClick={() => removeReminder(reminder.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
            >
              <X size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="number"
              min={1}
              value={reminder.delay_value}
              onChange={(e) => updateReminder(reminder.id, { delay_value: parseInt(e.target.value) || 1 })}
              style={{ ...inputStyle, width: 70 }}
            />
            <select
              value={reminder.delay_unit}
              onChange={(e) => updateReminder(reminder.id, { delay_unit: e.target.value as 'hours' | 'days' })}
              style={{ ...inputStyle, width: 110 }}
            >
              <option value="hours">heures avant</option>
              <option value="days">jours avant</option>
            </select>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>à</span>
            <input
              type="time"
              value={reminder.at_time ?? ''}
              onChange={(e) => updateReminder(reminder.id, { at_time: e.target.value || null })}
              placeholder="Heure du RDV"
              style={{ ...inputStyle, width: 110, colorScheme: 'dark' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Canal</label>
            <select
              value={reminder.channel}
              onChange={(e) => handleChannelChange(reminder.id, e.target.value as ReminderChannel)}
              style={inputStyle}
            >
              {CHANNEL_OPTIONS.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Message — variables : {'{{prenom}}'}, {'{{date_rdv}}'}, {'{{heure_rdv}}'}, {'{{nom_calendrier}}'}
            </label>
            <textarea
              value={reminder.message}
              onChange={(e) => updateReminder(reminder.id, { message: e.target.value })}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addReminder}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '10px 14px',
          borderRadius: 8,
          border: '1px dashed var(--border-primary)',
          background: 'transparent',
          color: 'var(--text-tertiary)',
          cursor: 'pointer',
          fontSize: 12,
          transition: 'all 0.15s',
        }}
      >
        <Plus size={14} />
        Ajouter un rappel
      </button>
    </div>
  )
}
