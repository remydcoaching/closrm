'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Trash2, Edit2 } from 'lucide-react'
import { IG_CAPTION_CATEGORIES } from './constants'
import type { IgCaptionTemplate } from '@/types'

export default function IgCaptionTemplates() {
  const [templates, setTemplates] = useState<IgCaptionTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<IgCaptionTemplate | null>(null)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('general')
  const [body, setBody] = useState('')
  const [hashtags, setHashtags] = useState('')

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/instagram/caption-templates')
    const json = await res.json()
    setTemplates(json.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  const openCreate = () => { setTitle(''); setCategory('general'); setBody(''); setHashtags(''); setEditing(null); setShowModal(true) }
  const openEdit = (t: IgCaptionTemplate) => { setTitle(t.title); setCategory(t.category); setBody(t.body); setHashtags(t.hashtags.join(', ')); setEditing(t); setShowModal(true) }

  const handleSave = async () => {
    if (!title.trim()) return
    const tags = hashtags.split(',').map(h => h.trim().replace(/^#/, '')).filter(Boolean)
    const data = { title: title.trim(), category, body, hashtags: tags }
    if (editing) {
      await fetch('/api/instagram/caption-templates', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editing.id, ...data }) })
    } else {
      await fetch('/api/instagram/caption-templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    }
    setShowModal(false); fetchTemplates()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce template ?')) return
    await fetch('/api/instagram/caption-templates', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    fetchTemplates()
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)', fontSize: 13 }}>Chargement...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Templates de legende</h3>
        <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, color: '#fff', background: 'var(--color-primary)', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
          <Plus size={14} /> Nouveau template
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        {templates.map(t => {
          const catLabel = IG_CAPTION_CATEGORIES.find(c => c.value === t.category)?.label ?? t.category
          return (
            <div key={t.id} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t.title}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => openEdit(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><Edit2 size={14} /></button>
                  <button onClick={() => handleDelete(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={14} /></button>
                </div>
              </div>
              <span style={{ padding: '2px 8px', fontSize: 10, fontWeight: 600, borderRadius: 12, background: 'var(--bg-elevated)', color: 'var(--text-tertiary)', display: 'inline-block', marginBottom: 8 }}>{catLabel}</span>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: 8 }}>{t.body.slice(0, 100)}{t.body.length > 100 && '...'}</p>
              {(t.hashtags?.length ?? 0) > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {t.hashtags.slice(0, 5).map(h => <span key={h} style={{ padding: '2px 8px', fontSize: 10, background: 'var(--bg-elevated)', color: 'var(--text-tertiary)', borderRadius: 12 }}>#{h}</span>)}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {templates.length === 0 && <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)', fontSize: 13, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border-primary)' }}>Aucun template</div>}

      {showModal && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 16, padding: 28, width: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{editing ? 'Modifier' : 'Nouveau template'}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Titre</label>
                <input value={title} onChange={e => setTitle(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', fontSize: 13, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', borderRadius: 8, outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Categorie</label>
                <select value={category} onChange={e => setCategory(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', fontSize: 13, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', borderRadius: 8, outline: 'none' }}>
                  {IG_CAPTION_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Corps</label>
                <textarea value={body} onChange={e => setBody(e.target.value)} rows={5}
                  style={{ width: '100%', padding: '10px 12px', fontSize: 13, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', borderRadius: 8, outline: 'none', resize: 'vertical' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Hashtags</label>
                <input value={hashtags} onChange={e => setHashtags(e.target.value)} placeholder="tag1, tag2, tag3"
                  style={{ width: '100%', padding: '10px 12px', fontSize: 13, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', borderRadius: 8, outline: 'none' }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '8px 16px', fontSize: 13, color: 'var(--text-tertiary)', background: 'none', border: '1px solid var(--border-primary)', borderRadius: 8, cursor: 'pointer' }}>Annuler</button>
              <button onClick={handleSave} disabled={!title.trim()} style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, color: '#fff', background: 'var(--color-primary)', border: 'none', borderRadius: 8, cursor: 'pointer' }}>{editing ? 'Modifier' : 'Creer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
