'use client'

import { Instagram } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function IgNotConnected() {
  const router = useRouter()

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: 80, textAlign: 'center',
      background: 'var(--bg-secondary)', borderRadius: 12,
      border: '1px solid var(--border-primary)',
    }}>
      <Instagram size={48} style={{ color: 'var(--text-tertiary)', marginBottom: 16 }} />
      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
        Connectez votre compte Instagram
      </h3>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 24, maxWidth: 400 }}>
        Pour accéder aux stories, reels, calendrier de publication et messages,
        connectez d&apos;abord votre compte Instagram via l&apos;intégration Meta.
      </p>
      <button
        onClick={() => router.push('/parametres/integrations')}
        style={{
          padding: '10px 24px', fontSize: 13, fontWeight: 600,
          color: '#fff', background: 'var(--color-primary)',
          border: 'none', borderRadius: 8, cursor: 'pointer',
        }}
      >
        Aller aux intégrations
      </button>
    </div>
  )
}
