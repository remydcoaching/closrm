import type { MetaStats } from '@/lib/stats/queries'

interface MetaSectionProps {
  meta: MetaStats
}

export default function MetaSection({ meta }: MetaSectionProps) {
  if (!meta.isConnected) {
    return (
      <div style={{
        background: 'rgba(24, 119, 242, 0.04)',
        border: '1px dashed rgba(24, 119, 242, 0.2)',
        borderRadius: 12,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>📊</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#aaa', marginBottom: 3 }}>
              Performance Meta Ads
            </div>
            <div style={{ fontSize: 12, color: '#555' }}>
              Connecte ton compte Meta pour voir le coût par lead et le ROAS estimé.
            </div>
          </div>
        </div>
        <a
          href="/parametres/integrations"
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
          Connecter Meta →
        </a>
      </div>
    )
  }

  // Meta connecté — V1 : données temps réel non disponibles
  const cards = [
    { label: 'Coût / lead', value: meta.costPerLead !== null ? `${meta.costPerLead.toFixed(2)}€` : '—' },
    { label: 'ROAS estimé',  value: meta.roas !== null ? `${meta.roas.toFixed(1)}x` : '—' },
    { label: 'Budget dépensé', value: meta.budgetSpent !== null ? `${meta.budgetSpent.toFixed(0)}€` : '—' },
  ]

  return (
    <div style={{
      background: 'rgba(24, 119, 242, 0.04)',
      border: '1px solid rgba(24, 119, 242, 0.15)',
      borderRadius: 12,
      padding: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 16 }}>📊</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#aaa' }}>Performance Meta Ads</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {cards.map(({ label, value }) => (
          <div key={label} style={{
            background: '#0f0f11',
            border: '1px solid rgba(24, 119, 242, 0.2)',
            borderRadius: 8,
            padding: 14,
          }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#1877F2' }}>{value}</div>
            <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
