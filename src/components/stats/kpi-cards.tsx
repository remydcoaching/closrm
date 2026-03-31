import { Users, Phone, TrendingUp, Target, BarChart2 } from 'lucide-react'
import type { StatsKpis } from '@/lib/stats/queries'

interface KpiCardsProps {
  kpis: StatsKpis
}

const CARDS = [
  {
    key: 'totalLeads' as const,
    label: 'Leads totaux',
    icon: Users,
    color: '#3b82f6',
    format: (v: number | null) => String(v ?? 0),
  },
  {
    key: 'bookedCalls' as const,
    label: 'Calls bookés',
    icon: Phone,
    color: '#f59e0b',
    format: (v: number | null) => String(v ?? 0),
  },
  {
    key: 'bookingRate' as const,
    label: 'Taux de booking',
    icon: BarChart2,
    color: '#3b82f6',
    format: (v: number | null) => v !== null ? `${v}%` : '—',
  },
  {
    key: 'closedDeals' as const,
    label: 'Deals closés',
    icon: Target,
    color: 'var(--color-primary)',
    format: (v: number | null) => String(v ?? 0),
  },
  {
    key: 'winRate' as const,
    label: 'Win rate',
    icon: TrendingUp,
    color: '#a855f7',
    format: (v: number | null) => v !== null ? `${v}%` : '—',
  },
]

const VALUE_COLORS: Record<string, string> = {
  closedDeals: 'var(--color-primary)',
  winRate: '#a855f7',
  bookingRate: '#3b82f6',
}

export default function KpiCards({ kpis }: KpiCardsProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
      gap: 10,
      marginBottom: 14,
    }}>
      {CARDS.map(({ key, label, icon: Icon, color, format }) => (
        <div key={key} style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-primary)',
          borderRadius: 12,
          padding: 18,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: color + '18',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 12,
          }}>
            <Icon size={15} color={color} />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: VALUE_COLORS[key] ?? 'var(--text-primary)' }}>
            {format(kpis[key] as number | null)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{label}</div>
        </div>
      ))}
    </div>
  )
}
