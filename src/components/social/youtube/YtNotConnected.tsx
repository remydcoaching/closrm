'use client'

import { Video, ExternalLink } from 'lucide-react'

export default function YtNotConnected() {
  return (
    <div style={{
      textAlign: 'center', padding: 60,
      background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border-primary)',
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: 'rgba(255,0,0,0.1)', border: '1px solid rgba(255,0,0,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 20px',
      }}>
        <Video size={30} style={{ color: '#FF0000' }} />
      </div>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
        Connecter ton compte YouTube
      </h2>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 24, maxWidth: 440, margin: '0 auto 24px' }}>
        Synchronise tes vidéos, analytics et commentaires. Publie ou programme des vidéos longues + Shorts depuis ClosRM.
      </p>
      <a
        href="/api/integrations/youtube/authorize"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '12px 24px', fontSize: 13, fontWeight: 600,
          color: '#fff', background: '#FF0000', textDecoration: 'none',
          borderRadius: 8,
        }}
      >
        <Video size={15} />
        <span>Connecter YouTube</span>
        <ExternalLink size={13} />
      </a>
    </div>
  )
}
