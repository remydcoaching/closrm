'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { IgStory, StorySequenceItem } from '@/types'

interface Props {
  sequenceId: string
  currentItems: StorySequenceItem[]
  onClose: () => void
  onSaved: () => void
}

export default function IgStoriesSelector({ sequenceId, currentItems, onClose, onSaved }: Props) {
  const [stories, setStories] = useState<IgStory[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set(currentItems.map(i => i.story_id)))
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch('/api/instagram/stories')
      .then(r => {
        if (!r.ok) throw new Error('Erreur lors du chargement des stories')
        return r.json()
      })
      .then(j => setStories(j.data ?? []))
      .catch(err => setError(err instanceof Error ? err.message : 'Erreur inconnue'))
      .finally(() => setLoading(false))
  }, [])

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const items = Array.from(selected).map((story_id, idx) => ({
        story_id,
        position: idx + 1,
      }))
      const res = await fetch(`/api/instagram/sequences/${sequenceId}/items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      if (!res.ok) throw new Error('Erreur lors de la sauvegarde')
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = selected.size > 0

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <div style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
        borderRadius: 16, padding: 28, width: 560, maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Sélectionner des stories</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={18} /></button>
        </div>

        {error && (
          <div style={{
            background: '#ef444422', border: '1px solid #ef4444', borderRadius: 8,
            padding: '8px 14px', marginBottom: 16, fontSize: 12, color: '#ef4444',
          }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 13 }}>Chargement...</div>
        ) : (
          <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
            {stories.map(s => (
              <label key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
                background: selected.has(s.id) ? 'var(--bg-active)' : 'var(--bg-primary)',
                border: '1px solid var(--border-primary)', borderRadius: 8, cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={selected.has(s.id)}
                  onChange={() => toggle(s.id)}
                  style={{ flexShrink: 0, marginTop: 0 }}
                />
                <div style={{ width: 36, height: 64, borderRadius: 4, overflow: 'hidden', background: 'var(--bg-elevated)', flexShrink: 0 }}>
                  {(s.thumbnail_url || s.ig_media_url) && (
                    <img src={s.thumbnail_url || s.ig_media_url || ''} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.caption?.slice(0, 40) || 'Story'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {new Date(s.published_at).toLocaleDateString('fr-FR')} · {s.impressions} vues
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', fontSize: 13, color: 'var(--text-tertiary)', background: 'none', border: '1px solid var(--border-primary)', borderRadius: 8, cursor: 'pointer' }}>Annuler</button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            style={{
              padding: '8px 20px', fontSize: 13, fontWeight: 600, color: '#fff',
              background: 'var(--color-primary)', border: 'none', borderRadius: 8,
              cursor: hasChanges && !saving ? 'pointer' : 'not-allowed',
              opacity: saving || !hasChanges ? 0.5 : 1,
            }}
          >
            {saving ? 'Sauvegarde...' : `Sauvegarder (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  )
}
