'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import type { EmailBlock, EmailTemplate } from '@/types'
import EmailBlockBuilder from '@/components/emails/EmailBlockBuilder'
import EmailPreview from '@/components/emails/EmailPreview'

export default function TemplateEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [template, setTemplate] = useState<EmailTemplate | null>(null)
  const [blocks, setBlocks] = useState<EmailBlock[]>([])
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [previewText, setPreviewText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch(`/api/emails/templates/${id}`)
      .then(r => r.json())
      .then((data: EmailTemplate) => {
        setTemplate(data)
        setBlocks(data.blocks || [])
        setName(data.name)
        setSubject(data.subject)
        setPreviewText(data.preview_text || '')
      })
  }, [id])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setSaved(false)
    await fetch(`/api/emails/templates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, subject, blocks, preview_text: previewText }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [id, name, subject, blocks, previewText])

  if (!template) {
    return <div style={{ padding: '32px 40px', color: '#555' }}>Chargement...</div>
  }

  return (
    <div style={{ padding: '24px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <button onClick={() => router.push('/acquisition/emails/templates')} style={{
          fontSize: 13, color: '#666', background: 'none', border: 'none', cursor: 'pointer',
        }}>
          ← Retour aux templates
        </button>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {saved && <span style={{ fontSize: 12, color: '#00C853' }}>Sauvegardé</span>}
          <button onClick={handleSave} disabled={saving} style={{
            padding: '8px 20px', fontSize: 13, fontWeight: 600,
            background: 'var(--color-primary)', color: '#fff', border: 'none',
            borderRadius: 8, cursor: 'pointer', opacity: saving ? 0.6 : 1,
          }}>
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      {/* Meta fields */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 4 }}>Nom du template</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 4 }}>Sujet de l&apos;email</label>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Ex: Bienvenue chez Mon Coaching !"
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 4 }}>Texte d&apos;aperçu</label>
          <input
            type="text"
            value={previewText}
            onChange={e => setPreviewText(e.target.value)}
            placeholder="Texte visible dans la boîte de réception"
            style={inputStyle}
          />
        </div>
      </div>

      {/* Builder + Preview split */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 12 }}>Blocs</h3>
          <EmailBlockBuilder blocks={blocks} onChange={setBlocks} />
        </div>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 12 }}>Aperçu</h3>
          <EmailPreview blocks={blocks} previewText={previewText} />
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
