'use client'

import { useEffect, useState, useCallback } from 'react'
import { MessageSquare, Phone, PhoneIncoming, CalendarCheck, Clock, CheckCircle } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import StatusBadge from '@/components/leads/StatusBadge'
import SourceBadge from '@/components/leads/SourceBadge'
import LeadSidePanel from '@/components/shared/LeadSidePanel'
import type { Lead, Call, FollowUp, LeadStatus, LeadSource, FollowUpChannel } from '@/types'

// ─── Types for API responses ────────────────────────────────────────────────

interface CallWithLead extends Call {
  lead: { id: string; first_name: string; last_name: string; phone: string; email: string | null; status: LeadStatus }
}

interface FollowUpWithLead extends FollowUp {
  lead: { id: string; first_name: string; last_name: string; phone: string; email: string | null; status: LeadStatus; assigned_to: string | null }
}

interface ApiResponse<T> {
  data: T[]
  meta: { total: number; page: number; per_page: number; total_pages: number }
}

// ─── Constants ──────────────────────────────────────────────────────────────

const GOALS = {
  callsPerDay: 15,
  bookingsPerWeek: 5,
} as const

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

interface SetterDashboardProps {
  firstName: string
  userId: string
}

export default function SetterDashboard({ firstName, userId }: SetterDashboardProps) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [callsToday, setCallsToday] = useState<CallWithLead[]>([])
  const [followUpsToday, setFollowUpsToday] = useState<FollowUpWithLead[]>([])
  const [allCallsToday, setAllCallsToday] = useState<CallWithLead[]>([])
  const [sidePanelLeadId, setSidePanelLeadId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const tomorrowStart = new Date(todayStart)
    tomorrowStart.setDate(tomorrowStart.getDate() + 1)

    const todayIso = todayStart.toISOString()
    const tomorrowIso = tomorrowStart.toISOString()

    // Monday of current week for weekly stats
    const mondayStart = new Date(todayStart)
    mondayStart.setDate(mondayStart.getDate() - ((mondayStart.getDay() + 6) % 7))
    mondayStart.setHours(0, 0, 0, 0)
    const mondayIso = mondayStart.toISOString()

    try {
      const [leadsRes, callsTodayRes, followUpsRes, allCallsTodayRes, weeklyCallsRes] = await Promise.all([
        fetch(`/api/leads?assigned_to=${userId}&per_page=10&sort=created_at&order=desc`),
        fetch(`/api/calls?scheduled_after=${todayIso}&scheduled_before=${tomorrowIso}&sort=scheduled_at&order=asc`),
        fetch(`/api/follow-ups?status=en_attente&scheduled_before=${tomorrowIso}&sort=scheduled_at&order=asc`),
        // All calls today (for stats — messages + appels passes + repondus)
        fetch(`/api/calls?scheduled_after=${todayIso}&scheduled_before=${tomorrowIso}&per_page=100`),
        // Weekly calls for booking count
        fetch(`/api/calls?scheduled_after=${mondayIso}&scheduled_before=${tomorrowIso}&per_page=100`),
      ])

      const [leadsData, callsTodayData, followUpsData, allCallsTodayData, weeklyCallsData] = await Promise.all([
        leadsRes.json() as Promise<ApiResponse<Lead>>,
        callsTodayRes.json() as Promise<ApiResponse<CallWithLead>>,
        followUpsRes.json() as Promise<ApiResponse<FollowUpWithLead>>,
        allCallsTodayRes.json() as Promise<ApiResponse<CallWithLead>>,
        weeklyCallsRes.json() as Promise<ApiResponse<CallWithLead>>,
      ])

      setLeads(leadsData.data ?? [])
      setCallsToday(callsTodayData.data ?? [])
      setFollowUpsToday(followUpsData.data ?? [])
      setAllCallsToday(allCallsTodayData.data ?? [])

      // Store weekly bookings count in allCallsToday length is reused below
      // We'll compute stats from allCallsTodayData and weeklyCallsData in the render
      setWeeklyBookings(
        (weeklyCallsData.data ?? []).filter(c => c.outcome === 'done' && c.type === 'setting').length
      )
    } catch {
      // Silently fail — empty state will show
    } finally {
      setLoading(false)
    }
  }, [userId])

  const [weeklyBookings, setWeeklyBookings] = useState(0)

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ─── Compute stats ──────────────────────────────────────────────────────────

  const callsDone = allCallsToday.filter(c => c.outcome === 'done').length
  const callsReached = allCallsToday.filter(c => c.outcome === 'done' && c.reached).length
  const bookingsToday = allCallsToday.filter(c => c.outcome === 'done' && c.type === 'setting').length

  const kpis = [
    {
      label: 'Appels passes',
      value: callsDone,
      icon: Phone,
      color: '#3b82f6',
    },
    {
      label: 'Appels repondus',
      value: callsReached,
      icon: PhoneIncoming,
      color: '#38A169',
    },
    {
      label: 'RDV bookes',
      value: bookingsToday,
      icon: CalendarCheck,
      color: '#a855f7',
    },
    {
      label: 'Follow-ups restants',
      value: followUpsToday.length,
      icon: MessageSquare,
      color: '#f59e0b',
    },
  ]

  // ─── Progress bar helper ──────────────────────────────────────────────────

  function ProgressBar({ current, target, label }: { current: number; target: number; label: string }) {
    const pct = Math.min(100, Math.round((current / target) * 100))
    const barColor = pct >= 80 ? '#38A169' : pct >= 50 ? '#f59e0b' : '#ef4444'

    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
            {current}/{target}
          </span>
        </div>
        <div style={{
          height: 8,
          borderRadius: 4,
          background: 'var(--bg-input)',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: 4,
            background: barColor,
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>
    )
  }

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
          Setter — voici votre journee
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

      {/* Two columns: Leads + Agenda/Objectifs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 14,
        alignItems: 'start',
      }}>
        {/* Mes leads a traiter */}
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>Mes leads a traiter</div>
          {leads.length === 0 ? (
            <div style={emptyStyle}>Aucun lead assigne</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {leads.map((lead) => (
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
                      {lead.last_activity_at && (
                        <span> · {format(new Date(lead.last_activity_at), "d MMM", { locale: fr })}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                    <StatusBadge status={lead.status} />
                    <SourceBadge source={lead.source} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right column: Agenda + Objectifs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Mon agenda du jour */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...sectionTitleStyle }}>
              <Clock size={14} color="#f59e0b" />
              Mon agenda du jour
            </div>
            {callsToday.length === 0 && followUpsToday.length === 0 ? (
              <div style={emptyStyle}>Rien de prevu aujourd&apos;hui</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {callsToday.map((call) => {
                  const leadName = call.lead
                    ? `${call.lead.first_name} ${call.lead.last_name}`
                    : 'Lead inconnu'
                  return (
                    <button
                      key={call.id}
                      onClick={() => call.lead && setSidePanelLeadId(call.lead.id)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 10px', background: 'var(--bg-input)',
                        borderRadius: 8, border: 'none',
                        borderLeft: `2px solid ${call.type === 'setting' ? '#3b82f6' : '#a855f7'}`,
                        cursor: 'pointer', textAlign: 'left', width: '100%',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {leadName}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {format(new Date(call.scheduled_at), "HH'h'mm", { locale: fr })} · {call.type === 'setting' ? 'Setting' : 'Closing'}
                        </div>
                      </div>
                      <Phone size={14} color="var(--text-label)" />
                    </button>
                  )
                })}

                {followUpsToday.map((fu) => {
                  const leadName = fu.lead
                    ? `${fu.lead.first_name} ${fu.lead.last_name}`
                    : 'Lead inconnu'
                  const channelLabel: Record<FollowUpChannel, string> = {
                    whatsapp: 'WhatsApp',
                    email: 'Email',
                    instagram_dm: 'DM Instagram',
                    manuel: 'Manuel',
                  }
                  return (
                    <button
                      key={fu.id}
                      onClick={() => fu.lead && setSidePanelLeadId(fu.lead.id)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 10px', background: 'var(--bg-input)',
                        borderRadius: 8, border: 'none',
                        borderLeft: '2px solid #f59e0b',
                        cursor: 'pointer', textAlign: 'left', width: '100%',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {leadName}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          Follow-up · {channelLabel[fu.channel]}
                        </div>
                      </div>
                      <MessageSquare size={14} color="var(--text-label)" />
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Mes objectifs */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...sectionTitleStyle }}>
              <CheckCircle size={14} color="#38A169" />
              Mes objectifs
            </div>
            <ProgressBar
              current={callsDone}
              target={GOALS.callsPerDay}
              label="Appels / jour"
            />
            <ProgressBar
              current={weeklyBookings}
              target={GOALS.bookingsPerWeek}
              label="RDV bookes / semaine"
            />
          </div>
        </div>
      </div>

      {/* Side panel */}
      {sidePanelLeadId && (
        <LeadSidePanel leadId={sidePanelLeadId} onClose={() => setSidePanelLeadId(null)} />
      )}
    </div>
  )
}
