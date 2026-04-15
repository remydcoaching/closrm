'use client'

/**
 * A-028a-02 — Config inspector pour le bloc Formulaire.
 *
 * Simplifié : pas de champ "Clé" (auto-généré depuis le label),
 * et sélecteur de redirection (page du funnel ou URL personnalisée).
 */

import type { FormBlockConfig, FunnelFormField, FunnelPage, FunnelBlock } from '@/types'
import RedirectPicker from './RedirectPicker'

interface Props {
  config: FormBlockConfig
  onChange: (config: FormBlockConfig) => void
  pages?: FunnelPage[]
  blocks?: FunnelBlock[]
}

/**
 * Génère une clé technique depuis un label français.
 * "Prénom" → "prenom", "Chiffre d'affaires" → "chiffre_d_affaires"
 */
function slugifyLabel(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    || 'field'
}

export default function FormConfig({ config, onChange, pages, blocks }: Props) {
  const fields = config.fields || []

  const updateField = (index: number, patch: Partial<FunnelFormField>) => {
    const next = fields.map((f, i) => {
      if (i !== index) return f
      const updated = { ...f, ...patch }
      // Auto-générer la clé depuis le label quand le label change
      if (patch.label !== undefined) {
        updated.key = slugifyLabel(patch.label)
      }
      return updated
    })
    onChange({ ...config, fields: next })
  }

  const addField = () => {
    const newField: FunnelFormField = {
      key: `field_${fields.length}`,
      label: '',
      type: 'text',
      placeholder: '',
      required: false,
    }
    onChange({ ...config, fields: [...fields, newField] })
  }

  const removeField = (index: number) => {
    onChange({ ...config, fields: fields.filter((_, i) => i !== index) })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Titre / Sous-titre */}
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

      {/* Champs */}
      <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>Champs</div>
      {fields.map((field, i) => (
        <div key={i} style={fieldCardStyle}>
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

          {/* Label */}
          <div style={{ marginBottom: 6 }}>
            <label style={labelStyle}>Label</label>
            <input
              type="text"
              value={field.label}
              onChange={e => updateField(i, { label: e.target.value })}
              placeholder="Ex : Prénom, Email, Téléphone..."
              style={inputStyle}
            />
          </div>

          {/* Type + Required */}
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

          {/* Placeholder (optionnel) */}
          <div style={{ marginTop: 6 }}>
            <label style={labelStyle}>Placeholder</label>
            <input
              type="text"
              value={field.placeholder}
              onChange={e => updateField(i, { placeholder: e.target.value })}
              placeholder="Texte indicatif..."
              style={inputStyle}
            />
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addField}
        style={addFieldButtonStyle}
      >
        + Ajouter un champ
      </button>

      {/* Texte du bouton */}
      <div style={{ marginTop: 4 }}>
        <label style={labelStyle}>Texte du bouton</label>
        <input
          type="text"
          value={config.submitText}
          onChange={e => onChange({ ...config, submitText: e.target.value })}
          placeholder="Envoyer"
          style={inputStyle}
        />
      </div>

      {/* Message de succès */}
      <div>
        <label style={labelStyle}>Message de succès</label>
        <input
          type="text"
          value={config.successMessage}
          onChange={e => onChange({ ...config, successMessage: e.target.value })}
          placeholder="Merci ! Nous reviendrons vers toi sous 24h."
          style={inputStyle}
        />
      </div>

      {/* ── Redirection ── */}
      <RedirectPicker
        value={config.redirectUrl}
        onChange={val => onChange({ ...config, redirectUrl: val })}
        pages={pages}
        blocks={blocks}
        label="Redirection après envoi"
      />
    </div>
  )
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: 11, color: '#555', display: 'block', marginBottom: 4,
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 13,
  background: '#0a0a0a', border: '1px solid #333', borderRadius: 8,
  color: '#fff', outline: 'none',
}

const fieldCardStyle: React.CSSProperties = {
  background: '#111', borderRadius: 8, padding: 10, border: '1px solid #262626',
}

const addFieldButtonStyle: React.CSSProperties = {
  padding: '6px 12px', fontSize: 12, background: '#1a1a1a', border: '1px dashed #444',
  borderRadius: 8, color: '#aaa', cursor: 'pointer',
}
