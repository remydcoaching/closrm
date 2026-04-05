'use client'

import { useState, useEffect, Fragment } from 'react'
import type { IgReel } from '@/types'

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6) // 6h -> 23h

export default function IgBestTime() {
  const [reels, setReels] = useState<IgReel[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/instagram/reels?per_page=100')
      .then(r => r.json())
      .then(j => { setReels(j.data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)', fontSize: 13 }}>Chargement...</div>
  if (reels.length < 5) return (
    <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)', fontSize: 13, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border-primary)' }}>
      Minimum 5 reels nécessaires pour analyser les meilleurs horaires
    </div>
  )

  // Build heatmap data
  const grid: Record<string, { total: number; count: number }> = {}
  for (const reel of reels) {
    const d = new Date(reel.published_at)
    const day = (d.getDay() + 6) % 7 // Monday = 0
    const hour = d.getHours()
    const key = `${day}-${hour}`
    if (!grid[key]) grid[key] = { total: 0, count: 0 }
    grid[key].total += reel.engagement_rate
    grid[key].count++
  }

  const avgs: Record<string, number> = {}
  let maxAvg = 0
  for (const [key, val] of Object.entries(grid)) {
    const avg = val.total / val.count
    avgs[key] = avg
    if (avg > maxAvg) maxAvg = avg
  }

  // Top 5 slots
  const topSlots = Object.entries(avgs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, avg]) => {
      const [day, hour] = key.split('-').map(Number)
      return { day: DAYS[day], hour: `${hour}h`, avg: avg.toFixed(1), count: grid[key].count }
    })

  return (
    <div>
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Heatmap engagement par créneau</h3>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: `60px repeat(${HOURS.length}, 1fr)`, gap: 2 }}>
            {/* Header row */}
            <div />
            {HOURS.map(h => (
              <div key={h} style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)', padding: 4 }}>{h}h</div>
            ))}
            {/* Data rows */}
            {DAYS.map((day, dayIdx) => (
              <Fragment key={`row-${dayIdx}`}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', paddingRight: 8 }}>{day}</div>
                {HOURS.map(hour => {
                  const key = `${dayIdx}-${hour}`
                  const avg = avgs[key] ?? 0
                  const intensity = maxAvg > 0 ? avg / maxAvg : 0
                  return (
                    <div
                      key={`${dayIdx}-${hour}`}
                      title={avg > 0 ? `${DAYS[dayIdx]} ${hour}h — ${avg.toFixed(1)}% engagement (${grid[key]?.count ?? 0} posts)` : 'Pas de données'}
                      style={{
                        height: 34, borderRadius: 6,
                        background: intensity > 0
                          ? `rgba(239, 68, 68, ${0.08 + intensity * 0.82})`
                          : 'var(--bg-primary)',
                        transition: 'all 0.15s ease',
                        cursor: avg > 0 ? 'pointer' : 'default',
                      }}
                      onMouseEnter={e => { if (avg > 0) { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.zIndex = '1' } }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.zIndex = '0' }}
                    />
                  )
                })}
              </Fragment>
            ))}
          </div>
        </div>

        {/* Color scale legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20, justifyContent: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>Faible</span>
          <div style={{ display: 'flex', gap: 2, borderRadius: 4, overflow: 'hidden' }}>
            {[0.08, 0.2, 0.38, 0.58, 0.78, 0.9].map((opacity, i) => (
              <div key={i} style={{ width: 28, height: 14, background: `rgba(239, 68, 68, ${opacity})` }} />
            ))}
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>Fort</span>
        </div>
      </div>

      {/* Top 5 */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Top 5 créneaux</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {topSlots.map((slot, i) => (
            <div key={i} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: 10, padding: 16, textAlign: 'center', transition: 'all 0.2s ease', position: 'relative', overflow: 'hidden' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-primary)'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              {i === 0 && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--color-primary)', borderRadius: '10px 10px 0 0' }} />}
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>#{i + 1}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{slot.day} {slot.hour}</div>
              <div style={{ fontSize: 14, color: 'var(--color-primary)', fontWeight: 700 }}>{slot.avg}%</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{slot.count} posts</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
