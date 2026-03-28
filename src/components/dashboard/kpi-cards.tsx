import { Users, Phone, Target, TrendingUp } from 'lucide-react'
import type { DashboardKpis } from '@/lib/dashboard/queries'

interface KpiCardsProps {
  kpis: DashboardKpis
}

const CARDS = [
  {
    key: 'newLeads' as const,
    label: 'Nouveaux leads',
    icon: Users,
    color: '#3b82f6',
    format: (v: number | null) => v ?? 0,
  },
  {
    key: 'plannedCalls' as const,
    label: 'Appels planifiés',
    icon: Phone,
    color: '#f59e0b',
    format: (v: number | null) => v ?? 0,
  },
  {
    key: 'closedDeals' as const,
    label: 'Deals closés',
    icon: Target,
    color: '#00C853',
    format: (v: number | null) => v ?? 0,
  },
  {
    key: 'closingRate' as const,
    label: 'Taux de closing',
    icon: TrendingUp,
    color: '#a855f7',
    format: (v: number | null) => v !== null ? `${v}%` : '—',
  },
]

export default function KpiCards({ kpis }: KpiCardsProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
      gap: 12,
      marginBottom: 14,
    }}>
      {CARDS.map(({ key, label, icon: Icon, color, format }) => (
        <div key={key} style={{
          background: '#0f0f11',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 14,
          padding: 20,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: color + '18',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 14,
          }}>
            <Icon size={16} color={color} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#fff' }}>
            {format(kpis[key] as number | null)}
          </div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{label}</div>
        </div>
      ))}
    </div>
  )
}
