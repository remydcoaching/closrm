'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import SocialPlatformTabs from '@/components/social/SocialPlatformTabs'
import IgSubTabs from '@/components/social/instagram/IgSubTabs'
import IgNotConnected from '@/components/social/instagram/IgNotConnected'
import IgAcquisitionTab from '@/components/social/instagram/IgAcquisitionTab'
import IgInboxTab from '@/components/social/instagram/IgInboxTab'
import IgStoriesTab from '@/components/social/instagram/IgStoriesTab'
import IgReelsTab from '@/components/social/instagram/IgReelsTab'
import PlanningView from '@/components/social/planning/PlanningView'
import YtNotConnected from '@/components/social/youtube/YtNotConnected'
import YtSubTabs from '@/components/social/youtube/YtSubTabs'
import YtAcquisitionTab from '@/components/social/youtube/YtAcquisitionTab'
import YtInboxTab from '@/components/social/youtube/YtInboxTab'
import YtVideosTab from '@/components/social/youtube/YtVideosTab'
import YtInsightsTab from '@/components/social/youtube/YtInsightsTab'
import type { YtAccount } from '@/types'

function LoadingSkeleton() {
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[1, 2].map(i => (
          <div key={i} style={{ width: 120, height: 36, background: 'var(--bg-elevated)', borderRadius: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: '16px 20px', height: 90 }}>
            <div style={{ width: '60%', height: 12, background: 'var(--bg-elevated)', borderRadius: 4, marginBottom: 10, animation: 'pulse 1.5s ease-in-out infinite' }} />
            <div style={{ width: '80%', height: 24, background: 'var(--bg-elevated)', borderRadius: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

const VALID_PLATFORMS = new Set(['planning', 'instagram', 'youtube'])
const VALID_IG_TABS = new Set(['acquisition', 'inbox', 'stories', 'reels'])
const VALID_YT_TABS = new Set(['acquisition', 'inbox', 'videos', 'insights'])

export default function ReseauxSociauxPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const toast = useToast()

  const initialPlatform = (() => {
    const p = searchParams.get('platform')
    return p && VALID_PLATFORMS.has(p) ? p : 'planning'
  })()
  const initialIgTab = (() => {
    const t = searchParams.get('tab')
    return t && VALID_IG_TABS.has(t) ? t : 'acquisition'
  })()
  const initialYtTab = (() => {
    const t = searchParams.get('tab')
    return t && VALID_YT_TABS.has(t) ? t : 'acquisition'
  })()

  const [platform, setPlatformState] = useState<string>(initialPlatform)
  const [igTab, setIgTabState] = useState<string>(initialIgTab)
  const [ytTab, setYtTabState] = useState<string>(initialYtTab)

  // Sync URL when state changes (replace, no history pollution)
  const updateUrl = useCallback((nextPlatform: string, nextTab?: string) => {
    const params = new URLSearchParams()
    if (nextPlatform !== 'planning') params.set('platform', nextPlatform)
    if (nextTab && nextTab !== 'acquisition') params.set('tab', nextTab)
    const qs = params.toString()
    router.replace(qs ? `/acquisition/reseaux-sociaux?${qs}` : '/acquisition/reseaux-sociaux', { scroll: false })
  }, [router])

  const setPlatform = useCallback((p: string) => {
    setPlatformState(p)
    const tab = p === 'instagram' ? igTab : p === 'youtube' ? ytTab : undefined
    updateUrl(p, tab)
  }, [igTab, ytTab, updateUrl])

  const setIgTab = useCallback((t: string) => {
    setIgTabState(t)
    if (platform === 'instagram') updateUrl('instagram', t)
  }, [platform, updateUrl])

  const setYtTab = useCallback((t: string) => {
    setYtTabState(t)
    if (platform === 'youtube') updateUrl('youtube', t)
  }, [platform, updateUrl])

  const [igAccount, setIgAccount] = useState<Record<string, unknown> | null>(null)
  const [ytAccount, setYtAccount] = useState<YtAccount | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  const fetchAccounts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [igRes, ytRes] = await Promise.all([
        fetch('/api/instagram/account'),
        fetch('/api/youtube/account'),
      ])

      const igJson = igRes.ok ? await igRes.json() : { data: null }
      const ytJson = ytRes.ok ? await ytRes.json() : { data: null }

      if (igJson.data) {
        setIgAccount(igJson.data)
      } else {
        const createRes = await fetch('/api/instagram/account', { method: 'POST' })
        if (createRes.ok) {
          const createJson = await createRes.json()
          setIgAccount(createJson.data ?? null)
        }
      }
      setYtAccount(ytJson.data ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les comptes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAccounts() }, [fetchAccounts])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const endpoint = platform === 'youtube' ? '/api/youtube/sync' : '/api/instagram/sync'
      const res = await fetch(endpoint, { method: 'POST' })
      if (!res.ok) throw new Error(`Erreur ${res.status}`)
      await fetchAccounts()
    } catch {
      toast.error('Erreur lors de la synchronisation')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div style={{ padding: '32px 40px' }}>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } } @keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <SocialPlatformTabs selected={platform} onChange={setPlatform} />
        {((platform === 'instagram' && igAccount) || (platform === 'youtube' && ytAccount)) && (
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{
              padding: '8px 16px', fontSize: 12, fontWeight: 600,
              color: '#fff',
              background: platform === 'youtube' ? '#FF0000' : 'var(--color-primary)',
              border: 'none', borderRadius: 8,
              cursor: syncing ? 'wait' : 'pointer', opacity: syncing ? 0.7 : 1,
              transition: 'all 0.2s ease',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            {syncing && (
              <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
            )}
            {syncing ? 'Synchronisation...' : 'Synchroniser'}
          </button>
        )}
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#ef4444', fontSize: 13, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid rgba(239,68,68,0.2)' }}>
          {error}
          <button onClick={fetchAccounts} style={{ display: 'block', margin: '12px auto 0', padding: '8px 20px', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 8, cursor: 'pointer' }}>Réessayer</button>
        </div>
      ) : platform === 'planning' ? (
        <PlanningView />
      ) : platform === 'instagram' ? (
        !igAccount ? (
          <IgNotConnected />
        ) : (
          <>
            <IgSubTabs selected={igTab} onChange={setIgTab} />
            {igTab === 'acquisition' && (
              <IgAcquisitionTab
                onSeeAllInbox={() => setIgTab('inbox')}
                onOpenPlanning={() => setPlatform('planning')}
              />
            )}
            {igTab === 'inbox' && <IgInboxTab />}
            {igTab === 'stories' && <IgStoriesTab />}
            {igTab === 'reels' && <IgReelsTab />}
          </>
        )
      ) : (
        // platform === 'youtube'
        !ytAccount ? (
          <YtNotConnected />
        ) : (
          <>
            <YtSubTabs selected={ytTab} onChange={setYtTab} />
            {ytTab === 'acquisition' && (
              <YtAcquisitionTab
                account={ytAccount}
                onSync={handleSync}
                syncing={syncing}
                onSeeAllInbox={() => setYtTab('inbox')}
              />
            )}
            {ytTab === 'inbox' && <YtInboxTab onSync={handleSync} syncing={syncing} />}
            {ytTab === 'videos' && <YtVideosTab />}
            {ytTab === 'insights' && <YtInsightsTab />}
          </>
        )
      )}
    </div>
  )
}
