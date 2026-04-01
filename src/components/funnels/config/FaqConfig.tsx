'use client'

import type { FaqBlockConfig, FaqItem } from '@/types'

interface Props {
  config: FaqBlockConfig
  onChange: (config: FaqBlockConfig) => void
}

export default function FaqConfig({ config, onChange }: Props) {
  const items = config.items || []

  const updateItem = (index: number, patch: Partial<FaqItem>) => {
    const next = items.map((item, i) => (i === index ? { ...item, ...patch } : item))
    onChange({ ...config, items: next })
  }

  const addItem = () => onChange({ ...config, items: [...items, { question: '', answer: '' }] })

  const removeItem = (index: number) => {
    onChange({ ...config, items: items.filter((_, i) => i !== index) })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <label style={labelStyle}>Titre de la section</label>
        <input
          type="text"
          value={config.title}
          onChange={e => onChange({ ...config, title: e.target.value })}
          placeholder="Questions fréquentes"
          style={inputStyle}
        />
      </div>

      {items.map((item, i) => (
        <div key={i} style={{ background: '#111', borderRadius: 8, padding: 10, border: '1px solid #262626' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: '#555' }}>Q&A {i + 1}</span>
            <button
              type="button"
              onClick={() => removeItem(i)}
              style={{ background: 'none', border: 'none', color: '#E53E3E', fontSize: 12, cursor: 'pointer' }}
            >
              Supprimer
            </button>
          </div>
          <div style={{ marginBottom: 6 }}>
            <label style={labelStyle}>Question</label>
            <input
              type="text"
              value={item.question}
              onChange={e => updateItem(i, { question: e.target.value })}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Réponse</label>
            <textarea
              value={item.answer}
              onChange={e => updateItem(i, { answer: e.target.value })}
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addItem}
        style={{
          padding: '6px 12px', fontSize: 12, background: '#1a1a1a', border: '1px dashed #444',
          borderRadius: 8, color: '#aaa', cursor: 'pointer',
        }}
      >
        + Ajouter une question
      </button>
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
