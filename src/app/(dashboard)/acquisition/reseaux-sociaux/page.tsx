'use client'

import { useState, useEffect, useCallback } from 'react'
import SocialPlatformTabs from '@/components/social/SocialPlatformTabs'
import IgSubTabs from '@/components/social/instagram/IgSubTabs'
import IgNotConnected from '@/components/social/instagram/IgNotConnected'
import IgGeneralTab from '@/components/social/instagram/IgGeneralTab'
import IgStoriesTab from '@/components/social/instagram/IgStoriesTab'
import IgReelsTab from '@/components/social/instagram/IgReelsTab'
import IgCalendarTab from '@/components/social/instagram/IgCalendarTab'

export default function ReseauxSociauxPage() {
  const [platform, setPlatform] = useState('instagram')
  const [igTab, setIgTab] = useState('general')
  const [igAccount, setIgAccount] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const fetchAccount = useCallback(async () => {
    try {
      const res = await fetch('/api/instagram/account')
      const json = await res.json()
      setIgAccount(json.data ?? null)
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAccount() }, [fetchAccount])

  const handleSync = async () => {
    setSyncing(true)
    try {
      await fetch('/api/instagram/sync', { method: 'POST' })
    } catch { /* ignore */ }
    setSyncing(false)
  }

  const handleLinkAccount = async () => {
    try {
      await fetch('/api/instagram/account', { method: 'POST' })
      await fetchAccount()
    } catch { /* ignore */ }
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200 }}>
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
                border: 'none', borderRadius: 8, cursor: 'pointer',
                opacity: syncing ? 0.6 : 1,
              }}
            >
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
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)', fontSize: 13 }}>
          Chargement...
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
        </>
      )}
    </div>
  )
}
