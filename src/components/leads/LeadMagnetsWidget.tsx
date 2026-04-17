'use client'
import { useEffect, useState } from 'react'
import type { LeadMagnet, LeadMagnetPlatform } from '@/types'

interface TrackedLinkInfo {
  short_code: string
  clicks_count: number
  last_clicked_at: string | null
  lead_magnet_id: string
  full_url?: string
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
  const [pendingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [magnetsRes, clicksRes] = await Promise.all([
          fetch('/api/lead-magnets').then(r => r.json()),
          fetch(`/api/leads/${leadId}/clicks`).then(r => r.json()),
        ])
        const lm: LeadMagnet[] = magnetsRes.lead_magnets ?? []
        const existing: TrackedLinkInfo[] = clicksRes.tracked_links ?? []
        if (cancelled) return
        setMagnets(lm)

        // Pré-générer les tracked_links manquants pour que "Copier" soit synchrone
        const existingIds = new Set(existing.map(t => t.lead_magnet_id))
        const missing = lm.filter(m => !existingIds.has(m.id))
        const generated: TrackedLinkInfo[] = []
        for (const m of missing) {
          try {
            const res = await fetch(`/api/lead-magnets/${m.id}/track-for-lead`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lead_id: leadId }),
            })
            if (res.ok) {
              const { short_code, full_url } = await res.json()
              generated.push({ short_code, full_url, clicks_count: 0, last_clicked_at: null, lead_magnet_id: m.id })
            }
          } catch { /* skip */ }
        }

        // Pour les existants, on a pas de full_url dans /clicks — on dérive via l'origin actuel
        const origin = typeof window !== 'undefined' ? window.location.origin : ''
        const enriched = existing.map(t => ({ ...t, full_url: t.full_url || `${origin}/c/${t.short_code}` }))

        if (!cancelled) {
          setTracks([...enriched, ...generated])
          setLoading(false)
        }
      } catch {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [leadId])

  function handleCopy(magnetId: string) {
    const track = tracks.find(t => t.lead_magnet_id === magnetId)
    const url = track?.full_url
    if (!url) {
      setToast('Lien non prêt, patiente…')
      setTimeout(() => setToast(null), 2000)
      return
    }

    // Copie synchrone (user gesture préservée → Safari autorise)
    let copied = false
    try {
      if (navigator.clipboard?.writeText) {
        // Fire and forget — l'appel sync lance la copie
        navigator.clipboard.writeText(url).catch(() => {})
        copied = true
      }
    } catch { /* ignore */ }

    if (!copied) {
      const ta = document.createElement('textarea')
      ta.value = url
      ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.focus(); ta.select()
      try { document.execCommand('copy'); copied = true } catch { /* ignore */ }
      document.body.removeChild(ta)
    }

    setToast(copied ? 'Lien copié !' : 'Échec copie')
    setTimeout(() => setToast(null), 2000)
  }

  if (loading) {
    return <div style={{ padding: 12, color: 'var(--text-secondary)', fontSize: 12 }}>Chargement…</div>
  }
  if (magnets.length === 0) {
    return (
      <div style={{ padding: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Lead Magnets
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Aucun lead magnet.{' '}
          <a href="/acquisition/lead-magnets" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>En créer un →</a>
        </div>
      </div>
    )
  }

  const trackByMagnet = new Map(tracks.map(t => [t.lead_magnet_id, t]))

  return (
    <div style={{ padding: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
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
              padding: '8px 0', borderBottom: idx === magnets.length - 1 ? 'none' : '1px solid var(--border-primary)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, marginRight: 8 }}>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span style={{ marginRight: 6 }}>{PLATFORM_EMOJI[m.platform]}</span>{m.title}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{lastLabel}</div>
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
