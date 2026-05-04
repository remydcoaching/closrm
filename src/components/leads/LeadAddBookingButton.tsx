'use client'

/**
 * Bouton "Planifier un RDV" pour la fiche/side panel d'un lead.
 *
 * - Au mount, fetch en background les calendars + locations du workspace
 *   (pas de blocage UI : on rend le bouton disponible direct, et on affiche
 *   un mini loader le temps que le data soit prête si l'utilisateur clique
 *   pendant le fetch).
 * - Au clic, ouvre NewBookingModal avec le lead pré-sélectionné.
 *
 * Style : petit bouton secondaire, à intégrer dans une rangée d'actions.
 */
import { useEffect, useState } from 'react'
import { Calendar } from 'lucide-react'
import NewBookingModal from '@/components/agenda/NewBookingModal'
import type { BookingCalendar, BookingLocation, Lead } from '@/types'

interface Props {
  lead: Lead
  /** Style optionnel pour adapter au contexte (side panel vs page). */
  variant?: 'default' | 'small' | 'large'
  onCreated?: () => void
}

function nextHalfHourSlot(): { date: string; time: string } {
  const now = new Date()
  // Round up to next 30min slot, +1h offset pour laisser le temps de prep
  now.setHours(now.getHours() + 1)
  const m = now.getMinutes()
  if (m < 30) now.setMinutes(30, 0, 0)
  else {
    now.setHours(now.getHours() + 1)
    now.setMinutes(0, 0, 0)
  }
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mi = String(now.getMinutes()).padStart(2, '0')
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${mi}` }
}

export default function LeadAddBookingButton({ lead, variant = 'default', onCreated }: Props) {
  const [calendars, setCalendars] = useState<BookingCalendar[]>([])
  const [locations, setLocations] = useState<BookingLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [calRes, locRes] = await Promise.all([
          fetch('/api/booking-calendars'),
          fetch('/api/booking-locations'),
        ])
        if (cancelled) return
        if (calRes.ok) {
          const json = await calRes.json()
          setCalendars(json.data ?? [])
        }
        if (locRes.ok) {
          const json = await locRes.json()
          setLocations(json.data ?? [])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const slot = nextHalfHourSlot()

  const isSmall = variant === 'small'
  const isLarge = variant === 'large'
  const buttonStyle: React.CSSProperties = isLarge
    ? {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '9px 16px',
        borderRadius: 8,
        background: 'var(--color-primary)',
        border: 'none',
        color: '#000',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'all 0.15s',
      }
    : {
        display: 'inline-flex',
        alignItems: 'center',
        gap: isSmall ? 4 : 6,
        padding: isSmall ? '4px 10px' : '6px 12px',
        borderRadius: 8,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-primary)',
        color: 'var(--text-primary)',
        fontSize: isSmall ? 11 : 12,
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'all 0.15s',
      }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={loading}
        title={loading ? 'Chargement des calendriers…' : 'Planifier un RDV pour ce lead'}
        style={{
          ...buttonStyle,
          opacity: loading ? 0.6 : 1,
          cursor: loading ? 'wait' : 'pointer',
        }}
        onMouseEnter={e => {
          if (loading || isLarge) return
          e.currentTarget.style.borderColor = 'var(--color-primary)'
        }}
        onMouseLeave={e => {
          if (isLarge) return
          e.currentTarget.style.borderColor = 'var(--border-primary)'
        }}
      >
        <Calendar size={isSmall ? 12 : isLarge ? 13 : 14} />
        Planifier un RDV
      </button>
      {open && (
        <NewBookingModal
          calendars={calendars}
          locations={locations}
          prefillDate={slot.date}
          prefillTime={slot.time}
          prefillLead={lead}
          onClose={() => setOpen(false)}
          onCreated={() => {
            setOpen(false)
            onCreated?.()
          }}
        />
      )}
    </>
  )
}
