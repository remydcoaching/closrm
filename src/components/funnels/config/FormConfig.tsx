'use client'

import type { FormBlockConfig, FunnelFormField } from '@/types'

interface Props {
  config: FormBlockConfig
  onChange: (config: FormBlockConfig) => void
}

const emptyField: FunnelFormField = {
  key: '',
  label: '',
  type: 'text',
  placeholder: '',
  required: false,
}

export default function FormConfig({ config, onChange }: Props) {
  const fields = config.fields || []

  const updateField = (index: number, patch: Partial<FunnelFormField>) => {
    const next = fields.map((f, i) => (i === index ? { ...f, ...patch } : f))
    onChange({ ...config, fields: next })
  }

  const addField = () => onChange({ ...config, fields: [...fields, { ...emptyField, key: `field_${fields.length}` }] })

  const removeField = (index: number) => {
    onChange({ ...config, fields: fields.filter((_, i) => i !== index) })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Titre du formulaire</label>
          <input
            type="text"
            value={config.title}
            onChange={e => onChange({ ...config, title: e.target.value })}
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Sous-titre</label>
          <input
            type="text"
            value={config.subtitle}
            onChange={e => onChange({ ...config, subtitle: e.target.value })}
            style={inputStyle}
          />
        </div>
      </div>

      <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>Champs</div>
      {fields.map((field, i) => (
        <div key={i} style={{ background: '#111', borderRadius: 8, padding: 10, border: '1px solid #262626' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: '#555' }}>Champ {i + 1}</span>
            <button
              type="button"
              onClick={() => removeField(i)}
              style={{ background: 'none', border: 'none', color: '#E53E3E', fontSize: 12, cursor: 'pointer' }}
            >
              Supprimer
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Clé</label>
              <input
                type="text"
                value={field.key}
                onChange={e => updateField(i, { key: e.target.value })}
                placeholder="email"
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Label</label>
              <input
                type="text"
                value={field.label}
                onChange={e => updateField(i, { label: e.target.value })}
                placeholder="Votre email"
                style={inputStyle}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Type</label>
              <select
                value={field.type}
                onChange={e => updateField(i, { type: e.target.value as FunnelFormField['type'] })}
                style={inputStyle}
              >
                <option value="text">Texte</option>
                <option value="email">Email</option>
                <option value="tel">Téléphone</option>
                <option value="textarea">Zone de texte</option>
                <option value="select">Liste déroulante</option>
              </select>
            </div>
            <label style={{ fontSize: 12, color: '#aaa', display: 'flex', alignItems: 'center', gap: 4, marginTop: 14, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={field.required}
                onChange={e => updateField(i, { required: e.target.checked })}
                style={{ accentColor: 'var(--color-primary, #E53E3E)' }}
              />
              Requis
            </label>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addField}
        style={{
          padding: '6px 12px', fontSize: 12, background: '#1a1a1a', border: '1px dashed #444',
          borderRadius: 8, color: '#aaa', cursor: 'pointer',
        }}
      >
        + Ajouter un champ
      </button>

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Texte du bouton</label>
          <input
            type="text"
            value={config.submitText}
            onChange={e => onChange({ ...config, submitText: e.target.value })}
            placeholder="Envoyer"
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>URL de redirection</label>
          <input
            type="url"
            value={config.redirectUrl || ''}
            onChange={e => onChange({ ...config, redirectUrl: e.target.value || null })}
            placeholder="https://..."
            style={inputStyle}
          />
        </div>
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
  color: '#fff', outline: 'none',
}
