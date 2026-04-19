'use client'

import { useEffect, useState } from 'react'
import { CreditCard, Zap, Mail, MessageCircle, Bot, ArrowUpRight } from 'lucide-react'
import type { BillingPlan, QuotaInfo, WorkspaceCurrentUsage, WorkspaceBilling } from '@/types/billing'

interface PlanData {
  workspace: WorkspaceBilling & { id: string }
  plan: BillingPlan | null
  usage: WorkspaceCurrentUsage | null
  quotas: QuotaInfo[]
}

export default function PlanPage() {
  const [data, setData] = useState<PlanData | null>(null)
  const [loading, setLoading] = useState(true)
  const [daysLeftTrial, setDaysLeftTrial] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/billing/plan')
      .then((r) => r.json())
      .then((json: PlanData) => {
        setData(json)
        if (json.workspace?.trial_ends_at && json.workspace.subscription_status === 'trial') {
          const trialEndMs = new Date(json.workspace.trial_ends_at).getTime()
          setDaysLeftTrial(Math.max(Math.ceil((trialEndMs - Date.now()) / (1000 * 60 * 60 * 24)), 0))
        }
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div style={{ padding: 40, color: 'var(--text-secondary)' }}>Chargement…</div>
  }

  if (!data || !data.plan) {
    return (
      <div style={{ padding: 40 }}>
        <p style={{ color: 'var(--text-secondary)' }}>Aucune donnée de plan disponible.</p>
      </div>
    )
  }

  const { workspace, plan, quotas } = data
  const isInternal = workspace.is_internal

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          Plan & Consommation
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          Votre plan actuel, quotas inclus et consommation de la période.
        </p>
      </div>

      {/* Plan actuel */}
      <section
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-primary)',
          borderRadius: 12,
          padding: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: isInternal ? 'rgba(168,85,247,0.15)' : 'rgba(229,62,62,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CreditCard size={22} color={isInternal ? '#a855f7' : '#E53E3E'} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{plan.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                {isInternal
                  ? 'Bypass billing (compte interne)'
                  : `${(plan.base_price_cents / 100).toFixed(0)}€/mois${plan.additional_seat_price_cents ? ` + ${(plan.additional_seat_price_cents / 100).toFixed(0)}€/siège` : ''}`}
              </div>
            </div>
          </div>

          {!isInternal && (
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                background: '#E53E3E',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 13,
              }}
              onClick={() => alert('Stripe Customer Portal à intégrer (phase P2)')}
            >
              Gérer mon abonnement
              <ArrowUpRight size={14} />
            </button>
          )}
        </div>

        {daysLeftTrial !== null && (
          <div
            style={{
              padding: '10px 14px',
              background: 'rgba(214,158,46,0.15)',
              border: '1px solid rgba(214,158,46,0.3)',
              borderRadius: 8,
              fontSize: 13,
              color: '#D69E2E',
              marginTop: 8,
            }}
          >
            Essai en cours — <strong>{daysLeftTrial} jour{daysLeftTrial > 1 ? 's' : ''}</strong> restants. Passez en Pro pour continuer sans interruption.
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
            marginTop: 20,
          }}
        >
          <MetricCard label="Sièges actifs" value={`${workspace.seats_count}${plan.max_seats ? ` / ${plan.max_seats}` : ''}`} />
          <MetricCard
            label="Wallet"
            value={`${(workspace.wallet_balance_cents / 100).toFixed(2)}€`}
            subtle={workspace.wallet_auto_recharge_enabled ? `Auto-recharge : ${(workspace.wallet_auto_recharge_amount_cents / 100).toFixed(0)}€` : 'Auto-recharge désactivée'}
          />
          <MetricCard
            label="Période"
            value={
              workspace.current_period_end
                ? `Jusqu'au ${new Date(workspace.current_period_end).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
                : '—'
            }
          />
        </div>
      </section>

      {/* Quotas par ressource */}
      <section
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-primary)',
          borderRadius: 12,
          padding: 24,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
          Consommation de la période
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {quotas.map((q) => (
            <QuotaRow key={q.resource_type} quota={q} />
          ))}
        </div>

        {!isInternal && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 16, lineHeight: 1.6 }}>
            Au-delà du quota inclus, l&apos;usage est facturé sur votre wallet : {(plan.overage_email_price_cents_per_1k / 100).toFixed(2)}€ / 1 000 emails,
            {' '}{(plan.overage_ai_tokens_price_cents_per_1k / 100).toFixed(2)}€ / 1 000 tokens IA,
            {' '}{(plan.overage_whatsapp_price_cents_per_1k / 100).toFixed(2)}€ / 100 WhatsApp.
          </p>
        )}
      </section>
    </div>
  )
}

function MetricCard({ label, value, subtle }: { label: string; value: string; subtle?: string }) {
  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 10,
        padding: 16,
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
      {subtle && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{subtle}</div>}
    </div>
  )
}

const RESOURCE_META: Record<string, { label: string; icon: React.ReactNode; unit: string }> = {
  email: { label: 'Emails', icon: <Mail size={16} />, unit: '' },
  ai_tokens: { label: 'Tokens IA', icon: <Bot size={16} />, unit: '' },
  whatsapp: { label: 'WhatsApp', icon: <MessageCircle size={16} />, unit: '' },
  sms: { label: 'SMS', icon: <Zap size={16} />, unit: '' },
}

function QuotaRow({ quota }: { quota: QuotaInfo }) {
  const meta = RESOURCE_META[quota.resource_type]
  if (!meta) return null
  const pct = quota.quota_total > 0 ? Math.min((quota.quota_used / quota.quota_total) * 100, 100) : 0
  const color = pct < 70 ? '#38A169' : pct < 90 ? '#D69E2E' : '#E53E3E'
  const isUnlimited = quota.quota_total >= Number.MAX_SAFE_INTEGER / 2

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>
          <span style={{ color: 'var(--text-tertiary)' }}>{meta.icon}</span>
          {meta.label}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {isUnlimited ? (
            <span style={{ color: '#a855f7', fontWeight: 600 }}>Illimité (compte interne)</span>
          ) : (
            <>
              <strong style={{ color: 'var(--text-primary)' }}>{quota.quota_used.toLocaleString('fr-FR')}</strong>
              {' / '}
              {quota.quota_total.toLocaleString('fr-FR')}
            </>
          )}
        </div>
      </div>
      <div style={{ height: 6, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: isUnlimited ? '3%' : `${pct}%`,
            background: isUnlimited ? '#a855f7' : color,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      {!isUnlimited && quota.fair_use_cap && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          Fair-use : {quota.fair_use_cap.toLocaleString('fr-FR')} / mois max. Au-delà → upgrade Scale requis.
        </div>
      )}
    </div>
  )
}
