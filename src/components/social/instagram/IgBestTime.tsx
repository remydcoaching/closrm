'use client'

import { useState, useEffect, Fragment } from 'react'
import type { IgReel } from '@/types'

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6) // 6h -> 23h

export default function IgBestTime() {
  const [reels, setReels] = useState<IgReel[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/instagram/reels?per_page=100').then(r => r.json()).then(j => { setReels(j.data ?? []); setLoading(false) })
  }, [])

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)', fontSize: 13 }}>Chargement...</div>
  if (reels.length < 5) return (
    <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)', fontSize: 13, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border-primary)' }}>
      Minimum 5 reels necessaires pour analyser les meilleurs horaires
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
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Heatmap engagement par creneau</h3>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: `60px repeat(${HOURS.length}, 1fr)`, gap: 2 }}>
            {/* Header row */}
            <div />
            {HOURS.map(h => (
              <div key={h} style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-tertiary)', padding: 4 }}>{h}h</div>
            ))}
            {/* Data rows */}
            {DAYS.map((day, dayIdx) => (
              <Fragment key={`row-${dayIdx}`}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', paddingRight: 8 }}>{day}</div>
                {HOURS.map(hour => {
                  const key = `${dayIdx}-${hour}`
                  const avg = avgs[key] ?? 0
                  const intensity = maxAvg > 0 ? avg / maxAvg : 0
                  return (
                    <div
                      key={`${dayIdx}-${hour}`}
                      title={avg > 0 ? `${avg.toFixed(1)}% engagement` : ''}
                      style={{
                        height: 28, borderRadius: 3,
                        background: intensity > 0
                          ? `rgba(239, 68, 68, ${0.1 + intensity * 0.8})`
                          : 'var(--bg-primary)',
                      }}
                    />
                  )
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Top 5 */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Top 5 creneaux</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {topSlots.map((slot, i) => (
            <div key={i} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: 8, padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{slot.day} {slot.hour}</div>
              <div style={{ fontSize: 13, color: 'var(--color-primary)', fontWeight: 600 }}>{slot.avg}%</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{slot.count} posts</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
