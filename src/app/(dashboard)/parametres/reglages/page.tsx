'use client'

import { useEffect, useState } from 'react'
import ProfileForm from '@/components/settings/ProfileForm'
import WorkspaceForm from '@/components/settings/WorkspaceForm'
import BrandingForm from '@/components/settings/BrandingForm'
import DeleteAccount from '@/components/settings/DeleteAccount'

interface UserData {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
}

interface WorkspaceData {
  id: string
  name: string
  timezone: string
  accent_color: string
  logo_url: string | null
}

export default function ReglagesPage() {
  const [user, setUser] = useState<UserData | null>(null)
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [slug, setSlug] = useState('')
  const [slugSaving, setSlugSaving] = useState(false)
  const [slugError, setSlugError] = useState<string | null>(null)
  const [slugSuccess, setSlugSuccess] = useState(false)

  async function fetchData() {
    try {
      const [profileRes, slugRes] = await Promise.all([
        fetch('/api/user/profile'),
        fetch('/api/workspaces/slug'),
      ])
      if (!profileRes.ok) throw new Error('Impossible de charger le profil')
      const json = await profileRes.json()
      setUser(json.data.user)
      setWorkspace(json.data.workspace)
      if (slugRes.ok) {
        const slugJson = await slugRes.json()
        setSlug(slugJson.slug || '')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  async function saveSlug() {
    setSlugSaving(true)
    setSlugError(null)
    setSlugSuccess(false)
    try {
      const res = await fetch('/api/workspaces/slug', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error || 'Erreur')
      }
      setSlugSuccess(true)
      setTimeout(() => setSlugSuccess(false), 3000)
    } catch (err) {
      setSlugError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSlugSaving(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Chargement...</p>
      </div>
    )
  }

  if (error || !user || !workspace) {
    return (
      <div style={{ padding: 32 }}>
        <p style={{ color: '#ef4444', fontSize: 14 }}>{error || 'Erreur de chargement'}</p>
      </div>
    )
  }

  return (
    <div style={{ padding: 32, maxWidth: 640 }}>
      <h1
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: 32,
        }}
      >
        Réglages
      </h1>

      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-primary)',
          borderRadius: 10,
          padding: 24,
        }}
      >
        <ProfileForm user={user} onSave={fetchData} />
      </div>

      <div
        style={{
          borderTop: '1px solid var(--border-primary)',
          margin: '32px 0',
        }}
      />

      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-primary)',
          borderRadius: 10,
          padding: 24,
        }}
      >
        <WorkspaceForm workspace={workspace} onSave={fetchData} />
      </div>

      <div
        style={{
          borderTop: '1px solid var(--border-primary)',
          margin: '32px 0',
        }}
      />

      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-primary)',
          borderRadius: 10,
          padding: 24,
        }}
      >
        <BrandingForm
          accentColor={workspace.accent_color ?? '#00C853'}
          logoUrl={workspace.logo_url ?? null}
          onSave={fetchData}
        />
      </div>

      <div
        style={{
          borderTop: '1px solid var(--border-primary)',
          margin: '32px 0',
        }}
      />

      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-primary)',
          borderRadius: 10,
          padding: 24,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
          Lien de prise de RDV
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16 }}>
          Ce slug est utilisé dans l&apos;URL publique de vos calendriers de prise de RDV.
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              <span style={{
                padding: '9px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
                borderRight: 'none', borderRadius: '8px 0 0 8px', fontSize: 13, color: 'var(--text-tertiary)',
                whiteSpace: 'nowrap',
              }}>
                {typeof window !== 'undefined' ? window.location.origin : ''}/book/
              </span>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="mon-slug"
                style={{
                  flex: 1, padding: '9px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-primary)',
                  borderRadius: '0 8px 8px 0', color: 'var(--text-primary)', fontSize: 13, outline: 'none',
                  minWidth: 120,
                }}
              />
            </div>
            {slugError && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 6 }}>{slugError}</p>}
            {slugSuccess && <p style={{ color: '#38A169', fontSize: 12, marginTop: 6 }}>Slug sauvegardé !</p>}
          </div>
          <button
            onClick={saveSlug}
            disabled={slugSaving || !slug}
            style={{
              padding: '9px 20px', background: '#E53E3E', color: '#fff', border: 'none',
              borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              opacity: slugSaving || !slug ? 0.5 : 1,
            }}
          >
            {slugSaving ? '...' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      <div
        style={{
          borderTop: '1px solid var(--border-primary)',
          margin: '32px 0',
        }}
      />

      <DeleteAccount workspaceName={workspace.name} />
    </div>
  )
}
