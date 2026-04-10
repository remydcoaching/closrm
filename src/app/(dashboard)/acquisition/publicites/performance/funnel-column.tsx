'use client'

import { ChevronDown } from 'lucide-react'
import type { FunnelData } from './insights-engine'

interface Props {
  funnel: FunnelData
  adSpend: number
}

interface FunnelStep {
  label: string
  value: number | null
  conversionTo?: number | null
  isLast?: boolean
  isCash?: boolean
}

function formatNumber(n: number): string {
  return n.toLocaleString('fr-FR')
}

function formatEuro(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' \u20AC'
}

function computeRate(from: number, to: number): string {
  if (from === 0) return '0%'
  return ((to / from) * 100).toFixed(2) + '% conversion'
}

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-elevated, #141414)',
  border: '1px solid var(--border-primary, #262626)',
  borderRadius: 14,
  padding: 24,
}

export default function FunnelColumn({ funnel, adSpend }: Props) {
  const steps: FunnelStep[] = [
    { label: 'Visites du profil', value: funnel.profile_visits, conversionTo: funnel.followers },
    { label: 'Abonnes', value: funnel.followers, conversionTo: funnel.qualified_followers },
    { label: 'Abonnes qualifies', value: funnel.qualified_followers, conversionTo: funnel.conversations },
    { label: 'Conversations', value: funnel.conversations, conversionTo: funnel.appointments },
    { label: 'RDV pris', value: funnel.appointments, conversionTo: funnel.show_ups },
    { label: 'Presences', value: funnel.show_ups, conversionTo: funnel.cash_collected },
    { label: 'CA genere', value: funnel.cash_collected, isLast: true, isCash: true },
  ]

  const costPerFollower = funnel.followers > 0
    ? (adSpend / funnel.followers).toFixed(2)
    : null

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
      }}>
        <div>
          <div style={{
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--text-primary, #FFFFFF)',
          }}>
            Funnel de conversion
          </div>
          <div style={{
            fontSize: 11,
            color: 'var(--text-muted, #666)',
            marginTop: 2,
          }}>
            De la visite au cash
          </div>
        </div>
        {costPerFollower && (
          <div style={{
            fontSize: 11,
            color: 'var(--text-muted, #666)',
            background: 'rgba(59, 130, 246, 0.08)',
            padding: '4px 10px',
            borderRadius: 8,
          }}>
            CPF: {costPerFollower} \u20AC
          </div>
        )}
      </div>

      {/* Funnel steps */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0,
      }}>
        {steps.map((step, i) => (
          <div key={step.label} style={{ width: '100%' }}>
            {/* Step */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '12px 0',
            }}>
              {/* Value */}
              <div style={{
                fontSize: 28,
                fontWeight: 800,
                color: step.isCash
                  ? (step.value !== null ? '#38A169' : 'var(--text-muted, #666)')
                  : '#3b82f6',
                lineHeight: 1.1,
              }}>
                {step.value === null
                  ? '\u2014'
                  : step.isCash
                    ? formatEuro(step.value)
                    : formatNumber(step.value)
                }
              </div>

              {/* Label */}
              <div style={{
                fontSize: 12,
                color: 'var(--text-secondary, #A0A0A0)',
                marginTop: 4,
                fontWeight: 500,
              }}>
                {step.label}
              </div>
            </div>

            {/* Arrow + conversion rate */}
            {!step.isLast && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '4px 0',
              }}>
                <ChevronDown size={16} color="var(--border-primary, #262626)" />
                {step.value !== null && step.value > 0 && step.conversionTo !== null && step.conversionTo !== undefined && (
                  <div style={{
                    fontSize: 10,
                    color: 'var(--text-muted, #666)',
                    marginTop: 2,
                    fontWeight: 500,
                  }}>
                    {computeRate(step.value, step.conversionTo)}
                  </div>
                )}
              </div>
            )}

            {/* Subtle separator */}
            {i < steps.length - 1 && (
              <div style={{
                width: '60%',
                height: 1,
                background: 'var(--border-primary, #262626)',
                margin: '0 auto',
                opacity: 0.4,
              }} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
