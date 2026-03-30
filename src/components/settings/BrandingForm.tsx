'use client'

import { useState, useRef } from 'react'
import { ACCENT_PRESETS, isValidHex } from '@/lib/branding/utils'
import { Upload, X, Check } from 'lucide-react'

interface Props {
  accentColor: string
  logoUrl: string | null
  onSave: () => void
}

export default function BrandingForm({ accentColor, logoUrl, onSave }: Props) {
  const [color, setColor] = useState(accentColor)
  const [hexInput, setHexInput] = useState(accentColor)
  const [logo, setLogo] = useState<string | null>(logoUrl)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const colorChanged = color !== accentColor
  const isDirty = colorChanged

  function handlePresetClick(hex: string) {
    setColor(hex)
    setHexInput(hex)
  }

  function handleHexChange(value: string) {
    setHexInput(value)
    if (isValidHex(value)) {
      setColor(value)
    }
  }

  async function handleSaveColor() {
    if (!isValidHex(color)) return
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/workspaces', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accent_color: color }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Erreur')
      }
      setMessage({ type: 'success', text: 'Couleur enregistrée.' })
      onSave()
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Erreur' })
    } finally {
      setSaving(false)
    }
  }

  async function handleLogoUpload(file: File) {
    setUploadingLogo(true)
    setMessage(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/workspaces/logo', { method: 'POST', body: formData })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Erreur')
      }
      const json = await res.json()
      setLogo(json.data.logo_url)
      setMessage({ type: 'success', text: 'Logo enregistré.' })
      onSave()
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Erreur' })
    } finally {
      setUploadingLogo(false)
    }
  }

  async function handleLogoDelete() {
    setUploadingLogo(true)
    setMessage(null)
    try {
      const res = await fetch('/api/workspaces/logo', { method: 'DELETE' })
      if (!res.ok) throw new Error('Erreur de suppression')
      setLogo(null)
      setMessage({ type: 'success', text: 'Logo supprimé.' })
      onSave()
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Erreur' })
    } finally {
      setUploadingLogo(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleLogoUpload(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleLogoUpload(file)
  }

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20 }}>
        Personnalisation
      </h2>

      {/* Color picker */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 10 }}>
          Couleur d&apos;accent
        </label>

        {/* Preset grid */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {ACCENT_PRESETS.map((preset) => (
            <button
              key={preset.hex}
              onClick={() => handlePresetClick(preset.hex)}
              title={preset.name}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: preset.hex,
                border: color === preset.hex ? '2px solid var(--text-primary)' : '2px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'border-color 0.15s ease',
              }}
            >
              {color === preset.hex && <Check size={14} color={preset.hex === '#000000' ? '#fff' : '#fff'} strokeWidth={3} />}
            </button>
          ))}
        </div>

        {/* Custom hex input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: isValidHex(hexInput) ? hexInput : color,
              border: '1px solid var(--border-secondary)',
              flexShrink: 0,
            }}
          />
          <input
            type="text"
            value={hexInput}
            onChange={(e) => handleHexChange(e.target.value)}
            placeholder="#000000"
            maxLength={7}
            style={{
              width: 100,
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid var(--border-secondary)',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontFamily: 'monospace',
            }}
          />
          {!isValidHex(hexInput) && hexInput.length > 1 && (
            <span style={{ fontSize: 12, color: '#ef4444' }}>Format invalide</span>
          )}
        </div>

        {/* Preview */}
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Apercu :</span>
          <button
            style={{
              padding: '5px 14px',
              borderRadius: 6,
              background: color,
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              border: 'none',
              cursor: 'default',
            }}
          >
            Bouton CTA
          </button>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 4,
              background: `${color}18`,
              color: color,
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            Badge
          </span>
        </div>

        {/* Save button */}
        {isDirty && (
          <button
            onClick={handleSaveColor}
            disabled={saving || !isValidHex(color)}
            style={{
              marginTop: 14,
              padding: '8px 20px',
              borderRadius: 8,
              background: color,
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Enregistrement...' : 'Enregistrer la couleur'}
          </button>
        )}
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--border-primary)', margin: '20px 0' }} />

      {/* Logo upload */}
      <div>
        <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 10 }}>
          Logo du workspace
        </label>

        {logo ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img
              src={logo}
              alt="Logo workspace"
              style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--border-secondary)' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadingLogo}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  background: 'var(--bg-hover)',
                  color: 'var(--text-secondary)',
                  fontSize: 12,
                  border: '1px solid var(--border-secondary)',
                  cursor: 'pointer',
                }}
              >
                Changer
              </button>
              <button
                onClick={handleLogoDelete}
                disabled={uploadingLogo}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  background: 'transparent',
                  color: '#ef4444',
                  fontSize: 12,
                  border: '1px solid rgba(239,68,68,0.3)',
                  cursor: 'pointer',
                }}
              >
                <X size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                Supprimer
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            style={{
              border: '2px dashed var(--border-secondary)',
              borderRadius: 10,
              padding: '24px 16px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'border-color 0.15s ease',
            }}
          >
            <Upload size={20} style={{ color: 'var(--text-muted)', marginBottom: 6 }} />
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              {uploadingLogo ? 'Upload en cours...' : 'Glisser ou cliquer pour uploader'}
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
              JPG, PNG ou WebP &bull; Max 2 Mo
            </p>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>

      {/* Message */}
      {message && (
        <p style={{
          marginTop: 14,
          fontSize: 13,
          color: message.type === 'success' ? 'var(--color-primary)' : '#ef4444',
        }}>
          {message.text}
        </p>
      )}
    </div>
  )
}
