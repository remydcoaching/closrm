'use client'

import { Users, Eye, MessageCircle, ArrowUp, ArrowDown } from 'lucide-react'

interface Props {
  adSpend: number
  followers: number
  followersPrev: number
  appointments: number
  appointmentsPrev: number
  adSpendPrev: number
  breakdown?: { campaign_type: string; spend: number; clicks: number; impressions: number }[]
  profileVisits: number
  conversations: number
}

function formatEuro(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function formatNumber(n: number): string {
  return n.toLocaleString('fr-FR')
}

function formatChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 1000) / 10
}

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-elevated, #141414)',
  border: '1px solid var(--border-primary, #262626)',
  borderRadius: 14,
  padding: 24,
}

// ─── Cost metric row ──────────────────────────────────────────────────────────

interface CostRowProps {
  label: string
  value: string
  change: number
  previous: string
  target: string
  isAlt?: boolean
}

function CostRow({ label, value, change, previous, target, isAlt }: CostRowProps) {
  const isPositive = change <= 0 // For costs, negative change is good
  return (
    <div style={{
      padding: '16px 20px',
      background: isAlt ? 'rgba(255,255,255,0.02)' : 'transparent',
      borderRadius: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--text-secondary, #A0A0A0)',
          marginBottom: 4,
        }}>
          {label}
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 10,
        }}>
          <span style={{
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--text-primary, #FFFFFF)',
          }}>
            {value}
          </span>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            padding: '2px 8px',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 600,
            background: isPositive ? 'rgba(56, 161, 105, 0.12)' : 'rgba(229, 62, 62, 0.12)',
            color: isPositive ? '#38A169' : '#E53E3E',
          }}>
            {change <= 0 ? <ArrowDown size={11} /> : <ArrowUp size={11} />}
            {change <= 0 ? '' : '+'}{change}%
          </span>
        </div>
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        textAlign: 'right',
      }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted, #666)' }}>
          Precedent : {previous}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted, #666)' }}>
          Objectif : {target}
        </span>
      </div>
    </div>
  )
}

// ─── Attribution bar ──────────────────────────────────────────────────────────

interface AttributionBarProps {
  label: string
  value: number
  percentage: number
  cost: number
  cpf: number
}

function AttributionBar({ label, value, percentage, cost, cpf }: AttributionBarProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
      }}>
        <span style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--text-secondary, #A0A0A0)',
        }}>
          {label}
        </span>
        <span style={{
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--text-primary, #FFFFFF)',
        }}>
          {formatNumber(value)} ({percentage.toFixed(0)}%)
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        width: '100%',
        height: 8,
        background: 'rgba(59, 130, 246, 0.1)',
        borderRadius: 4,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${Math.min(percentage, 100)}%`,
          height: '100%',
          background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
          borderRadius: 4,
          transition: 'width 0.6s ease',
        }} />
      </div>

      <div style={{
        fontSize: 10,
        color: 'var(--text-muted, #666)',
        marginTop: 4,
      }}>
        Cost: {formatEuro(cost)} | CPF: {formatEuro(cpf)}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CostAnalysis({
  adSpend,
  followers,
  followersPrev,
  appointments,
  appointmentsPrev,
  adSpendPrev,
  breakdown,
  profileVisits,
  conversations,
}: Props) {
  const cpf = followers > 0 ? adSpend / followers : 0
  const cpfPrev = followersPrev > 0 ? adSpendPrev / followersPrev : 0
  const cpa = appointments > 0 ? adSpend / appointments : 0
  const cpaPrev = appointmentsPrev > 0 ? adSpendPrev / appointmentsPrev : 0

  // Group breakdown by campaign_type
  const grouped = (breakdown ?? []).reduce<Record<string, { spend: number; clicks: number; impressions: number }>>((acc, row) => {
    const key = row.campaign_type || 'Other'
    if (!acc[key]) acc[key] = { spend: 0, clicks: 0, impressions: 0 }
    acc[key].spend += row.spend
    acc[key].clicks += row.clicks
    acc[key].impressions += row.impressions
    return acc
  }, {})

  const totalClicks = Object.values(grouped).reduce((s, g) => s + g.clicks, 0)

  // Friendly labels for campaign types
  const typeLabels: Record<string, string> = {
    follow_ads: 'Instagram Follow Ads',
    leadform: 'Lead Form Ads',
    story: 'Instagram Story Ads',
    reels: 'Reels Ads',
  }

  return (
    <div style={cardStyle}>
      {/* Section 1: Cost Analysis */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--text-primary, #FFFFFF)',
          marginBottom: 4,
        }}>
          Analyse des couts
        </div>
        <div style={{
          fontSize: 11,
          color: 'var(--text-muted, #666)',
          marginBottom: 16,
        }}>
          Metriques de cout par acquisition
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          background: 'rgba(255,255,255,0.01)',
          borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.04)',
          overflow: 'hidden',
        }}>
          <CostRow
            label="Cout par abonne"
            value={formatEuro(cpf)}
            change={formatChange(cpf, cpfPrev)}
            previous={formatEuro(cpfPrev)}
            target="4,00 €"
          />
          <CostRow
            label="Cout par RDV"
            value={formatEuro(cpa)}
            change={formatChange(cpa, cpaPrev)}
            previous={formatEuro(cpaPrev)}
            target="120,00 €"
            isAlt
          />
        </div>
      </div>

      {/* Divider */}
      <div style={{
        height: 1,
        background: 'var(--border-primary, #262626)',
        margin: '0 0 24px',
      }} />

      {/* Section 2: Ad Source Attribution */}
      <div>
        <div style={{
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--text-primary, #FFFFFF)',
          marginBottom: 4,
        }}>
          Attribution par source
        </div>
        <div style={{
          fontSize: 11,
          color: 'var(--text-muted, #666)',
          marginBottom: 20,
        }}>
          Repartition par type de campagne
        </div>

        {Object.entries(grouped).length > 0 ? (
          <div>
            {Object.entries(grouped).map(([type, data]) => {
              const pct = totalClicks > 0 ? (data.clicks / totalClicks) * 100 : 0
              const typeCpf = data.clicks > 0 ? data.spend / data.clicks : 0
              return (
                <AttributionBar
                  key={type}
                  label={typeLabels[type] ?? type}
                  value={data.clicks}
                  percentage={pct}
                  cost={data.spend}
                  cpf={typeCpf}
                />
              )
            })}
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '20px 0',
            fontSize: 12,
            color: 'var(--text-muted, #666)',
          }}>
            Aucune donnee de campagne disponible
          </div>
        )}

        {/* Bottom stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          marginTop: 20,
          paddingTop: 16,
          borderTop: '1px solid var(--border-primary, #262626)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'rgba(59, 130, 246, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Users size={16} color="#3b82f6" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #FFFFFF)' }}>
                {formatNumber(followers)}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted, #666)' }}>
                Total abonnes
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'rgba(56, 161, 105, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Eye size={16} color="#38A169" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #FFFFFF)' }}>
                {formatNumber(profileVisits)}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted, #666)' }}>
                Visites du profil
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'rgba(214, 158, 46, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <MessageCircle size={16} color="#D69E2E" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #FFFFFF)' }}>
                {formatNumber(conversations)}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted, #666)' }}>
                Conversations
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
