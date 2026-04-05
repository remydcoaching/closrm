'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

interface PillarCount {
  name: string
  value: number
  color: string
}

interface Props {
  pillarCounts: PillarCount[]
}

export default function IgPillarPieChartInner({ pillarCounts }: Props) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={pillarCounts} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" strokeWidth={0}>
          {pillarCounts.map((entry, i) => <Cell key={i} fill={entry.color} />)}
        </Pie>
        <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid var(--border-primary)', borderRadius: 8, fontSize: 12, color: 'var(--text-primary)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
