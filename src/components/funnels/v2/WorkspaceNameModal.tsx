'use client'

/**
 * T-028 Phase 17 — Modale "Choisissez un nom pour vos pages"
 *
 * S'ouvre automatiquement quand le coach clique "Publier" sans avoir encore
 * défini de nom pour son espace (= le slug du workspace dans la table
 * `workspace_slugs`). Le coach ne voit jamais le mot "slug" — on lui
 * demande simplement de choisir un nom court qui apparaîtra dans l'URL
 * de ses pages publiées.
 *
 * Flow :
 * 1. Coach clique "Publier"
 * 2. handlePublish détecte workspaceSlug === null
 * 3. Ouvre cette modale
 * 4. Coach tape "remyd-coaching" → valide
 * 5. PUT /api/workspaces/slug → sauvegarde
 * 6. Callback onSaved(slug) → le parent enchaîne la publication
 * 7. Si le coach annule → ferme la modale, ne publie pas
 */

import { useState } from 'react'

interface Props {
  /** Callback quand le slug est sauvegardé avec succès. Le parent peut
   * enchaîner la publication dans ce callback. */
  onSaved: (slug: string) => void
  /** Ferme la modale sans sauvegarder (= annulation). */
  onCancel: () => void
}

export default function WorkspaceNameModal({ onSaved, onCancel }: Props) {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Normalise le texte saisi en un slug valide (lowercase, pas d'accents, tirets)
  const normalized = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  const isValid = normalized.length >= 3

  const handleSubmit = async () => {
    if (!isValid || saving) return
    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/workspaces/slug', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: normalized }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => null)
        const msg = json?.error || `Erreur (${res.status})`
        // Message user-friendly selon le cas
        if (res.status === 409) {
          setError('Ce nom est déjà pris. Essaie un autre.')
        } else {
          setError(msg)
        }
        return
      }

      onSaved(normalized)
    } catch {
      setError('Erreur de connexion. Réessaie.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          zIndex: 9998,
          backdropFilter: 'blur(4px)',
        }}
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 420,
          maxWidth: 'calc(100vw - 40px)',
          background: '#141414',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          padding: 32,
          zIndex: 9999,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Choisir un nom pour vos pages"
      >
        <h2
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: '#fff',
            margin: '0 0 8px',
          }}
        >
          Choisissez un nom pour vos pages
        </h2>
        <p
          style={{
            fontSize: 13,
            color: '#888',
            margin: '0 0 20px',
            lineHeight: 1.5,
          }}
        >
          Ce nom apparaîtra dans l&apos;adresse de toutes vos pages publiées.
          Vous ne pouvez le choisir qu&apos;une seule fois.
        </p>

        {/* Input */}
        <div style={{ marginBottom: 12 }}>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit()
              if (e.key === 'Escape') onCancel()
            }}
            placeholder="mon-coaching"
            autoFocus
            style={{
              width: '100%',
              padding: '12px 14px',
              fontSize: 15,
              fontWeight: 500,
              background: '#0a0a0a',
              border: error
                ? '1px solid rgba(229,62,62,0.5)'
                : '1px solid rgba(255,255,255,0.15)',
              borderRadius: 10,
              color: '#fff',
              outline: 'none',
              boxSizing: 'border-box',
              fontFamily: 'monospace',
            }}
          />
        </div>

        {/* Preview de l'URL */}
        <div
          style={{
            fontSize: 12,
            color: '#666',
            marginBottom: 16,
            fontFamily: 'monospace',
            wordBreak: 'break-all',
          }}
        >
          {normalized ? (
            <>
              Vos pages seront accessibles sur :{' '}
              <span style={{ color: '#22d3ee' }}>
                {typeof window !== 'undefined' ? window.location.host : 'closrm.fr'}
                /f/<strong>{normalized}</strong>/...
              </span>
            </>
          ) : (
            <span style={{ fontStyle: 'italic' }}>
              Tapez un nom pour voir l&apos;adresse
            </span>
          )}
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              fontSize: 12,
              color: '#E53E3E',
              marginBottom: 12,
              padding: '8px 12px',
              background: 'rgba(229,62,62,0.08)',
              border: '1px solid rgba(229,62,62,0.2)',
              borderRadius: 8,
            }}
          >
            {error}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: 600,
              background: 'rgba(255,255,255,0.06)',
              color: '#aaa',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || saving}
            style={{
              padding: '10px 24px',
              fontSize: 13,
              fontWeight: 700,
              background: isValid ? '#E53E3E' : 'rgba(229,62,62,0.3)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: !isValid || saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
              fontFamily: 'inherit',
              transition: 'all 0.15s ease',
            }}
          >
            {saving ? 'Enregistrement...' : 'Valider et publier'}
          </button>
        </div>
      </div>
    </>
  )
}
