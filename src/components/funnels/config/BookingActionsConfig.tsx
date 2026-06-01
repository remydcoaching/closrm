'use client'

import type { BookingActionsBlockConfig } from '@/types'

interface Props {
  config: BookingActionsBlockConfig
  onChange: (config: BookingActionsBlockConfig) => void
}

export default function BookingActionsConfig({ config, onChange }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <label style={labelStyle}>Titre</label>
        <input
          type="text"
          value={config.title}
          onChange={e => onChange({ ...config, title: e.target.value })}
          placeholder="Ajoute le RDV à ton agenda"
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Sous-titre</label>
        <input
          type="text"
          value={config.subtitle}
          onChange={e => onChange({ ...config, subtitle: e.target.value })}
          placeholder="Pour ne pas oublier ton appel."
          style={inputStyle}
        />
      </div>

      <div style={separatorStyle}>Boutons</div>

      <div>
        <label style={labelStyle}>Google Calendar</label>
        <input
          type="text"
          value={config.googleLabel}
          onChange={e => onChange({ ...config, googleLabel: e.target.value })}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Apple / iCal (.ics)</label>
        <input
          type="text"
          value={config.appleLabel}
          onChange={e => onChange({ ...config, appleLabel: e.target.value })}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Outlook</label>
        <input
          type="text"
          value={config.outlookLabel}
          onChange={e => onChange({ ...config, outlookLabel: e.target.value })}
          style={inputStyle}
        />
      </div>

      <div style={separatorStyle}>Lien Reprogrammer / Annuler</div>

      <label style={toggleRowStyle}>
        <input
          type="checkbox"
          checked={config.showManageLink}
          onChange={e => onChange({ ...config, showManageLink: e.target.checked })}
        />
        <span>Afficher le lien Reprogrammer / Annuler</span>
      </label>

      {config.showManageLink && (
        <div>
          <label style={labelStyle}>Texte du lien</label>
          <input
            type="text"
            value={config.manageLabel}
            onChange={e => onChange({ ...config, manageLabel: e.target.value })}
            style={inputStyle}
          />
        </div>
      )}

      <div style={separatorStyle}>Message si pas de réservation</div>

      <div>
        <label style={labelStyle}>
          Affiché en rouge si le visiteur arrive sur cette page sans avoir
          encore réservé.
        </label>
        <textarea
          value={config.noBookingMessage}
          onChange={e => onChange({ ...config, noBookingMessage: e.target.value })}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' as const }}
        />
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, color: '#555', display: 'block', marginBottom: 4,
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 13,
  background: '#0a0a0a', border: '1px solid #333', borderRadius: 8,
  color: '#fff', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
}

const separatorStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: '#888',
  textTransform: 'uppercase', letterSpacing: '0.06em',
  marginTop: 8, paddingTop: 8, borderTop: '1px solid #262626',
}

const toggleRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  fontSize: 12, color: '#ccc', cursor: 'pointer',
}
