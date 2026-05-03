'use client'

import { useState } from 'react'
import KpiGrid from './kpis/kpi-grid'
import PeriodSelectorV2 from './period-selector-v2'
import NextCallCard from './hero/next-call-card'
import DayPlanCard from './hero/day-plan-card'
import PreCallBriefModal from './hero/pre-call-brief-modal'
import RiskLeadsCard from './lists/risk-leads-card'
import HotLeadsCard from './lists/hot-leads-card'
import RecentBookingsCard from './lists/recent-bookings-card'
import ConversionFunnel from './funnel/conversion-funnel'
import LeadSidePanel from '@/components/shared/LeadSidePanel'
import type {
  DashboardKpisV2,
  NextBooking,
  DayPlanItem,
  PriorityLead,
  FunnelData,
  RecentBookingsBucket,
} from '@/lib/dashboard/v2-queries'

interface Props {
  firstName: string
  period: number
  kpis: DashboardKpisV2
  nextBooking: NextBooking | null
  dayPlan: DayPlanItem[]
  riskLeads: PriorityLead[]
  hotLeads: PriorityLead[]
  funnelData: FunnelData
  recentBookings: RecentBookingsBucket
}

export default function DashboardClientV2({
  firstName,
  period,
  kpis,
  nextBooking,
  dayPlan,
  riskLeads,
  hotLeads,
  funnelData,
  recentBookings,
}: Props) {
  const [briefModal, setBriefModal] = useState<{
    bookingId: string | null
    leadId: string | null
  } | null>(null)
  const [sidePanelLeadId, setSidePanelLeadId] = useState<string | null>(null)

  return (
    <div style={{ padding: 32, maxWidth: 1400, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Bonjour, {firstName} 👋
          </h1>
          <p
            style={{
              fontSize: 13,
              color: 'var(--text-muted)',
              margin: '4px 0 0',
            }}
          >
            Voici votre command center
          </p>
        </div>
        <PeriodSelectorV2 current={period} />
      </div>

      {/* Hero */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <NextCallCard
          booking={nextBooking}
          onGenerateBrief={(bookingId, leadId) => setBriefModal({ bookingId, leadId })}
        />
        <DayPlanCard items={dayPlan} />
      </div>

      {/* KPIs */}
      <KpiGrid kpis={kpis} />

      {/* Listes */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <RiskLeadsCard leads={riskLeads} />
        <HotLeadsCard leads={hotLeads} />
      </div>

      {/* Funnel */}
      <ConversionFunnel data={funnelData} />

      {/* Réservations récentes */}
      <RecentBookingsCard data={recentBookings} onLeadClick={setSidePanelLeadId} />

      <PreCallBriefModal
        open={briefModal !== null}
        bookingId={briefModal?.bookingId ?? null}
        leadId={briefModal?.leadId ?? null}
        onClose={() => setBriefModal(null)}
      />

      {sidePanelLeadId && (
        <LeadSidePanel leadId={sidePanelLeadId} onClose={() => setSidePanelLeadId(null)} />
      )}
    </div>
  )
}
