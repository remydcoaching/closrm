'use client'

// T-048 — Panneau de config du bloc "Problèmes".

import type { ProblemsBlockConfig, ProblemItem } from '@/types'
import ReorderableItemList from './ReorderableItemList'
import IconPicker from './IconPicker'
import ImageUploadField from './ImageUploadField'

interface Props {
  config: ProblemsBlockConfig
  onChange: (config: ProblemsBlockConfig) => void
  funnelId: string
}

export default function ProblemsConfig({ config, onChange, funnelId }: Props) {
  const items = config.items || []

  const updateItem = (index: number, patch: Partial<ProblemItem>) => {
    const next = items.map((item, i) => (i === index ? { ...item, ...patch } : item))
    onChange({ ...config, items: next })
  }

  const addItem = () => onChange({
    ...config,
    items: [
      ...items,
      { id: crypto.randomUUID(), title: '', description: '', showNumber: true, icon: null, imageUrl: null },
    ],
  })

  const removeItem = (index: number) => onChange({ ...config, items: items.filter((_, i) => i !== index) })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label style={labelStyle}>Titre de la section</label>
        <input
          type="text"
          value={config.title}
          onChange={e => onChange({ ...config, title: e.target.value })}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Sous-titre (optionnel)</label>
        <input
          type="text"
          value={config.subtitle || ''}
          onChange={e => onChange({ ...config, subtitle: e.target.value || undefined })}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Colonnes (desktop)</label>
        <select
          value={config.columns}
          onChange={e => onChange({ ...config, columns: Number(e.target.value) as 1 | 2 | 3 })}
          style={inputStyle}
        >
          <option value={1}>1 colonne</option>
          <option value={2}>2 colonnes</option>
          <option value={3}>3 colonnes</option>
        </select>
      </div>

      <ReorderableItemList
        items={items}
        onChange={next => onChange({ ...config, items: next })}
        onAdd={addItem}
        addLabel="Ajouter un problème"
        renderItem={(item, i) => (
          <div style={{ background: '#111', borderRadius: 8, padding: 10, border: '1px solid #262626' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: '#555' }}>Problème {i + 1}</span>
              <button
                type="button"
                onClick={() => removeItem(i)}
                style={{ background: 'none', border: 'none', color: '#E53E3E', fontSize: 12, cursor: 'pointer' }}
              >
                Supprimer
              </button>
            </div>
            <div style={{ marginBottom: 6 }}>
              <label style={labelStyle}>Titre</label>
              <input
                type="text"
                value={item.title}
                onChange={e => updateItem(i, { title: e.target.value })}
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: 6 }}>
              <label style={labelStyle}>Description</label>
              <textarea
                value={item.description}
                onChange={e => updateItem(i, { description: e.target.value })}
                rows={2}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#aaa', cursor: 'pointer', marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={item.showNumber}
                onChange={e => updateItem(i, { showNumber: e.target.checked })}
                style={{ accentColor: 'var(--color-primary)' }}
              />
              Afficher le numéro
            </label>
            <div style={{ marginBottom: 6 }}>
              <label style={labelStyle}>Icône (optionnelle)</label>
              <IconPicker value={item.icon} onChange={icon => updateItem(i, { icon })} />
            </div>
            <ImageUploadField
              value={item.imageUrl || ''}
              onChange={url => updateItem(i, { imageUrl: url || null })}
              funnelId={funnelId}
              label="Image (optionnelle)"
            />
          </div>
        )}
      />
    </div>
  )
}

const labelStyle: React.CSSProperties = { fontSize: 11, color: '#555', display: 'block', marginBottom: 4 }
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 13,
  background: '#0a0a0a', border: '1px solid #333', borderRadius: 8,
  color: '#fff', outline: 'none',
}
