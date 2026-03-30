'use client'

import type { WorkflowTriggerType } from '@/types'

interface Props {
  triggerType: WorkflowTriggerType
  triggerConfig: Record<string, unknown>
  onChange: (triggerType: WorkflowTriggerType, triggerConfig: Record<string, unknown>) => void
}

const LEAD_STATUSES = [
  { value: 'nouveau', label: 'Nouveau' },
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
  const updateConfig = (key: string, value: unknown) => {
    onChange(triggerType, { ...triggerConfig, [key]: value })
  }

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
              <option value="formulaire">Formulaire</option>
              <option value="manuel">Manuel</option>
            </select>
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
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: 20,
        }}
      >
        Configuration du déclencheur
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle}>Type de déclencheur</label>
        <select
          style={selectStyle}
          value={triggerType}
          onChange={(e) => onChange(e.target.value as WorkflowTriggerType, {})}
        >
          <optgroup label="LEADS">
            <option value="new_lead">Nouveau lead</option>
            <option value="lead_status_changed">Changement de statut</option>
            <option value="tag_added">Tag ajouté</option>
            <option value="tag_removed">Tag supprimé</option>
            <option value="deal_won">Deal gagné</option>
          </optgroup>
          <optgroup label="APPELS">
            <option value="call_scheduled">Appel planifié</option>
            <option value="call_in_x_hours">Appel dans X heures</option>
            <option value="call_no_show">No-show appel</option>
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
          <optgroup label="RÉSERVATIONS">
            <option value="booking_created">Réservation créée</option>
            <option value="booking_cancelled">Réservation annulée</option>
          </optgroup>
        </select>
      </div>

      {renderConfigFields()}
    </div>
  )
}
