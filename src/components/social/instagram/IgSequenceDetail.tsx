'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { IG_SEQ_TYPES } from './constants'
import type { StorySequence, StorySequenceItem } from '@/types'
import IgStoriesSelector from './IgStoriesSelector'

interface Props {
  sequence: StorySequence
  onBack: () => void
  onRefresh: () => void
}

export default function IgSequenceDetail({ sequence, onBack, onRefresh }: Props) {
  const [items, setItems] = useState<StorySequenceItem[]>([])
  const [showSelector, setShowSelector] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchItems = useCallback(async () => {
    const res = await fetch(`/api/instagram/sequences/${sequence.id}/items`)
    const json = await res.json()
    setItems(json.data ?? [])
  }, [sequence.id])

  useEffect(() => { fetchItems() }, [fetchItems])

  const handleDelete = async () => {
    if (!confirm('Supprimer cette séquence ?')) return
    setDeleting(true)
    await fetch(`/api/instagram/sequences/${sequence.id}`, { method: 'DELETE' })
    setDeleting(false)
    onRefresh()
    onBack()
  }

  const seqType = IG_SEQ_TYPES[sequence.sequence_type as keyof typeof IG_SEQ_TYPES]

  // Retention funnel
  const maxImpressions = items.length > 0 ? Math.max(...items.map(i => i.story?.impressions ?? 0)) : 0

  return (
    <div>
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 13, marginBottom: 20 }}>
        <ArrowLeft size={16} /> Retour
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{sequence.name}</h2>
        {seqType && (
          <span style={{ padding: '2px 10px', fontSize: 11, fontWeight: 600, borderRadius: 20, background: seqType.color + '22', color: seqType.color }}>
            {seqType.label}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowSelector(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, color: '#fff', background: 'var(--color-primary)', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
          <Plus size={14} /> Ajouter des stories
        </button>
        <button onClick={handleDelete} disabled={deleting} style={{ padding: '6px 14px', fontSize: 12, color: '#ef4444', background: 'none', border: '1px solid #ef4444', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Trash2 size={14} /> Supprimer
        </button>
      </div>

      {sequence.objective && <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 4 }}>{sequence.objective}</p>}
      {sequence.notes && <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16 }}>{sequence.notes}</p>}

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Stories', value: items.length },
          { label: 'Impressions', value: sequence.total_impressions.toLocaleString() },
          { label: 'Drop-off', value: `${Math.round(sequence.overall_dropoff_rate)}%` },
          { label: 'Replies', value: sequence.total_replies },
        ].map(m => (
          <div key={m.label} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>{m.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Retention funnel */}
      {items.length > 0 && (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Funnel de rétention</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {items.map(item => {
              const imp = item.story?.impressions ?? 0
              const pct = maxImpressions > 0 ? (imp / maxImpressions) * 100 : 0
              return (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 60 }}>Story {item.position}</span>
                  <div style={{ flex: 1, height: 24, background: 'var(--bg-primary)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--color-primary)', borderRadius: 4, display: 'flex', alignItems: 'center', paddingLeft: 8 }}>
                      <span style={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>{imp}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Story thumbnails grid */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {items.map(item => (
          <div key={item.id} style={{ width: 100, height: 178, borderRadius: 8, overflow: 'hidden', background: 'var(--bg-elevated)' }}>
            {(item.story?.thumbnail_url || item.story?.ig_media_url) ? (
              <img src={item.story.thumbnail_url || item.story.ig_media_url || ''} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--text-tertiary)' }}>Story {item.position}</div>
            )}
          </div>
        ))}
      </div>

      {showSelector && (
        <IgStoriesSelector
          sequenceId={sequence.id}
          currentItems={items}
          onClose={() => setShowSelector(false)}
          onSaved={() => { setShowSelector(false); fetchItems(); onRefresh() }}
        />
      )}
    </div>
  )
}
