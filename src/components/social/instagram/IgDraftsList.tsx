'use client'

import { useState, useEffect, useCallback } from 'react'
import { Edit2, Trash2 } from 'lucide-react'
import dynamic from 'next/dynamic'
import type { IgDraft } from '@/types'

const IgDraftModal = dynamic(() => import('./IgDraftModal'), { ssr: false })

interface Props {
  status: 'draft' | 'scheduled'
}

function LoadingSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ height: 150, background: 'var(--bg-elevated)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ padding: 14 }}>
            <div style={{ width: '90%', height: 14, background: 'var(--bg-elevated)', borderRadius: 4, marginBottom: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
            <div style={{ width: '70%', height: 14, background: 'var(--bg-elevated)', borderRadius: 4, marginBottom: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />
            <div style={{ display: 'flex', gap: 4 }}>
              {[1, 2, 3].map(j => (
                <div key={j} style={{ width: 50, height: 18, background: 'var(--bg-elevated)', borderRadius: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function IgDraftsList({ status }: Props) {
  const [drafts, setDrafts] = useState<IgDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [editDraft, setEditDraft] = useState<IgDraft | null>(null)

  const fetchDrafts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/instagram/drafts?status=${status}`)
      const json = await res.json()
      setDrafts(json.data ?? [])
    } catch {
      setDrafts([])
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => { fetchDrafts() }, [fetchDrafts])

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce brouillon ?')) return
    try {
      await fetch(`/api/instagram/drafts/${id}`, { method: 'DELETE' })
      fetchDrafts()
    } catch {
      alert('Erreur lors de la suppression')
    }
  }

  if (loading) return <LoadingSkeleton />

  if (drafts.length === 0) return (
    <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)', fontSize: 13, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border-primary)' }}>
      Aucun {status === 'draft' ? 'brouillon' : 'post programmé'}
    </div>
  )

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {drafts.map(d => (
          <div key={d.id} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, overflow: 'hidden', transition: 'all 0.2s ease', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)'; e.currentTarget.style.borderColor = 'var(--text-tertiary)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border-primary)' }}
            onClick={() => setEditDraft(d)}
          >
            {d.media_urls?.[0] ? (
              <div style={{ height: 160, overflow: 'hidden', position: 'relative' }}>
                {d.media_type === 'VIDEO' ? (
                  <video src={d.media_urls[0]} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease' }} />
                ) : (
                  <img src={d.media_urls[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease' }} />
                )}
                <div style={{ position: 'absolute', top: 8, right: 8, padding: '2px 8px', fontSize: 10, fontWeight: 600, borderRadius: 6, background: d.status === 'scheduled' ? 'rgba(59,130,246,0.9)' : 'rgba(100,100,100,0.9)', color: '#fff', backdropFilter: 'blur(4px)' }}>
                  {d.status === 'scheduled' ? 'Programmé' : 'Brouillon'}
                </div>
              </div>
            ) : (
              <div style={{ height: 160, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Aucun média</span>
                <div style={{ position: 'absolute', top: 8, right: 8, padding: '2px 8px', fontSize: 10, fontWeight: 600, borderRadius: 6, background: d.status === 'scheduled' ? 'rgba(59,130,246,0.9)' : 'rgba(100,100,100,0.9)', color: '#fff' }}>
                  {d.status === 'scheduled' ? 'Programmé' : 'Brouillon'}
                </div>
              </div>
            )}
            <div style={{ padding: 14 }}>
              <p style={{ fontSize: 12, color: 'var(--text-primary)', marginBottom: 8, lineHeight: 1.5 }}>
                {d.caption?.slice(0, 120) || 'Pas de légende'}
                {(d.caption?.length ?? 0) > 120 && '...'}
              </p>
              {(d.hashtags?.length ?? 0) > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                  {d.hashtags!.slice(0, 5).map(h => (
                    <span key={h} style={{ padding: '3px 8px', fontSize: 10, background: 'var(--bg-elevated)', color: 'var(--text-tertiary)', borderRadius: 12, border: '1px solid var(--border-primary)' }}>#{h}</span>
                  ))}
                  {d.hashtags!.length > 5 && <span style={{ fontSize: 10, color: 'var(--text-tertiary)', padding: '3px 0' }}>+{d.hashtags!.length - 5}</span>}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border-primary)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {d.scheduled_at ? new Date(d.scheduled_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={e => { e.stopPropagation(); setEditDraft(d) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', transition: 'color 0.15s ease', padding: 4, borderRadius: 4 }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
                  ><Edit2 size={14} /></button>
                  <button onClick={e => { e.stopPropagation(); handleDelete(d.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', transition: 'color 0.15s ease', padding: 4, borderRadius: 4 }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#ef4444' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
                  ><Trash2 size={14} /></button>
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
