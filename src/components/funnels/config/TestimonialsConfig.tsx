'use client'

import type { TestimonialsBlockConfig, TestimonialItem } from '@/types'

interface Props {
  config: TestimonialsBlockConfig
  onChange: (config: TestimonialsBlockConfig) => void
}

const emptyItem: TestimonialItem = {
  name: '',
  role: '',
  content: '',
  avatarUrl: null,
  rating: 5,
}

export default function TestimonialsConfig({ config, onChange }: Props) {
  const items = config.items || []

  const updateItem = (index: number, patch: Partial<TestimonialItem>) => {
    const next = items.map((item, i) => (i === index ? { ...item, ...patch } : item))
    onChange({ ...config, items: next })
  }

  const addItem = () => onChange({ ...config, items: [...items, { ...emptyItem }] })

  const removeItem = (index: number) => {
    onChange({ ...config, items: items.filter((_, i) => i !== index) })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((item, i) => (
        <div key={i} style={{ background: '#111', borderRadius: 8, padding: 10, border: '1px solid #262626' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: '#555' }}>Témoignage {i + 1}</span>
            <button
              type="button"
              onClick={() => removeItem(i)}
              style={{ background: 'none', border: 'none', color: '#E53E3E', fontSize: 12, cursor: 'pointer' }}
            >
              Supprimer
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Nom</label>
              <input
                type="text"
                value={item.name}
                onChange={e => updateItem(i, { name: e.target.value })}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Rôle</label>
              <input
                type="text"
                value={item.role}
                onChange={e => updateItem(i, { role: e.target.value })}
                placeholder="Coach, CEO..."
                style={inputStyle}
              />
            </div>
          </div>
          <div style={{ marginBottom: 6 }}>
            <label style={labelStyle}>Témoignage</label>
            <textarea
              value={item.content}
              onChange={e => updateItem(i, { content: e.target.value })}
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>
          <div>
            <label style={labelStyle}>Photo (URL)</label>
            <input
              type="url"
              value={item.avatarUrl || ''}
              onChange={e => updateItem(i, { avatarUrl: e.target.value || null })}
              placeholder="https://..."
              style={inputStyle}
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
        + Ajouter un témoignage
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
