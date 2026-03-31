'use client'

import { useState } from 'react'
import LeadSidePanel from '@/components/shared/LeadSidePanel'
import KpiCards from '@/components/dashboard/kpi-cards'
import PeriodSelector from '@/components/dashboard/period-selector'
import UpcomingCalls from '@/components/dashboard/upcoming-calls'
import OverdueFollowUps from '@/components/dashboard/overdue-followups'
import RecentActivity from '@/components/dashboard/recent-activity'
import type { DashboardKpis, UpcomingCall, OverdueFollowUp, ActivityEvent } from '@/lib/dashboard/queries'

interface DashboardClientProps {
  firstName: string
  period: number
  kpis: DashboardKpis
  upcomingCalls: UpcomingCall[]
  overdueFollowUps: OverdueFollowUp[]
  recentActivity: ActivityEvent[]
}

export default function DashboardClient({
  firstName,
  period,
  kpis,
  upcomingCalls,
  overdueFollowUps,
  recentActivity,
}: DashboardClientProps) {
  const [sidePanelLeadId, setSidePanelLeadId] = useState<string | null>(null)

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28,
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Bonjour, {firstName} 👋
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Voici votre activité du moment
          </p>
        </div>
        <PeriodSelector current={period} />
      </div>

      {/* KPIs */}
      <KpiCards kpis={kpis} />

      {/* Prochains appels + Follow-ups en retard */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
        gap: 14,
        marginBottom: 14,
      }}>
        <UpcomingCalls calls={upcomingCalls} onLeadClick={setSidePanelLeadId} />
        <OverdueFollowUps followUps={overdueFollowUps} onLeadClick={setSidePanelLeadId} />
      </div>

      {/* Activité récente */}
      <RecentActivity events={recentActivity} />

      {/* Side panel */}
      {sidePanelLeadId && (
        <LeadSidePanel leadId={sidePanelLeadId} onClose={() => setSidePanelLeadId(null)} />
      )}
    </div>
  )
}
