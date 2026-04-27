'use client'

import { useEffect, useState } from 'react'
import { Check, X, Edit3, Trash2, StickyNote } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

interface LeadNote {
  id: string
  lead_id: string
  content: string
  created_at: string
  updated_at: string
}

const composerStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px',
  background: 'var(--bg-input)', border: '1px solid var(--border-primary)',
  borderRadius: 10, color: 'var(--text-primary)', fontSize: 12.5,
  outline: 'none', resize: 'none' as const, lineHeight: 1.55,
  fontFamily: 'inherit', minHeight: 64,
}

const iconBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', borderRadius: 6,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 22, height: 22, padding: 0, color: 'var(--text-muted)',
  transition: 'all 0.15s ease',
}

export default function LeadNotesWidget({ leadId }: { leadId: string }) {
  const [notes, setNotes] = useState<LeadNote[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const res = await fetch(`/api/lead-notes?lead_id=${leadId}`)
      if (res.ok) {
        const json = await res.json()
        if (!cancelled) setNotes(json.data ?? [])
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [leadId])

  async function addNote() {
    const content = draft.trim()
    if (!content || saving) return
    setSaving(true)
    const res = await fetch('/api/lead-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: leadId, content }),
    })
    if (res.ok) {
      const json = await res.json()
      setNotes(prev => [json.data, ...prev])
      setDraft('')
    }
    setSaving(false)
  }

  async function saveEdit(id: string) {
    const content = editValue.trim()
    if (!content) return
    const res = await fetch(`/api/lead-notes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    if (res.ok) {
      const json = await res.json()
      setNotes(prev => prev.map(n => n.id === id ? json.data : n))
    }
    setEditingId(null)
  }

  async function removeNote(id: string) {
    if (!confirm('Supprimer cette note ?')) return
    const res = await fetch(`/api/lead-notes/${id}`, { method: 'DELETE' })
    if (res.ok) setNotes(prev => prev.filter(n => n.id !== id))
  }

  const hasDraft = draft.trim().length > 0

  return (
    <div>
      {/* Composer */}
      <div style={{ position: 'relative', marginBottom: notes.length > 0 ? 14 : 0 }}>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              addNote()
            }
          }}
          rows={3}
          placeholder="Écrire une note..."
          style={composerStyle}
        />
        {hasDraft && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginTop: 8,
          }}>
            <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
              ⌘ + Entrée pour enregistrer
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => setDraft('')}
                style={{
                  padding: '6px 12px', borderRadius: 7, fontSize: 11.5, fontWeight: 500,
                  background: 'transparent', border: '1px solid var(--border-primary)',
                  color: 'var(--text-tertiary)', cursor: 'pointer',
                }}
              >
                Annuler
              </button>
              <button
                onClick={addNote}
                disabled={saving}
                style={{
                  padding: '6px 14px', borderRadius: 7, fontSize: 11.5, fontWeight: 600,
                  background: 'var(--color-primary)', border: 'none',
                  color: '#000', cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.6 : 1,
                }}
              >
                Enregistrer
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Liste */}
      {loading ? (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>Chargement...</p>
      ) : notes.length === 0 ? (
        !hasDraft && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '14px 2px',
            color: 'var(--text-muted)', fontSize: 12,
          }}>
            <StickyNote size={13} />
            Aucune note pour ce lead
          </div>
        )
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {notes.map((note, i) => {
            const editing = editingId === note.id
            const edited = note.updated_at && note.updated_at !== note.created_at
            const relative = formatDistanceToNow(new Date(note.created_at), { addSuffix: true, locale: fr })
            const absolute = format(new Date(note.created_at), "dd MMM yyyy 'à' HH'h'mm", { locale: fr })
            return (
              <div
                key={note.id}
                style={{
                  padding: '12px 0',
                  borderTop: i === 0 ? 'none' : '1px solid var(--border-primary)',
                }}
              >
                {editing ? (
                  <>
                    <textarea
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      rows={3}
                      autoFocus
                      style={composerStyle}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 8 }}>
                      <button
                        onClick={() => setEditingId(null)}
                        style={{
                          padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 500,
                          background: 'transparent', border: '1px solid var(--border-primary)',
                          color: 'var(--text-tertiary)', cursor: 'pointer',
                        }}
                      >
                        <X size={11} style={{ marginRight: 4 }} />Annuler
                      </button>
                      <button
                        onClick={() => saveEdit(note.id)}
                        style={{
                          padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600,
                          background: 'var(--color-primary)', border: 'none',
                          color: '#000', cursor: 'pointer',
                        }}
                      >
                        <Check size={11} style={{ marginRight: 4 }} />Enregistrer
                      </button>
                    </div>
                  </>
                ) : (
                  <div
                    style={{ position: 'relative', paddingRight: 54 }}
                    onMouseEnter={e => {
                      const actions = e.currentTarget.querySelector('[data-note-actions]') as HTMLElement
                      if (actions) actions.style.opacity = '1'
                    }}
                    onMouseLeave={e => {
                      const actions = e.currentTarget.querySelector('[data-note-actions]') as HTMLElement
                      if (actions) actions.style.opacity = '0'
                    }}
                  >
                    <div style={{
                      fontSize: 12.5, color: 'var(--text-primary)',
                      whiteSpace: 'pre-wrap', lineHeight: 1.55, marginBottom: 4,
                    }}>
                      {note.content}
                    </div>
                    <div
                      title={absolute}
                      style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 500 }}
                    >
                      {relative}{edited && <span style={{ marginLeft: 6, fontStyle: 'italic' }}>· modifiée</span>}
                    </div>
                    <div
                      data-note-actions
                      style={{
                        position: 'absolute', top: 0, right: 0,
                        display: 'flex', gap: 2,
                        opacity: 0, transition: 'opacity 0.15s ease',
                      }}
                    >
                      <button
                        onClick={() => { setEditingId(note.id); setEditValue(note.content) }}
                        style={iconBtn}
                        title="Modifier"
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                      >
                        <Edit3 size={12} />
                      </button>
                      <button
                        onClick={() => removeNote(note.id)}
                        style={iconBtn}
                        title="Supprimer"
                        onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
