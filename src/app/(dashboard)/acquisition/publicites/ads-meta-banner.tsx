'use client'

interface AdsMetaBannerProps {
  state: 'not_connected' | 'needs_upgrade' | 'error'
  errorMessage?: string
  onRetry?: () => void
}

export default function AdsMetaBanner({ state, errorMessage, onRetry }: AdsMetaBannerProps) {
  if (state === 'not_connected') {
    return (
      <div style={{
        background: 'rgba(24, 119, 242, 0.06)',
        border: '1px dashed rgba(24, 119, 242, 0.3)',
        borderRadius: 12,
        padding: '24px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            Connecte ton compte Meta
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Relie ton compte publicitaire pour voir tes performances Facebook & Instagram Ads en temps réel.
          </div>
        </div>
        <a
          href="/parametres/integrations"
          style={{
            background: '#1877F2',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            padding: '10px 20px',
            borderRadius: 8,
            textDecoration: 'none',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          Connecter Meta →
        </a>
      </div>
    )
  }

  if (state === 'needs_upgrade') {
    return (
      <div style={{
        background: 'rgba(214, 158, 46, 0.06)',
        border: '1px dashed rgba(214, 158, 46, 0.3)',
        borderRadius: 12,
        padding: '24px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            Mets à jour ta connexion Meta
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            De nouvelles permissions sont nécessaires pour accéder aux statistiques publicitaires. Tes leads continuent d&apos;arriver normalement.
          </div>
        </div>
        <a
          href="/api/integrations/meta"
          style={{
            background: '#D69E2E',
            color: '#000',
            fontSize: 13,
            fontWeight: 600,
            padding: '10px 20px',
            borderRadius: 8,
            textDecoration: 'none',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          Mettre à jour →
        </a>
      </div>
    )
  }

  // Error state
  return (
    <div style={{
      background: 'rgba(229, 62, 62, 0.06)',
      border: '1px dashed rgba(229, 62, 62, 0.3)',
      borderRadius: 12,
      padding: '24px 28px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
    }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          Erreur de connexion Meta
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {errorMessage ?? 'Impossible de récupérer les données publicitaires.'}
        </div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            background: '#E53E3E',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            padding: '10px 20px',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Réessayer
        </button>
      )}
    </div>
  )
}
