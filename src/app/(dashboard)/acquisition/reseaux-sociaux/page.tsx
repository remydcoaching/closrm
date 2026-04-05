'use client'

import { useState, useEffect, useCallback } from 'react'
import SocialPlatformTabs from '@/components/social/SocialPlatformTabs'
import IgSubTabs from '@/components/social/instagram/IgSubTabs'
import IgNotConnected from '@/components/social/instagram/IgNotConnected'
import IgGeneralTab from '@/components/social/instagram/IgGeneralTab'
import IgStoriesTab from '@/components/social/instagram/IgStoriesTab'
import IgReelsTab from '@/components/social/instagram/IgReelsTab'
import IgCalendarTab from '@/components/social/instagram/IgCalendarTab'
import IgCommentsTab from '@/components/social/instagram/IgCommentsTab'

function LoadingSkeleton() {
  return (
    <div>
      {/* Platform tabs skeleton */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[1, 2].map(i => (
          <div key={i} style={{ width: 120, height: 36, background: 'var(--bg-elevated)', borderRadius: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
      {/* Sub-tabs skeleton */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ width: 80, height: 32, background: 'var(--bg-elevated)', borderRadius: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
      {/* KPI row skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 32 }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ width: '60%', height: 12, background: 'var(--bg-elevated)', borderRadius: 4, marginBottom: 10, animation: 'pulse 1.5s ease-in-out infinite' }} />
            <div style={{ width: '80%', height: 24, background: 'var(--bg-elevated)', borderRadius: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />
          </div>
        ))}
      </div>
      {/* Chart skeleton */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: 20 }}>
        <div style={{ width: 180, height: 16, background: 'var(--bg-elevated)', borderRadius: 6, marginBottom: 16, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ width: '100%', height: 250, background: 'var(--bg-elevated)', borderRadius: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
    </div>
  )
}

export default function ReseauxSociauxPage() {
  const [platform, setPlatform] = useState('instagram')
  const [igTab, setIgTab] = useState('general')
  const [igAccount, setIgAccount] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  const fetchAccount = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/instagram/account')
      if (!res.ok) throw new Error(`Erreur ${res.status}`)
      const json = await res.json()
      if (json.data) {
        setIgAccount(json.data)
      } else {
        // No ig_account yet — try to create one from existing Meta integration
        const createRes = await fetch('/api/instagram/account', { method: 'POST' })
        if (!createRes.ok) throw new Error(`Erreur ${createRes.status}`)
        const createJson = await createRes.json()
        setIgAccount(createJson.data ?? null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger le compte')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAccount() }, [fetchAccount])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/instagram/sync', { method: 'POST' })
      if (!res.ok) throw new Error(`Erreur ${res.status}`)
    } catch {
      alert('Erreur lors de la synchronisation')
    } finally {
      setSyncing(false)
    }
  }

  const handleLinkAccount = async () => {
    try {
      const res = await fetch('/api/instagram/account', { method: 'POST' })
      if (!res.ok) throw new Error()
      await fetchAccount()
    } catch {
      alert('Erreur lors de la connexion du compte')
    }
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200 }}>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
          Réseaux sociaux
        </h1>
        {igAccount && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleSync}
              disabled={syncing}
              style={{
                padding: '8px 16px', fontSize: 12, fontWeight: 600,
                color: '#fff', background: 'var(--color-primary)',
                border: 'none', borderRadius: 8, cursor: syncing ? 'wait' : 'pointer',
                opacity: syncing ? 0.7 : 1,
                transition: 'all 0.2s ease',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              {syncing && (
                <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
              )}
              {syncing ? 'Synchronisation...' : 'Synchroniser'}
            </button>
          </div>
        )}
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 24 }}>
        Gérez vos réseaux sociaux, stories, reels et calendrier de publication
      </p>

      <SocialPlatformTabs selected={platform} onChange={setPlatform} />

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#ef4444', fontSize: 13, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid rgba(239,68,68,0.2)' }}>
          {error}
          <button onClick={fetchAccount} style={{ display: 'block', margin: '12px auto 0', padding: '8px 20px', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s ease' }}>Réessayer</button>
        </div>
      ) : !igAccount ? (
        <IgNotConnected />
      ) : (
        <>
          <IgSubTabs selected={igTab} onChange={setIgTab} />
          {igTab === 'general' && <IgGeneralTab onLinkAccount={handleLinkAccount} />}
          {igTab === 'stories' && <IgStoriesTab />}
          {igTab === 'reels' && <IgReelsTab />}
          {igTab === 'calendar' && <IgCalendarTab />}
          {igTab === 'comments' && <IgCommentsTab />}
        </>
      )}
    </div>
  )
}
