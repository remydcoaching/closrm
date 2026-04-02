'use client'

import { useState, useEffect, useCallback } from 'react'
import { Edit2, Trash2 } from 'lucide-react'
import type { IgDraft } from '@/types'
import IgDraftModal from './IgDraftModal'

interface Props {
  status: 'draft' | 'scheduled'
}

export default function IgDraftsList({ status }: Props) {
  const [drafts, setDrafts] = useState<IgDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [editDraft, setEditDraft] = useState<IgDraft | null>(null)

  const fetchDrafts = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/instagram/drafts?status=${status}`)
    const json = await res.json()
    setDrafts(json.data ?? [])
    setLoading(false)
  }, [status])

  useEffect(() => { fetchDrafts() }, [fetchDrafts])

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce brouillon ?')) return
    await fetch(`/api/instagram/drafts/${id}`, { method: 'DELETE' })
    fetchDrafts()
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)', fontSize: 13 }}>Chargement...</div>

  if (drafts.length === 0) return (
    <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)', fontSize: 13, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border-primary)' }}>
      Aucun {status === 'draft' ? 'brouillon' : 'post programme'}
    </div>
  )

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {drafts.map(d => (
          <div key={d.id} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, overflow: 'hidden' }}>
            {d.media_urls?.[0] && (
              <div style={{ height: 150, overflow: 'hidden' }}>
                {d.media_type === 'VIDEO' ? (
                  <video src={d.media_urls[0]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <img src={d.media_urls[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
              </div>
            )}
            <div style={{ padding: 14 }}>
              <p style={{ fontSize: 12, color: 'var(--text-primary)', marginBottom: 8, lineHeight: 1.4 }}>
                {d.caption?.slice(0, 120) || 'Pas de legende'}
                {(d.caption?.length ?? 0) > 120 && '...'}
              </p>
              {(d.hashtags?.length ?? 0) > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                  {d.hashtags!.slice(0, 5).map(h => (
                    <span key={h} style={{ padding: '2px 8px', fontSize: 10, background: 'var(--bg-elevated)', color: 'var(--text-tertiary)', borderRadius: 12 }}>#{h}</span>
                  ))}
                  {d.hashtags!.length > 5 && <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>+{d.hashtags!.length - 5}</span>}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {d.scheduled_at ? new Date(d.scheduled_at).toLocaleDateString('fr-FR') : ''}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => setEditDraft(d)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><Edit2 size={14} /></button>
                  <button onClick={() => handleDelete(d.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {editDraft && <IgDraftModal draft={editDraft} onClose={() => setEditDraft(null)} onSaved={() => { setEditDraft(null); fetchDrafts() }} />}
    </div>
  )
}
