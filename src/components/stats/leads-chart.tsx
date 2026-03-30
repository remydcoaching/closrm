'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import type { LeadsPerDay } from '@/lib/stats/queries'

interface LeadsChartProps {
  data: LeadsPerDay[]
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export default function LeadsChart({ data }: LeadsChartProps) {
  if (data.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 140, color: '#555', fontSize: 13 }}>
        Aucune donnée sur cette période
      </div>
    )
  }

  const formatted = data.map(d => ({ ...d, dateLabel: formatDate(d.date) }))

  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={formatted} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <XAxis
          dataKey="dateLabel"
          tick={{ fontSize: 10, fill: '#555' }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#555' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid #2a2a35', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#aaa' }}
          itemStyle={{ color: 'var(--color-primary)' }}
          cursor={{ fill: 'rgba(255,255,255,0.03)' }}
        />
        <Bar dataKey="count" name="Leads" radius={[4, 4, 0, 0]}>
          {formatted.map((entry, index) => (
            <Cell
              key={entry.date}
              fill="var(--color-primary)"
              fillOpacity={index === formatted.length - 1 ? 0.5 : 0.19}
              stroke="var(--color-primary)"
              strokeWidth={1}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
