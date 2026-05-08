'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Clapperboard, Scissors, CheckCircle2, Loader2 } from 'lucide-react'
import type { SocialPost, ContentPillar } from '@/types'
import { useToast } from '@/components/ui/Toast'

// Drawer = lourd (~2k lignes), lazy
const SlotDetailDrawer = dynamic(() => import('@/components/social/planning/SlotDetailDrawer'), { ssr: false })

const COLUMNS = [
  { key: 'filmed', label: 'À monter', color: '#f59e0b', icon: Clapperboard },
  { key: 'edited', label: 'Monté',    color: '#8b5cf6', icon: Scissors },
  { key: 'ready',  label: 'Validé',   color: '#10b981', icon: CheckCircle2 },
] as const

export default function MontagePage() {
  const toast = useToast()
  const [slots, setSlots] = useState<SocialPost[]>([])
  const [pillars, setPillars] = useState<ContentPillar[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)

  const fetchSlots = useCallback(async () => {
    try {
      const res = await fetch('/api/social/posts?slim=true&production_status=filmed,edited,ready&per_page=200')
      if (!res.ok) throw new Error(`Erreur ${res.status}`)
      const j = await res.json()
      setSlots((j as { data?: SocialPost[] }).data ?? [])
    } catch (e) {
      toast.error('Erreur', (e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [toast])

  const fetchPillars = useCallback(async () => {
    try {
      const res = await fetch('/api/social/pillars')
      if (!res.ok) return
      const j = await res.json()
      setPillars((j as { data?: ContentPillar[] }).data ?? [])
    } catch { /* best-effort */ }
  }, [])

  useEffect(() => {
    fetchSlots()
    fetchPillars()
  }, [fetchSlots, fetchPillars])

  const slotsByStatus: Record<string, SocialPost[]> = {
    filmed: slots.filter(s => s.production_status === 'filmed'),
    edited: slots.filter(s => s.production_status === 'edited'),
    ready:  slots.filter(s => s.production_status === 'ready'),
  }

  return (
    <div style={{ padding: '32px 40px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>
        Mes montages
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 28 }}>
        Slots qui te sont assignés. Clique sur un slot pour uploader la vidéo finale ou consulter les retours.
      </p>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-tertiary)', fontSize: 13 }}>
          <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Chargement…
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : slots.length === 0 ? (
        <div style={{
          padding: 48, textAlign: 'center',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-primary)',
          borderRadius: 12,
          color: 'var(--text-tertiary)',
          fontSize: 13,
        }}>
          Aucun slot ne t&apos;est assigné pour le moment. Le coach te notifiera quand un montage sera prêt.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {COLUMNS.map(col => {
            const Icon = col.icon
            const colSlots = slotsByStatus[col.key] ?? []
            return (
              <div
                key={col.key}
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--border-primary)' }}>
                  <Icon size={14} style={{ color: col.color }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {col.label}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
                    {colSlots.length}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {colSlots.length === 0 ? (
                    <div style={{ padding: 16, textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)' }}>
                      —
                    </div>
                  ) : (
                    colSlots.map(s => (
                      <SlotCard key={s.id} slot={s} pillars={pillars} onClick={() => setSelectedSlotId(s.id)} />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selectedSlotId && (
        <SlotDetailDrawer
          slotId={selectedSlotId}
          pillars={pillars}
          onClose={() => setSelectedSlotId(null)}
          onChange={fetchSlots}
        />
      )}
    </div>
  )
}

function SlotCard({
  slot,
  pillars,
  onClick,
}: {
  slot: SocialPost
  pillars: ContentPillar[]
  onClick: () => void
}) {
  const pillar = pillars.find(p => p.id === slot.pillar_id)
  const date = slot.plan_date
    ? new Date(slot.plan_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
    : null
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left',
        padding: 12,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-primary)',
        borderRadius: 8,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        transition: 'border-color 0.15s',
      }}
    >
      {date && (
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {date}
        </span>
      )}
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35 }}>
        {slot.title || slot.hook?.slice(0, 80) || 'Sans titre'}
      </span>
      {pillar && (
        <span style={{ fontSize: 10, color: pillar.color, fontWeight: 600 }}>
          ● {pillar.name}
        </span>
      )}
    </button>
  )
}
