'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { X } from 'lucide-react'
import { PrepView } from '@/app/(dashboard)/acquisition/reels/tournage/prep/page'
import { JourJView } from '@/app/(dashboard)/acquisition/reels/tournage/jour-j/page'
import { BriefView } from '@/app/(dashboard)/acquisition/reels/tournage/brief/page'

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
  reels?: Array<{ social_post_id: string; position: number }>
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

interface Props {
  open: boolean
  onClose: () => void
}

type View = { kind: 'index' } | { kind: 'prep' | 'jour-j' | 'brief'; reelIds: string[]; sessionId: string }

export default function TournagesModal({ open, onClose }: Props) {
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [view, setView] = useState<View>({ kind: 'index' })
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | SessionRow['status']>('all')

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

  useEffect(() => { if (open) load() }, [open, load])

  // ESC ferme
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  const filtered = showArchived ? sessions : sessions.filter(s => s.status !== 'archived')
  const filteredByStatus = statusFilter === 'all' ? filtered : filtered.filter(s => s.status === statusFilter)
  const visible = search.trim()
    ? filteredByStatus.filter(s => (s.name ?? '').toLowerCase().includes(search.toLowerCase()))
    : filteredByStatus

  function openSubView(kind: 'prep' | 'jour-j' | 'brief', sessionId: string, reelIds: string[]) {
    setView({ kind, sessionId, reelIds })
  }
  function backToIndex() { setView({ kind: 'index' }); load() }
  function switchSubView(kind: 'prep' | 'jour-j' | 'brief') {
    if (view.kind === 'index') return
    setView({ kind, sessionId: view.sessionId, reelIds: view.reelIds })
  }
  // Reçoit les changements d'URL des sub-views (ex: picker confirm avec nouveaux reels)
  // Parse l'URL pour extraire ?reel=X,Y et update view.reelIds sans naviguer.
  function handleSubNavigate(url: string) {
    if (view.kind === 'index') return
    try {
      const u = new URL(url, window.location.origin)
      const reelQS = u.searchParams.get('reel')
      const newReelIds = reelQS ? reelQS.split(',').map(s => s.trim()).filter(Boolean) : []
      setView({ kind: view.kind, sessionId: view.sessionId, reelIds: newReelIds })
    } catch { /* noop */ }
  }

  // Sub-view: rend PrepView/JourJView/BriefView en plein écran de modale
  if (view.kind !== 'index') {
    const reelParam = view.reelIds.length > 0 ? view.reelIds.join(',') : null
    return (
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90,
      }}>
        <div onClick={e => e.stopPropagation()} style={{
          width: '95vw', maxWidth: 1200,
          height: '95vh', maxHeight: 900,
          background: '#0a0a0a', border: '1px solid #262626', borderRadius: 14,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
        }}>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <Suspense fallback={<div style={{ padding: 40, color: '#888' }}>Chargement…</div>}>
              {view.kind === 'prep' && (
                <PrepView
                  embedded
                  reelParamProp={reelParam}
                  onClose={backToIndex}
                  onSwitchView={(v) => switchSubView(v)}
                  onNavigate={handleSubNavigate}
                />
              )}
              {view.kind === 'jour-j' && (
                <JourJView
                  embedded
                  reelParamProp={reelParam}
                  onClose={backToIndex}
                  onSwitchView={(v) => switchSubView(v)}
                />
              )}
              {view.kind === 'brief' && (
                <BriefView
                  embedded
                  reelParamProp={reelParam}
                  onClose={backToIndex}
                  onSwitchView={(v) => switchSubView(v)}
                />
              )}
            </Suspense>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 920, maxWidth: 'calc(100vw - 40px)',
        height: 'calc(100vh - 80px)', maxHeight: 720,
        background: '#0a0a0a', border: '1px solid #262626', borderRadius: 14,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', background: '#141414', borderBottom: '1px solid #262626',
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
              📹 Sessions de tournage
            </div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
              Groupe les reels que tu films ensemble — chaque session = une date + N reels.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => setCreating(true)} style={{
              padding: '8px 14px', background: '#FF0000', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>+ Nouvelle session</button>
            <button onClick={onClose} aria-label="Fermer" style={{
              width: 32, height: 32, background: 'transparent',
              border: '1px solid #262626', borderRadius: 8, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#888',
            }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
            <input type="text" placeholder="🔎 Rechercher une session…"
              value={search} onChange={e => setSearch(e.target.value)}
              style={{
                flex: 1, minWidth: 200, maxWidth: 320,
                padding: '7px 12px', background: '#141414', border: '1px solid #262626',
                borderRadius: 7, color: '#fff', fontSize: 12, outline: 'none',
              }} />
            {(['all', 'draft', 'ready', 'in_progress', 'completed'] as const).map(f => {
              const labels: Record<string, string> = {
                all: 'Tout', draft: 'Brouillon', ready: 'Prête',
                in_progress: 'En cours', completed: 'Terminée',
              }
              const isActive = statusFilter === f
              return (
                <button key={f} onClick={() => setStatusFilter(f)} style={{
                  padding: '5px 10px', background: isActive ? '#FF0000' : '#141414',
                  border: `1px solid ${isActive ? '#FF0000' : '#262626'}`,
                  borderRadius: 99, fontSize: 10,
                  color: isActive ? '#fff' : '#888', cursor: 'pointer', whiteSpace: 'nowrap',
                }}>{labels[f]}</button>
              )
            })}
            <label style={{ marginLeft: 'auto', fontSize: 10, color: '#666', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)}
                style={{ accentColor: '#888' }} />
              + archivées
            </label>
          </div>
          {sessions.length > 0 && visible.length === 0 && (
            <div style={{
              padding: 30, textAlign: 'center', color: '#666', fontSize: 12,
              background: '#141414', border: '1px dashed #262626', borderRadius: 8,
            }}>
              Aucune session ne correspond à ton filtre.
            </div>
          )}

          {loading ? (
            <div style={{ padding: 40, color: '#888', textAlign: 'center' }}>Chargement…</div>
          ) : error ? (
            <div style={{ padding: 40, color: '#E53E3E', textAlign: 'center' }}>
              Erreur : {error}
              <button onClick={load} style={{ marginLeft: 12, padding: '6px 12px', background: '#E53E3E', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>↻ Réessayer</button>
            </div>
          ) : visible.length === 0 ? (
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
              {visible.map(s => <SessionCard key={s.id} session={s} onChange={load} onOpenSubView={openSubView} />)}
            </div>
          )}
        </div>
      </div>

      {creating && (
        <CreateSessionModal
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); load() }}
        />
      )}
    </div>
  )
}

function SessionCard({ session, onChange, onOpenSubView }: {
  session: SessionRow
  onChange: () => void
  onOpenSubView: (kind: 'prep' | 'jour-j' | 'brief', sessionId: string, reelIds: string[]) => void
}) {
  const reelIds = (session.reels ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map(r => r.social_post_id)
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
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'archived' }),
    })
    onChange()
  }
  async function unarchive() {
    await fetch(`/api/tournage-sessions/${session.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
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
      background: '#141414', border: '1px solid #262626', borderRadius: 12, padding: 16,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4 }}>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
              color: meta.color, background: meta.bg, textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>{meta.label}</span>
            {dateLabel && <span style={{ fontSize: 11, color: '#888' }}>{dateLabel}</span>}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
            {session.name?.trim() || 'Session sans nom'}
          </div>
          <div style={{ fontSize: 11, color: '#666' }}>
            {session.reels_count} reel{session.reels_count > 1 ? 's' : ''}
            {total > 0 && ` · ${done}/${total} phrase${total > 1 ? 's' : ''} tournée${done > 1 ? 's' : ''}`}
            {session.stats.skipped > 0 && ` · ${session.stats.skipped} reportée${session.stats.skipped > 1 ? 's' : ''}`}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => onOpenSubView('prep', session.id, reelIds)}
            style={{
              padding: '6px 11px', fontSize: 11, fontWeight: 600,
              color: '#fff', background: '#FF0000',
              border: 'none', borderRadius: 6, cursor: 'pointer',
            }}>📋 Prep</button>
          <button
            onClick={() => onOpenSubView('jour-j', session.id, reelIds)}
            style={{
              padding: '6px 11px', fontSize: 11, fontWeight: 600,
              color: '#FF0000', background: 'rgba(255,0,0,0.1)',
              border: '1px solid rgba(255,0,0,0.25)', borderRadius: 6, cursor: 'pointer',
            }}>🎬 Jour J</button>
          <button
            onClick={() => onOpenSubView('brief', session.id, reelIds)}
            style={{
              padding: '6px 11px', fontSize: 11, fontWeight: 600,
              color: '#888', background: 'transparent',
              border: '1px solid #262626', borderRadius: 6, cursor: 'pointer',
            }}>📄 Brief</button>
        </div>
      </div>

      {total > 0 && (
        <div style={{ height: 4, background: '#262626', borderRadius: 99, overflow: 'hidden', marginBottom: 10 }}>
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
              placeholder="ex: Salle wellness — pectoraux" style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Date prévue de tournage</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
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
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
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
