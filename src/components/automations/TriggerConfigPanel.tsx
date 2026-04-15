'use client'

import { useState, useEffect } from 'react'
import type { WorkflowTriggerType, BookingCalendar } from '@/types'

interface Props {
  triggerType: WorkflowTriggerType
  triggerConfig: Record<string, unknown>
  onChange: (triggerType: WorkflowTriggerType, triggerConfig: Record<string, unknown>) => void
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

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none' as const,
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-tertiary)',
  marginBottom: 6,
  display: 'block',
}

export default function TriggerConfigPanel({ triggerType, triggerConfig, onChange }: Props) {
  const [calendars, setCalendars] = useState<Pick<BookingCalendar, 'id' | 'name'>[]>([])

  useEffect(() => {
    fetch('/api/booking-calendars')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(json => setCalendars(json.data ?? []))
      .catch(() => {})
  }, [])

  const updateConfig = (key: string, value: unknown) => {
    onChange(triggerType, { ...triggerConfig, [key]: value })
  }

  const calendarSelect = (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>Calendrier</label>
      <select
        style={selectStyle}
        value={(triggerConfig.calendar_id as string) || ''}
        onChange={(e) => updateConfig('calendar_id', e.target.value || null)}
      >
        <option value="">Tous les calendriers</option>
        {calendars.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </div>
  )

  const renderConfigFields = () => {
    switch (triggerType) {
      case 'lead_status_changed':
        return (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Ancien statut</label>
              <select
                style={selectStyle}
                value={(triggerConfig.from_status as string) || ''}
                onChange={(e) => updateConfig('from_status', e.target.value || null)}
              >
                <option value="">Tous</option>
                {LEAD_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Nouveau statut</label>
              <select
                style={selectStyle}
                value={(triggerConfig.to_status as string) || ''}
                onChange={(e) => updateConfig('to_status', e.target.value || null)}
              >
                <option value="">Tous</option>
                {LEAD_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </>
        )

      case 'tag_added':
      case 'tag_removed':
        return (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Tag</label>
            <input
              type="text"
              style={inputStyle}
              placeholder="Ex: VIP, chaud..."
              value={(triggerConfig.tag as string) || ''}
              onChange={(e) => updateConfig('tag', e.target.value)}
            />
          </div>
        )

      case 'call_in_x_hours':
        return (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Heures avant l&apos;appel</label>
            <input
              type="number"
              style={inputStyle}
              min={1}
              value={(triggerConfig.hours_before as number) ?? 24}
              onChange={(e) => updateConfig('hours_before', parseInt(e.target.value) || 1)}
            />
          </div>
        )

      case 'followup_pending_x_days':
        return (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Jours en attente</label>
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
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Mot-clé</label>
            <input
              type="text"
              style={inputStyle}
              placeholder="Ex: info, prix..."
              value={(triggerConfig.keyword as string) || ''}
              onChange={(e) => updateConfig('keyword', e.target.value)}
            />
          </div>
        )

      case 'new_lead':
        return (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Source</label>
            <select
              style={selectStyle}
              value={(triggerConfig.source as string) || ''}
              onChange={(e) => updateConfig('source', e.target.value || null)}
            >
              <option value="">Toutes</option>
              <option value="facebook_ads">Facebook Ads</option>
              <option value="instagram_ads">Instagram Ads</option>
              <option value="follow_ads">Follow Ads</option>
              <option value="formulaire">Formulaire</option>
              <option value="manuel">Manuel</option>
            </select>
          </div>
        )

      case 'lead_imported':
        return (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Source (optionnel)</label>
            <select
              style={selectStyle}
              value={(triggerConfig.source as string) || ''}
              onChange={(e) => updateConfig('source', e.target.value || null)}
            >
              <option value="">Toutes</option>
              <option value="facebook_ads">Facebook Ads</option>
              <option value="instagram_ads">Instagram Ads</option>
              <option value="follow_ads">Follow Ads</option>
              <option value="formulaire">Formulaire</option>
              <option value="manuel">Manuel</option>
            </select>
          </div>
        )

      case 'lead_with_ig_handle':
        return (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Se declenche quand un lead est cree avec un pseudo Instagram.
          </div>
        )

      case 'booking_no_show':
        return (
          <>
            {calendarSelect}
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Se declenche quand un prospect ne se presente pas au rendez-vous.
            </div>
          </>
        )

      case 'booking_created':
        return (
          <>
            {calendarSelect}
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Se declenche quand un rendez-vous est pris sur le calendrier.
            </div>
          </>
        )

      case 'booking_cancelled':
        return (
          <>
            {calendarSelect}
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Se declenche quand un rendez-vous est annule.
            </div>
          </>
        )

      case 'booking_completed':
        return (
          <>
            {calendarSelect}
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Se declenche quand un rendez-vous est marque comme termine.
            </div>
          </>
        )

      case 'booking_in_x_hours':
        return (
          <>
            {calendarSelect}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Heures avant le rendez-vous</label>
              <input
                type="number"
                style={inputStyle}
                min={1}
                value={(triggerConfig.hours_before as number) ?? 24}
                onChange={(e) => updateConfig('hours_before', parseInt(e.target.value) || 1)}
              />
            </div>
          </>
        )

      case 'lead_inactive_x_days':
        return (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Inactif depuis (jours)</label>
            <input
              type="number"
              style={inputStyle}
              min={1}
              value={(triggerConfig.days as number) ?? 30}
              onChange={(e) => updateConfig('days', parseInt(e.target.value) || 30)}
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

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 22, paddingBottom: 14,
        borderBottom: '1px solid var(--border-primary)',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'rgba(229,62,62,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E53E3E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            Declencheur
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Quand ce workflow demarre
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle}>Type de declencheur</label>
        <select
          style={selectStyle}
          value={triggerType}
          onChange={(e) => onChange(e.target.value as WorkflowTriggerType, {})}
        >
          <optgroup label="LEADS">
            <option value="new_lead">Nouveau lead</option>
            <option value="lead_imported">Leads importes en bulk</option>
            <option value="lead_status_changed">Changement de statut</option>
            <option value="tag_added">Tag ajoute</option>
            <option value="tag_removed">Tag supprime</option>
            <option value="deal_won">Deal gagne</option>
            <option value="lead_with_ig_handle">Lead avec pseudo Instagram</option>
            <option value="lead_inactive_x_days">Lead inactif depuis X jours</option>
          </optgroup>
          <optgroup label="RENDEZ-VOUS">
            <option value="booking_created">Rendez-vous créé</option>
            <option value="booking_in_x_hours">Rappel avant rendez-vous</option>
            <option value="booking_completed">Rendez-vous terminé</option>
            <option value="booking_cancelled">Rendez-vous annulé</option>
            <option value="booking_no_show">No-show rendez-vous</option>
            <option value="call_outcome_logged">Résultat d&apos;appel enregistré</option>
          </optgroup>
          <optgroup label="FOLLOW-UPS">
            <option value="followup_pending_x_days">Follow-up en attente X jours</option>
          </optgroup>
          <optgroup label="INSTAGRAM">
            <option value="new_follower">Nouveau follower</option>
            <option value="dm_keyword">DM avec mot-clé</option>
            <option value="comment_keyword">Commentaire avec mot-clé</option>
          </optgroup>
        </select>
      </div>

      {renderConfigFields()}
    </div>
  )
}
