'use client'

import { useState, useEffect, useCallback } from 'react'
import { Mail, Send, FileText, Settings, AlertCircle } from 'lucide-react'
import BroadcastsClient from './broadcasts/broadcasts-client'
import SequencesClient from './sequences/sequences-client'
import TemplatesClient from './templates/templates-client'
import DomainSetup from '@/components/emails/DomainSetup'

type Tab = 'campagnes' | 'sequences' | 'templates' | 'parametres'

interface TabDef {
  key: Tab
  label: string
  icon: React.ReactNode
}

const TABS: TabDef[] = [
  { key: 'campagnes', label: 'Campagnes', icon: <Send size={14} /> },
  { key: 'sequences', label: 'Séquences', icon: <Mail size={14} /> },
  { key: 'templates', label: 'Templates', icon: <FileText size={14} /> },
  { key: 'parametres', label: 'Paramètres', icon: <Settings size={14} /> },
]

interface EmailStats {
  total: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  rates: { open: number; click: number; bounce: number }
}

interface Counts {
  broadcasts: number
  sequences: number
  templates: number
}

export default function EmailsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('campagnes')
  const [counts, setCounts] = useState<Counts>({ broadcasts: 0, sequences: 0, templates: 0 })
  const [stats, setStats] = useState<EmailStats | null>(null)
  const [domainVerified, setDomainVerified] = useState<boolean | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)

  const fetchCounts = useCallback(async () => {
    try {
      const [bcRes, seqRes, tplRes] = await Promise.all([
        fetch('/api/emails/broadcasts'),
        fetch('/api/emails/sequences'),
        fetch('/api/emails/templates'),
      ])
      const [bcData, seqData, tplData] = await Promise.all([
        bcRes.ok ? bcRes.json() : [],
        seqRes.ok ? seqRes.json() : [],
        tplRes.ok ? tplRes.json() : [],
      ])
      setCounts({
        broadcasts: Array.isArray(bcData) ? bcData.length : 0,
        sequences: Array.isArray(seqData) ? seqData.length : 0,
        templates: Array.isArray(tplData) ? tplData.length : 0,
      })
    } catch {
      // silently fail
    }
  }, [])

  const fetchDomainStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/emails/domains')
      if (res.ok) {
        const data = await res.json()
        const domains = Array.isArray(data) ? data : []
        setDomainVerified(domains.some((d: { status: string }) => d.status === 'verified'))
      } else {
        setDomainVerified(false)
      }
    } catch {
      setDomainVerified(false)
    }
  }, [])

  const fetchStats = useCallback(async () => {
    setLoadingStats(true)
    try {
      const res = await fetch('/api/emails/stats?days=30')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch {
      // silently fail
    }
    setLoadingStats(false)
  }, [])

  useEffect(() => {
    fetchCounts()
    fetchDomainStatus()
  }, [fetchCounts, fetchDomainStatus])

  useEffect(() => {
    if (activeTab === 'parametres') {
      fetchStats()
    }
  }, [activeTab, fetchStats])

  const countForTab = (tab: Tab): number | null => {
    if (tab === 'campagnes') return counts.broadcasts
    if (tab === 'sequences') return counts.sequences
    if (tab === 'templates') return counts.templates
    return null
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
          Emails
        </h1>
        <p style={{ fontSize: 13, color: '#666', margin: 0 }}>
          Campagnes, séquences automatisées et templates email
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: '1px solid #262626' }}>
        {TABS.map((tab) => {
          const active = activeTab === tab.key
          const count = countForTab(tab.key)
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                border: 'none',
                borderBottom: active ? '2px solid #E53E3E' : '2px solid transparent',
                background: active ? 'rgba(229,62,62,0.06)' : 'transparent',
                color: active ? '#fff' : '#666',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                transition: 'all 0.15s',
                marginBottom: -1,
              }}
            >
              {tab.icon}
              {tab.label}
              {count !== null && count > 0 && (
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '1px 7px',
                  borderRadius: 99,
                  background: active ? 'rgba(229,62,62,0.15)' : '#262626',
                  color: active ? '#E53E3E' : '#888',
                  marginLeft: 2,
                }}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Domain warning banner on Campagnes tab */}
      {activeTab === 'campagnes' && domainVerified === false && (
        <DomainBanner onGoToSettings={() => setActiveTab('parametres')} />
      )}

      {/* Tab content */}
      {activeTab === 'campagnes' && <CampagnesTab onCountChange={(n) => setCounts(c => ({ ...c, broadcasts: n }))} />}
      {activeTab === 'sequences' && <SequencesTab onCountChange={(n) => setCounts(c => ({ ...c, sequences: n }))} />}
      {activeTab === 'templates' && <TemplatesTab onCountChange={(n) => setCounts(c => ({ ...c, templates: n }))} />}
      {activeTab === 'parametres' && <ParametresTab stats={stats} loadingStats={loadingStats} />}
    </div>
  )
}

/* ─── Domain Warning Banner ─────────────────────────────────────────────── */

function DomainBanner({ onGoToSettings }: { onGoToSettings: () => void }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 18px',
      marginBottom: 24,
      background: 'rgba(59,130,246,0.08)',
      border: '1px solid rgba(59,130,246,0.2)',
      borderRadius: 10,
    }}>
      <AlertCircle size={16} color="#3B82F6" style={{ flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: '#93C5FD', flex: 1 }}>
        Configurez votre domaine email pour envoyer des campagnes
      </span>
      <button
        onClick={onGoToSettings}
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: '#3B82F6',
          background: 'rgba(59,130,246,0.12)',
          border: '1px solid rgba(59,130,246,0.25)',
          borderRadius: 6,
          padding: '5px 14px',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Aller aux paramètres
      </button>
    </div>
  )
}

/* ─── Campagnes Tab ──────────────────────────────────────────────────────── */

function CampagnesTab({ onCountChange }: { onCountChange: (n: number) => void }) {
  const [broadcasts, setBroadcasts] = useState<Parameters<typeof BroadcastsClient>[0]['initialBroadcasts']>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/emails/broadcasts')
        if (res.ok) {
          const data = await res.json()
          const arr = Array.isArray(data) ? data : []
          setBroadcasts(arr)
          onCountChange(arr.length)
        }
      } catch {
        // silently fail
      }
      setLoading(false)
    }
    load()
  }, [onCountChange])

  if (loading) {
    return <LoadingPlaceholder />
  }

  return <BroadcastsClient initialBroadcasts={broadcasts} />
}

/* ─── Sequences Tab ──────────────────────────────────────────────────────── */

function SequencesTab({ onCountChange }: { onCountChange: (n: number) => void }) {
  const [sequences, setSequences] = useState<Parameters<typeof SequencesClient>[0]['initialSequences']>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/emails/sequences')
        if (res.ok) {
          const data = await res.json()
          const arr = Array.isArray(data) ? data : []
          setSequences(arr)
          onCountChange(arr.length)
        }
      } catch {
        // silently fail
      }
      setLoading(false)
    }
    load()
  }, [onCountChange])

  if (loading) {
    return <LoadingPlaceholder />
  }

  return <SequencesClient initialSequences={sequences} />
}

/* ─── Templates Tab ──────────────────────────────────────────────────────── */

function TemplatesTab({ onCountChange }: { onCountChange: (n: number) => void }) {
  const [templates, setTemplates] = useState<Parameters<typeof TemplatesClient>[0]['initialTemplates']>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/emails/templates')
        if (res.ok) {
          const data = await res.json()
          const arr = Array.isArray(data) ? data : []
          setTemplates(arr)
          onCountChange(arr.length)
        }
      } catch {
        // silently fail
      }
      setLoading(false)
    }
    load()
  }, [onCountChange])

  if (loading) {
    return <LoadingPlaceholder />
  }

  return <TemplatesClient initialTemplates={templates} />
}

/* ─── Parametres Tab ─────────────────────────────────────────────────────── */

function ParametresTab({ stats, loadingStats }: { stats: EmailStats | null; loadingStats: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* Section Domaine */}
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
          Domaine d&apos;envoi
        </h2>
        <p style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>
          Configure ton domaine pour envoyer des emails depuis ta propre adresse
        </p>
        <DomainSetup />
      </div>

      {/* Section Stats */}
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
          Statistiques
        </h2>
        <p style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>
          Performances des 30 derniers jours
        </p>

        {loadingStats ? (
          <LoadingPlaceholder />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <StatsCard
              label="Emails envoyés"
              value={stats ? String(stats.total) : '0'}
              color="#fff"
            />
            <StatsCard
              label="Taux d'ouverture"
              value={stats ? `${stats.rates.open}%` : '0%'}
              color="#00C853"
            />
            <StatsCard
              label="Taux de clic"
              value={stats ? `${stats.rates.click}%` : '0%'}
              color="#3B82F6"
            />
            <StatsCard
              label="Bounces"
              value={stats ? `${stats.rates.bounce}%` : '0%'}
              color={stats && stats.rates.bounce > 5 ? '#E53E3E' : '#D69E2E'}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function StatsCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: '#141414',
      border: '1px solid #262626',
      borderRadius: 12,
      padding: '20px 24px',
    }}>
      <div style={{ fontSize: 11, color: '#555', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>
        {value}
      </div>
    </div>
  )
}

function LoadingPlaceholder() {
  return (
    <div style={{
      textAlign: 'center',
      padding: 48,
      color: '#555',
      fontSize: 13,
      background: '#141414',
      borderRadius: 12,
      border: '1px solid #262626',
    }}>
      Chargement...
    </div>
  )
}
