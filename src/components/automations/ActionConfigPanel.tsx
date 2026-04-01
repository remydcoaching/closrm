'use client'

import type { WorkflowStep, WorkflowActionType } from '@/types'
import TemplateVariableHelper from './TemplateVariableHelper'

interface Props {
  step: WorkflowStep
  onChange: (updates: Partial<WorkflowStep>) => void
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

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 80,
  resize: 'vertical' as const,
}

export default function ActionConfigPanel({ step, onChange }: Props) {
  const config = step.action_config || {}

  const updateConfig = (key: string, value: unknown) => {
    onChange({ action_config: { ...config, [key]: value } })
  }

  const renderConfigFields = () => {
    switch (step.action_type) {
      case 'send_email':
        return (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Objet</label>
              <input
                type="text"
                style={inputStyle}
                placeholder="Objet de l'email..."
                value={(config.subject as string) || ''}
                onChange={(e) => updateConfig('subject', e.target.value)}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Message</label>
              <textarea
                style={textareaStyle}
                placeholder="Contenu de l'email..."
                value={(config.message as string) || ''}
                onChange={(e) => updateConfig('message', e.target.value)}
              />
              <TemplateVariableHelper />
            </div>
          </>
        )

      case 'send_whatsapp':
        return (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Message</label>
            <textarea
              style={textareaStyle}
              placeholder="Message WhatsApp..."
              value={(config.message as string) || ''}
              onChange={(e) => updateConfig('message', e.target.value)}
            />
            <TemplateVariableHelper />
          </div>
        )

      case 'send_dm_instagram':
        return (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Message</label>
            <textarea
              style={textareaStyle}
              placeholder="Message Instagram DM..."
              value={(config.message as string) || ''}
              onChange={(e) => updateConfig('message', e.target.value)}
            />
            <TemplateVariableHelper />
          </div>
        )

      case 'create_followup':
        return (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Raison</label>
              <input
                type="text"
                style={inputStyle}
                placeholder="Raison du follow-up..."
                value={(config.reason as string) || ''}
                onChange={(e) => updateConfig('reason', e.target.value)}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Canal</label>
              <select
                style={selectStyle}
                value={(config.channel as string) || 'whatsapp'}
                onChange={(e) => updateConfig('channel', e.target.value)}
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="manuel">Manuel</option>
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Délai (jours)</label>
              <input
                type="number"
                style={inputStyle}
                min={0}
                value={(config.delay_days as number) ?? 1}
                onChange={(e) => updateConfig('delay_days', parseInt(e.target.value) || 0)}
              />
            </div>
          </>
        )

      case 'change_lead_status':
        return (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Nouveau statut</label>
            <select
              style={selectStyle}
              value={(config.new_status as string) || ''}
              onChange={(e) => updateConfig('new_status', e.target.value)}
            >
              <option value="" disabled>Sélectionner...</option>
              {LEAD_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        )

      case 'add_tag':
      case 'remove_tag':
        return (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Tag</label>
            <input
              type="text"
              style={inputStyle}
              placeholder="Ex: VIP, chaud..."
              value={(config.tag as string) || ''}
              onChange={(e) => updateConfig('tag', e.target.value)}
            />
          </div>
        )

      case 'send_notification':
        return (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Canal</label>
              <select
                style={selectStyle}
                value={(config.channel as string) || 'telegram'}
                onChange={(e) => updateConfig('channel', e.target.value)}
              >
                <option value="telegram">Telegram</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Message</label>
              <textarea
                style={textareaStyle}
                placeholder="Notification au coach..."
                value={(config.message as string) || ''}
                onChange={(e) => updateConfig('message', e.target.value)}
              />
              <TemplateVariableHelper />
            </div>
          </>
        )

      case 'facebook_conversions_api':
        return (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Type d&apos;événement</label>
              <select
                style={selectStyle}
                value={(config.event_name as string) || 'Lead'}
                onChange={(e) => updateConfig('event_name', e.target.value)}
              >
                <option value="Lead">Lead</option>
                <option value="Schedule">Schedule</option>
                <option value="Purchase">Purchase</option>
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Source de l&apos;action</label>
              <select
                style={selectStyle}
                value={(config.action_source as string) || 'website'}
                onChange={(e) => updateConfig('action_source', e.target.value)}
              >
                <option value="website">Site web</option>
                <option value="app">Application</option>
              </select>
            </div>
            <div style={{ marginTop: 18 }}>
              {[
                { key: 'send_fbclid', label: 'Envoyer Click ID (fbclid)' },
                { key: 'send_fbp', label: 'Envoyer FBP (pixel cookie)' },
                { key: 'send_fbc', label: 'Envoyer FBC (click cookie)' },
                { key: 'send_lead_id', label: 'Envoyer Lead ID externe' },
              ].map(({ key, label }) => (
                <label
                  key={key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 10,
                    fontSize: 13,
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    onClick={() => updateConfig(key, !config[key])}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      border: config[key]
                        ? '1px solid var(--color-primary)'
                        : '1px solid var(--border-primary)',
                      background: config[key]
                        ? 'rgba(0,200,83,0.2)'
                        : 'var(--bg-hover)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {!!config[key] && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2.5 6L5 8.5L9.5 3.5"
                          stroke="var(--color-primary)"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </>
        )

      case 'enroll_in_sequence':
        return (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>ID de la séquence</label>
            <input
              type="text"
              style={inputStyle}
              placeholder="ID de la séquence email..."
              value={(config.sequence_id as string) || ''}
              onChange={(e) => updateConfig('sequence_id', e.target.value)}
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Retrouve l&apos;ID dans Emails &gt; Séquences
            </div>
          </div>
        )

      case 'add_note':
        return (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Contenu de la note</label>
            <textarea
              style={textareaStyle}
              placeholder="Note à ajouter au lead..."
              value={(config.note as string) || ''}
              onChange={(e) => updateConfig('note', e.target.value)}
            />
            <TemplateVariableHelper />
          </div>
        )

      case 'set_reached':
        return (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Valeur</label>
            <select
              style={selectStyle}
              value={(config.reached as string) ?? 'true'}
              onChange={(e) => updateConfig('reached', e.target.value)}
            >
              <option value="true">Joint (oui)</option>
              <option value="false">Non joint (non)</option>
            </select>
          </div>
        )

      case 'schedule_call':
        return (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Type d&apos;appel</label>
              <select
                style={selectStyle}
                value={(config.call_type as string) || 'setting'}
                onChange={(e) => updateConfig('call_type', e.target.value)}
              >
                <option value="setting">Setting</option>
                <option value="closing">Closing</option>
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Délai avant l&apos;appel (jours)</label>
              <input
                type="number"
                style={inputStyle}
                min={0}
                value={(config.delay_days as number) ?? 1}
                onChange={(e) => updateConfig('delay_days', parseInt(e.target.value) || 0)}
              />
            </div>
          </>
        )

      case 'webhook':
        return (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>URL du webhook</label>
              <input
                type="url"
                style={inputStyle}
                placeholder="https://..."
                value={(config.url as string) || ''}
                onChange={(e) => updateConfig('url', e.target.value)}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Méthode HTTP</label>
              <select
                style={selectStyle}
                value={(config.method as string) || 'POST'}
                onChange={(e) => updateConfig('method', e.target.value)}
              >
                <option value="POST">POST</option>
                <option value="GET">GET</option>
                <option value="PUT">PUT</option>
              </select>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Les données du lead seront envoyées automatiquement dans le body.
            </div>
          </>
        )

      default:
        return null
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
        Configuration de l&apos;action
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle}>Type d&apos;action</label>
        <select
          style={selectStyle}
          value={step.action_type || ''}
          onChange={(e) =>
            onChange({
              action_type: (e.target.value as WorkflowActionType) || null,
              action_config: {},
            })
          }
        >
          <option value="" disabled>Sélectionner...</option>
          <option value="send_email">Envoyer un email</option>
          <option value="send_whatsapp">Envoyer WhatsApp</option>
          <option value="send_dm_instagram">Envoyer DM Instagram</option>
          <option value="create_followup">Créer un follow-up</option>
          <option value="change_lead_status">Changer le statut du lead</option>
          <option value="add_tag">Ajouter un tag</option>
          <option value="remove_tag">Supprimer un tag</option>
          <option value="send_notification">Notifier le coach</option>
          <option value="facebook_conversions_api">Facebook Conversions API</option>
          <option value="enroll_in_sequence">Inscrire dans une séquence email</option>
          <option value="add_note">Ajouter une note au lead</option>
          <option value="set_reached">Marquer comme joint</option>
          <option value="schedule_call">Planifier un appel</option>
          <option value="webhook">Appeler un webhook externe</option>
        </select>
      </div>

      {renderConfigFields()}
    </div>
  )
}
