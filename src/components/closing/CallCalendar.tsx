'use client'

import { useState } from 'react'
import { format, startOfWeek, addDays, isSameDay, isToday, getHours, getMinutes } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Call, Lead } from '@/types'
import CallTypeBadge from './CallTypeBadge'
import { OUTCOME_CONFIG } from './CallOutcomeBadge'

type CallWithLead = Call & { lead: Pick<Lead, 'id' | 'first_name' | 'last_name' | 'phone' | 'email' | 'status'> }

interface Props {
  calls: CallWithLead[]
  loading: boolean
  onCallClick: (call: CallWithLead) => void
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 8) // 8h - 21h

export default function CallCalendar({ calls, loading, onCallClick }: Props) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  if (loading) return <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-label)' }}>Chargement...</div>

  return (
    <div>
      {/* Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setWeekStart(addDays(weekStart, -7))} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-primary)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={16} color="#888" />
          </button>
          <button onClick={() => setWeekStart(addDays(weekStart, 7))} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-primary)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChevronRight size={16} color="#888" />
          </button>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginLeft: 8 }}>
            {format(weekStart, 'd', { locale: fr })} - {format(addDays(weekStart, 6), 'd MMMM yyyy', { locale: fr })}
          </span>
        </div>
        <button onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border-primary)', background: 'transparent', color: 'var(--text-tertiary)', fontSize: 12, cursor: 'pointer' }}>
          Aujourd&apos;hui
        </button>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '50px repeat(7, 1fr)', border: '1px solid var(--border-primary)', borderRadius: 12, overflow: 'hidden' }}>
        {/* Header row */}
        <div style={{ background: 'var(--bg-input)', padding: 8, borderBottom: '1px solid var(--border-primary)' }} />
        {days.map((day) => {
          const today = isToday(day)
          return (
            <div key={day.toISOString()} style={{
              background: today ? 'rgba(0,200,83,0.04)' : 'var(--bg-input)',
              padding: '8px 6px', borderBottom: '1px solid var(--border-primary)',
              borderLeft: '1px solid var(--bg-hover)', textAlign: 'center',
            }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' as const }}>{format(day, 'EEE', { locale: fr })}</div>
              <div style={{ fontSize: 16, fontWeight: today ? 700 : 500, color: today ? 'var(--color-primary)' : 'var(--text-primary)', marginTop: 2 }}>{format(day, 'd')}</div>
            </div>
          )
        })}

        {/* Hour rows */}
        {HOURS.map((hour) => (
          <>
            <div key={`h-${hour}`} style={{ padding: '4px 6px', fontSize: 10, color: 'var(--text-label)', textAlign: 'right', borderBottom: '1px solid var(--bg-hover)', minHeight: 48, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end' }}>
              {hour}h
            </div>
            {days.map((day) => {
              const dayCalls = calls.filter((c) => {
                const d = new Date(c.scheduled_at)
                return isSameDay(d, day) && getHours(d) === hour
              })
              return (
                <div key={`${day.toISOString()}-${hour}`} style={{
                  borderLeft: '1px solid var(--bg-hover)',
                  borderBottom: '1px solid var(--bg-hover)',
                  padding: 2, minHeight: 48,
                  background: isToday(day) ? 'rgba(0,200,83,0.02)' : 'transparent',
                }}>
                  {dayCalls.map((call) => {
                    const oc = OUTCOME_CONFIG[call.outcome]
                    return (
                      <div key={call.id} onClick={() => onCallClick(call)} style={{
                        background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
                        borderLeft: `3px solid ${oc.color}`, borderRadius: 6, padding: '4px 6px',
                        marginBottom: 2, cursor: 'pointer', fontSize: 10,
                      }}>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                          {format(new Date(call.scheduled_at), "HH'h'mm")} — {call.lead.first_name}
                        </div>
                        <div style={{ marginTop: 2 }}>
                          <CallTypeBadge type={call.type} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </>
        ))}
      </div>
    </div>
  )
}
