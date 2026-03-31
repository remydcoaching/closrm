'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { SourceData } from '@/lib/stats/queries'

interface SourceChartProps {
  data: SourceData[]
}

export default function SourceChart({ data }: SourceChartProps) {
  if (data.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 140, color: 'var(--text-muted)', fontSize: 13 }}>
        Aucune donnée sur cette période
      </div>
    )
  }

  const total = data.reduce((sum, d) => sum + d.count, 0)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 140 }}>
      <ResponsiveContainer width={110} height={110}>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={28}
            outerRadius={50}
            paddingAngle={2}
          >
            {data.map((entry) => (
              <Cell key={entry.source} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid #2a2a35', borderRadius: 8, fontSize: 12 }}
            formatter={(value) => {
              const n = value as number
              return [`${n} (${Math.round((n / total) * 100)}%)`, '']
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        {data.map((entry) => (
          <div key={entry.source} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: entry.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flex: 1 }}>{entry.label}</span>
            <span style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 600 }}>
              {Math.round((entry.count / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
