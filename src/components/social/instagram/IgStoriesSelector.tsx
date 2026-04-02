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

  useEffect(() => {
    fetch('/api/instagram/stories').then(r => r.json()).then(j => setStories(j.data ?? []))
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
    const items = Array.from(selected).map((story_id, idx) => ({
      story_id,
      position: idx + 1,
    }))
    await fetch(`/api/instagram/sequences/${sequenceId}/items`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
    setSaving(false)
    onSaved()
  }

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
        borderRadius: 16, padding: 28, width: 560, maxHeight: '80vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Sélectionner des stories</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
          {stories.map(s => (
            <label key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
              background: selected.has(s.id) ? 'var(--bg-active)' : 'var(--bg-primary)',
              border: '1px solid var(--border-primary)', borderRadius: 8, cursor: 'pointer',
            }}>
              <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
              <div style={{ width: 36, height: 50, borderRadius: 4, overflow: 'hidden', background: 'var(--bg-elevated)', flexShrink: 0 }}>
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

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', fontSize: 13, color: 'var(--text-tertiary)', background: 'none', border: '1px solid var(--border-primary)', borderRadius: 8, cursor: 'pointer' }}>Annuler</button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, color: '#fff', background: 'var(--color-primary)', border: 'none', borderRadius: 8, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Sauvegarde...' : `Sauvegarder (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  )
}
