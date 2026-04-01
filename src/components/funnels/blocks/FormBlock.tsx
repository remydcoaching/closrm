'use client'

import { useState } from 'react'
import type { FormBlockConfig, FunnelFormField } from '@/types'

interface Props {
  config: FormBlockConfig
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  fontSize: 15,
  border: '1px solid #ddd',
  borderRadius: 8,
  background: '#fff',
  color: '#333',
  outline: 'none',
  boxSizing: 'border-box',
}

function FormField({ field }: { field: FunnelFormField }) {
  if (field.type === 'textarea') {
    return (
      <textarea
        name={field.key}
        placeholder={field.placeholder}
        required={field.required}
        rows={4}
        style={{ ...fieldStyle, resize: 'vertical' }}
      />
    )
  }

  if (field.type === 'select') {
    return (
      <select name={field.key} required={field.required} style={fieldStyle}>
        <option value="">{field.placeholder || 'Sélectionner...'}</option>
        {(field.options || []).map((opt, i) => (
          <option key={i} value={opt}>{opt}</option>
        ))}
      </select>
    )
  }

  return (
    <input
      type={field.type}
      name={field.key}
      placeholder={field.placeholder}
      required={field.required}
      style={fieldStyle}
    />
  )
}

export default function FormBlock({ config }: Props) {
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const data = Object.fromEntries(new FormData(form))
    console.log('[FormBlock] submission:', data)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', maxWidth: 500, margin: '0 auto' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
        <p style={{ fontSize: 18, color: '#333' }}>
          {config.successMessage || 'Merci ! Nous avons bien reçu votre candidature.'}
        </p>
      </div>
    )
  }

  return (
    <div style={{ padding: '40px 20px', maxWidth: 500, margin: '0 auto' }}>
      {config.title && (
        <h2 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 8px', color: '#111', textAlign: 'center' }}>
          {config.title}
        </h2>
      )}
      {config.subtitle && (
        <p style={{ fontSize: 15, color: '#666', margin: '0 0 24px', textAlign: 'center' }}>
          {config.subtitle}
        </p>
      )}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {(config.fields || []).map((field, i) => (
          <div key={i}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#444', display: 'block', marginBottom: 4 }}>
              {field.label}{field.required && <span style={{ color: '#E53E3E' }}> *</span>}
            </label>
            <FormField field={field} />
          </div>
        ))}
        <button
          type="submit"
          style={{
            padding: '12px 24px',
            fontSize: 16,
            fontWeight: 600,
            color: '#fff',
            background: 'var(--color-primary, #E53E3E)',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            marginTop: 8,
          }}
        >
          {config.submitText || 'Envoyer'}
        </button>
      </form>
    </div>
  )
}
