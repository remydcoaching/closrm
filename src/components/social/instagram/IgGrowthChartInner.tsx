'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface ChartEntry {
  date: string
  Followers: number
  Vues: number
  Reach: number
}

interface Props {
  chartData: ChartEntry[]
}

export default function IgGrowthChartInner({ chartData }: Props) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={chartData}>
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#666' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#666' }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid var(--border-primary)', borderRadius: 8, fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }} />
        <Line type="monotone" dataKey="Followers" stroke="#3b82f6" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="Vues" stroke="#22c55e" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="Reach" stroke="#f97316" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
