'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { TrendingUp, TrendingDown, Wallet, Repeat, Users, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { FinanceOverviewResponse } from '@/app/api/finance/overview/route'
import type { MemberPerformance } from '@/app/api/finance/team/route'
import type { Deal, Lead } from '@/types'

type DealWithLead = Deal & { lead: Pick<Lead, 'id' | 'first_name' | 'last_name' | 'email' | 'phone'> | null }

function formatEuro(v: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
}

const card: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-primary)',
  borderRadius: 14,
  padding: 18,
}

const kpiCard: React.CSSProperties = { ...card, padding: 16 }
const kpiLabel: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: 'var(--text-label)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }
const kpiValue: React.CSSProperties = { fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }
const kpiDelta: React.CSSProperties = { fontSize: 11, fontWeight: 500, marginTop: 4 }
const sectionTitle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }

const th: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: 'var(--text-label)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid var(--border-primary)', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '11px 12px', fontSize: 12.5, borderBottom: '1px solid var(--bg-hover)', whiteSpace: 'nowrap' }

export default function FinanceClient() {
  const [overview, setOverview] = useState<FinanceOverviewResponse | null>(null)
  const [team, setTeam] = useState<MemberPerformance[]>([])
  const [deals, setDeals] = useState<DealWithLead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [ovRes, teamRes, dealsRes] = await Promise.all([
        fetch('/api/finance/overview').then(r => r.ok ? r.json() : null),
        fetch('/api/finance/team').then(r => r.ok ? r.json() : { data: [] }),
        fetch('/api/deals?status=active').then(r => r.ok ? r.json() : { data: [] }),
      ])
      if (!cancelled) {
        setOverview(ovRes?.data ?? null)
        setTeam(teamRes.data ?? [])
        setDeals(dealsRes.data ?? [])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const maxMrr = overview ? Math.max(1, ...overview.mrr_by_month.map(m => m.mrr)) : 1

  return (
    <div style={{ padding: 32 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Finance</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          MRR, cash collecté, performances closers & setters
        </p>
      </div>

      {loading || !overview ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Chargement...</div>
      ) : (
        <>
          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
            <div style={kpiCard}>
              <div style={kpiLabel}><Repeat size={10} style={{ marginRight: 4, verticalAlign: '-1px' }} />MRR actuel</div>
              <div style={kpiValue}>{formatEuro(overview.mrr_current)}</div>
              <div style={{ ...kpiDelta, color: overview.mrr_new_this_month >= overview.mrr_churned_this_month ? '#38A169' : '#ef4444' }}>
                {overview.mrr_new_this_month > 0 && `+${formatEuro(overview.mrr_new_this_month)} nouveau`}
                {overview.mrr_churned_this_month > 0 && ` · -${formatEuro(overview.mrr_churned_this_month)} churn`}
              </div>
            </div>
            <div style={kpiCard}>
              <div style={kpiLabel}><Wallet size={10} style={{ marginRight: 4, verticalAlign: '-1px' }} />Cash ce mois</div>
              <div style={kpiValue}>{formatEuro(overview.cash_this_month)}</div>
              <div style={{ ...kpiDelta, color: 'var(--text-muted)' }}>Cash cumulé : {formatEuro(overview.cash_cumulative)}</div>
            </div>
            <div style={kpiCard}>
              <div style={kpiLabel}><TrendingUp size={10} style={{ marginRight: 4, verticalAlign: '-1px' }} />CA cumulé</div>
              <div style={kpiValue}>{formatEuro(overview.revenue_cumulative)}</div>
              <div style={{ ...kpiDelta, color: 'var(--text-muted)' }}>
                Reste à collecter : {formatEuro(overview.revenue_cumulative - overview.cash_cumulative)}
              </div>
            </div>
            <div style={kpiCard}>
              <div style={kpiLabel}>Deals actifs</div>
              <div style={kpiValue}>{overview.deals_active}</div>
              <div style={{ ...kpiDelta, color: 'var(--text-muted)' }}>Ticket moyen : {formatEuro(overview.avg_deal_size)}</div>
            </div>
          </div>

          {/* MRR chart */}
          <div style={{ ...card, marginBottom: 24 }}>
            <div style={sectionTitle}>MRR sur 12 mois</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 140 }}>
              {overview.mrr_by_month.map((m) => {
                const h = (m.mrr / maxMrr) * 100
                return (
                  <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                      <div
                        title={`${m.month} : ${formatEuro(m.mrr)}`}
                        style={{
                          width: '100%',
                          height: `${h}%`,
                          minHeight: m.mrr > 0 ? 2 : 0,
                          background: 'linear-gradient(180deg, var(--color-primary), rgba(0,200,83,0.4))',
                          borderRadius: '4px 4px 0 0',
                          transition: 'height 0.3s',
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                      {m.month.slice(5)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Deals actifs */}
          <div style={{ ...card, marginBottom: 24, padding: 0 }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                Deals actifs <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({deals.length})</span>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Client</th>
                    <th style={th}>Closer</th>
                    <th style={{ ...th, textAlign: 'right' }}>Montant</th>
                    <th style={{ ...th, textAlign: 'right' }}>Encaissé</th>
                    <th style={{ ...th, textAlign: 'right' }}>Reste</th>
                    <th style={{ ...th, textAlign: 'right' }}>Paiement</th>
                    <th style={{ ...th, textAlign: 'right' }}>Durée</th>
                    <th style={{ ...th, textAlign: 'right' }}>MRR</th>
                    <th style={{ ...th, textAlign: 'right' }}>Fin</th>
                    <th style={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {deals.length === 0 ? (
                    <tr><td colSpan={10} style={{ ...td, textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Aucun deal actif</td></tr>
                  ) : deals.map(d => {
                    const closerRow = team.find(m => m.user_id === d.closer_id)
                    const remaining = Math.max(0, Number(d.amount) - Number(d.cash_collected))
                    const mrr = d.duration_months ? Number(d.amount) / d.duration_months : 0
                    return (
                      <tr key={d.id}>
                        <td style={td}>
                          {d.lead ? (
                            <Link href={`/leads/${d.lead.id}`} style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 500 }}>
                              {d.lead.first_name} {d.lead.last_name}
                            </Link>
                          ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td style={{ ...td, color: 'var(--text-tertiary)' }}>{closerRow?.full_name ?? (d.closer_id ? '—' : 'Non attribué')}</td>
                        <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{formatEuro(Number(d.amount))}</td>
                        <td style={{ ...td, textAlign: 'right', color: '#38A169' }}>{formatEuro(Number(d.cash_collected))}</td>
                        <td style={{ ...td, textAlign: 'right', color: remaining > 0 ? '#f59e0b' : 'var(--text-muted)' }}>{formatEuro(remaining)}</td>
                        <td style={{ ...td, textAlign: 'right' }}>{d.installments}x</td>
                        <td style={{ ...td, textAlign: 'right' }}>{d.duration_months ? `${d.duration_months} mois` : 'One-shot'}</td>
                        <td style={{ ...td, textAlign: 'right', fontWeight: 500 }}>{mrr > 0 ? formatEuro(mrr) : '—'}</td>
                        <td style={{ ...td, textAlign: 'right', color: 'var(--text-muted)' }}>
                          {d.ends_at ? format(new Date(d.ends_at), 'dd MMM yy', { locale: fr }) : '—'}
                        </td>
                        <td style={{ ...td, textAlign: 'right' }}>
                          {d.lead && (
                            <Link href={`/leads/${d.lead.id}`} style={{ display: 'inline-flex', color: 'var(--text-tertiary)' }}>
                              <ExternalLink size={12} />
                            </Link>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Équipe */}
          <div style={{ ...card, padding: 0 }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-primary)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Users size={14} />Performance équipe
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Membre</th>
                    <th style={th}>Rôle</th>
                    <th style={{ ...th, textAlign: 'right' }}>Deals (closer)</th>
                    <th style={{ ...th, textAlign: 'right' }}>Deals (setter)</th>
                    <th style={{ ...th, textAlign: 'right' }}>CA généré</th>
                    <th style={{ ...th, textAlign: 'right' }}>Cash collecté</th>
                    <th style={{ ...th, textAlign: 'right' }}>MRR contribué</th>
                  </tr>
                </thead>
                <tbody>
                  {team.length === 0 ? (
                    <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Aucun membre actif</td></tr>
                  ) : team.map(m => (
                    <tr key={m.user_id}>
                      <td style={{ ...td, fontWeight: 500, color: 'var(--text-primary)' }}>{m.full_name}</td>
                      <td style={td}>
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                          background: m.role === 'admin' ? 'rgba(168,85,247,0.12)' : m.role === 'closer' ? 'rgba(0,200,83,0.12)' : 'rgba(59,130,246,0.12)',
                          color: m.role === 'admin' ? '#a855f7' : m.role === 'closer' ? 'var(--color-primary)' : '#3b82f6',
                          textTransform: 'uppercase',
                        }}>
                          {m.role}
                        </span>
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{m.deals_as_closer}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{m.deals_as_setter}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{formatEuro(m.revenue_closed)}</td>
                      <td style={{ ...td, textAlign: 'right', color: '#38A169' }}>{formatEuro(m.cash_collected)}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 500 }}>{m.mrr_contributed > 0 ? formatEuro(m.mrr_contributed) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
