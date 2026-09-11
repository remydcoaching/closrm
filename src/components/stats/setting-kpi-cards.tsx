import { Phone, Users, MessageCircle, Reply, Percent } from 'lucide-react'
import type { SettingKpis } from '@/lib/stats/setting-kpis'

interface SettingKpiCardsProps {
  kpis: SettingKpis
}

const CARDS = [
  {
    key: 'callsBookes' as const,
    label: 'Calls bookés',
    icon: Phone,
    color: '#f59e0b',
    format: (v: number | null) => String(v ?? 0),
  },
  {
    key: 'nouveauxLeads' as const,
    label: 'Nouveaux leads',
    icon: Users,
    color: '#3b82f6',
    format: (v: number | null) => String(v ?? 0),
  },
  {
    key: 'totalConvIg' as const,
    label: 'Total conv. IG',
    icon: MessageCircle,
    color: 'var(--color-primary)',
    format: (v: number | null) => String(v ?? 0),
  },
  {
    key: 'totalRepIg' as const,
    label: 'Total rép. IG',
    icon: Reply,
    color: '#a855f7',
    format: (v: number | null) => String(v ?? 0),
  },
  {
    key: 'tauxReponse' as const,
    label: 'Taux de réponse',
    icon: Percent,
    color: '#a855f7',
    format: (v: number | null) => (v !== null ? `${v}%` : '—'),
  },
]

export default function SettingKpiCards({ kpis }: SettingKpiCardsProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 14 }}>
      {CARDS.map(({ key, label, icon: Icon, color, format }) => (
        <div
          key={key}
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-primary)',
            borderRadius: 12,
            padding: 18,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: color + '18',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}
          >
            <Icon size={15} color={color} />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)' }}>
            {format(kpis[key])}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{label}</div>
        </div>
      ))}
    </div>
  )
}
