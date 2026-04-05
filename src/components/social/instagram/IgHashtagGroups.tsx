'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Trash2, Edit2 } from 'lucide-react'
import type { IgHashtagGroup } from '@/types'

function LoadingSkeleton() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ width: 160, height: 18, background: 'var(--bg-elevated)', borderRadius: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ width: 140, height: 32, background: 'var(--bg-elevated)', borderRadius: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: 16 }}>
            <div style={{ width: '60%', height: 16, background: 'var(--bg-elevated)', borderRadius: 6, marginBottom: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {[1, 2, 3, 4].map(j => (
                <div key={j} style={{ width: 60 + j * 10, height: 20, background: 'var(--bg-elevated)', borderRadius: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function IgHashtagGroups() {
  const [groups, setGroups] = useState<IgHashtagGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<IgHashtagGroup | null>(null)
  const [name, setName] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)

  const fetchGroups = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/instagram/hashtag-groups')
      if (!res.ok) throw new Error(`Erreur ${res.status}`)
      const json = await res.json()
      setGroups(json.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les groupes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchGroups() }, [fetchGroups])

  const openCreate = () => { setName(''); setHashtags(''); setEditing(null); setSaveError(null); setShowModal(true) }
  const openEdit = (g: IgHashtagGroup) => { setName(g.name); setHashtags(g.hashtags.join(', ')); setEditing(g); setSaveError(null); setShowModal(true) }

  const handleSave = async () => {
    if (!name.trim()) return
    const tags = hashtags.split(',').map(h => h.trim().replace(/^#/, '')).filter(Boolean)
    if (!tags.length) return
    const body = { name: name.trim(), hashtags: tags }
    setSaveError(null)

    try {
      if (editing) {
        const res = await fetch('/api/instagram/hashtag-groups', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editing.id, ...body }) })
        if (!res.ok) throw new Error(`Erreur ${res.status}`)
      } else {
        const res = await fetch('/api/instagram/hashtag-groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        if (!res.ok) throw new Error(`Erreur ${res.status}`)
      }
      setShowModal(false)
      fetchGroups()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce groupe ?')) return
    try {
      const res = await fetch('/api/instagram/hashtag-groups', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      if (!res.ok) throw new Error(`Erreur ${res.status}`)
      fetchGroups()
    } catch {
      alert('Erreur lors de la suppression')
    }
  }

  if (loading) return <LoadingSkeleton />

  if (error) return (
    <div style={{ textAlign: 'center', padding: 60, color: '#ef4444', fontSize: 13, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border-primary)' }}>
      {error}
      <button onClick={fetchGroups} style={{ display: 'block', margin: '12px auto 0', padding: '6px 16px', fontSize: 12, color: 'var(--text-primary)', background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 6, cursor: 'pointer' }}>Réessayer</button>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Groupes de hashtags</h3>
        <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, color: '#fff', background: 'var(--color-primary)', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
          <Plus size={14} /> Nouveau groupe
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        {groups.map(g => (
          <div key={g.id} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{g.name}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => openEdit(g)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><Edit2 size={14} /></button>
                <button onClick={() => handleDelete(g.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={14} /></button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {g.hashtags.map(h => (
                <span key={h} style={{ padding: '2px 10px', fontSize: 11, background: 'var(--bg-elevated)', color: 'var(--text-secondary)', borderRadius: 12 }}>#{h}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {groups.length === 0 && <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)', fontSize: 13, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border-primary)' }}>Aucun groupe</div>}

      {showModal && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 16, padding: 28, width: 460, maxWidth: '90vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{editing ? 'Modifier' : 'Nouveau groupe'}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={18} /></button>
            </div>
            {saveError && (
              <div style={{ padding: '8px 12px', marginBottom: 16, fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,0.1)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)' }}>
                {saveError}
              </div>
            )}
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Nom</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', fontSize: 13, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', borderRadius: 8, outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Hashtags (séparés par des virgules)</label>
                <textarea value={hashtags} onChange={e => setHashtags(e.target.value)} rows={3}
                  style={{ width: '100%', padding: '10px 12px', fontSize: 13, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', borderRadius: 8, outline: 'none', resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '8px 16px', fontSize: 13, color: 'var(--text-tertiary)', background: 'none', border: '1px solid var(--border-primary)', borderRadius: 8, cursor: 'pointer' }}>Annuler</button>
              <button onClick={handleSave} style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, color: '#fff', background: 'var(--color-primary)', border: 'none', borderRadius: 8, cursor: 'pointer' }}>{editing ? 'Modifier' : 'Créer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
