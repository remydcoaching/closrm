'use client'

import { useState } from 'react'
import { Camera, FileText, Film } from 'lucide-react'
import {
  type ContentPillar,
  type SocialPostWithPublications,
  type SocialProductionStatus,
  type SocialContentKind,
  PRODUCTION_STATUSES,
} from '@/types'

interface Props {
  posts: SocialPostWithPublications[]
  pillars: ContentPillar[]
  onSelectSlot: (id: string) => void
  onChange: () => void
}

const KIND_ICON: Record<SocialContentKind, typeof Camera> = {
  post: FileText,
  story: Camera,
  reel: Film,
}

export default function BoardView({ posts, pillars, onSelectSlot, onChange }: Props) {
  const [showAll, setShowAll] = useState(false)
  const [filterKind, setFilterKind] = useState<SocialContentKind | 'all'>('all')
  const [draggedId, setDraggedId] = useState<string | null>(null)

  const today = new Date()
  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(today.getDate() - 7)
  const cutoff = `${sevenDaysAgo.getFullYear()}-${String(sevenDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(sevenDaysAgo.getDate()).padStart(2, '0')}`

  const visiblePosts = posts.filter((p) => {
    if (filterKind !== 'all' && p.content_kind !== filterKind) return false
    if (showAll) return true
    if (!['draft', 'scheduled', 'failed'].includes(p.status)) return false
    if (p.plan_date && p.plan_date < cutoff) return false
    return true
  })

  const grouped: Record<SocialProductionStatus, SocialPostWithPublications[]> = {
    idea: [], to_film: [], filmed: [], edited: [], ready: [],
  }
  for (const p of visiblePosts) {
    const ps = (p.production_status ?? 'idea') as SocialProductionStatus
    grouped[ps].push(p)
  }

  const handleDrop = async (status: SocialProductionStatus) => {
    if (!draggedId) return
    const slot = posts.find((p) => p.id === draggedId)
    if (!slot) return
    if (status === 'ready' && (!slot.media_urls || slot.media_urls.length === 0)) {
      alert('Pour passer en "Prêt", il faut au moins un media uploadé.')
      setDraggedId(null)
      return
    }
    setDraggedId(null)
    await fetch(`/api/social/posts/${draggedId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ production_status: status }),
    })
    onChange()
  }

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <select
          value={filterKind}
          onChange={(e) => setFilterKind(e.target.value as SocialContentKind | 'all')}
          style={selectStyle}
        >
          <option value="all">Tous types</option>
          <option value="post">Posts</option>
          <option value="story">Stories</option>
          <option value="reel">Reels</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-tertiary)', cursor: 'pointer' }}>
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Tout l'historique
        </label>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
          {visiblePosts.length} slot{visiblePosts.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, minWidth: 800, overflowX: 'auto' }}>
        {PRODUCTION_STATUSES.map(({ value, label }) => (
          <div
            key={value}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(value)}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 10, padding: 10, minHeight: 200 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                {label}
              </h4>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{grouped[value].length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {grouped[value].map((p) => {
                const pillar = pillars.find((x) => x.id === p.pillar_id)
                const Icon = KIND_ICON[(p.content_kind ?? 'post') as SocialContentKind]
                return (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={() => setDraggedId(p.id)}
                    onClick={() => onSelectSlot(p.id)}
                    style={{
                      background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
                      borderLeft: `3px solid ${pillar?.color ?? '#666'}`,
                      borderRadius: 8, padding: 10, cursor: 'grab',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: pillar?.color ?? 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                        {pillar?.name ?? '—'}
                      </span>
                      <Icon size={12} color="var(--text-tertiary)" />
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.3 }}>
                      {p.hook ?? p.title ?? <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(sans titre)</span>}
                    </div>
                    {p.plan_date && (
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                        {formatDate(p.plan_date)}
                      </div>
                    )}
                  </div>
                )
              })}
              {grouped[value].length === 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', padding: 12, fontStyle: 'italic' }}>
                  Vide
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

const selectStyle: React.CSSProperties = {
  padding: '6px 10px', fontSize: 12,
  color: 'var(--text-primary)', background: 'var(--bg-secondary)',
  border: '1px solid var(--border-primary)', borderRadius: 6, cursor: 'pointer',
}
