'use client'

import { useEffect, useState } from 'react'
import { Plus, Check, X, Edit3, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface LeadNote {
  id: string
  lead_id: string
  content: string
  created_at: string
  updated_at: string
}

const inputS: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px',
  background: 'var(--bg-input)', border: '1px solid var(--border-primary)',
  borderRadius: 8, color: 'var(--text-primary)', fontSize: 12, outline: 'none',
  resize: 'vertical' as const, lineHeight: 1.5, fontFamily: 'inherit',
}

const iconBtn: React.CSSProperties = {
  background: 'none', border: '1px solid var(--border-primary)', borderRadius: 6,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 26, height: 26, flexShrink: 0,
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

  return (
    <div>
      {/* Composer */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              addNote()
            }
          }}
          rows={2}
          placeholder="Écrire une note... (⌘+Entrée pour enregistrer)"
          style={{ ...inputS, flex: 1 }}
        />
        <button
          onClick={addNote}
          disabled={!draft.trim() || saving}
          title="Ajouter la note"
          style={{
            ...iconBtn, width: 32, height: 'auto',
            background: draft.trim() && !saving ? 'rgba(0,200,83,0.10)' : 'transparent',
            borderColor: draft.trim() && !saving ? 'rgba(0,200,83,0.3)' : 'var(--border-primary)',
            cursor: draft.trim() && !saving ? 'pointer' : 'not-allowed',
          }}
        >
          <Plus size={13} color={draft.trim() && !saving ? 'var(--color-primary)' : 'var(--text-muted)'} />
        </button>
      </div>

      {/* Liste */}
      {loading ? (
        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Chargement...</p>
      ) : notes.length === 0 ? (
        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Aucune note</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notes.map(note => {
            const editing = editingId === note.id
            const edited = note.updated_at && note.updated_at !== note.created_at
            return (
              <div
                key={note.id}
                style={{
                  padding: '10px 12px',
                  background: 'var(--bg-input)',
                  borderRadius: 8,
                  border: '1px solid var(--border-primary)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 6 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>
                    {format(new Date(note.created_at), "dd MMM yyyy 'à' HH'h'mm", { locale: fr })}
                    {edited && <span style={{ marginLeft: 6, fontStyle: 'italic' }}>· modifiée</span>}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {editing ? (
                      <>
                        <button onClick={() => saveEdit(note.id)} style={iconBtn} title="Enregistrer">
                          <Check size={12} color="var(--color-primary)" />
                        </button>
                        <button onClick={() => setEditingId(null)} style={iconBtn} title="Annuler">
                          <X size={12} color="var(--text-muted)" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => { setEditingId(note.id); setEditValue(note.content) }}
                          style={iconBtn}
                          title="Modifier"
                        >
                          <Edit3 size={11} color="#666" />
                        </button>
                        <button onClick={() => removeNote(note.id)} style={iconBtn} title="Supprimer">
                          <Trash2 size={11} color="#ef4444" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {editing ? (
                  <textarea
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    rows={3}
                    autoFocus
                    style={inputS}
                  />
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {note.content}
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
