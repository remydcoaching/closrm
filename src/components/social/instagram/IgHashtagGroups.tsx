'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Trash2, Edit2 } from 'lucide-react'
import type { IgHashtagGroup } from '@/types'

export default function IgHashtagGroups() {
  const [groups, setGroups] = useState<IgHashtagGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<IgHashtagGroup | null>(null)
  const [name, setName] = useState('')
  const [hashtags, setHashtags] = useState('')

  const fetchGroups = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/instagram/hashtag-groups')
    const json = await res.json()
    setGroups(json.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchGroups() }, [fetchGroups])

  const openCreate = () => { setName(''); setHashtags(''); setEditing(null); setShowModal(true) }
  const openEdit = (g: IgHashtagGroup) => { setName(g.name); setHashtags(g.hashtags.join(', ')); setEditing(g); setShowModal(true) }

  const handleSave = async () => {
    if (!name.trim()) return
    const tags = hashtags.split(',').map(h => h.trim().replace(/^#/, '')).filter(Boolean)
    if (!tags.length) return
    const body = { name: name.trim(), hashtags: tags }

    if (editing) {
      await fetch('/api/instagram/hashtag-groups', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editing.id, ...body }) })
    } else {
      await fetch('/api/instagram/hashtag-groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    }
    setShowModal(false); fetchGroups()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce groupe ?')) return
    await fetch('/api/instagram/hashtag-groups', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    fetchGroups()
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)', fontSize: 13 }}>Chargement...</div>

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
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 16, padding: 28, width: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{editing ? 'Modifier' : 'Nouveau groupe'}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Nom</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', fontSize: 13, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', borderRadius: 8, outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Hashtags (separes par des virgules)</label>
                <textarea value={hashtags} onChange={e => setHashtags(e.target.value)} rows={3}
                  style={{ width: '100%', padding: '10px 12px', fontSize: 13, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', borderRadius: 8, outline: 'none', resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '8px 16px', fontSize: 13, color: 'var(--text-tertiary)', background: 'none', border: '1px solid var(--border-primary)', borderRadius: 8, cursor: 'pointer' }}>Annuler</button>
              <button onClick={handleSave} style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, color: '#fff', background: 'var(--color-primary)', border: 'none', borderRadius: 8, cursor: 'pointer' }}>{editing ? 'Modifier' : 'Creer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
