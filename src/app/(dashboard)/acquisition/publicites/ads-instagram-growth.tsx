'use client'

import { useState, useEffect } from 'react'

interface Snapshot {
  snapshot_date: string
  followers: number
  views: number
  reach: number
}

interface AdsInstagramGrowthProps {
  dateFrom: string
  dateTo: string
}

export default function AdsInstagramGrowth({ dateFrom, dateTo }: AdsInstagramGrowthProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(true)

  useEffect(() => {
    async function fetchSnapshots() {
      setLoading(true)
      try {
        const res = await fetch('/api/instagram/snapshots')
        if (!res.ok) {
          setConnected(false)
          return
        }
        const json = await res.json()
        const all: Snapshot[] = json.data ?? []

        // Filter to period
        const filtered = all.filter(
          s => s.snapshot_date >= dateFrom && s.snapshot_date <= dateTo
        )
        setSnapshots(filtered)
        setConnected(true)
      } catch {
        setConnected(false)
      } finally {
        setLoading(false)
      }
    }
    fetchSnapshots()
  }, [dateFrom, dateTo])

  if (loading) {
    return (
      <div style={{
        background: '#141414',
        border: '1px solid rgba(138,43,226,0.2)',
        borderRadius: 10,
        padding: 16,
        height: 80,
        animation: 'pulse 1.5s ease-in-out infinite',
      }}>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
      </div>
    )
  }

  if (!connected || snapshots.length === 0) {
    return (
      <div style={{
        background: 'rgba(24, 119, 242, 0.06)',
        border: '1px dashed rgba(24, 119, 242, 0.3)',
        borderRadius: 10,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
            Connecte Instagram
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            pour voir ta croissance followers en temps réel
          </div>
        </div>
        <a
          href="/parametres/integrations"
          style={{
            background: '#8B2BE2',
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            padding: '8px 16px',
            borderRadius: 6,
            textDecoration: 'none',
            flexShrink: 0,
          }}
        >
          Connecter →
        </a>
      </div>
    )
  }

  const first = snapshots[0]
  const last = snapshots[snapshots.length - 1]
  const newFollowers = last.followers - first.followers
  const totalFollowers = last.followers
  const growthRate = first.followers > 0
    ? Math.round((newFollowers / first.followers) * 1000) / 10
    : 0

  return (
    <div style={{
      background: '#141414',
      border: '1px solid rgba(138,43,226,0.2)',
      borderRadius: 10,
      padding: 16,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#8B2BE2', marginBottom: 10 }}>
        📈 Croissance Instagram (période)
      </div>
      <div style={{ display: 'flex', gap: 24 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#8B2BE2' }}>
            {newFollowers >= 0 ? '+' : ''}{newFollowers}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Nouveaux followers</div>
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
            {totalFollowers.toLocaleString('fr-FR')}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Total followers</div>
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
            {growthRate}%
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Taux croissance</div>
        </div>
      </div>
    </div>
  )
}
