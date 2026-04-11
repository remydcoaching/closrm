'use client'

import { useEffect, useState, useCallback } from 'react'
import { Phone, Target, DollarSign, TrendingUp, Clock, Users, XCircle } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import StatusBadge from '@/components/leads/StatusBadge'
import LeadSidePanel from '@/components/shared/LeadSidePanel'
import type { Lead, Call, LeadStatus } from '@/types'

// ─── Types for API responses ────────────────────────────────────────────────

interface CallWithLead extends Call {
  lead: { id: string; first_name: string; last_name: string; phone: string; email: string | null; status: LeadStatus }
}

interface ApiResponse<T> {
  data: T[]
  meta: { total: number; page: number; per_page: number; total_pages: number }
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-primary)',
  borderRadius: 12,
  padding: 20,
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--text-primary)',
  marginBottom: 14,
}

const emptyStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '24px 0',
  fontSize: 13,
  color: 'var(--text-tertiary)',
}

// ─── Component ──────────────────────────────────────────────────────────────

interface CloserDashboardProps {
  firstName: string
  userId: string
}

export default function CloserDashboard({ firstName, userId }: CloserDashboardProps) {
  const [closingsToday, setClosingsToday] = useState<CallWithLead[]>([])
  const [pipelineLeads, setPipelineLeads] = useState<Lead[]>([])
  const [monthlyClosedLeads, setMonthlyClosedLeads] = useState<Lead[]>([])
  const [monthlyNoShows, setMonthlyNoShows] = useState(0)
  const [sidePanelLeadId, setSidePanelLeadId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const tomorrowStart = new Date(todayStart)
    tomorrowStart.setDate(tomorrowStart.getDate() + 1)

    const todayIso = todayStart.toISOString()
    const tomorrowIso = tomorrowStart.toISOString()

    // First day of current month
    const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1)
    const monthIso = monthStart.toISOString()

    try {
      const [closingsTodayRes, pipelineRes, closedMonthRes, noShowMonthRes] = await Promise.all([
        // Closings du jour
        fetch(`/api/calls?type=closing&scheduled_after=${todayIso}&scheduled_before=${tomorrowIso}&sort=scheduled_at&order=asc&per_page=50`),
        // Pipeline leads en closing
        fetch(`/api/leads?assigned_to=${userId}&status=closing_planifie,no_show_closing&per_page=50&sort=updated_at&order=desc`),
        // Leads closes ce mois
        fetch(`/api/leads?assigned_to=${userId}&status=clos&per_page=100&sort=updated_at&order=desc`),
        // No-shows ce mois
        fetch(`/api/calls?type=closing&outcome=no_show&scheduled_after=${monthIso}&scheduled_before=${tomorrowIso}&per_page=100`),
      ])

      const [closingsTodayData, pipelineData, closedMonthData, noShowMonthData] = await Promise.all([
        closingsTodayRes.json() as Promise<ApiResponse<CallWithLead>>,
        pipelineRes.json() as Promise<ApiResponse<Lead>>,
        closedMonthRes.json() as Promise<ApiResponse<Lead>>,
        noShowMonthRes.json() as Promise<ApiResponse<CallWithLead>>,
      ])

      setClosingsToday(closingsTodayData.data ?? [])
      setPipelineLeads(pipelineData.data ?? [])

      // Filter closed leads to only those closed this month
      const monthlyClosedFiltered = (closedMonthData.data ?? []).filter(l => {
        if (!l.closed_at) return false
        return new Date(l.closed_at) >= monthStart
      })
      setMonthlyClosedLeads(monthlyClosedFiltered)
      setMonthlyNoShows((noShowMonthData.data ?? []).length)
    } catch {
      // Silently fail — empty state will show
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ─── Compute stats ──────────────────────────────────────────────────────────

  const closingsPrevus = closingsToday.length
  const closesCeMois = monthlyClosedLeads.length
  const caGenere = monthlyClosedLeads.reduce((sum, l) => sum + (l.deal_amount ?? 0), 0)
  const totalClosingAttempts = closesCeMois + monthlyNoShows
  const tauxClosing = totalClosingAttempts > 0 ? Math.round((closesCeMois / totalClosingAttempts) * 100) : 0

  const kpis = [
    {
      label: 'Closings prevus',
      value: String(closingsPrevus),
      icon: Phone,
      color: '#a855f7',
    },
    {
      label: 'Closes ce mois',
      value: String(closesCeMois),
      icon: Target,
      color: '#38A169',
    },
    {
      label: 'CA genere',
      value: caGenere > 0 ? `${caGenere.toLocaleString('fr-FR')}€` : '0€',
      icon: DollarSign,
      color: '#f59e0b',
    },
    {
      label: 'Taux closing',
      value: `${tauxClosing}%`,
      icon: TrendingUp,
      color: '#3b82f6',
    },
  ]

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
          Chargement...
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Bonjour, {firstName}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Closer — voici votre journee
        </p>
      </div>

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 12,
        marginBottom: 20,
      }}>
        {kpis.map(({ label, value, icon: Icon, color }) => (
          <div key={label} style={cardStyle}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: color + '18',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 14,
            }}>
              <Icon size={16} color={color} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>
              {value}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Two columns: Closings du jour + Pipeline */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 14,
        alignItems: 'start',
        marginBottom: 14,
      }}>
        {/* Mes closings du jour */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...sectionTitleStyle }}>
            <Clock size={14} color="#a855f7" />
            Mes closings du jour
          </div>
          {closingsToday.length === 0 ? (
            <div style={emptyStyle}>Aucun closing prevu aujourd&apos;hui</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {closingsToday.map((call) => {
                const leadName = call.lead
                  ? `${call.lead.first_name} ${call.lead.last_name}`
                  : 'Lead inconnu'
                const outcomeColors: Record<string, string> = {
                  pending: '#f59e0b',
                  done: '#38A169',
                  cancelled: '#ef4444',
                  no_show: '#f97316',
                }
                return (
                  <button
                    key={call.id}
                    onClick={() => call.lead && setSidePanelLeadId(call.lead.id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 12px', background: 'var(--bg-input)',
                      borderRadius: 8, border: 'none',
                      borderLeft: `2px solid ${outcomeColors[call.outcome] ?? '#a855f7'}`,
                      cursor: 'pointer', textAlign: 'left', width: '100%',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {format(new Date(call.scheduled_at), "HH'h'mm", { locale: fr })} — {leadName}
                      </div>
                      {call.notes && (
                        <div style={{
                          fontSize: 11, color: 'var(--text-muted)', marginTop: 3,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          maxWidth: 280,
                        }}>
                          Brief : {call.notes}
                        </div>
                      )}
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 600,
                      color: outcomeColors[call.outcome] ?? 'var(--text-tertiary)',
                      background: (outcomeColors[call.outcome] ?? 'var(--text-tertiary)') + '18',
                      padding: '3px 8px', borderRadius: 99, flexShrink: 0, marginLeft: 8,
                    }}>
                      {call.outcome === 'pending' ? 'En attente' : call.outcome === 'done' ? 'Fait' : call.outcome === 'no_show' ? 'No-show' : 'Annule'}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Mon pipeline */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...sectionTitleStyle }}>
            <Users size={14} color="#3b82f6" />
            Mon pipeline
          </div>
          {pipelineLeads.length === 0 ? (
            <div style={emptyStyle}>Aucun lead en pipeline closing</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {pipelineLeads.map((lead) => (
                <button
                  key={lead.id}
                  onClick={() => setSidePanelLeadId(lead.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', background: 'var(--bg-input)',
                    borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {lead.first_name} {lead.last_name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {lead.phone || lead.email || '—'}
                    </div>
                  </div>
                  <StatusBadge status={lead.status} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats du mois */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...sectionTitleStyle }}>
          <TrendingUp size={14} color="#3b82f6" />
          Mes stats du mois
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
        }}>
          {[
            { label: 'Closings', value: String(closesCeMois), icon: Target, color: '#38A169' },
            { label: 'CA genere', value: caGenere > 0 ? `${caGenere.toLocaleString('fr-FR')}€` : '0€', icon: DollarSign, color: '#f59e0b' },
            { label: 'Taux closing', value: `${tauxClosing}%`, icon: TrendingUp, color: '#3b82f6' },
            { label: 'No-show', value: String(monthlyNoShows), icon: XCircle, color: '#ef4444' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} style={{
              textAlign: 'center',
              padding: '16px 8px',
              background: 'var(--bg-input)',
              borderRadius: 10,
            }}>
              <Icon size={18} color={color} style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
                {value}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Side panel */}
      {sidePanelLeadId && (
        <LeadSidePanel leadId={sidePanelLeadId} onClose={() => setSidePanelLeadId(null)} />
      )}
    </div>
  )
}
