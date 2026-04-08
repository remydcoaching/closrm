'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { EmailTemplate, EmailBroadcastFilters } from '@/types'
import BroadcastFilterBuilder from '@/components/emails/BroadcastFilterBuilder'
import EmailPreview from '@/components/emails/EmailPreview'

export default function NewBroadcastPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [filters, setFilters] = useState<EmailBroadcastFilters>({})
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const selectedTemplate = templates.find(t => t.id === templateId)

  useEffect(() => {
    fetch('/api/emails/templates').then(r => r.json()).then(d => setTemplates(Array.isArray(d) ? d : []))
  }, [])

  // Auto-fill subject when template changes
  useEffect(() => {
    if (templateId) {
      const tpl = templates.find(t => t.id === templateId)
      if (tpl?.subject && !subject) setSubject(tpl.subject)
    }
  }, [templateId, templates, subject])

  async function handleSend() {
    if (!templateId) { setError('Choisis un template'); return }
    if (!name.trim()) { setError('Donne un nom à la campagne'); return }
    setError('')
    setSending(true)

    // Create broadcast
    const createRes = await fetch('/api/emails/broadcasts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, template_id: templateId, subject, filters }),
    })

    if (!createRes.ok) {
      setSending(false)
      setError('Erreur création campagne')
      return
    }

    const broadcast = await createRes.json()

    // Send it
    const sendRes = await fetch(`/api/emails/broadcasts/${broadcast.id}/send`, { method: 'POST' })
    const result = await sendRes.json()

    setSending(false)
    if (sendRes.ok) {
      router.push('/acquisition/emails/broadcasts')
    } else {
      setError(result.error || 'Erreur envoi')
    }
  }

  return (
    <div style={{ padding: '24px 32px' }}>
      <button onClick={() => router.push('/acquisition/emails/broadcasts')} style={{
        fontSize: 13, color: '#666', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 24,
      }}>
        ← Retour aux campagnes
      </button>

      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 24 }}>
        Nouvelle campagne
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Left: config + filters */}
        <div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 4 }}>Nom de la campagne</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Promo janvier"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 4 }}>Template email</label>
            <select
              value={templateId}
              onChange={e => setTemplateId(e.target.value)}
              style={inputStyle}
            >
              <option value="">Choisir un template...</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 4 }}>Sujet de l&apos;email</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Ex: Une offre spéciale pour toi {{prenom}}"
              style={inputStyle}
            />
          </div>

          {/* Filters */}
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 12 }}>Ciblage</h3>
            <BroadcastFilterBuilder filters={filters} onChange={setFilters} />
          </div>

          {error && <div style={{ fontSize: 12, color: '#E53E3E', marginBottom: 12 }}>{error}</div>}

          <button onClick={handleSend} disabled={sending} style={{
            padding: '10px 24px', fontSize: 14, fontWeight: 600,
            background: 'var(--color-primary)', color: '#fff', border: 'none',
            borderRadius: 8, cursor: 'pointer', opacity: sending ? 0.6 : 1,
            width: '100%',
          }}>
            {sending ? 'Envoi en cours...' : 'Envoyer maintenant'}
          </button>
        </div>

        {/* Right: email preview */}
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 12 }}>Apercu de l&apos;email</h3>
          {selectedTemplate ? (
            <EmailPreview blocks={selectedTemplate.blocks || []} previewText={selectedTemplate.preview_text ?? undefined} />
          ) : (
            <div style={{
              background: '#141414', border: '1px solid #262626', borderRadius: 10,
              padding: 40, textAlign: 'center', color: '#555', fontSize: 13,
            }}>
              Selectionne un template pour voir l&apos;apercu
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 13,
  background: '#0a0a0a', border: '1px solid #333', borderRadius: 8,
  color: '#fff', outline: 'none',
}
