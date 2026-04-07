'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface DailyPoint {
  date: string
  leads?: number
  impressions?: number
  spend?: number
  clicks?: number
}

interface Props {
  daily: DailyPoint[]
  dataKey?: 'leads' | 'impressions' | 'spend' | 'clicks'
  label?: string
}

export default function AdsBarChartInner({ daily, dataKey = 'leads', label = 'Leads' }: Props) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={daily}>
        <XAxis
          dataKey="date"
          tickFormatter={(d: string) => d.slice(5)}
          tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-primary)',
            borderRadius: 8,
            fontSize: 12,
          }}
          labelFormatter={(d) => `Date : ${String(d)}`}
          formatter={(value) => [String(value), label]}
        />
        <Bar dataKey={dataKey} fill="#1877F2" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
