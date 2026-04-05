'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Plus, X, Trash2, Edit2 } from 'lucide-react'

function PieChartSkeleton() {
  return (
    <div style={{ width: '100%', height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 170, height: 170, borderRadius: '50%', background: 'var(--bg-elevated)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  )
}

const IgPillarPieChart = dynamic(
  () => import('./IgPillarPieChartInner'),
  { ssr: false, loading: () => <PieChartSkeleton /> },
)
import type { IgReel, IgContentPillar } from '@/types'

function SkeletonBlock({ width, height }: { width: string | number; height: string | number }) {
  return (
    <div style={{
      width, height, borderRadius: 8, background: 'var(--bg-elevated)',
      animation: 'pulse 1.5s ease-in-out infinite',
    }} />
  )
}

export default function IgReelsTab() {
  const [reels, setReels] = useState<IgReel[]>([])
  const [pillars, setPillars] = useState<IgContentPillar[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPillarModal, setShowPillarModal] = useState(false)
  const [editingPillar, setEditingPillar] = useState<IgContentPillar | null>(null)
  const [pillarName, setPillarName] = useState('')
  const [pillarColor, setPillarColor] = useState('#3b82f6')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [reelsRes, pillarsRes] = await Promise.all([
        fetch('/api/instagram/reels?per_page=100'),
        fetch('/api/instagram/pillars'),
      ])
      if (!reelsRes.ok || !pillarsRes.ok) throw new Error('Erreur lors du chargement des donnees')
      const [reelsJson, pillarsJson] = await Promise.all([reelsRes.json(), pillarsRes.json()])
      setReels(reelsJson.data ?? [])
      setPillars(pillarsJson.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // KPIs
  const totalViews = reels.reduce((s, r) => s + r.views, 0)
  const avgEngagement = reels.length > 0 ? reels.reduce((s, r) => s + r.engagement_rate, 0) / reels.length : 0
  const avgReach = reels.length > 0 ? reels.reduce((s, r) => s + r.reach, 0) / reels.length : 0

  // Pillar distribution for PieChart
  const pillarCounts = pillars.map(p => ({
    name: p.name,
    value: reels.filter(r => r.pillar_id === p.id).length,
    color: p.color,
  })).filter(p => p.value > 0)
  const unassigned = reels.filter(r => !r.pillar_id).length
  if (unassigned > 0) pillarCounts.push({ name: 'Non assigné', value: unassigned, color: '#666' })

  const handleSavePillar = async () => {
    if (!pillarName.trim()) return
    setError(null)
    try {
      if (editingPillar) {
        const res = await fetch('/api/instagram/pillars', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingPillar.id, name: pillarName.trim(), color: pillarColor }),
        })
        if (!res.ok) throw new Error('Erreur lors de la modification')
      } else {
        const res = await fetch('/api/instagram/pillars', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: pillarName.trim(), color: pillarColor }),
        })
        if (!res.ok) throw new Error('Erreur lors de la creation')
      }
      setPillarName(''); setPillarColor('#3b82f6'); setEditingPillar(null); setShowPillarModal(false); fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    }
  }

  const handleDeletePillar = async (id: string) => {
    if (!confirm('Supprimer ce pilier ?')) return
    try {
      const res = await fetch('/api/instagram/pillars', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error('Erreur lors de la suppression')
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    }
  }

  const handleAssignPillar = async (reelId: string, pillarId: string | null) => {
    try {
      await fetch('/api/instagram/reels', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reel_id: reelId, pillar_id: pillarId }),
      })
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    }
  }

  if (loading) {
    return (
      <div>
        {/* Skeleton: KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} width="100%" height={80} />
          ))}
        </div>
        {/* Skeleton: table */}
        <SkeletonBlock width="100%" height={300} />
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <SkeletonBlock width="100%" height={200} />
          <SkeletonBlock width="100%" height={200} />
        </div>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } }`}</style>
      </div>
    )
  }

  return (
    <div>
      {/* Error banner */}
      {error && (
        <div style={{
          background: '#ef444422', border: '1px solid #ef4444', borderRadius: 8,
          padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 13, color: '#ef4444' }}>{error}</span>
          <button onClick={fetchData} style={{ fontSize: 12, fontWeight: 600, color: '#ef4444', background: 'none', border: '1px solid #ef4444', borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}>
            Réessayer
          </button>
        </div>
      )}

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
        {[
          { label: 'Total Vues', value: totalViews.toLocaleString() },
          { label: 'Engagement moyen', value: `${avgEngagement.toFixed(1)}%` },
          { label: 'Total Reels', value: reels.length },
          { label: 'Reach moyen', value: Math.round(avgReach).toLocaleString() },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>{kpi.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Reels table */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: 20, marginBottom: 32 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Reels</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Caption', 'Pilier', 'Vues', 'Saves', 'Shares', 'Comments', 'Engagement'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border-primary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reels.map(r => {
                const pillar = pillars.find(p => p.id === r.pillar_id)
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border-primary)', transition: 'background 0.15s ease' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-primary)', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.caption?.slice(0, 60) ?? '—'}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <select
                        value={r.pillar_id ?? ''}
                        onChange={e => handleAssignPillar(r.id, e.target.value || null)}
                        style={{
                          fontSize: 11, padding: '3px 6px',
                          background: 'var(--bg-primary)', color: 'var(--text-secondary)',
                          border: '1px solid var(--border-primary)', borderRadius: 4,
                          appearance: 'auto',
                          WebkitAppearance: 'menulist',
                        }}
                      >
                        <option value="" style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>—</option>
                        {pillars.map(p => (
                          <option key={p.id} value={p.id} style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>{r.views.toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>{r.saves.toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>{r.shares.toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>{r.comments.toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>{r.engagement_rate.toFixed(1)}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Content Pillars */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Piliers de contenu</h3>
            <button onClick={() => { setPillarName(''); setPillarColor('#3b82f6'); setEditingPillar(null); setShowPillarModal(true) }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#fff', background: 'var(--color-primary)', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              <Plus size={14} /> Ajouter
            </button>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {pillars.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-primary)', borderRadius: 10, border: '1px solid var(--border-primary)', transition: 'all 0.15s ease' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = p.color }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-primary)' }}
              >
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: p.color, flexShrink: 0, boxShadow: `0 0 8px ${p.color}44` }} />
                <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1, fontWeight: 500 }}>{p.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 12 }}>{reels.filter(r => r.pillar_id === p.id).length} reels</span>
                <button onClick={() => { setPillarName(p.name); setPillarColor(p.color); setEditingPillar(p); setShowPillarModal(true) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><Edit2 size={14} /></button>
                <button onClick={() => handleDeletePillar(p.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>

        {/* Distribution chart */}
        {pillarCounts.length > 0 && (
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Distribution</h3>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IgPillarPieChart pillarCounts={pillarCounts} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12, justifyContent: 'center' }}>
              {pillarCounts.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.color }} />
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{p.name} ({p.value})</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Pillar modal */}
      {showPillarModal && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowPillarModal(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 16, padding: 28, width: 400, maxWidth: '90vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{editingPillar ? 'Modifier le pilier' : 'Nouveau pilier'}</h3>
              <button onClick={() => setShowPillarModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Nom</label>
                <input value={pillarName} onChange={e => setPillarName(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', fontSize: 13, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Couleur</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="color"
                    value={pillarColor}
                    onChange={e => setPillarColor(e.target.value)}
                    aria-label="Sélectionner une couleur pour le pilier"
                    style={{ width: 40, height: 36, border: 'none', cursor: 'pointer' }}
                  />
                  <input value={pillarColor} onChange={e => setPillarColor(e.target.value)}
                    style={{ flex: 1, padding: '10px 12px', fontSize: 13, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
              <button onClick={() => setShowPillarModal(false)} style={{ padding: '8px 16px', fontSize: 13, color: 'var(--text-tertiary)', background: 'none', border: '1px solid var(--border-primary)', borderRadius: 8, cursor: 'pointer' }}>Annuler</button>
              <button onClick={handleSavePillar} disabled={!pillarName.trim()}
                style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, color: '#fff', background: 'var(--color-primary)', border: 'none', borderRadius: 8, cursor: !pillarName.trim() ? 'not-allowed' : 'pointer', opacity: !pillarName.trim() ? 0.6 : 1 }}>
                {editingPillar ? 'Modifier' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
