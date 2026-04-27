'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { EmailTemplate, EmailBroadcastFilters } from '@/types'
import BroadcastFilterBuilder from '@/components/emails/BroadcastFilterBuilder'
import EmailPreview from '@/components/emails/EmailPreview'
import RichEmailEditor from '@/components/emails/RichEmailEditor'

type ComposeMode = 'template' | 'libre'

export default function NewBroadcastPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [mode, setMode] = useState<ComposeMode>('template')
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [filters, setFilters] = useState<EmailBroadcastFilters>({})
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const selectedTemplate = templates.find((t) => t.id === templateId)

  useEffect(() => {
    fetch('/api/emails/templates')
      .then((r) => r.json())
      .then((d) => setTemplates(Array.isArray(d) ? d : []))
  }, [])

  // Auto-fill subject when template changes
  useEffect(() => {
    if (mode === 'template' && templateId) {
      const tpl = templates.find((t) => t.id === templateId)
      if (tpl?.subject && !subject) setSubject(tpl.subject)
    }
  }, [templateId, templates, subject, mode])

  async function handleSend() {
    if (!name.trim()) {
      setError('Donne un nom à la campagne')
      return
    }
    if (!subject.trim()) {
      setError('Sujet requis')
      return
    }
    if (mode === 'template' && !templateId) {
      setError('Choisis un template')
      return
    }
    if (mode === 'libre' && !bodyText.trim()) {
      setError('Le message ne peut pas être vide')
      return
    }
    setError('')
    setSending(true)

    const payload: Record<string, unknown> = {
      name,
      subject,
      filters,
    }
    if (mode === 'template') {
      payload.template_id = templateId
    } else {
      // bodyText est du HTML (TipTap). On produit aussi une version text
      // pour les clients mail qui ne lisent que text/plain.
      payload.body_html = bodyText
      payload.body_text = bodyText
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }

    const createRes = await fetch('/api/emails/broadcasts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!createRes.ok) {
      setSending(false)
      const err = await createRes.json().catch(() => null)
      setError(err?.error || 'Erreur création campagne')
      return
    }

    const broadcast = await createRes.json()
    const sendRes = await fetch(`/api/emails/broadcasts/${broadcast.id}/send`, { method: 'POST' })
    const result = await sendRes.json()

    setSending(false)
    if (sendRes.ok) {
      router.push('/acquisition/emails?tab=campagnes')
    } else {
      setError(result.error || 'Erreur envoi')
    }
  }

  return (
    <div style={{ padding: '24px 32px' }}>
      <button
        onClick={() => router.push('/acquisition/emails?tab=campagnes')}
        style={{
          fontSize: 13,
          color: '#666',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          marginBottom: 24,
        }}
      >
        ← Retour aux campagnes
      </button>

      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 24 }}>
        Nouvelle campagne
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Left: config + filters */}
        <div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 4 }}>
              Nom de la campagne
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Promo janvier"
              style={inputStyle}
            />
          </div>

          {/* Mode toggle */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 6 }}>
              Contenu
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setMode('template')}
                style={{
                  flex: 1,
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid #333',
                  background: mode === 'template' ? 'var(--color-primary)' : 'transparent',
                  color: mode === 'template' ? '#fff' : '#888',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Template
              </button>
              <button
                type="button"
                onClick={() => setMode('libre')}
                style={{
                  flex: 1,
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid #333',
                  background: mode === 'libre' ? 'var(--color-primary)' : 'transparent',
                  color: mode === 'libre' ? '#fff' : '#888',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Email libre
              </button>
            </div>
          </div>

          {mode === 'template' ? (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 4 }}>
                Template email
              </label>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                style={inputStyle}
              >
                <option value="">Choisir un template...</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 4 }}>
                Message
              </label>
              <RichEmailEditor
                value={bodyText}
                onChange={setBodyText}
                placeholder="Écris ton message ici... Tu peux utiliser {{prenom}}, {{nom}} etc. via le bouton Variable."
                minHeight={240}
              />
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 4 }}>
              Sujet de l&apos;email
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex: Une offre spéciale pour toi {{prenom}}"
              style={inputStyle}
            />
          </div>

          {/* Filters */}
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 12 }}>
              Ciblage
            </h3>
            <BroadcastFilterBuilder filters={filters} onChange={setFilters} />
          </div>

          {error && <div style={{ fontSize: 12, color: '#E53E3E', marginBottom: 12 }}>{error}</div>}

          <button
            onClick={handleSend}
            disabled={sending}
            style={{
              padding: '10px 24px',
              fontSize: 14,
              fontWeight: 600,
              background: 'var(--color-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              opacity: sending ? 0.6 : 1,
              width: '100%',
            }}
          >
            {sending ? 'Envoi en cours...' : 'Envoyer maintenant'}
          </button>
        </div>

        {/* Right: email preview */}
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 12 }}>
            Aperçu de l&apos;email
          </h3>
          {mode === 'template' && selectedTemplate ? (
            <EmailPreview
              blocks={selectedTemplate.blocks || []}
              previewText={selectedTemplate.preview_text ?? undefined}
            />
          ) : mode === 'libre' && bodyText.trim() ? (
            <iframe
              sandbox=""
              srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;font-size:14px;line-height:1.6;background:#fff;}a{color:#E53E3E;}</style></head><body>${bodyText}</body></html>`}
              style={{
                width: '100%',
                minHeight: 280,
                border: '1px solid #262626',
                borderRadius: 10,
                background: '#fff',
              }}
            />
          ) : (
            <div
              style={{
                background: '#141414',
                border: '1px solid #262626',
                borderRadius: 10,
                padding: 40,
                textAlign: 'center',
                color: '#555',
                fontSize: 13,
              }}
            >
              {mode === 'template'
                ? "Sélectionne un template pour voir l'aperçu"
                : "Écris ton message pour voir l'aperçu"}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  fontSize: 13,
  background: '#0a0a0a',
  border: '1px solid #333',
  borderRadius: 8,
  color: '#fff',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}
