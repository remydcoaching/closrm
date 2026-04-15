'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  GraduationCap, Plus, FileText, Video, Link2, Type, CheckSquare,
  ChevronDown, ChevronRight, X, Loader2, Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type {
  WorkspaceRole, TrainingModuleWithItems, TrainingItemType, TrainingRole,
} from '@/types'

// ─── Styles ─────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-primary)',
  borderRadius: 12,
  padding: 20,
  marginBottom: 12,
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-label)',
  marginBottom: 8,
  display: 'block',
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  background: 'var(--bg-input)',
  border: '1px solid var(--border-primary)',
  borderRadius: 10,
  color: 'var(--text-primary)',
  fontSize: 13,
  outline: 'none',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  colorScheme: 'dark',
}

const btnPrimary: React.CSSProperties = {
  padding: '8px 18px',
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 600,
  background: 'var(--color-primary)',
  border: 'none',
  color: 'var(--text-primary)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}

const btnSecondary: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 10,
  fontSize: 12,
  fontWeight: 600,
  background: 'transparent',
  border: '1px solid var(--border-primary)',
  color: 'var(--text-tertiary)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 5,
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<TrainingItemType, typeof FileText> = {
  pdf: FileText,
  video: Video,
  link: Link2,
  text: Type,
  checklist: CheckSquare,
}

const TYPE_LABELS: Record<TrainingItemType, string> = {
  pdf: 'PDF',
  video: 'Video',
  link: 'Lien',
  text: 'Texte',
  checklist: 'Checklist',
}

const ROLE_LABELS: Record<TrainingRole, string> = {
  setter: 'Setter',
  closer: 'Closer',
  all: 'Tous',
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function TrainingClient() {
  const [modules, setModules] = useState<TrainingModuleWithItems[]>([])
  const [membersProgress, setMembersProgress] = useState<
    { user_id: string; full_name: string; item_id: string; completed: boolean }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<WorkspaceRole>('setter')
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [showAddModule, setShowAddModule] = useState(false)
  const [showAddItem, setShowAddItem] = useState<string | null>(null) // moduleId
  const [showMembersView, setShowMembersView] = useState<string | null>(null) // moduleId

  // Fetch user role
  useEffect(() => {
    async function fetchRole() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: member } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()

      if (member) {
        setUserRole(member.role as WorkspaceRole)
        return
      }

      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile) {
        setUserRole((profile.role === 'coach' ? 'admin' : profile.role) as WorkspaceRole)
      }
    }
    fetchRole()
  }, [])

  const fetchModules = useCallback(async () => {
    try {
      const res = await fetch('/api/team-training')
      if (!res.ok) return
      const json = await res.json()
      setModules(json.data ?? [])
      setMembersProgress(json.membersProgress ?? [])
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchModules()
  }, [fetchModules])

  function toggleModule(id: string) {
    setExpandedModules(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function toggleItemComplete(itemId: string, completed: boolean) {
    try {
      await fetch('/api/team-training/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, completed }),
      })
      await fetchModules()
    } catch {
      // silently fail
    }
  }

  // Filter modules based on role
  const visibleModules = modules.filter(mod => {
    if (userRole === 'admin') return true
    return mod.role === 'all' || mod.role === userRole
  })

  const isAdmin = userRole === 'admin'

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
          Chargement...
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 32, maxWidth: 800 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <GraduationCap size={22} color="var(--color-primary)" />
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Formation
            </h1>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {isAdmin ? 'Gerez les modules de formation de votre equipe' : 'Completez vos modules de formation'}
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowAddModule(true)} style={btnPrimary}>
            <Plus size={14} />
            Ajouter un module
          </button>
        )}
      </div>

      {/* Modules list */}
      {visibleModules.length === 0 ? (
        <div style={{
          ...cardStyle,
          textAlign: 'center',
          padding: 48,
          color: 'var(--text-tertiary)',
          fontSize: 13,
        }}>
          {isAdmin
            ? 'Aucun module de formation. Cliquez sur "Ajouter un module" pour commencer.'
            : 'Aucun module de formation disponible pour le moment.'}
        </div>
      ) : (
        visibleModules.map(mod => {
          const expanded = expandedModules.has(mod.id)
          const totalItems = mod.items.length
          const completedItems = mod.progress.filter(p => p.completed).length
          const pct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

          return (
            <div key={mod.id} style={cardStyle}>
              {/* Module header */}
              <button
                onClick={() => toggleModule(mod.id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                  textAlign: 'left', padding: 0,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {expanded
                      ? <ChevronDown size={16} color="var(--text-tertiary)" />
                      : <ChevronRight size={16} color="var(--text-tertiary)" />}
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {mod.title}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                      background: 'var(--bg-input)', color: 'var(--text-muted)',
                    }}>
                      {ROLE_LABELS[mod.role]}
                    </span>
                  </div>
                  {mod.description && (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, marginLeft: 24 }}>
                      {mod.description}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  {/* Progress bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 80, height: 6, borderRadius: 3,
                      background: 'var(--bg-input)', overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${pct}%`, height: '100%', borderRadius: 3,
                        background: pct === 100 ? '#38A169' : 'var(--color-primary)',
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 36, textAlign: 'right' }}>
                      {completedItems}/{totalItems}
                    </span>
                  </div>
                </div>
              </button>

              {/* Expanded items */}
              {expanded && (
                <div style={{ marginTop: 14, paddingLeft: 24 }}>
                  {mod.items.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '12px 0' }}>
                      Aucun element dans ce module.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {mod.items.map(item => {
                        const Icon = TYPE_ICONS[item.type as TrainingItemType] ?? FileText
                        const isCompleted = mod.progress.some(p => p.item_id === item.id && p.completed)
                        const isClickable = ['pdf', 'video', 'link'].includes(item.type) && item.content

                        return (
                          <div key={item.id} style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 12px', background: 'var(--bg-input)',
                            borderRadius: 8,
                          }}>
                            {/* Checkbox */}
                            <input
                              type="checkbox"
                              checked={isCompleted}
                              onChange={(e) => toggleItemComplete(item.id, e.target.checked)}
                              style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                            />
                            {/* Icon */}
                            <Icon size={14} color={isCompleted ? '#38A169' : 'var(--text-muted)'} />
                            {/* Title / link */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {isClickable ? (
                                <a
                                  href={item.content ?? '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    fontSize: 13, color: 'var(--color-primary)', textDecoration: 'none',
                                    fontWeight: 500,
                                  }}
                                >
                                  {item.title}
                                </a>
                              ) : (
                                <span style={{
                                  fontSize: 13,
                                  color: isCompleted ? 'var(--text-muted)' : 'var(--text-primary)',
                                  textDecoration: isCompleted ? 'line-through' : 'none',
                                }}>
                                  {item.title}
                                </span>
                              )}
                              {item.type === 'text' && item.content && (
                                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, margin: 0 }}>
                                  {item.content}
                                </p>
                              )}
                            </div>
                            {/* Type badge */}
                            <span style={{
                              fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                              background: 'var(--bg-elevated)', color: 'var(--text-muted)', flexShrink: 0,
                            }}>
                              {TYPE_LABELS[item.type as TrainingItemType] ?? item.type}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Admin actions */}
                  {isAdmin && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button onClick={() => setShowAddItem(mod.id)} style={btnSecondary}>
                        <Plus size={12} />
                        Ajouter un element
                      </button>
                      <button onClick={() => setShowMembersView(showMembersView === mod.id ? null : mod.id)} style={btnSecondary}>
                        <Users size={12} />
                        Progression equipe
                      </button>
                    </div>
                  )}

                  {/* Members progress (admin only) */}
                  {isAdmin && showMembersView === mod.id && (
                    <MembersProgressView
                      moduleItems={mod.items}
                      membersProgress={membersProgress}
                    />
                  )}
                </div>
              )}
            </div>
          )
        })
      )}

      {/* Add Module Modal */}
      {showAddModule && (
        <AddModuleModal
          onClose={() => setShowAddModule(false)}
          onCreated={() => { setShowAddModule(false); fetchModules() }}
        />
      )}

      {/* Add Item Modal */}
      {showAddItem && (
        <AddItemModal
          moduleId={showAddItem}
          onClose={() => setShowAddItem(null)}
          onCreated={() => { setShowAddItem(null); fetchModules() }}
        />
      )}
    </div>
  )
}

// ─── Members Progress View ──────────────────────────────────────────────────

function MembersProgressView({ moduleItems, membersProgress }: {
  moduleItems: { id: string; title: string }[]
  membersProgress: { user_id: string; full_name: string; item_id: string; completed: boolean }[]
}) {
  // Group by user
  const usersMap = new Map<string, { full_name: string; completed: Set<string> }>()
  for (const p of membersProgress) {
    if (!moduleItems.some(i => i.id === p.item_id)) continue
    if (!usersMap.has(p.user_id)) {
      usersMap.set(p.user_id, { full_name: p.full_name, completed: new Set() })
    }
    if (p.completed) {
      usersMap.get(p.user_id)!.completed.add(p.item_id)
    }
  }

  const users = Array.from(usersMap.entries())
  const totalItems = moduleItems.length

  if (users.length === 0) {
    return (
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '12px 0', marginTop: 8 }}>
        Aucune progression enregistree pour ce module.
      </div>
    )
  }

  return (
    <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border-primary)' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-label)', marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>
        Progression de l&apos;equipe
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {users.map(([userId, { full_name, completed }]) => {
          const pct = totalItems > 0 ? Math.round((completed.size / totalItems) * 100) : 0
          return (
            <div key={userId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--text-primary)', minWidth: 120 }}>
                {full_name}
              </span>
              <div style={{
                flex: 1, height: 6, borderRadius: 3,
                background: 'var(--bg-input)', overflow: 'hidden',
              }}>
                <div style={{
                  width: `${pct}%`, height: '100%', borderRadius: 3,
                  background: pct === 100 ? '#38A169' : 'var(--color-primary)',
                }} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 36, textAlign: 'right' }}>
                {completed.size}/{totalItems}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Add Module Modal ───────────────────────────────────────────────────────

function AddModuleModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [role, setRole] = useState<TrainingRole>('all')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Le titre est requis.'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/team-training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), description: description.trim() || null, role }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        setError(json?.error ?? 'Erreur lors de la creation.')
        return
      }
      onCreated()
    } catch {
      setError('Erreur lors de la creation.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose() }} style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
        borderRadius: 14, padding: 28, width: '100%', maxWidth: 420,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Nouveau module
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Titre *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex : Script de setting"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Description du module..."
              style={{ ...inputStyle, resize: 'vertical' as const }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Pour quel role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as TrainingRole)}
              style={selectStyle}
            >
              <option value="all">Tous</option>
              <option value="setter">Setter</option>
              <option value="closer">Closer</option>
            </select>
          </div>

          {error && (
            <div style={{ fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: 8, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{
              padding: '10px 20px', borderRadius: 10, fontSize: 13,
              border: '1px solid var(--border-primary)', background: 'transparent',
              color: 'var(--text-tertiary)', cursor: 'pointer',
            }}>
              Annuler
            </button>
            <button type="submit" disabled={saving} style={{
              ...btnPrimary,
              opacity: saving ? 0.6 : 1,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}>
              {saving && <Loader2 size={14} />}
              Creer
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Add Item Modal ─────────────────────────────────────────────────────────

function AddItemModal({ moduleId, onClose, onCreated }: {
  moduleId: string
  onClose: () => void
  onCreated: () => void
}) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<TrainingItemType>('text')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const contentLabel: Record<TrainingItemType, string> = {
    pdf: 'URL du PDF',
    video: 'URL de la video',
    link: 'URL du lien',
    text: 'Contenu texte',
    checklist: 'Elements (JSON)',
  }

  const contentPlaceholder: Record<TrainingItemType, string> = {
    pdf: 'https://example.com/doc.pdf',
    video: 'https://youtube.com/watch?v=...',
    link: 'https://example.com',
    text: 'Instructions ou contenu...',
    checklist: '[{"label":"Etape 1"},{"label":"Etape 2"}]',
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Le titre est requis.'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/team-training/${moduleId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), type, content: content.trim() || null }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        setError(json?.error ?? 'Erreur lors de la creation.')
        return
      }
      onCreated()
    } catch {
      setError('Erreur lors de la creation.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose() }} style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
        borderRadius: 14, padding: 28, width: '100%', maxWidth: 420,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Ajouter un element
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as TrainingItemType)}
              style={selectStyle}
            >
              {(Object.keys(TYPE_LABELS) as TrainingItemType[]).map(t => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Titre *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex : Script d'appel V2"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>{contentLabel[type]}</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              placeholder={contentPlaceholder[type]}
              style={{ ...inputStyle, resize: 'vertical' as const }}
            />
          </div>

          {error && (
            <div style={{ fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: 8, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{
              padding: '10px 20px', borderRadius: 10, fontSize: 13,
              border: '1px solid var(--border-primary)', background: 'transparent',
              color: 'var(--text-tertiary)', cursor: 'pointer',
            }}>
              Annuler
            </button>
            <button type="submit" disabled={saving} style={{
              ...btnPrimary,
              opacity: saving ? 0.6 : 1,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}>
              {saving && <Loader2 size={14} />}
              Ajouter
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
