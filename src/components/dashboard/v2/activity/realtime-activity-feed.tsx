'use client'

import { useEffect, useState } from 'react'
import { UserPlus, CalendarPlus, PhoneCall, Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ActivityEventV2 } from '@/lib/dashboard/v2-queries'

const ICONS = {
  new_lead: UserPlus,
  new_booking: CalendarPlus,
  call_done: PhoneCall,
  deal_closed: Trophy,
  follow_up_done: PhoneCall,
} as const

const COLORS = {
  new_lead: 'var(--color-primary)',
  new_booking: '#3b82f6',
  call_done: '#a855f7',
  deal_closed: 'var(--color-success)',
  follow_up_done: 'var(--text-muted)',
} as const

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `il y a ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `il y a ${hrs}h`
  return `il y a ${Math.floor(hrs / 24)}j`
}

export default function RealtimeActivityFeed({
  workspaceId,
  initialEvents,
}: {
  workspaceId: string
  initialEvents: ActivityEventV2[]
}) {
  const [events, setEvents] = useState<ActivityEventV2[]>(initialEvents)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`dashboard-activity-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'leads',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        payload => {
          const l = payload.new as {
            id: string
            first_name: string
            last_name: string
            source: string | null
            created_at: string
          }
          const ev: ActivityEventV2 = {
            id: `l-${l.id}`,
            type: 'new_lead',
            description: `${l.first_name} ${l.last_name} ajouté(e) (${(l.source ?? 'manuel').replaceAll('_', ' ')})`,
            created_at: l.created_at,
          }
          setEvents(prev => [ev, ...prev].slice(0, 20))
          setNewIds(prev => new Set([...prev, ev.id]))
          setTimeout(() => {
            setNewIds(prev => {
              const n = new Set(prev)
              n.delete(ev.id)
              return n
            })
          }, 4000)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bookings',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        async payload => {
          const b = payload.new as { id: string; lead_id: string; created_at: string }
          const { data: lead } = await supabase
            .from('leads')
            .select('first_name, last_name')
            .eq('id', b.lead_id)
            .single()
          if (!lead) return
          const ev: ActivityEventV2 = {
            id: `b-${b.id}`,
            type: 'new_booking',
            description: `${lead.first_name} ${lead.last_name} a réservé un RDV`,
            created_at: b.created_at,
          }
          setEvents(prev => [ev, ...prev].slice(0, 20))
          setNewIds(prev => new Set([...prev, ev.id]))
          setTimeout(() => {
            setNewIds(prev => {
              const n = new Set(prev)
              n.delete(ev.id)
              return n
            })
          }, 4000)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [workspaceId])

  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 12,
        padding: 20,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--text-label)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginBottom: 12,
        }}
      >
        Activité récente
      </div>
      {events.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucune activité récente</div>
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
          {events.map(ev => {
            const Icon = ICONS[ev.type]
            const isNew = newIds.has(ev.id)
            return (
              <li
                key={ev.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 6,
                  background: isNew ? 'var(--bg-active)' : 'transparent',
                  transition: 'background 0.5s ease',
                }}
              >
                <Icon size={14} style={{ color: COLORS[ev.type], flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>
                  {ev.description}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {timeAgo(ev.created_at)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
