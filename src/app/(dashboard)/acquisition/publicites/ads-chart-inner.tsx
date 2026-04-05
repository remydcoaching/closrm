'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface Props {
  daily: { date: string; leads: number }[]
}

export default function AdsBarChartInner({ daily }: Props) {
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
          width={30}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-primary)',
            borderRadius: 8,
            fontSize: 12,
          }}
          labelFormatter={(d) => `Date : ${String(d)}`}
          formatter={(value) => [String(value), 'Leads']}
        />
        <Bar dataKey="leads" fill="#1877F2" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
