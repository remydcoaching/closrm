'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Layers } from 'lucide-react'
import FunnelCard from '@/components/funnels/FunnelCard'
import { useWorkspaceSlugState } from '@/lib/funnels/use-workspace-slug'

interface FunnelListItem {
  id: string
  name: string
  slug: string
  status: 'draft' | 'published'
  page_count: number
  first_page_slug: string | null
  created_at: string
}

export default function FunnelsPage() {
  const [funnels, setFunnels] = useState<FunnelListItem[]>([])
  const [loading, setLoading] = useState(true)
  // T-028 Phase 14/16 — Slug du workspace fetché une seule fois, passé à chaque
  // FunnelCard pour construire l'URL publique des funnels publiés. On expose
  // aussi `fetched` pour que les cards puissent distinguer "en cours de chargement"
  // de "definitivement null" (workspace sans slug configuré).
  const { slug: workspaceSlug, fetched: workspaceSlugFetched } = useWorkspaceSlugState()

  const fetchFunnels = useCallback(async () => {
    try {
      const res = await fetch('/api/funnels')
      const json = await res.json()
      const data = Array.isArray(json.data) ? json.data : []
      setFunnels(data)
    } catch {
      setFunnels([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchFunnels() }, [fetchFunnels])

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/funnels/${id}`, { method: 'DELETE' })
      setFunnels(prev => prev.filter(f => f.id !== id))
    } catch {
      // ignore
    }
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Funnels</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Creez et gerez vos tunnels de vente
          </p>
        </div>
        <Link
          href="/acquisition/funnels/new"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '9px 18px', fontSize: 13, fontWeight: 600,
            background: '#E53E3E', color: '#fff', borderRadius: 8,
            textDecoration: 'none', border: 'none', cursor: 'pointer',
          }}
        >
          <Plus size={16} />
          Nouveau funnel
        </Link>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ color: '#555', fontSize: 14, textAlign: 'center', padding: 60 }}>
          Chargement...
        </div>
      ) : funnels.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 80,
          border: '1px dashed #333', borderRadius: 12,
        }}>
          <Layers size={40} color="#333" style={{ marginBottom: 16 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: '#888', marginBottom: 8 }}>
            Aucun funnel
          </div>
          <div style={{ fontSize: 13, color: '#555', marginBottom: 20 }}>
            Commencez par creer votre premier tunnel de vente
          </div>
          <Link
            href="/acquisition/funnels/new"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '9px 18px', fontSize: 13, fontWeight: 600,
              background: '#E53E3E', color: '#fff', borderRadius: 8,
              textDecoration: 'none',
            }}
          >
            <Plus size={14} />
            Creer un funnel
          </Link>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 16,
        }}>
          {funnels.map(funnel => (
            <FunnelCard
              key={funnel.id}
              funnel={funnel}
              workspaceSlug={workspaceSlug}
              workspaceSlugFetched={workspaceSlugFetched}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
