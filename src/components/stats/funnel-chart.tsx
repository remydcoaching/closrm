'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts'
import type { FunnelData } from '@/lib/stats/queries'

interface FunnelChartProps {
  data: FunnelData[]
}

export default function FunnelChart({ data }: FunnelChartProps) {
  if (data.every(d => d.count === 0)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 140, color: 'var(--text-muted)', fontSize: 13 }}>
        Aucune donnée sur cette période
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={data} margin={{ top: 16, right: 4, bottom: 0, left: -20 }}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: '#555' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#555' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid #2a2a35', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: 'var(--text-tertiary)' }}
          cursor={{ fill: 'var(--bg-subtle)' }}
          formatter={(value, _name, props) => [
            `${value ?? 0} (${(props.payload as FunnelData | undefined)?.pct ?? 0}%)`,
            'Leads',
          ]}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          <LabelList
            dataKey="pct"
            position="top"
            formatter={(v) => (v as number) > 0 ? `${v}%` : ''}
            style={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
          />
          {data.map((entry) => (
            <Cell key={entry.label} fill={entry.color} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
