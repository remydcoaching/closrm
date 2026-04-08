'use client'

/**
 * T-028c — FormBlock (stub visuel "À venir").
 *
 * ⚠️ Ce bloc est volontairement un PLACEHOLDER fonctionnel en V1.
 * La logique réelle de soumission (création de lead, déclenchement workflow,
 * redirection) sera ajoutée dans une tâche dédiée — voir
 * `ameliorations.md → A-028a-02` pour le plan complet.
 *
 * Décision T-028a/c (validée le 2026-04-07) :
 * - On redesigne visuellement le bloc pour qu'il s'intègre au design system
 * - On affiche les champs en preview (read-only / désactivés visuellement)
 * - On bloque la soumission avec un overlay "À venir"
 *
 * Visuellement : titre + sous-titre + champs grisés + bouton de submit avec
 * label "À venir". Toutes les couleurs viennent du preset.
 *
 * Note : on garde le rendu des champs configurés pour que le coach puisse
 * voir à quoi ressemblera son formulaire dans le builder. Les champs sont
 * juste désactivés (`disabled`) et le `onSubmit` est neutralisé.
 */

import type { FormBlockConfig, FunnelFormField } from '@/types'

interface Props {
  config: FormBlockConfig
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
  cursor: 'not-allowed',
  opacity: 0.7,
}

function FormField({ field }: { field: FunnelFormField }) {
  // Tous les champs sont disabled — submission désactivée tant que A-028a-02 pas faite
  if (field.type === 'textarea') {
    return (
      <textarea
        name={field.key}
        placeholder={field.placeholder}
        rows={4}
        disabled
        style={{ ...fieldStyle, resize: 'vertical' }}
      />
    )
  }

  if (field.type === 'select') {
    return (
      <select name={field.key} disabled style={fieldStyle}>
        <option value="">{field.placeholder || 'Sélectionner...'}</option>
        {(field.options || []).map((opt, i) => (
          <option key={i} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    )
  }

  return (
    <input
      type={field.type}
      name={field.key}
      placeholder={field.placeholder}
      disabled
      style={fieldStyle}
    />
  )
}

export default function FormBlock({ config }: Props) {
  // Pas de state submitted ici : la submission est désactivée. Le coach peut
  // voir le formulaire en preview mais aucune interaction n'est possible.
  return (
    <div style={{ padding: '40px 20px', maxWidth: 540, margin: '0 auto' }}>
      <div
        style={{
          position: 'relative',
          background: 'var(--fnl-section-bg)',
          borderRadius: 20,
          padding: 32,
          border: '2px dashed rgba(var(--fnl-primary-rgb), 0.3)',
        }}
      >
        {/* Badge "À venir" en haut à droite de la card */}
        <div
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            padding: '6px 14px',
            background:
              'linear-gradient(135deg, var(--fnl-primary) 0%, var(--fnl-primary-light) 100%)',
            color: 'white',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 1,
            textTransform: 'uppercase',
            borderRadius: 50,
            boxShadow: '0 4px 15px rgba(var(--fnl-primary-rgb), 0.3)',
          }}
        >
          À venir
        </div>

        {config.title && (
          <h2
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: 'var(--fnl-primary)',
              margin: '0 0 8px',
              textAlign: 'center',
              lineHeight: 1.3,
            }}
          >
            {config.title}
          </h2>
        )}
        {config.subtitle && (
          <p
            style={{
              fontSize: 14,
              color: 'var(--fnl-text-secondary)',
              margin: '0 0 24px',
              textAlign: 'center',
              lineHeight: 1.6,
            }}
          >
            {config.subtitle}
          </p>
        )}

        <form
          onSubmit={(e) => e.preventDefault()}
          style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          {(config.fields || []).map((field, i) => (
            <div key={i}>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--fnl-text)',
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                {field.label}
                {field.required && (
                  <span style={{ color: 'var(--fnl-primary)', marginLeft: 4 }}>*</span>
                )}
              </label>
              <FormField field={field} />
            </div>
          ))}

          <button
            type="submit"
            disabled
            style={{
              padding: '14px 28px',
              fontSize: 16,
              fontWeight: 700,
              color: '#fff',
              background:
                'linear-gradient(135deg, var(--fnl-primary) 0%, var(--fnl-primary-light) 100%)',
              border: 'none',
              borderRadius: 50,
              marginTop: 8,
              opacity: 0.5,
              cursor: 'not-allowed',
              fontFamily: 'Poppins, sans-serif',
              boxShadow: '0 6px 20px rgba(var(--fnl-primary-rgb), 0.2)',
            }}
          >
            {config.submitText || 'Envoyer'} (à venir)
          </button>
        </form>

        <p
          style={{
            fontSize: 11,
            color: 'var(--fnl-text-secondary)',
            opacity: 0.7,
            margin: '16px 0 0',
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          Bientôt : création automatique de lead dans ClosRM, déclenchement de
          workflow et redirection.
        </p>
      </div>
    </div>
  )
}
