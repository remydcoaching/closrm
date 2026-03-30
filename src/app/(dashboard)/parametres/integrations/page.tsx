'use client'

import { useEffect, useState, useCallback } from 'react'
import IntegrationCard from '@/components/settings/IntegrationCard'
import ConnectIntegrationModal from '@/components/settings/ConnectIntegrationModal'

interface IntegrationData {
  type: string
  is_active: boolean
  connected_at: string | null
  has_credentials: boolean
}

const DISPLAY_ORDER = ['telegram', 'whatsapp', 'meta', 'google_calendar', 'stripe']
const DISABLED_TYPES = new Set(['stripe'])

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<IntegrationData[]>([])
  const [loading, setLoading] = useState(true)
  const [connectModal, setConnectModal] = useState<{ open: boolean; type: string }>({ open: false, type: '' })

  const fetchIntegrations = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations')
      const json = await res.json()
      if (json.data) {
        // Enrich with has_credentials (GET list doesn't return it, default based on connected_at)
        const enriched: IntegrationData[] = json.data.map((i: IntegrationData & { id?: string | null }) => ({
          type: i.type,
          is_active: i.is_active,
          connected_at: i.connected_at,
          has_credentials: i.connected_at !== null,
        }))
        setIntegrations(enriched)
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchIntegrations()
  }, [fetchIntegrations])

  async function handleConnect(type: string, credentials: Record<string, string>) {
    const res = await fetch('/api/integrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, credentials }),
    })
    if (res.ok) {
      setConnectModal({ open: false, type: '' })
      await fetchIntegrations()
    }
  }

  async function handleDisconnect(type: string) {
    const confirmed = window.confirm(`Voulez-vous vraiment déconnecter cette intégration ?`)
    if (!confirmed) return

    const res = await fetch(`/api/integrations/${type}`, { method: 'DELETE' })
    if (res.ok) {
      await fetchIntegrations()
    }
  }

  async function handleToggle(type: string, active: boolean) {
    const res = await fetch(`/api/integrations/${type}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: active }),
    })
    if (res.ok) {
      await fetchIntegrations()
    }
  }

  // Sort integrations by display order
  const sorted = DISPLAY_ORDER.map(type =>
    integrations.find(i => i.type === type) || {
      type,
      is_active: false,
      connected_at: null,
      has_credentials: false,
    }
  )

  return (
    <div style={{ padding: 32, maxWidth: 900 }}>
      {/* Header */}
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
        Intégrations
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-tertiary)', margin: '0 0 32px 0' }}>
        Connectez vos services pour automatiser vos workflows.
      </p>

      {/* Grid */}
      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Chargement...</div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 16,
        }}>
          {sorted.map(integration => (
            <IntegrationCard
              key={integration.type}
              integration={integration}
              onConnect={type => setConnectModal({ open: true, type })}
              onDisconnect={handleDisconnect}
              onToggle={handleToggle}
              disabled={DISABLED_TYPES.has(integration.type)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <ConnectIntegrationModal
        open={connectModal.open}
        type={connectModal.type}
        onClose={() => setConnectModal({ open: false, type: '' })}
        onConnect={handleConnect}
      />
    </div>
  )
}
