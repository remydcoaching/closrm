'use client'

import { useState, useRef } from 'react'
import { User, Camera } from 'lucide-react'

interface Props {
  user: { id: string; full_name: string; email: string; avatar_url: string | null }
  onSave: () => void
}

export default function ProfileForm({ user, onSave }: Props) {
  const [fullName, setFullName] = useState(user.full_name)
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/user/avatar', { method: 'POST', body: formData })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error || 'Erreur upload')
        return
      }

      setAvatarUrl(json.data.url)
    } catch {
      setError('Erreur lors de l\'upload')
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    if (fullName.trim().length < 2) {
      setError('Le nom doit faire au moins 2 caractères.')
      setSaving(false)
      return
    }

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName.trim() }),
      })

      if (!res.ok) {
        const json = await res.json()
        setError(json.error || 'Erreur sauvegarde')
        return
      }

      setSuccess(true)
      onSave()
    } catch {
      setError('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20 }}>
        Profil
      </h2>

      {/* Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Avatar"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <User size={28} color="#555" />
          )}
        </div>
        <div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              fontSize: 13,
              color: 'var(--text-primary)',
              background: 'var(--bg-hover)',
              border: '1px solid var(--border-primary)',
              borderRadius: 6,
              cursor: uploading ? 'not-allowed' : 'pointer',
              opacity: uploading ? 0.5 : 1,
            }}
          >
            <Camera size={14} />
            {uploading ? 'Upload...' : 'Changer la photo'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleAvatarChange}
            style={{ display: 'none' }}
          />
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            JPG, PNG ou WebP. Max 2 Mo.
          </p>
        </div>
      </div>

      {/* Full name */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 6 }}>
          Nom complet
        </label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => { setFullName(e.target.value); setError(null); setSuccess(false) }}
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: 14,
            color: 'var(--text-primary)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-primary)',
            borderRadius: 6,
            outline: 'none',
          }}
        />
      </div>

      {/* Email (read-only) */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 6 }}>
          Email
        </label>
        <input
          type="email"
          value={user.email}
          disabled
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: 14,
            color: 'var(--text-muted)',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
            borderRadius: 6,
            cursor: 'not-allowed',
          }}
        />
      </div>

      {error && (
        <p style={{ fontSize: 13, color: '#ef4444', marginBottom: 12 }}>{error}</p>
      )}
      {success && (
        <p style={{ fontSize: 13, color: 'var(--color-primary)', marginBottom: 12 }}>Profil mis à jour.</p>
      )}

      <button
        type="submit"
        disabled={saving}
        style={{
          padding: '8px 20px',
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--text-primary)',
          background: 'var(--color-primary)',
          border: 'none',
          borderRadius: 6,
          cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? 'Enregistrement...' : 'Enregistrer'}
      </button>
    </form>
  )
}
