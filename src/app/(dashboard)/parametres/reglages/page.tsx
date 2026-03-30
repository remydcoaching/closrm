'use client'

import { useEffect, useState } from 'react'
import ProfileForm from '@/components/settings/ProfileForm'
import WorkspaceForm from '@/components/settings/WorkspaceForm'
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
}

export default function ReglagesPage() {
  const [user, setUser] = useState<UserData | null>(null)
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function fetchData() {
    try {
      const res = await fetch('/api/user/profile')
      if (!res.ok) throw new Error('Impossible de charger le profil')
      const json = await res.json()
      setUser(json.data.user)
      setWorkspace(json.data.workspace)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <p style={{ color: '#888', fontSize: 14 }}>Chargement...</p>
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
          color: '#fff',
          marginBottom: 32,
        }}
      >
        Réglages
      </h1>

      <div
        style={{
          background: '#141416',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 10,
          padding: 24,
        }}
      >
        <ProfileForm user={user} onSave={fetchData} />
      </div>

      <div
        style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          margin: '32px 0',
        }}
      />

      <div
        style={{
          background: '#141416',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 10,
          padding: 24,
        }}
      >
        <WorkspaceForm workspace={workspace} onSave={fetchData} />
      </div>

      <div
        style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          margin: '32px 0',
        }}
      />

      <DeleteAccount workspaceName={workspace.name} />
    </div>
  )
}
