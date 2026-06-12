'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface MetaIntegration {
  is_active: boolean
  connected_at: string | null
  meta_page_id: string | null
  meta_pixel_id?: string | null
  capi_enabled?: boolean | null
}

interface MetaIntegrationCardProps {
  integration: MetaIntegration | null
}

export default function MetaIntegrationCard({ integration }: MetaIntegrationCardProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const isConnected = !!integration?.is_active

  // ── Workspace-level pixel state (only used when connected) ─────────────
  const [pixelDraft, setPixelDraft] = useState<string>(integration?.meta_pixel_id ?? '')
  const [pixelSaving, setPixelSaving] = useState(false)
  const [pixelSavedAt, setPixelSavedAt] = useState<number | null>(null)
  const [pixelError, setPixelError] = useState<string | null>(null)

  // ── CAPI on/off toggle ──────────────────────────────────────────────────
  const [capiEnabled, setCapiEnabled] = useState<boolean>(
    integration?.capi_enabled !== false, // default true (also when null/undefined)
  )
  const [capiSaving, setCapiSaving] = useState(false)

  async function handleDisconnect() {
    if (!confirm('Déconnecter Facebook Meta Ads + Instagram ? Les leads ne seront plus importés automatiquement.')) return
    setLoading(true)
    try {
      const res = await fetch('/api/integrations/meta/disconnect', { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erreur inconnue' }))
        alert(`Erreur: ${err.error || 'Déconnexion échouée'}`)
        return
      }
      router.refresh()
    } catch {
      alert('Erreur réseau lors de la déconnexion')
    } finally {
      setLoading(false)
    }
  }

  async function savePixel() {
    setPixelSaving(true)
    setPixelError(null)
    try {
      const res = await fetch('/api/integrations/meta/pixel', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pixel_id: pixelDraft.trim() || null }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setPixelError(json?.error ?? 'Erreur lors de la sauvegarde.')
        return
      }
      setPixelSavedAt(Date.now())
    } catch {
      setPixelError('Erreur réseau.')
    } finally {
      setPixelSaving(false)
    }
  }

  async function toggleCapi(next: boolean) {
    // Optimistic update for snappy UX, revert on error.
    const prev = capiEnabled
    setCapiEnabled(next)
    setCapiSaving(true)
    try {
      const res = await fetch('/api/integrations/meta/pixel', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capi_enabled: next }),
      })
      if (!res.ok) setCapiEnabled(prev)
    } catch {
      setCapiEnabled(prev)
    } finally {
      setCapiSaving(false)
    }
  }

  const connectedAt = integration?.connected_at
    ? new Date(integration.connected_at).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : null

  const pixelDirty = pixelDraft.trim() !== (integration?.meta_pixel_id ?? '')

  return (
    <div style={{
      background: '#141414',
      border: `1px solid ${isConnected ? 'rgba(24,119,242,0.3)' : '#262626'}`,
      borderRadius: 12,
      padding: '16px 20px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'rgba(24,119,242,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
          }}>
            📊
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Facebook Meta Ads + Instagram</span>
              {isConnected && (
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#00C853',
                  background: 'rgba(0,200,83,0.1)',
                  border: '1px solid rgba(0,200,83,0.25)',
                  borderRadius: 4,
                  padding: '2px 7px',
                }}>
                  CONNECTÉ
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: '#555' }}>
              {isConnected
                ? `Page ID : ${integration?.meta_page_id ?? '—'} · Connecté le ${connectedAt}`
                : 'Import automatique des leads Facebook & Instagram Ads'}
            </div>
          </div>
        </div>

        {isConnected ? (
          <button
            onClick={handleDisconnect}
            disabled={loading}
            style={{
              background: 'transparent',
              border: '1px solid #333',
              color: '#888',
              fontSize: 12,
              fontWeight: 600,
              padding: '7px 16px',
              borderRadius: 8,
              cursor: loading ? 'not-allowed' : 'pointer',
              flexShrink: 0,
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? 'Déconnexion...' : 'Déconnecter'}
          </button>
        ) : (
          <a
            href="/api/integrations/meta"
            style={{
              background: '#1877F2',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              padding: '7px 16px',
              borderRadius: 8,
              textDecoration: 'none',
              flexShrink: 0,
            }}
          >
            Connecter →
          </a>
        )}
      </div>

      {isConnected && (
        <div style={{
          marginTop: 14, paddingTop: 14, borderTop: '1px solid #262626',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {/* ── Toggle CAPI ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 4 }}>
                Remonter les conversions à Meta
              </p>
              <p style={{ fontSize: 11, color: '#888', maxWidth: 540, lineHeight: 1.5 }}>
                Quand un lead est qualifié, prend RDV ou clôt un deal, ClosRM le dit à Meta automatiquement (en plus du pixel browser). Meta apprend à cibler les bons profils → coût par lead qualifié plus bas.
                <br />
                <span style={{ color: '#666' }}>OFF = aucun event statut envoyé. Pixel du navigateur inchangé.</span>
              </p>
            </div>
            <label style={{
              display: 'inline-flex', alignItems: 'center', cursor: capiSaving ? 'not-allowed' : 'pointer',
              flexShrink: 0,
            }}>
              <input
                type="checkbox"
                checked={capiEnabled}
                onChange={(e) => toggleCapi(e.target.checked)}
                disabled={capiSaving}
                style={{ display: 'none' }}
              />
              <span style={{
                width: 40, height: 22, borderRadius: 12,
                background: capiEnabled ? '#1877F2' : '#262626',
                border: `1px solid ${capiEnabled ? '#1877F2' : '#333'}`,
                position: 'relative', transition: 'background 0.15s ease',
                opacity: capiSaving ? 0.5 : 1,
              }}>
                <span style={{
                  position: 'absolute', top: 2, left: capiEnabled ? 20 : 2,
                  width: 16, height: 16, borderRadius: '50%', background: '#fff',
                  transition: 'left 0.15s ease',
                }} />
              </span>
            </label>
          </div>

          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#A0A0A0', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
              Pixel Meta global · pages calendrier directes
            </p>
            <p style={{ fontSize: 11, color: '#666', maxWidth: 540 }}>
              Pour les leads qui prennent un RDV via un lien direct <code style={{ color: '#888' }}>/book/...</code> (sans funnel ClosRM). Sert aussi de fallback pour l&apos;API Conversions quand un lead n&apos;est pas attribué à un funnel.
              Tu peux mettre un autre pixel par funnel dans l&apos;éditeur du funnel.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="ID du Pixel Web (ex: 1159466063670518)"
              value={pixelDraft}
              onChange={(e) => setPixelDraft(e.target.value.replace(/[^\d]/g, ''))}
              disabled={pixelSaving}
              style={{
                background: '#0a0a0a', border: '1px solid #262626', color: '#fff',
                fontSize: 13, padding: '7px 10px', borderRadius: 8, minWidth: 260,
                fontFamily: 'monospace',
              }}
            />
            <button
              onClick={savePixel}
              disabled={pixelSaving || !pixelDirty}
              style={{
                background: pixelSaving ? '#333' : '#1877F2',
                color: '#fff', fontSize: 12, fontWeight: 600,
                padding: '7px 16px', borderRadius: 8, border: 'none',
                cursor: pixelSaving || !pixelDirty ? 'not-allowed' : 'pointer',
                opacity: pixelSaving || !pixelDirty ? 0.6 : 1,
              }}
            >
              {pixelSaving ? 'Sauvegarde…' : 'Enregistrer'}
            </button>
            {integration?.meta_pixel_id && pixelDraft && (
              <button
                onClick={() => { setPixelDraft(''); }}
                disabled={pixelSaving}
                style={{
                  background: 'transparent', border: '1px solid #333', color: '#888',
                  fontSize: 12, padding: '7px 12px', borderRadius: 8, cursor: 'pointer',
                }}
              >
                Effacer
              </button>
            )}
            {pixelSavedAt && Date.now() - pixelSavedAt < 3000 && (
              <span style={{ fontSize: 11, color: '#00C853' }}>✓ Sauvegardé</span>
            )}
            {pixelError && (
              <span style={{ fontSize: 11, color: '#E53E3E' }}>{pixelError}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
