'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

interface SessionRow {
  id: string
  name: string | null
  scheduled_date: string | null
  status: 'draft' | 'ready' | 'in_progress' | 'completed' | 'archived'
  monteur_id: string | null
  brief_sent_at: string | null
  notes: string | null
  created_at: string
  reels_count: number
  stats: { total: number; done: number; skipped: number }
  reels?: Array<{ social_post_id: string; post: { id: string; title: string | null; hook: string | null } | null }>
}

interface SocialPost {
  id: string
  title: string | null
  hook: string | null
  content_kind: string | null
}

const STATUS_META: Record<SessionRow['status'], { label: string; color: string; bg: string }> = {
  draft: { label: 'Brouillon', color: '#888', bg: '#262626' },
  ready: { label: 'Prête à filmer', color: '#5b9bf5', bg: 'rgba(91,155,245,0.12)' },
  in_progress: { label: 'En cours', color: '#d69e2e', bg: 'rgba(214,158,46,0.12)' },
  completed: { label: 'Terminée', color: '#38A169', bg: 'rgba(56,161,105,0.12)' },
  archived: { label: 'Archivée', color: '#555', bg: '#1a1a1a' },
}

export default function SessionsIndexPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/tournage-sessions')
      if (!res.ok) throw new Error(`${res.status}`)
      const json = await res.json()
      setSessions(json.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const visible = showArchived ? sessions : sessions.filter(s => s.status !== 'archived')

  if (loading) return <div style={{ padding: 40, color: '#888' }}>Chargement…</div>
  if (error) return (
    <div style={{ padding: 40, color: '#E53E3E' }}>
      Erreur : {error}
      <button onClick={load} style={{ marginLeft: 12, padding: '6px 12px', background: '#E53E3E', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>↻ Réessayer</button>
    </div>
  )

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
            📹 Sessions de tournage
          </h1>
          <p style={{ fontSize: 13, color: '#666' }}>
            Groupe les reels que tu films ensemble. Chaque session = une date + N reels.
          </p>
        </div>
        <button onClick={() => setCreating(true)} style={{
          padding: '10px 16px', background: '#FF0000', color: '#fff',
          border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}>+ Nouvelle session</button>
      </div>

      <div style={{ marginTop: 14, marginBottom: 18 }}>
        <label style={{ fontSize: 11, color: '#666', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)}
            style={{ accentColor: '#888' }} />
          Afficher les sessions archivées
        </label>
      </div>

      {visible.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 60,
          background: '#141414', border: '1px dashed #262626', borderRadius: 12,
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 14, color: '#fff', marginBottom: 8 }}>Aucune session pour l&apos;instant</div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 18 }}>
            Crée une session pour grouper les reels que tu vas filmer le même jour.
          </div>
          <button onClick={() => setCreating(true)} style={{
            padding: '10px 16px', background: '#FF0000', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>+ Créer ma première session</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visible.map(s => <SessionCard key={s.id} session={s} onChange={load} />)}
        </div>
      )}

      {creating && (
        <CreateSessionModal
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); load() }}
        />
      )}
    </div>
  )
}

function SessionCard({ session, onChange }: { session: SessionRow; onChange: () => void }) {
  const meta = STATUS_META[session.status]
  const total = session.stats.total
  const done = session.stats.done
  const pct = total ? (done / total) * 100 : 0
  const dateLabel = session.scheduled_date
    ? new Date(session.scheduled_date).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })
    : null

  async function archive() {
    if (!confirm('Archiver cette session ?')) return
    await fetch(`/api/tournage-sessions/${session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'archived' }),
    })
    onChange()
  }
  async function unarchive() {
    await fetch(`/api/tournage-sessions/${session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'draft' }),
    })
    onChange()
  }
  async function del() {
    if (!confirm('Supprimer définitivement cette session ? (les reels et phrases sont conservés)')) return
    await fetch(`/api/tournage-sessions/${session.id}`, { method: 'DELETE' })
    onChange()
  }

  return (
    <div style={{
      background: '#141414', border: '1px solid #262626', borderRadius: 12, padding: 18,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4 }}>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
              color: meta.color, background: meta.bg, textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>{meta.label}</span>
            {dateLabel && (
              <span style={{ fontSize: 11, color: '#888' }}>{dateLabel}</span>
            )}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
            {session.name?.trim() || 'Session sans nom'}
          </div>
          <div style={{ fontSize: 11, color: '#666' }}>
            {session.reels_count} reel{session.reels_count > 1 ? 's' : ''}
            {total > 0 && ` · ${done}/${total} phrase${total > 1 ? 's' : ''} tournée${done > 1 ? 's' : ''}`}
            {session.stats.skipped > 0 && ` · ${session.stats.skipped} reportée${session.stats.skipped > 1 ? 's' : ''}`}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <Link
            href={`/acquisition/reels/tournage/${session.id}/prep`}
            style={{
              padding: '6px 12px', fontSize: 11, fontWeight: 600,
              color: '#fff', background: '#FF0000',
              borderRadius: 6, textDecoration: 'none',
            }}>📋 Prep</Link>
          <Link
            href={`/acquisition/reels/tournage/${session.id}/jour-j`}
            style={{
              padding: '6px 12px', fontSize: 11, fontWeight: 600,
              color: '#FF0000', background: 'rgba(255,0,0,0.1)',
              border: '1px solid rgba(255,0,0,0.25)', borderRadius: 6, textDecoration: 'none',
            }}>🎬 Jour J</Link>
          <Link
            href={`/acquisition/reels/tournage/${session.id}/brief`}
            style={{
              padding: '6px 12px', fontSize: 11, fontWeight: 600,
              color: '#888', background: 'transparent',
              border: '1px solid #262626', borderRadius: 6, textDecoration: 'none',
            }}>📄 Brief</Link>
        </div>
      </div>

      {total > 0 && (
        <div style={{ height: 4, background: '#262626', borderRadius: 99, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ width: `${pct}%`, height: '100%', background: '#38A169', transition: 'width 0.2s' }} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, fontSize: 10 }}>
        {session.status === 'archived' ? (
          <button onClick={unarchive} style={btnText}>↻ Désarchiver</button>
        ) : (
          <button onClick={archive} style={btnText}>📦 Archiver</button>
        )}
        <button onClick={del} style={{ ...btnText, color: '#E53E3E' }}>🗑 Supprimer</button>
      </div>
    </div>
  )
}

function CreateSessionModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [reels, setReels] = useState<SocialPost[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/social/posts?content_kind=reel&slim=true&per_page=100')
      .then(r => r.json())
      .then(j => setReels(j.data ?? []))
      .finally(() => setLoading(false))
  }, [])

  function toggle(id: string) {
    setSelectedIds(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  async function submit() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/tournage-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || null,
          scheduled_date: date || null,
          social_post_ids: Array.from(selectedIds),
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        alert('Erreur : ' + (j.error ?? res.status))
        return
      }
      onCreated()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 520, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 80px)',
        background: '#141414', border: '1px solid #262626',
        borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #262626' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
            Nouvelle session de tournage
          </div>
          <div style={{ fontSize: 11, color: '#888' }}>
            Groupe les reels que tu vas filmer ensemble. Tu pourras ajouter d&apos;autres reels plus tard.
          </div>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Nom (optionnel)</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="ex: Salle wellness — pectoraux"
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Date prévue de tournage</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={inputStyle}
            />
          </div>

          <label style={labelStyle}>Reels à inclure ({selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''})</label>
          {loading ? (
            <div style={{ padding: 20, color: '#666', fontSize: 12 }}>Chargement des reels…</div>
          ) : reels.length === 0 ? (
            <div style={{ padding: 20, color: '#666', fontSize: 12, textAlign: 'center' }}>
              Aucun reel. Crée d&apos;abord un slot avec content_kind = reel.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 240, overflowY: 'auto' }}>
              {reels.map(r => {
                const isSelected = selectedIds.has(r.id)
                return (
                  <div key={r.id} onClick={() => toggle(r.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px',
                    background: isSelected ? 'rgba(255,0,0,0.06)' : 'transparent',
                    border: `1px solid ${isSelected ? '#FF0000' : '#262626'}`,
                    borderRadius: 7, cursor: 'pointer',
                  }}>
                    <div style={{
                      width: 16, height: 16, flexShrink: 0,
                      border: `2px solid ${isSelected ? '#FF0000' : '#444'}`,
                      background: isSelected ? '#FF0000' : 'transparent',
                      borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 10, fontWeight: 700,
                    }}>{isSelected && '✓'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.title?.trim() || 'Sans titre'}
                      </div>
                      {r.hook && (
                        <div style={{ fontSize: 10, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          🪝 {r.hook}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid #262626', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={submitting} style={{
            padding: '8px 14px', background: 'transparent', color: '#888',
            border: '1px solid #262626', borderRadius: 7, fontSize: 12, cursor: 'pointer',
          }}>Annuler</button>
          <button onClick={submit} disabled={submitting} style={{
            padding: '8px 16px', background: submitting ? '#3a1a1a' : '#FF0000',
            color: '#fff', border: 'none', borderRadius: 7,
            fontSize: 12, fontWeight: 700, cursor: submitting ? 'wait' : 'pointer',
          }}>
            {submitting ? 'Création…' : 'Créer la session'}
          </button>
        </div>
      </div>
    </div>
  )
}

const btnText: React.CSSProperties = {
  padding: '4px 8px', background: 'transparent', color: '#666',
  border: 'none', cursor: 'pointer', fontSize: 10,
}
const labelStyle: React.CSSProperties = {
  fontSize: 11, color: '#888', display: 'block', marginBottom: 6, fontWeight: 600,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', background: '#0a0a0a', border: '1px solid #262626',
  borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none',
}
