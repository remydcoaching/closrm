'use client'

/**
 * A-028a-02 — FormBlock fonctionnel.
 *
 * Formulaire de capture de leads intégré dans les funnels. En mode public
 * (page publiée), soumet les données via POST /api/public/f/submit qui
 * crée le lead + fire les triggers workflow + incrémente submissions_count.
 *
 * En mode preview (builder), les champs sont interactifs pour tester le
 * rendu mais la soumission est désactivée.
 *
 * Après soumission :
 * - Si config.redirectUrl → redirection
 * - Sinon → affiche config.successMessage
 */

import { useState } from 'react'
import type { FormBlockConfig, FunnelFormField } from '@/types'
import { useFunnelRender } from '../FunnelRenderContext'
import { resolveFunnelUrl } from '@/lib/funnels/resolve-url'

interface Props {
  config: FormBlockConfig
}

export default function FormBlock({ config }: Props) {
  const { funnelPageId } = useFunnelRender()
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // En mode preview (builder), simuler le succès sans appel API
    if (!funnelPageId) {
      if (config.redirectUrl) {
        window.location.href = resolveFunnelUrl(config.redirectUrl)
        return
      }
      setSubmitted(true)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/public/f/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funnel_page_id: funnelPageId,
          fields: formData,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Erreur lors de l\'envoi.')
        return
      }

      // Redirect or show success message
      if (config.redirectUrl) {
        window.location.href = resolveFunnelUrl(config.redirectUrl)
        return
      }

      setSubmitted(true)
    } catch {
      setError('Erreur réseau. Veuillez réessayer.')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Success state ──────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div style={{ padding: '40px 20px', maxWidth: 540, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
        <h2 style={titleStyle}>
          {config.successMessage || 'Merci ! Nous reviendrons vers toi sous 24h.'}
        </h2>
      </div>
    )
  }

  // ─── Form ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '40px 20px', maxWidth: 540, margin: '0 auto' }}>
      <div style={cardStyle}>
        {config.title && (
          <h2 style={titleStyle}>{config.title}</h2>
        )}
        {config.subtitle && (
          <p style={subtitleStyle}>{config.subtitle}</p>
        )}

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          {(config.fields || []).map((field, i) => (
            <div key={i}>
              <label style={labelStyle}>
                {field.label}
                {field.required && (
                  <span style={{ color: 'var(--fnl-primary)', marginLeft: 4 }}>*</span>
                )}
              </label>
              <FormField
                field={field}
                value={formData[field.key] ?? ''}
                onChange={(val) => setFormData(p => ({ ...p, [field.key]: val }))}
                disabled={false}
              />
            </div>
          ))}

          {error && (
            <div style={{ color: 'var(--fnl-primary)', fontSize: 13 }}>{error}</div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={submitButtonStyle(submitting)}
          >
            {submitting ? 'Envoi en cours...' : config.submitText || 'Envoyer'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Field renderer ─────────────────────────────────────────────────────────

function FormField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FunnelFormField
  value: string
  onChange: (val: string) => void
  disabled: boolean
}) {
  if (field.type === 'textarea') {
    return (
      <textarea
        name={field.key}
        placeholder={field.placeholder}
        rows={4}
        required={field.required}
        disabled={disabled}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ ...fieldStyle, resize: 'vertical' }}
      />
    )
  }

  if (field.type === 'select') {
    return (
      <select
        name={field.key}
        required={field.required}
        disabled={disabled}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={fieldStyle}
      >
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
      disabled={disabled}
      value={value}
      onChange={e => onChange(e.target.value)}
      style={fieldStyle}
    />
  )
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  position: 'relative',
  background: 'var(--fnl-section-bg, rgba(var(--fnl-primary-rgb), 0.02))',
  borderRadius: 20,
  padding: 32,
  border: '1px solid rgba(var(--fnl-primary-rgb), 0.12)',
}

const titleStyle: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 800,
  color: 'var(--fnl-primary)',
  margin: '0 0 8px',
  textAlign: 'center',
  lineHeight: 1.3,
}

const subtitleStyle: React.CSSProperties = {
  fontSize: 14,
  color: 'var(--fnl-text-secondary)',
  margin: '0 0 24px',
  textAlign: 'center',
  lineHeight: 1.6,
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--fnl-text)',
  display: 'block',
  marginBottom: 6,
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  fontSize: 15,
  border: '1px solid rgba(var(--fnl-primary-rgb), 0.2)',
  borderRadius: 10,
  background: 'rgba(var(--fnl-primary-rgb), 0.03)',
  color: 'var(--fnl-text)',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'Poppins, sans-serif',
}

const submitButtonStyle = (disabled: boolean): React.CSSProperties => ({
  padding: '14px 28px',
  fontSize: 16,
  fontWeight: 700,
  color: '#fff',
  background: disabled
    ? 'rgba(var(--fnl-primary-rgb), 0.4)'
    : 'linear-gradient(135deg, var(--fnl-primary) 0%, var(--fnl-primary-light) 100%)',
  border: 'none',
  borderRadius: 50,
  marginTop: 8,
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontFamily: 'Poppins, sans-serif',
  boxShadow: disabled ? 'none' : '0 6px 20px rgba(var(--fnl-primary-rgb), 0.2)',
  transition: 'all 0.2s',
})
