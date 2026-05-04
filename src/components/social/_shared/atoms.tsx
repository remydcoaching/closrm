'use client'

/**
 * Atomes partagés entre les tabs Acquisition IG et YT.
 * Évite la duplication massive de KpiCard / SectionHeader / CardShell / fmt
 * qui existait avant la factorisation.
 */

export function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace('.0', '') + 'K'
  return Math.round(n).toString()
}

export function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-primary)',
      borderRadius: 12,
      padding: 18,
    }}>
      {children}
    </div>
  )
}

export function SectionHeader({
  icon: Icon, title, subtitle, accent, action,
}: {
  icon: React.ElementType
  title: string
  subtitle?: string
  accent: string
  action?: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: `${accent}1a`, color: accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={16} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{subtitle}</div>
          )}
        </div>
      </div>
      {action}
    </div>
  )
}

export function KpiCard({ label, value, hint, icon: Icon, accent, highlight }: {
  label: string; value: string; hint?: string; icon: React.ElementType; accent: string; highlight?: boolean
}) {
  return (
    <div style={{
      background: highlight ? `linear-gradient(135deg, ${accent}1a, ${accent}05)` : 'var(--bg-secondary)',
      border: `1px solid ${highlight ? accent + '60' : 'var(--border-primary)'}`,
      borderRadius: 12,
      padding: 16,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: `${accent}1a`, color: accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={14} />
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
        {value}
      </div>
      {hint && (
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>{hint}</div>
      )}
    </div>
  )
}
