'use client'

import { useRef, useState, useCallback } from 'react'
import { useImageUpload } from '@/hooks/useImageUpload'

interface Props {
  value: string
  onChange: (url: string) => void
  funnelId: string
  label?: string
}

export default function ImageUploadField({ value, onChange, funnelId, label }: Props) {
  const { upload, isUploading, progress, error, reset } = useImageUpload({ funnelId })
  const inputRef = useRef<HTMLInputElement>(null)
  const [urlInput, setUrlInput] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  const handleFile = useCallback(async (file: File) => {
    try {
      const url = await upload(file)
      onChange(url)
    } catch {
      // l'erreur est déjà dans le state du hook
    }
  }, [upload, onChange])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleUrlSubmit = useCallback(() => {
    const trimmed = urlInput.trim()
    if (trimmed) {
      onChange(trimmed)
      setUrlInput('')
    }
  }, [urlInput, onChange])

  // État rempli
  if (value && !isUploading) {
    return (
      <div>
        {label && <label style={labelStyle}>{label}</label>}
        <div
          style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-primary)' }}
          onMouseEnter={e => { const ov = e.currentTarget.querySelector<HTMLElement>('.img-ov'); if (ov) ov.style.opacity = '1' }}
          onMouseLeave={e => { const ov = e.currentTarget.querySelector<HTMLElement>('.img-ov'); if (ov) ov.style.opacity = '0' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }} />
          <div
            className="img-ov"
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: 0, transition: '.15s' }}
          >
            <button type="button" onClick={() => inputRef.current?.click()} style={overlayBtn('var(--color-primary)')}>Changer</button>
            <button type="button" onClick={() => { onChange(''); reset() }} style={overlayBtn('rgba(255,255,255,0.15)')}>Supprimer</button>
          </div>
        </div>
        <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
      </div>
    )
  }

  // État upload en cours
  if (isUploading) {
    return (
      <div>
        {label && <label style={labelStyle}>{label}</label>}
        <div style={{ ...dropZoneBase, opacity: 0.7 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>Compression + upload…</span>
          <div style={{ width: '100%', background: 'var(--border-secondary)', borderRadius: 4, height: 4, overflow: 'hidden' }}>
            <div style={{ background: 'var(--color-primary)', height: '100%', width: `${progress}%`, transition: '.2s' }} />
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{progress}%</span>
        </div>
      </div>
    )
  }

  // État erreur
  if (error) {
    return (
      <div>
        {label && <label style={labelStyle}>{label}</label>}
        <div style={{ border: '2px dashed var(--color-primary)', borderRadius: 8, padding: '14px 12px', textAlign: 'center', background: 'var(--bg-input)' }}>
          <div style={{ fontSize: 12, color: 'var(--color-primary)', marginBottom: 6 }}>⚠️ {error}</div>
          <button type="button" onClick={reset} style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 5, padding: '3px 10px', cursor: 'pointer' }}>
            Réessayer
          </button>
        </div>
      </div>
    )
  }

  // État vide
  return (
    <div>
      {label && <label style={labelStyle}>{label}</label>}
      <div
        style={{ ...dropZoneBase, borderColor: isDragging ? 'var(--color-primary)' : 'var(--border-secondary)', cursor: 'pointer' }}
        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <span style={{ fontSize: 18, marginBottom: 4 }}>⬆</span>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Glisse ou{' '}
          <span style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>clique pour uploader</span>
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>JPG PNG WebP · max 15 Mo</span>
      </div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '8px 0' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--border-primary)' }} />
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>ou URL</span>
        <div style={{ flex: 1, height: 1, background: 'var(--border-primary)' }} />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="url"
          value={urlInput}
          onChange={e => setUrlInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleUrlSubmit()}
          placeholder="https://..."
          style={{ flex: 1, padding: '7px 10px', fontSize: 12, background: 'var(--bg-input)', border: '1px solid var(--border-primary)', borderRadius: 8, color: 'var(--text-primary)', outline: 'none' }}
        />
        <button type="button" onClick={handleUrlSubmit} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)', borderRadius: 8, padding: '0 10px', fontSize: 12, cursor: 'pointer' }}>
          OK
        </button>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4,
}

const dropZoneBase: React.CSSProperties = {
  border: '2px dashed var(--border-secondary)',
  borderRadius: 8,
  padding: '18px 12px',
  textAlign: 'center',
  background: 'var(--bg-input)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
}

function overlayBtn(bg: string): React.CSSProperties {
  return { background: bg, color: 'var(--text-primary)', padding: '4px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer', border: 'none' }
}
