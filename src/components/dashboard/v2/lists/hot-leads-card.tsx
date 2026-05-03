'use client'

import { Flame, ChevronRight } from 'lucide-react'
import type { PriorityLead } from '@/lib/dashboard/v2-queries'

export default function HotLeadsCard({ leads }: { leads: PriorityLead[] }) {
  return (
    <div style={cardStyle}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Flame size={14} color="#f59e0b" />
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text-label)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Leads chauds
          </span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{leads.length}</span>
      </div>
      {leads.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Aucun lead chaud actuellement
        </div>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {leads.map(l => (
            <li key={l.id}>
              <a
                href={`/leads/${l.id}`}
                style={rowStyle}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--bg-hover)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {l.name}
                </span>
                <span style={{ fontSize: 11, color: '#f59e0b' }}>{l.context}</span>
                <ChevronRight size={12} color="var(--text-muted)" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-primary)',
  borderRadius: 12,
  padding: 16,
  minHeight: 180,
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 10px',
  borderRadius: 6,
  textDecoration: 'none',
  transition: 'background 0.15s ease',
}
