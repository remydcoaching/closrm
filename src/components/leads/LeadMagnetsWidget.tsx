'use client'
import { useEffect, useState } from 'react'
import type { LeadMagnet, LeadMagnetPlatform } from '@/types'

interface TrackedLinkInfo {
  short_code: string
  clicks_count: number
  last_clicked_at: string | null
  lead_magnet_id: string
}

interface Props { leadId: string }

const PLATFORM_EMOJI: Record<LeadMagnetPlatform, string> = {
  youtube: '🎥', tiktok: '🎵', instagram: '📷',
  podcast: '🎧', blog: '📝', pdf: '📘', other: '🔗',
}

export default function LeadMagnetsWidget({ leadId }: Props) {
  const [magnets, setMagnets] = useState<LeadMagnet[]>([])
  const [tracks, setTracks] = useState<TrackedLinkInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/lead-magnets').then(r => r.json()),
      fetch(`/api/leads/${leadId}/clicks`).then(r => r.json()),
    ]).then(([{ lead_magnets }, { tracked_links }]) => {
      setMagnets(lead_magnets ?? [])
      setTracks(tracked_links ?? [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [leadId])

  async function handleCopy(magnetId: string) {
    setPendingId(magnetId)
    try {
      const res = await fetch(`/api/lead-magnets/${magnetId}/track-for-lead`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId }),
      })
      const { full_url, short_code } = await res.json()
      if (full_url) {
        await navigator.clipboard.writeText(full_url)
        setToast('Lien copié !')
        setTimeout(() => setToast(null), 2000)
        setTracks(prev => prev.some(t => t.lead_magnet_id === magnetId)
          ? prev
          : [...prev, { short_code, clicks_count: 0, last_clicked_at: null, lead_magnet_id: magnetId }])
      }
    } finally {
      setPendingId(null)
    }
  }

  if (loading) {
    return <div style={{ padding: 12, color: 'var(--color-text-secondary)', fontSize: 12 }}>Chargement…</div>
  }
  if (magnets.length === 0) {
    return (
      <div style={{ padding: 12, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Lead Magnets
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
          Aucun lead magnet.{' '}
          <a href="/acquisition/lead-magnets" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>En créer un →</a>
        </div>
      </div>
    )
  }

  const trackByMagnet = new Map(tracks.map(t => [t.lead_magnet_id, t]))

  return (
    <div style={{ padding: 12, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Lead Magnets
      </div>
      {magnets.map((m, idx) => {
        const t = trackByMagnet.get(m.id)
        const lastLabel = t && t.clicks_count > 0
          ? `${t.clicks_count} clic${t.clicks_count > 1 ? 's' : ''}${t.last_clicked_at ? ` · dernier ${formatRelative(t.last_clicked_at)}` : ''}`
          : t ? 'lien généré, pas encore cliqué' : 'pas encore envoyé'
        const isPending = pendingId === m.id
        return (
          <div
            key={m.id}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 0', borderBottom: idx === magnets.length - 1 ? 'none' : '1px solid var(--color-border)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, marginRight: 8 }}>
              <div style={{ fontSize: 13, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span style={{ marginRight: 6 }}>{PLATFORM_EMOJI[m.platform]}</span>{m.title}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>{lastLabel}</div>
            </div>
            <button
              onClick={() => handleCopy(m.id)}
              disabled={isPending}
              style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                background: 'var(--color-primary)', color: '#fff', border: 'none',
                cursor: isPending ? 'wait' : 'pointer', opacity: isPending ? 0.6 : 1, whiteSpace: 'nowrap',
              }}
            >
              {isPending ? '…' : 'Copier lien'}
            </button>
          </div>
        )
      })}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20, padding: '10px 16px',
          background: '#38A169', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}

function formatRelative(iso: string): string {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'à l\'instant'
  if (minutes < 60) return `il y a ${minutes}min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours}h`
  const days = Math.floor(hours / 24)
  return `il y a ${days}j`
}
