'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { parseISO, differenceInMinutes, format } from 'date-fns'
import { Bell, BellOff, ChevronDown } from 'lucide-react'
import { BookingWithCalendar } from '@/types'

const REMINDER_OPTIONS = [
  { label: '5 min avant', value: 5 },
  { label: '10 min avant', value: 10 },
  { label: '15 min avant', value: 15 },
  { label: '30 min avant', value: 30 },
  { label: '1 heure avant', value: 60 },
]

const LS_KEY_ENABLED = 'closrm-notif-enabled'
const LS_KEY_REMINDER = 'closrm-notif-reminder'

interface BookingNotificationsProps {
  bookings: BookingWithCalendar[]
}

export function BookingNotifications({ bookings }: BookingNotificationsProps) {
  const [enabled, setEnabled] = useState(false)
  const [reminderMinutes, setReminderMinutes] = useState(15)
  const [showDropdown, setShowDropdown] = useState(false)
  const [permissionState, setPermissionState] = useState<NotificationPermission | 'default'>('default')
  const notifiedRef = useRef<Set<string>>(new Set())

  // Load preferences from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    const savedEnabled = localStorage.getItem(LS_KEY_ENABLED)
    const savedReminder = localStorage.getItem(LS_KEY_REMINDER)
    if (savedEnabled === 'true') setEnabled(true)
    if (savedReminder) setReminderMinutes(parseInt(savedReminder, 10))
    if ('Notification' in window) {
      setPermissionState(Notification.permission)
    }
  }, [])

  // Request permission when enabling
  const toggleEnabled = useCallback(async () => {
    if (!enabled) {
      if (!('Notification' in window)) return
      const perm = await Notification.requestPermission()
      setPermissionState(perm)
      if (perm === 'granted') {
        setEnabled(true)
        localStorage.setItem(LS_KEY_ENABLED, 'true')
      }
    } else {
      setEnabled(false)
      localStorage.setItem(LS_KEY_ENABLED, 'false')
    }
  }, [enabled])

  const changeReminder = useCallback((value: number) => {
    setReminderMinutes(value)
    localStorage.setItem(LS_KEY_REMINDER, String(value))
    setShowDropdown(false)
  }, [])

  // Check bookings every minute
  useEffect(() => {
    if (!enabled || permissionState !== 'granted') return

    function check() {
      const now = new Date()
      for (const booking of bookings) {
        if (notifiedRef.current.has(booking.id)) continue
        const scheduledAt = parseISO(booking.scheduled_at)
        const diff = differenceInMinutes(scheduledAt, now)
        // Notify if within the reminder window but not already past
        if (diff >= 0 && diff <= reminderMinutes) {
          notifiedRef.current.add(booking.id)
          const timeStr = format(scheduledAt, 'HH:mm')
          const leadName = booking.lead
            ? `${booking.lead.first_name} ${booking.lead.last_name}`.trim()
            : null
          const body = leadName
            ? `${booking.title} a ${timeStr} avec ${leadName}`
            : `${booking.title} a ${timeStr}`
          new Notification('Rappel RDV', { body, icon: '/favicon.ico' })
        }
      }
    }

    check()
    const interval = setInterval(check, 60_000)
    return () => clearInterval(interval)
  }, [enabled, permissionState, bookings, reminderMinutes])

  const Icon = enabled ? Bell : BellOff

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={toggleEnabled}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 10px',
          borderRadius: 6,
          border: `1px solid ${enabled ? 'var(--color-primary, #E53E3E)' : 'var(--border-secondary)'}`,
          background: enabled ? 'rgba(229,62,62,0.1)' : 'transparent',
          color: enabled ? 'var(--color-primary, #E53E3E)' : 'var(--text-secondary)',
          fontSize: 12,
          cursor: 'pointer',
        }}
        title={enabled ? 'Désactiver les notifications' : 'Activer les notifications'}
      >
        <Icon size={14} />
        {enabled && (
          <span
            onClick={(e) => {
              e.stopPropagation()
              setShowDropdown((v) => !v)
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }}
          >
            {reminderMinutes < 60 ? `${reminderMinutes}min` : '1h'}
            <ChevronDown size={12} />
          </span>
        )}
      </button>

      {showDropdown && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            width: 160,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-secondary)',
            borderRadius: 8,
            padding: 4,
            zIndex: 20,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          {REMINDER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => changeReminder(opt.value)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '6px 10px',
                background: opt.value === reminderMinutes ? 'rgba(229,62,62,0.1)' : 'transparent',
                border: 'none',
                borderRadius: 6,
                color: opt.value === reminderMinutes ? 'var(--color-primary, #E53E3E)' : 'var(--text-primary)',
                fontSize: 12,
                fontWeight: opt.value === reminderMinutes ? 600 : 400,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                if (opt.value !== reminderMinutes) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover, rgba(255,255,255,0.05))'
              }}
              onMouseLeave={(e) => {
                if (opt.value !== reminderMinutes) (e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
