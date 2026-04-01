'use client'

import type { PricingBlockConfig } from '@/types'

interface Props {
  config: PricingBlockConfig
  onChange: (config: PricingBlockConfig) => void
}

export default function PricingConfig({ config, onChange }: Props) {
  const features = config.features || []

  const updateFeature = (index: number, value: string) => {
    const next = features.map((f, i) => (i === index ? value : f))
    onChange({ ...config, features: next })
  }

  const addFeature = () => onChange({ ...config, features: [...features, ''] })

  const removeFeature = (index: number) => {
    onChange({ ...config, features: features.filter((_, i) => i !== index) })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <label style={labelStyle}>Titre</label>
        <input
          type="text"
          value={config.title}
          onChange={e => onChange({ ...config, title: e.target.value })}
          placeholder="Offre Premium"
          style={inputStyle}
        />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Prix</label>
          <input
            type="text"
            value={config.price}
            onChange={e => onChange({ ...config, price: e.target.value })}
            placeholder="997"
            style={inputStyle}
          />
        </div>
        <div style={{ width: 80 }}>
          <label style={labelStyle}>Devise</label>
          <input
            type="text"
            value={config.currency}
            onChange={e => onChange({ ...config, currency: e.target.value })}
            placeholder="€"
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Période</label>
          <input
            type="text"
            value={config.period}
            onChange={e => onChange({ ...config, period: e.target.value })}
            placeholder="mois"
            style={inputStyle}
          />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Fonctionnalités</label>
        {features.map((feat, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
            <input
              type="text"
              value={feat}
              onChange={e => updateFeature(i, e.target.value)}
              placeholder="Accès illimité..."
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              type="button"
              onClick={() => removeFeature(i)}
              style={{ background: 'none', border: 'none', color: '#E53E3E', fontSize: 16, cursor: 'pointer', padding: '0 4px' }}
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addFeature}
          style={{
            padding: '4px 10px', fontSize: 11, background: '#1a1a1a', border: '1px dashed #444',
            borderRadius: 6, color: '#aaa', cursor: 'pointer', marginTop: 2,
          }}
        >
          + Ajouter
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Texte du bouton</label>
          <input
            type="text"
            value={config.ctaText}
            onChange={e => onChange({ ...config, ctaText: e.target.value })}
            placeholder="Commencer"
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>URL du bouton</label>
          <input
            type="url"
            value={config.ctaUrl}
            onChange={e => onChange({ ...config, ctaUrl: e.target.value })}
            placeholder="https://..."
            style={inputStyle}
          />
        </div>
      </div>

      <label style={{ fontSize: 12, color: '#aaa', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={config.highlighted}
          onChange={e => onChange({ ...config, highlighted: e.target.checked })}
          style={{ accentColor: 'var(--color-primary, #E53E3E)' }}
        />
        Mettre en avant (bordure accent)
      </label>
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
