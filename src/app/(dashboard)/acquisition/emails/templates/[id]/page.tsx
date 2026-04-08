'use client'

import { useState, useEffect, useCallback, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import type { EmailBlock, EmailTemplate } from '@/types'
import EmailBlockBuilder from '@/components/emails/EmailBlockBuilder'
import EmailPreview from '@/components/emails/EmailPreview'

const TEMPLATE_VARIABLES = [
  { key: '{{prenom}}', label: 'Prenom du prospect' },
  { key: '{{nom}}', label: 'Nom du prospect' },
  { key: '{{email}}', label: 'Email du prospect' },
  { key: '{{telephone}}', label: 'Telephone' },
  { key: '{{nom_coach}}', label: 'Nom du coach' },
] as const

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
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [showVariables, setShowVariables] = useState(false)
  const [copiedVar, setCopiedVar] = useState('')
  const initialLoadDone = useRef(false)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch(`/api/emails/templates/${id}`)
      .then(r => r.json())
      .then((data: EmailTemplate) => {
        setTemplate(data)
        setBlocks(data.blocks || [])
        setName(data.name)
        setSubject(data.subject)
        setPreviewText(data.preview_text || '')
        // Mark initial load done after a tick so the auto-save doesn't fire on load
        setTimeout(() => { initialLoadDone.current = true }, 100)
      })
  }, [id])

  // Auto-save with 2s debounce
  useEffect(() => {
    if (!initialLoadDone.current || !template) return

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)

    autoSaveTimer.current = setTimeout(async () => {
      setAutoSaveStatus('saving')
      try {
        await fetch(`/api/emails/templates/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, subject, blocks, preview_text: previewText }),
        })
        setAutoSaveStatus('saved')
        setTimeout(() => setAutoSaveStatus('idle'), 2000)
      } catch {
        setAutoSaveStatus('idle')
      }
    }, 2000)

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    }
  }, [id, name, subject, blocks, previewText, template])

  const handleSave = useCallback(async () => {
    // Cancel pending auto-save
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    setSaving(true)
    setSaved(false)
    setAutoSaveStatus('idle')
    await fetch(`/api/emails/templates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, subject, blocks, preview_text: previewText }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [id, name, subject, blocks, previewText])

  function handleCopyVariable(variable: string) {
    navigator.clipboard.writeText(variable)
    setCopiedVar(variable)
    setTimeout(() => setCopiedVar(''), 1500)
    setShowVariables(false)
  }

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
          {/* Auto-save indicator */}
          {autoSaveStatus === 'saving' && (
            <span style={{ fontSize: 12, color: '#D69E2E' }}>Sauvegarde...</span>
          )}
          {autoSaveStatus === 'saved' && (
            <span style={{ fontSize: 12, color: '#00C853' }}>Sauvegarde automatique &#10003;</span>
          )}
          {saved && autoSaveStatus === 'idle' && (
            <span style={{ fontSize: 12, color: '#00C853' }}>Sauvegarde &#10003;</span>
          )}

          {/* Variables dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowVariables(v => !v)}
              style={{
                padding: '8px 14px', fontSize: 13, fontWeight: 500,
                background: '#1a1a1a', color: '#ccc', border: '1px solid #333',
                borderRadius: 8, cursor: 'pointer',
              }}
            >
              {'{{'} Variables {'}}'}
            </button>
            {showVariables && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 6,
                background: '#1a1a1a', border: '1px solid #333', borderRadius: 10,
                padding: 6, zIndex: 50, minWidth: 240, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}>
                {TEMPLATE_VARIABLES.map(v => (
                  <button
                    key={v.key}
                    onClick={() => handleCopyVariable(v.key)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      width: '100%', padding: '8px 10px', fontSize: 12,
                      background: copiedVar === v.key ? 'rgba(0,200,83,0.1)' : 'transparent',
                      color: '#ccc', border: 'none', borderRadius: 6, cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontFamily: 'monospace', color: '#E53E3E', marginRight: 8 }}>{v.key}</span>
                    <span style={{ color: '#666' }}>{copiedVar === v.key ? 'Copie !' : v.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

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
