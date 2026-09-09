'use client'

// T-048 — Panneau de config du bloc "C'est pour toi / Pas pour toi".
// Deux colonnes indépendantes (yes/no), chacune avec sa propre liste de
// points réordonnable.

import type { QualifierBlockConfig, QualifierColumn, QualifierPoint } from '@/types'
import ReorderableItemList from './ReorderableItemList'
import IconPicker from './IconPicker'

interface Props {
  config: QualifierBlockConfig
  onChange: (config: QualifierBlockConfig) => void
}

function ColumnEditor({
  column, onChange, addLabel,
}: {
  column: QualifierColumn
  onChange: (column: QualifierColumn) => void
  addLabel: string
}) {
  const items = column.items || []

  const updateItem = (index: number, patch: Partial<QualifierPoint>) => {
    const next = items.map((item, i) => (i === index ? { ...item, ...patch } : item))
    onChange({ ...column, items: next })
  }

  const addItem = () => onChange({ ...column, items: [...items, { id: crypto.randomUUID(), text: '' }] })
  const removeItem = (index: number) => onChange({ ...column, items: items.filter((_, i) => i !== index) })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: '#0d0d0d', border: '1px solid #262626', borderRadius: 8, padding: 10 }}>
      <div>
        <label style={labelStyle}>Titre de la colonne</label>
        <input
          type="text"
          value={column.title}
          onChange={e => onChange({ ...column, title: e.target.value })}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Sous-titre (optionnel)</label>
        <input
          type="text"
          value={column.subtitle || ''}
          onChange={e => onChange({ ...column, subtitle: e.target.value || undefined })}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Icône (optionnelle)</label>
        <IconPicker value={column.icon} onChange={icon => onChange({ ...column, icon })} />
      </div>
      <ReorderableItemList
        items={items}
        onChange={next => onChange({ ...column, items: next })}
        onAdd={addItem}
        addLabel={addLabel}
        renderItem={(item, i) => (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="text"
              value={item.text}
              onChange={e => updateItem(i, { text: e.target.value })}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              type="button"
              onClick={() => removeItem(i)}
              style={{ background: 'none', border: 'none', color: '#E53E3E', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}
            >
              ✕
            </button>
          </div>
        )}
      />
    </div>
  )
}

export default function QualifierConfig({ config, onChange }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <ColumnEditor
        column={config.yes}
        onChange={yes => onChange({ ...config, yes })}
        addLabel="Ajouter un critère"
      />
      <ColumnEditor
        column={config.no}
        onChange={no => onChange({ ...config, no })}
        addLabel="Ajouter un critère"
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
