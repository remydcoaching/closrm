// Réseaux sociaux — desktop port of src/app/(dashboard)/acquisition/reseaux-sociaux.
// Platforms: Planning / Instagram / YouTube (same as the web), with the same
// Instagram sub-tabs (Acquisition, Inbox, Stories, Reels) + Vue d'ensemble &
// objectifs and Brouillons (web components that exist but are unmounted), and
// the same YouTube sub-tabs (Acquisition, Inbox, Vidéos, Insights).
// Account loading mirrors the web: GET /api/instagram/account (POST to create
// it from the Meta integration when missing), GET /api/youtube/account;
// sync = POST /api/instagram/sync or /api/youtube/sync.
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../lib/api-client'
import { openWeb } from '../../lib/web-link'
import { Tabs } from '../../design-system/Tabs'
import { EmptyState, ErrorState, LoadingState } from '../../design-system/States'
import { NoticeBanner, useNotice } from './ui'
import { errMsg } from './http'
import { PlanningView } from './PlanningView'
import { IgAcquisitionTab, IgInboxTab } from './IgAcquisitionTab'
import { IgStoriesTab } from './IgStoriesTab'
import { IgReelsTab } from './IgReelsTab'
import { IgOverviewTab } from './IgOverviewTab'
import { IgDraftsTab } from './IgDraftsTab'
import { YtAcquisitionTab, YtInboxTab, YtInsightsTab, YtVideosTab } from './YoutubeTabs'
import type { IgAccount, YtAccount } from './types'
import './social.css'

type Platform = 'planning' | 'instagram' | 'youtube'
type IgTab = 'acquisition' | 'inbox' | 'stories' | 'reels' | 'overview' | 'drafts'
type YtTab = 'acquisition' | 'inbox' | 'videos' | 'insights'

const PLATFORMS = new Set<Platform>(['planning', 'instagram', 'youtube'])
const IG_TABS = new Set<IgTab>(['acquisition', 'inbox', 'stories', 'reels', 'overview', 'drafts'])
const YT_TABS = new Set<YtTab>(['acquisition', 'inbox', 'videos', 'insights'])

export function SocialPage() {
  const [params, setParams] = useSearchParams()
  const qp = params.get('platform') as Platform | null
  const qt = params.get('tab')
  const [platform, setPlatformState] = useState<Platform>(qp && PLATFORMS.has(qp) ? qp : 'planning')
  const [igTab, setIgTabState] = useState<IgTab>(qt && IG_TABS.has(qt as IgTab) ? (qt as IgTab) : 'acquisition')
  const [ytTab, setYtTabState] = useState<YtTab>(qt && YT_TABS.has(qt as YtTab) ? (qt as YtTab) : 'acquisition')
  const [igAccount, setIgAccount] = useState<IgAccount | null>(null)
  const [ytAccount, setYtAccount] = useState<YtAccount | null>(null)
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [accountsError, setAccountsError] = useState<string | null>(null)
  const [igCreateError, setIgCreateError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncKey, setSyncKey] = useState(0)
  const [notice, notify, clearNotice] = useNotice()

  const syncUrl = useCallback(
    (p: Platform, tab?: string) => {
      const next = new URLSearchParams()
      if (p !== 'planning') next.set('platform', p)
      if (tab && tab !== 'acquisition' && p !== 'planning') next.set('tab', tab)
      setParams(next, { replace: true })
    },
    [setParams],
  )

  const setPlatform = (p: Platform) => {
    setPlatformState(p)
    syncUrl(p, p === 'instagram' ? igTab : p === 'youtube' ? ytTab : undefined)
  }
  const setIgTab = (t: IgTab) => {
    setIgTabState(t)
    syncUrl('instagram', t)
  }
  const setYtTab = (t: YtTab) => {
    setYtTabState(t)
    syncUrl('youtube', t)
  }

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true)
    setAccountsError(null)
    setIgCreateError(null)
    try {
      const [ig, yt] = await Promise.all([
        api.get<{ data: IgAccount | null }>('/api/instagram/account').catch(() => ({ data: null })),
        api.get<{ data: YtAccount | null }>('/api/youtube/account').catch(() => ({ data: null })),
      ])
      if (ig.data) setIgAccount(ig.data)
      else {
        // Same as the web: try to create the IG account from the Meta integration.
        try {
          const created = await api.post<{ data: IgAccount | null }>('/api/instagram/account', {})
          setIgAccount(created.data ?? null)
        } catch (e) {
          setIgAccount(null)
          setIgCreateError(errMsg(e))
        }
      }
      setYtAccount(yt.data ?? null)
    } catch (e) {
      setAccountsError(errMsg(e))
    } finally {
      setAccountsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAccounts()
  }, [loadAccounts])

  async function sync() {
    setSyncing(true)
    try {
      await api.post(platform === 'youtube' ? '/api/youtube/sync' : '/api/instagram/sync', {})
      notify('Synchronisation terminée')
      await loadAccounts()
      setSyncKey((k) => k + 1)
    } catch (e) {
      notify(`Erreur lors de la synchronisation : ${errMsg(e)}`, 'danger')
    } finally {
      setSyncing(false)
    }
  }

  const canSync = (platform === 'instagram' && igAccount) || (platform === 'youtube' && ytAccount)

  return (
    <div className="soc-page">
      <header className="soc-header">
        <div>
          <h1>Réseaux sociaux</h1>
          <p>
            {platform === 'planning'
              ? 'Calendrier éditorial, production et publication multi-plateformes'
              : platform === 'instagram'
                ? igAccount?.ig_username
                  ? `@${igAccount.ig_username}`
                  : 'Instagram'
                : ytAccount?.channel_title ?? 'YouTube'}
          </p>
        </div>
        <div className="soc-toolbar">
          <Tabs
            items={[
              { key: 'planning', label: 'Planning' },
              { key: 'instagram', label: 'Instagram' },
              { key: 'youtube', label: 'YouTube' },
            ]}
            active={platform}
            onChange={setPlatform}
          />
          {canSync && (
            <button type="button" className="ds-pill-button ds-pill-button--dark" disabled={syncing} onClick={() => void sync()}>
              {syncing ? 'Synchronisation…' : 'Synchroniser'}
            </button>
          )}
        </div>
      </header>

      <NoticeBanner notice={notice} onClose={clearNotice} />

      {platform === 'planning' ? (
        <PlanningView notify={notify} />
      ) : accountsLoading ? (
        <LoadingState />
      ) : accountsError ? (
        <ErrorState message={accountsError} onRetry={() => void loadAccounts()} />
      ) : platform === 'instagram' ? (
        !igAccount ? (
          <section className="soc-card" style={{ alignItems: 'center', textAlign: 'center' }}>
            <EmptyState
              title="Connectez votre compte Instagram"
              description="Pour accéder aux stories, reels, calendrier de publication et messages, connectez d'abord votre compte Instagram via l'intégration Meta."
            />
            {igCreateError && <p className="soc-error">{igCreateError}</p>}
            <button type="button" className="ds-pill-button ds-pill-button--dark" onClick={() => void openWeb('/parametres/integrations')}>
              Aller aux intégrations ↗
            </button>
          </section>
        ) : (
          <div className="soc-stack" key={`ig-${syncKey}`}>
            <Tabs
              items={[
                { key: 'acquisition', label: 'Acquisition' },
                { key: 'inbox', label: 'Inbox' },
                { key: 'stories', label: 'Stories' },
                { key: 'reels', label: 'Reels & piliers' },
                { key: 'overview', label: "Vue d'ensemble & objectifs" },
                { key: 'drafts', label: 'Brouillons' },
              ]}
              active={igTab}
              onChange={setIgTab}
            />
            {igTab === 'acquisition' && <IgAcquisitionTab notify={notify} onSeeInbox={() => setIgTab('inbox')} />}
            {igTab === 'inbox' && <IgInboxTab notify={notify} />}
            {igTab === 'stories' && <IgStoriesTab notify={notify} />}
            {igTab === 'reels' && <IgReelsTab notify={notify} />}
            {igTab === 'overview' && <IgOverviewTab notify={notify} />}
            {igTab === 'drafts' && <IgDraftsTab notify={notify} />}
          </div>
        )
      ) : !ytAccount ? (
        <section className="soc-card" style={{ alignItems: 'center', textAlign: 'center' }}>
          <EmptyState
            title="Connecter ton compte YouTube"
            description="Synchronise tes vidéos, analytics et commentaires. Publie ou programme des vidéos longues + Shorts depuis ClosRM."
          />
          <button type="button" className="ds-pill-button ds-pill-button--dark" onClick={() => void openWeb('/parametres/integrations')}>
            Connecter YouTube ↗
          </button>
        </section>
      ) : (
        <div className="soc-stack" key={`yt-${syncKey}`}>
          <Tabs
            items={[
              { key: 'acquisition', label: 'Acquisition' },
              { key: 'inbox', label: 'Inbox' },
              { key: 'videos', label: 'Vidéos' },
              { key: 'insights', label: 'Insights' },
            ]}
            active={ytTab}
            onChange={setYtTab}
          />
          {ytTab === 'acquisition' && <YtAcquisitionTab account={ytAccount} notify={notify} onSeeInbox={() => setYtTab('inbox')} />}
          {ytTab === 'inbox' && <YtInboxTab notify={notify} />}
          {ytTab === 'videos' && <YtVideosTab />}
          {ytTab === 'insights' && <YtInsightsTab />}
        </div>
      )}
    </div>
  )
}
