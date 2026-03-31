'use client'

import { FormField, FormFieldType } from '@/types'

interface FormFieldsEditorProps {
  fields: FormField[]
  onChange: (fields: FormField[]) => void
}

const FIELD_TYPE_LABELS: { value: FormFieldType; label: string }[] = [
  { value: 'text', label: 'Texte' },
  { value: 'tel', label: 'Téléphone' },
  { value: 'email', label: 'Email' },
  { value: 'textarea', label: 'Texte long' },
  { value: 'select', label: 'Liste' },
]

function generateKey() {
  return `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export default function FormFieldsEditor({ fields, onChange }: FormFieldsEditorProps) {
  function addField() {
    onChange([
      ...fields,
      { key: generateKey(), label: '', type: 'text', required: false },
    ])
  }

  function removeField(index: number) {
    onChange(fields.filter((_, i) => i !== index))
  }

  function updateField(index: number, patch: Partial<FormField>) {
    const updated = [...fields]
    updated[index] = { ...updated[index], ...patch }
    onChange(updated)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {fields.map((field, idx) => (
        <div
          key={field.key}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-primary)',
            borderRadius: 8,
            padding: '8px 12px',
          }}
        >
          {/* Grip icon */}
          <div style={{ color: 'var(--text-muted)', cursor: 'grab', flexShrink: 0 }} title="Réorganiser">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="5" r="1" fill="currentColor" />
              <circle cx="9" cy="12" r="1" fill="currentColor" />
              <circle cx="9" cy="19" r="1" fill="currentColor" />
              <circle cx="15" cy="5" r="1" fill="currentColor" />
              <circle cx="15" cy="12" r="1" fill="currentColor" />
              <circle cx="15" cy="19" r="1" fill="currentColor" />
            </svg>
          </div>

          {/* Label input */}
          <input
            type="text"
            placeholder="Libellé du champ"
            value={field.label}
            onChange={e => updateField(idx, { label: e.target.value })}
            style={{
              flex: 1,
              background: 'var(--bg-input)',
              border: '1px solid var(--border-primary)',
              borderRadius: 6,
              padding: '5px 10px',
              fontSize: 13,
              color: 'var(--text-primary)',
              outline: 'none',
              minWidth: 0,
            }}
          />

          {/* Type select */}
          <select
            value={field.type}
            onChange={e => updateField(idx, { type: e.target.value as FormFieldType })}
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-primary)',
              borderRadius: 6,
              padding: '5px 10px',
              fontSize: 13,
              color: 'var(--text-primary)',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {FIELD_TYPE_LABELS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* Required checkbox */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', flexShrink: 0 }}>
            <input
              type="checkbox"
              checked={field.required}
              onChange={e => updateField(idx, { required: e.target.checked })}
              style={{ accentColor: '#E53E3E', width: 13, height: 13, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Requis</span>
          </label>

          {/* Remove button */}
          <button
            onClick={() => removeField(idx)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              padding: '0 2px',
              flexShrink: 0,
            }}
            title="Supprimer ce champ"
          >
            ×
          </button>
        </div>
      ))}

      <button
        onClick={addField}
        style={{
          background: 'none',
          border: '1px dashed var(--border-primary)',
          borderRadius: 8,
          padding: '8px 16px',
          fontSize: 13,
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          alignSelf: 'flex-start',
          marginTop: 4,
        }}
      >
        + Ajouter un champ
      </button>
    </div>
  )
}
