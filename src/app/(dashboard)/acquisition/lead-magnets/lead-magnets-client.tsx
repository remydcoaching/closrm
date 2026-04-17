'use client'
import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { LeadMagnet, LeadMagnetPlatform } from '@/types'

interface Stat { lead_magnet_id: string; clicks_count: number; lead_id: string }

interface Props {
  initialMagnets: LeadMagnet[]
  initialStats: Stat[]
}

const PLATFORMS: Array<{ value: LeadMagnetPlatform; label: string; emoji: string }> = [
  { value: 'youtube', label: 'YouTube', emoji: '🎥' },
  { value: 'tiktok', label: 'TikTok', emoji: '🎵' },
  { value: 'instagram', label: 'Instagram', emoji: '📷' },
  { value: 'podcast', label: 'Podcast', emoji: '🎧' },
  { value: 'blog', label: 'Blog', emoji: '📝' },
  { value: 'pdf', label: 'PDF', emoji: '📘' },
  { value: 'other', label: 'Autre', emoji: '🔗' },
]

interface TopLead { lead_id: string; name: string; clicks: number; last_clicked_at: string | null }
interface MagnetStats { total_clicks: number; unique_leads: number; top_leads: TopLead[] }

export default function LeadMagnetsClient({ initialMagnets, initialStats }: Props) {
  const [magnets, setMagnets] = useState(initialMagnets)
  const [stats] = useState(initialStats)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<LeadMagnet | null>(null)
  const [statsFor, setStatsFor] = useState<LeadMagnet | null>(null)
  const [statsData, setStatsData] = useState<MagnetStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)

  async function openStats(m: LeadMagnet) {
    setStatsFor(m); setStatsData(null); setStatsLoading(true)
    try {
      const res = await fetch(`/api/lead-magnets/${m.id}/stats`)
      if (res.ok) setStatsData(await res.json())
    } finally {
      setStatsLoading(false)
    }
  }

  const statsByMagnet = useMemo(() => {
    const map = new Map<string, { clicks: number; leads: Set<string> }>()
    stats.forEach(s => {
      if (!map.has(s.lead_magnet_id)) map.set(s.lead_magnet_id, { clicks: 0, leads: new Set() })
      const entry = map.get(s.lead_magnet_id)!
      entry.clicks += s.clicks_count
      if (s.clicks_count > 0) entry.leads.add(s.lead_id)
    })
    return map
  }, [stats])

  async function handleSave(input: { title: string; url: string; platform: LeadMagnetPlatform }) {
    if (editing) {
      const res = await fetch(`/api/lead-magnets/${editing.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const { lead_magnet } = await res.json()
      setMagnets(magnets.map(m => m.id === editing.id ? lead_magnet : m))
    } else {
      const res = await fetch('/api/lead-magnets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const { lead_magnet } = await res.json()
      setMagnets([lead_magnet, ...magnets])
    }
    setModalOpen(false); setEditing(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce lead magnet ? Tous les liens trackables associés seront supprimés.')) return
    await fetch(`/api/lead-magnets/${id}`, { method: 'DELETE' })
    setMagnets(magnets.filter(m => m.id !== id))
  }

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ color: 'var(--text-primary)', fontSize: 24, fontWeight: 700, margin: 0 }}>Lead Magnets</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Contenus partagés avec les leads via des liens courts trackables.
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setModalOpen(true) }}
          style={{
            padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer',
          }}
        >
          + Nouveau contenu
        </button>
      </div>

      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-primary)' }}>
              <th style={th}>Titre</th>
              <th style={th}>Plateforme</th>
              <th style={th}>Clics totaux</th>
              <th style={th}>Leads uniques</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {magnets.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Aucun lead magnet. Cliquez sur « + Nouveau contenu » pour commencer.
                </td>
              </tr>
            )}
            {magnets.map(m => {
              const s = statsByMagnet.get(m.id)
              const platform = PLATFORMS.find(p => p.value === m.platform)
              return (
                <tr key={m.id} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                  <td style={td}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 400 }}>
                      {m.url}
                    </div>
                  </td>
                  <td style={td}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span>{platform?.emoji}</span>
                      <span>{platform?.label}</span>
                    </span>
                  </td>
                  <td style={td}>{s?.clicks ?? 0}</td>
                  <td style={td}>{s?.leads.size ?? 0}</td>
                  <td style={td}>
                    <button onClick={() => openStats(m)} style={{ ...btnSecondary, color: 'var(--color-primary)' }}>Voir stats</button>
                    <button onClick={() => { setEditing(m); setModalOpen(true) }} style={{ ...btnSecondary, marginLeft: 8 }}>Éditer</button>
                    <button onClick={() => handleDelete(m.id)} style={{ ...btnSecondary, marginLeft: 8, color: '#E53E3E' }}>Supprimer</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <LeadMagnetModal
          initial={editing}
          onClose={() => { setModalOpen(false); setEditing(null) }}
          onSave={handleSave}
        />
      )}

      {statsFor && (
        <StatsDrawer
          magnet={statsFor}
          loading={statsLoading}
          stats={statsData}
          onClose={() => { setStatsFor(null); setStatsData(null) }}
        />
      )}
    </div>
  )
}

function StatsDrawer({ magnet, loading, stats, onClose }: {
  magnet: LeadMagnet
  loading: boolean
  stats: MagnetStats | null
  onClose: () => void
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null

  const content = (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', justifyContent: 'flex-end' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 480, background: 'var(--bg-elevated)', borderLeft: '1px solid var(--border-primary)',
          padding: 24, overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Stats du lead magnet
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '4px 0 0 0' }}>
              {magnet.title}
            </h2>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, wordBreak: 'break-all' }}>
              {magnet.url}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: 20, cursor: 'pointer', padding: 4 }}
          >
            ×
          </button>
        </div>

        {loading && <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Chargement…</div>}

        {!loading && stats && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Clics totaux</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>{stats.total_clicks}</div>
              </div>
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Leads uniques</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>{stats.unique_leads}</div>
              </div>
            </div>

            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
              Top leads ({stats.top_leads.length})
            </div>

            {stats.top_leads.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: 13, padding: 16, textAlign: 'center' }}>
                Personne n&apos;a encore cliqué.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {stats.top_leads.map(l => (
                  <a
                    key={l.lead_id}
                    href={`/leads/${l.lead_id}`}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 12px', background: 'var(--bg-primary)',
                      border: '1px solid var(--border-primary)', borderRadius: 8,
                      textDecoration: 'none',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{l.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {l.last_clicked_at ? `dernier clic : ${new Date(l.last_clicked_at).toLocaleString('fr-FR')}` : '—'}
                      </div>
                    </div>
                    <div style={{
                      fontSize: 13, fontWeight: 700, color: 'var(--color-primary)',
                      padding: '4px 10px', background: 'rgba(229,62,62,0.1)', borderRadius: 6,
                    }}>
                      {l.clicks} clic{l.clicks > 1 ? 's' : ''}
                    </div>
                  </a>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
  return createPortal(content, document.body)
}

const th: React.CSSProperties = { padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }
const td: React.CSSProperties = { padding: '14px 16px', fontSize: 13, color: 'var(--text-primary)' }
const btnSecondary: React.CSSProperties = { padding: '4px 10px', borderRadius: 6, fontSize: 12, background: 'transparent', border: '1px solid var(--border-primary)', color: 'var(--text-primary)', cursor: 'pointer' }

function LeadMagnetModal({ initial, onClose, onSave }: {
  initial: LeadMagnet | null
  onClose: () => void
  onSave: (input: { title: string; url: string; platform: LeadMagnetPlatform }) => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [url, setUrl] = useState(initial?.url ?? '')
  const [platform, setPlatform] = useState<LeadMagnetPlatform>(initial?.platform ?? 'other')

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-elevated)', padding: 24, borderRadius: 12, width: 480, border: '1px solid var(--border-primary)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>
          {initial ? 'Éditer' : 'Nouveau'} lead magnet
        </h2>
        <label style={labelStyle}>Titre</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Masterclass gratuite" style={inputStyle} />
        <label style={labelStyle}>URL</label>
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." style={inputStyle} />
        <label style={labelStyle}>Plateforme</label>
        <select
          value={platform}
          onChange={e => setPlatform(e.target.value as LeadMagnetPlatform)}
          style={inputStyle}
        >
          {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.emoji} {p.label}</option>)}
        </select>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={btnSecondary}>Annuler</button>
          <button
            onClick={() => title && url && onSave({ title, url, platform })}
            disabled={!title || !url}
            style={{ padding: '8px 16px', borderRadius: 6, background: 'var(--color-primary)', color: '#fff', border: 'none', fontWeight: 600, cursor: (title && url) ? 'pointer' : 'not-allowed', opacity: (title && url) ? 1 : 0.5 }}
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 12, marginBottom: 4 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 6, background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }
