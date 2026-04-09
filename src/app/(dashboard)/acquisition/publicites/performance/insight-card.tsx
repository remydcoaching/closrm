'use client'

import {
  MessageSquare,
  TrendingUp,
  Users,
  DollarSign,
  CalendarCheck,
  ShieldCheck,
  Target,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'
import type { PerformanceInsight } from './insights-engine'

const ICON_MAP: Record<string, LucideIcon> = {
  'MessageSquare': MessageSquare,
  'message-square': MessageSquare,
  'TrendingUp': TrendingUp,
  'trending-up': TrendingUp,
  'Users': Users,
  'users': Users,
  'DollarSign': DollarSign,
  'dollar-sign': DollarSign,
  'CalendarCheck': CalendarCheck,
  'calendar-check': CalendarCheck,
  'ShieldCheck': ShieldCheck,
  'shield-check': ShieldCheck,
  'Target': Target,
  'UserPlus': UserPlus,
}

const STATUS_COLORS: Record<PerformanceInsight['status'], string> = {
  action_required: '#E53E3E',
  needs_optimization: '#D69E2E',
  on_track: '#38A169',
}

const STATUS_BG: Record<PerformanceInsight['status'], string> = {
  action_required: 'rgba(229, 62, 62, 0.12)',
  needs_optimization: 'rgba(214, 158, 46, 0.12)',
  on_track: 'rgba(56, 161, 105, 0.12)',
}

export default function InsightCard(insight: PerformanceInsight) {
  const {
    icon,
    title,
    status,
    statusLabel,
    currentValue,
    targetValue,
    description,
    expectedImpact,
    actionSteps,
  } = insight

  const IconComponent = ICON_MAP[icon] ?? TrendingUp
  const statusColor = STATUS_COLORS[status]
  const statusBg = STATUS_BG[status]

  return (
    <div
      style={{
        background: 'var(--bg-elevated, #141414)',
        border: '1px solid var(--border-primary, #262626)',
        borderLeft: `4px solid ${statusColor}`,
        borderRadius: 12,
        padding: '20px 24px',
        position: 'relative',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.3)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Header: icon + title left, badge right */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 12,
        gap: 12,
      }}>
        {/* Icon + Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: statusBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <IconComponent size={18} color={statusColor} />
          </div>
          <div style={{
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--text-primary, #FFFFFF)',
            lineHeight: 1.3,
          }}>
            {title}
          </div>
        </div>

        {/* Status badge */}
        <span style={{
          flexShrink: 0,
          padding: '4px 10px',
          borderRadius: 20,
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase' as const,
          letterSpacing: 0.5,
          background: statusBg,
          color: statusColor,
          whiteSpace: 'nowrap',
        }}>
          {statusLabel}
        </span>
      </div>

      {/* Subtitle: Current -> Target */}
      <div style={{
        fontSize: 12,
        fontWeight: 600,
        color: statusColor,
        marginBottom: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <span>Actuel : {currentValue}</span>
        <span style={{ color: 'var(--text-muted, #666)' }}>{'→'}</span>
        <span>Objectif : {targetValue}</span>
      </div>

      {/* Description */}
      <div style={{
        fontSize: 12,
        lineHeight: 1.6,
        color: 'var(--text-secondary, #A0A0A0)',
        marginBottom: 16,
      }}>
        {description}
      </div>

      {/* Expected Impact */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '10px 14px',
        background: 'rgba(59, 130, 246, 0.06)',
        borderRadius: 8,
        marginBottom: 16,
        border: '1px solid rgba(59, 130, 246, 0.1)',
      }}>
        <TrendingUp size={14} color="#3b82f6" style={{ marginTop: 2, flexShrink: 0 }} />
        <div>
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase' as const,
            letterSpacing: 0.8,
            color: '#3b82f6',
            marginBottom: 3,
          }}>
            Expected Impact
          </div>
          <div style={{
            fontSize: 12,
            color: '#3b82f6',
            lineHeight: 1.5,
          }}>
            {expectedImpact}
          </div>
        </div>
      </div>

      {/* Action Steps */}
      {actionSteps.length > 0 && (
        <div>
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase' as const,
            letterSpacing: 0.8,
            color: 'var(--text-muted, #666)',
            marginBottom: 10,
          }}>
            Action Steps
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}>
            {actionSteps.map((step, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                }}
              >
                {/* Numbered circle */}
                <div style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: statusBg,
                  color: statusColor,
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 1,
                }}>
                  {i + 1}
                </div>
                <div style={{
                  fontSize: 12,
                  color: 'var(--text-secondary, #A0A0A0)',
                  lineHeight: 1.5,
                  paddingTop: 2,
                }}>
                  {step}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
