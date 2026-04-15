'use client'

import { Users, TrendingUp, DollarSign, ArrowUp, ArrowDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface Props {
  followers: number
  followersPrev: number
  conversionRate: number
  conversionRatePrev: number
  adSpend: number
  adSpendPrev: number
}

interface MetricCardConfig {
  label: string
  value: string
  icon: LucideIcon
  iconColor: string
  iconBg: string
  change: number
  subtitle: string
}

function formatChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 1000) / 10
}

function formatEuro(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' \u20AC'
}

function formatNumber(n: number): string {
  return n.toLocaleString('fr-FR')
}

const cardBase: React.CSSProperties = {
  background: 'var(--bg-elevated, #141414)',
  border: '1px solid var(--border-primary, #262626)',
  borderRadius: 12,
  padding: '20px 24px',
  position: 'relative',
  overflow: 'hidden',
  transition: 'border-color 0.2s, box-shadow 0.2s',
}

function MetricCard({ label, value, icon: Icon, iconColor, iconBg, change, subtitle }: MetricCardConfig) {
  const isPositive = change >= 0

  return (
    <div
      style={cardBase}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#3b3b3b'
        e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.3)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-primary, #262626)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Icon top-right */}
      <div style={{
        position: 'absolute',
        top: 16,
        right: 16,
        width: 40,
        height: 40,
        borderRadius: 10,
        background: iconBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Icon size={20} color={iconColor} />
      </div>

      {/* Label */}
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase' as const,
        letterSpacing: 0.8,
        color: 'var(--text-muted, #666)',
        marginBottom: 8,
      }}>
        {label}
      </div>

      {/* Value */}
      <div style={{
        fontSize: 24,
        fontWeight: 800,
        color: 'var(--text-primary, #FFFFFF)',
        lineHeight: 1.1,
        marginBottom: 10,
      }}>
        {value}
      </div>

      {/* Change badge + subtitle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          padding: '3px 8px',
          borderRadius: 20,
          fontSize: 11,
          fontWeight: 600,
          background: isPositive ? 'rgba(56, 161, 105, 0.12)' : 'rgba(229, 62, 62, 0.12)',
          color: isPositive ? '#38A169' : '#E53E3E',
        }}>
          {isPositive ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
          {isPositive ? '+' : ''}{change}%
        </span>
        <span style={{
          fontSize: 11,
          color: 'var(--text-muted, #666)',
        }}>
          {subtitle}
        </span>
      </div>
    </div>
  )
}

export default function OverviewMetrics({
  followers,
  followersPrev,
  conversionRate,
  conversionRatePrev,
  adSpend,
  adSpendPrev,
}: Props) {
  const cards: MetricCardConfig[] = [
    {
      label: 'Nouveaux abonnes',
      value: formatNumber(followers),
      icon: Users,
      iconColor: '#3b82f6',
      iconBg: 'rgba(59, 130, 246, 0.12)',
      change: formatChange(followers, followersPrev),
      subtitle: 'vs periode precedente',
    },
    {
      label: 'Taux de conversion',
      value: conversionRate.toFixed(1) + '%',
      icon: TrendingUp,
      iconColor: '#38A169',
      iconBg: 'rgba(56, 161, 105, 0.12)',
      change: formatChange(conversionRate, conversionRatePrev),
      subtitle: 'Visite → Abonne',
    },
    {
      label: 'Budget publicitaire',
      value: formatEuro(adSpend),
      icon: DollarSign,
      iconColor: '#E53E3E',
      iconBg: 'rgba(229, 62, 62, 0.12)',
      change: formatChange(adSpend, adSpendPrev),
      subtitle: 'Investissement total',
    },
  ]

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 16,
    }}>
      {cards.map((card) => (
        <MetricCard key={card.label} {...card} />
      ))}
    </div>
  )
}
