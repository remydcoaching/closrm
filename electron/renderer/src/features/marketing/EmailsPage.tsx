// Acquisition > Emails — mirrors src/app/(dashboard)/acquisition/emails/page.tsx:
// same tabs (Campagnes / Séquences / Templates / Paramètres) with counts, the
// "configure your domain" banner, plus a dedicated Statistiques tab (the web
// shows the same /api/emails/stats figures inside Paramètres).
// Tab kept in the URL (?tab=) like the web.
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../lib/api-client'
import { Tabs } from '../../design-system/Tabs'
import { BroadcastsTab } from './emails/BroadcastsTab'
import { SequencesTab } from './emails/SequencesTab'
import { TemplatesTab } from './emails/TemplatesTab'
import { EmailStatsTab } from './emails/EmailStatsTab'
import { DomainSettings } from './emails/DomainSettings'
import type { EmailBroadcast, EmailDomain, EmailTemplate, SequenceWorkflow } from './types'
import './marketing.css'
import '../leads/lead-create-modal.css'

type Tab = 'campagnes' | 'sequences' | 'templates' | 'stats' | 'parametres'
const TAB_KEYS: Tab[] = ['campagnes', 'sequences', 'templates', 'stats', 'parametres']

function isTab(v: string | null): v is Tab {
  return v !== null && (TAB_KEYS as string[]).includes(v)
}

export function EmailsPage() {
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('tab')
  const tab: Tab = isTab(tabParam) ? tabParam : 'campagnes'
  const [counts, setCounts] = useState<{ campagnes?: number; sequences?: number; templates?: number }>({})
  const [domains, setDomains] = useState<EmailDomain[]>([])
  const [domainVerified, setDomainVerified] = useState<boolean | null>(null)

  const changeTab = (t: Tab) => {
    const next = new URLSearchParams(params)
    next.set('tab', t)
    setParams(next, { replace: true })
  }

  const fetchDomains = useCallback(async () => {
    try {
      const data = await api.get<EmailDomain[] | { data: EmailDomain[] }>('/api/emails/domains')
      const list = Array.isArray(data) ? data : (data.data ?? [])
      setDomains(list)
      setDomainVerified(list.some((d) => d.status === 'verified'))
    } catch {
      setDomainVerified(false)
    }
  }, [])

  useEffect(() => {
    fetchDomains()
    Promise.all([
      api.get<EmailBroadcast[]>('/api/emails/broadcasts').catch(() => []),
      api.get<SequenceWorkflow[]>('/api/emails/sequences').catch(() => []),
      api.get<EmailTemplate[]>('/api/emails/templates').catch(() => []),
    ]).then(([b, s, t]) =>
      setCounts({
        campagnes: Array.isArray(b) ? b.length : 0,
        sequences: Array.isArray(s) ? s.length : 0,
        templates: Array.isArray(t) ? t.length : 0,
      }),
    )
  }, [fetchDomains])

  const label = (base: string, n?: number) => (n ? `${base} · ${n}` : base)
  const setCount = useCallback((key: 'campagnes' | 'sequences' | 'templates') => (n: number) => setCounts((c) => ({ ...c, [key]: n })), [])

  return (
    <div className="mk-page">
      <div className="mk-header">
        <div>
          <h1>Emails</h1>
          <p>Campagnes, séquences automatisées et templates email</p>
        </div>
      </div>

      <Tabs
        items={[
          { key: 'campagnes' as Tab, label: label('Campagnes', counts.campagnes) },
          { key: 'sequences' as Tab, label: label('Séquences', counts.sequences) },
          { key: 'templates' as Tab, label: label('Templates', counts.templates) },
          { key: 'stats' as Tab, label: 'Statistiques' },
          { key: 'parametres' as Tab, label: 'Paramètres' },
        ]}
        active={tab}
        onChange={changeTab}
      />

      {tab === 'campagnes' && domainVerified === false && (
        <div className="mk-banner">
          <span>Configurez votre domaine email pour envoyer des campagnes</span>
          <button className="mk-action" onClick={() => changeTab('parametres')}>
            Aller aux paramètres
          </button>
        </div>
      )}

      {tab === 'campagnes' && <BroadcastsTab onCount={setCount('campagnes')} />}
      {tab === 'sequences' && <SequencesTab onCount={setCount('sequences')} />}
      {tab === 'templates' && <TemplatesTab onCount={setCount('templates')} />}
      {tab === 'stats' && <EmailStatsTab />}
      {tab === 'parametres' && <DomainSettings existing={domains[0] ?? null} onChange={fetchDomains} />}
    </div>
  )
}
