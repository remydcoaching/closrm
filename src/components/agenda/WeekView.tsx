'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { startOfWeek, addDays, isToday, format, differenceInCalendarDays, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { BookingWithCalendar } from '@/types'
import { BookingBlock } from './BookingBlock'
import {
  getBookingSegmentsForDay,
  isAllDayBooking,
  type BookingDaySegment,
} from '@/lib/bookings/multi-day'

interface WeekViewProps {
  date: Date
  bookings: BookingWithCalendar[]
  onBookingClick: (booking: BookingWithCalendar) => void
  onSlotSelect: (date: Date, startHour: number, endHour: number) => void
  onBookingDrop?: (bookingId: string, newDate: Date, newHour: number) => void
}

const CELL_HEIGHT = 60
const START_HOUR = 7
const END_HOUR = 21
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR)
const TOTAL_HEIGHT = HOURS.length * CELL_HEIGHT
const HALF_SLOTS = HOURS.flatMap((h) => [h, h + 0.5])

function getSegmentPosition(seg: BookingDaySegment) {
  // Clamp les bornes à la fenêtre visible [START_HOUR, END_HOUR] : pour un
  // bloc "vacances 5 jours" qui démarre à minuit, sans clamp le top serait
  // négatif (au-dessus de la grille) — on le coupe à 7h pour qu'il occupe
  // visiblement toute la colonne du jour.
  const visStart = Math.max(seg.startHour, START_HOUR)
  const visEnd = Math.min(seg.endHour, END_HOUR)
  const top = (visStart - START_HOUR) * CELL_HEIGHT
  const height = Math.max((visEnd - visStart) * CELL_HEIGHT, 20)
  return { top, height }
}

/**
 * Résout les chevauchements sur les segments d'une même journée. Pour un
 * booking multi-jours, c'est son segment clampé du jour courant qui est
 * comparé — pas la durée totale du booking d'origine — sinon une vacance
 * de 5 jours ferait s'aligner tous les autres événements en colonne sur 5
 * jours, ce qui n'a aucun sens visuellement.
 */
function resolveOverlaps(
  segments: BookingDaySegment[],
): (BookingDaySegment & { col: number; totalCols: number })[] {
  if (segments.length === 0) return []
  const sorted = [...segments].sort((a, b) => a.startHour - b.startHour)
  const result: (BookingDaySegment & { col: number; totalCols: number })[] = []
  const groups: BookingDaySegment[][] = []

  for (const s of sorted) {
    let placed = false
    for (const group of groups) {
      const lastInGroup = group[group.length - 1]
      if (s.startHour >= lastInGroup.endHour) {
        group.push(s)
        placed = true
        break
      }
    }
    if (!placed) groups.push([s])
  }

  const totalCols = groups.length
  for (let col = 0; col < groups.length; col++) {
    for (const s of groups[col]) {
      result.push({ ...s, col, totalCols })
    }
  }
  return result
}

interface DragState {
  dayIdx: number
  startSlot: number // e.g. 10, 10.5, 11
  currentSlot: number
}

export function WeekView({ date, bookings, onBookingClick, onSlotSelect, onBookingDrop }: WeekViewProps) {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 })
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  // Sépare évènements "toute la journée" / multi-jours pour les rendre dans
  // une lane horizontale en haut (à la Google Calendar) plutôt qu'en colonne
  // dans la grille horaire — l'ancien rendu colonne mangeait toute la place
  // sur 1 seul jour, ce qui n'avait aucun sens visuel.
  const allDayBookings = bookings.filter(isAllDayBooking)
  const hourlyBookings = bookings.filter((b) => !isAllDayBooking(b))
  const [drag, setDrag] = useState<DragState | null>(null)
  const isDragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Current time indicator
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(interval)
  }, [])

  // Auto-scroll to current time on mount
  useEffect(() => {
    if (containerRef.current) {
      const currentHour = new Date().getHours()
      const scrollTop = Math.max((currentHour - START_HOUR - 1) * CELL_HEIGHT, 0)
      containerRef.current.scrollTop = scrollTop
    }
  }, [])

  const todayIndex = days.findIndex((d) => isToday(d))
  const currentTimeTop = todayIndex >= 0
    ? (now.getHours() - START_HOUR) * CELL_HEIGHT + (now.getMinutes() / 60) * CELL_HEIGHT
    : -1

  const GRID_BORDER = '1px solid var(--agenda-grid-border, rgba(128,128,128,0.15))'
  const HOUR_COL_WIDTH = 72

  const handleMouseDown = useCallback((dayIdx: number, slot: number) => {
    isDragging.current = true
    setDrag({ dayIdx, startSlot: slot, currentSlot: slot })
  }, [])

  const handleMouseEnter = useCallback((dayIdx: number, slot: number) => {
    if (!isDragging.current || !drag) return
    if (dayIdx !== drag.dayIdx) return // only drag within same day
    setDrag((prev) => prev ? { ...prev, currentSlot: slot } : null)
  }, [drag])

  const handleMouseUp = useCallback(() => {
    if (!isDragging.current || !drag) {
      isDragging.current = false
      setDrag(null)
      return
    }
    isDragging.current = false
    const start = Math.min(drag.startSlot, drag.currentSlot)
    const end = Math.max(drag.startSlot, drag.currentSlot) + 0.5 // end is exclusive, add 30min
    setDrag(null)
    onSlotSelect(days[drag.dayIdx], start, end)
  }, [drag, days, onSlotSelect])

  // Check if a half-slot is within the drag selection
  function isSlotInDrag(dayIdx: number, slot: number): boolean {
    if (!drag || dayIdx !== drag.dayIdx) return false
    const start = Math.min(drag.startSlot, drag.currentSlot)
    const end = Math.max(drag.startSlot, drag.currentSlot)
    return slot >= start && slot <= end
  }

  return (
    <div
      ref={containerRef}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto', position: 'relative', userSelect: 'none' }}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { if (isDragging.current) handleMouseUp() }}
    >
      {/* Sticky header */}
      <div style={{
        display: 'grid', gridTemplateColumns: `${HOUR_COL_WIDTH}px repeat(7, 1fr)`,
        borderBottom: '2px solid var(--border-secondary)', position: 'sticky', top: 0,
        zIndex: 5, background: 'var(--bg-primary)',
      }}>
        <div style={{ borderRight: GRID_BORDER }} />
        {days.map((day) => {
          const today = isToday(day)
          return (
            <div key={day.toISOString()} style={{
              textAlign: 'center', padding: '10px 0 8px',
              borderRight: GRID_BORDER,
              background: today ? 'color-mix(in srgb, var(--color-primary) 6%, transparent)' : 'transparent',
            }}>
              <div style={{
                fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em',
                color: today ? 'var(--color-primary)' : 'var(--text-secondary)',
              }}>
                {format(day, 'EEE', { locale: fr })}
              </div>
              <div style={{
                width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '4px auto 0', fontSize: 16, fontWeight: 600,
                background: today ? 'var(--color-primary)' : 'transparent',
                color: today ? '#fff' : 'var(--text-primary)',
              }}>
                {format(day, 'd')}
              </div>
            </div>
          )
        })}
      </div>

      {/* Lane "Toute la journée" — bookings multi-jours en barres horizontales,
          à la Google Calendar. On utilise un layout flex simple (pas sticky,
          pas de grid) pour éviter tout problème de positionnement / overlap. */}
      {allDayBookings.length > 0 && (
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-secondary)',
          background: 'var(--bg-primary)',
          minHeight: 32,
        }}>
          {/* Label gauche */}
          <div style={{
            width: HOUR_COL_WIDTH,
            flexShrink: 0,
            borderRight: GRID_BORDER,
            padding: '6px 10px 6px 0',
            fontSize: 10, color: 'var(--text-tertiary)',
            textTransform: 'uppercase', letterSpacing: '0.05em',
            lineHeight: 1.2, textAlign: 'right',
          }}>
            Toute la<br/>journée
          </div>
          {/* Bandeau qui contient les 7 colonnes jours + les barres absolument
              positionnées. Les barres span horizontalement via left/width en %
              calculés depuis l'index du jour. */}
          <div style={{
            flex: 1,
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            padding: '4px 0',
            minHeight: 24,
          }}>
            {/* Lignes verticales pour chaque colonne jour */}
            {days.map((day) => (
              <div key={day.toISOString()} style={{
                borderRight: GRID_BORDER,
                minHeight: 24,
              }} />
            ))}
            {/* Bars all-day, stackées verticalement */}
            <div style={{
              position: 'absolute',
              inset: '4px 0',
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              pointerEvents: 'none',
            }}>
              {allDayBookings.map((b) => {
                const start = parseISO(b.scheduled_at)
                const end = new Date(start.getTime() + b.duration_minutes * 60_000)
                const startIdx = differenceInCalendarDays(start, weekStart)
                const lastDayIdx = differenceInCalendarDays(new Date(end.getTime() - 1), weekStart)
                const visStart = Math.max(0, startIdx)
                const visEnd = Math.min(6, lastDayIdx)
                if (visStart > 6 || visEnd < 0) return null
                const span = Math.max(1, visEnd - visStart + 1)
                const leftPct = (visStart / 7) * 100
                const widthPct = (span / 7) * 100
                const color = b.is_personal
                  ? (b.form_data?.color as string) || '#6b7280'
                  : b.booking_calendar?.color || '#3b82f6'
                const displayTitle = b.is_personal
                  ? b.title
                  : (b.lead ? `${b.lead.first_name} ${b.lead.last_name}`.trim() : b.title)
                const isFree = b.blocks_availability === false
                const bg = isFree
                  ? `repeating-linear-gradient(135deg, ${color}33 0 8px, ${color}10 8px 16px)`
                  : `${color}33`
                return (
                  <div
                    key={b.id}
                    onClick={() => onBookingClick(b)}
                    style={{
                      position: 'relative',
                      marginLeft: `${leftPct}%`,
                      width: `calc(${widthPct}% - 6px)`,
                      height: 22,
                      background: bg,
                      borderLeft: `3px ${isFree ? 'dashed' : 'solid'} ${color}`,
                      color: 'var(--text-primary)',
                      fontSize: 12, fontWeight: 600,
                      padding: '2px 10px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      pointerEvents: 'auto',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      lineHeight: '18px',
                    }}
                    title={displayTitle}
                  >
                    {displayTitle}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Time grid + bookings overlay */}
      <div style={{ position: 'relative' }}>
        {/* Grid lines */}
        <div style={{ display: 'grid', gridTemplateColumns: `${HOUR_COL_WIDTH}px repeat(7, 1fr)` }}>
          {HOURS.map((hour) => (
            <div key={hour} style={{ display: 'contents' }}>
              <div style={{
                height: CELL_HEIGHT, textAlign: 'right', fontSize: 11, fontWeight: 500,
                color: 'var(--text-secondary)', borderRight: GRID_BORDER,
                position: 'relative',
              }}>
                <span style={{ position: 'absolute', top: -8, right: 10, lineHeight: 1, background: 'var(--bg-primary)', paddingTop: 2, paddingBottom: 2 }}>
                  {String(hour).padStart(2, '0')}:00
                </span>
              </div>
              {days.map((day, dayIdx) => (
                <div
                  key={`${day.toISOString()}-${hour}`}
                  style={{
                    height: CELL_HEIGHT, position: 'relative', cursor: 'pointer',
                    borderRight: GRID_BORDER,
                    borderBottom: GRID_BORDER,
                  }}
                >
                  {/* Top half — :00 */}
                  <div
                    onMouseDown={() => handleMouseDown(dayIdx, hour)}
                    onMouseEnter={() => handleMouseEnter(dayIdx, hour)}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
                    onDrop={(e) => {
                      e.preventDefault()
                      const bookingId = e.dataTransfer.getData('bookingId')
                      if (bookingId && onBookingDrop) onBookingDrop(bookingId, days[dayIdx], hour)
                    }}
                    style={{
                      height: '50%',
                      borderBottom: '1px dashed rgba(128,128,128,0.08)',
                      background: isSlotInDrag(dayIdx, hour)
                        ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)'
                        : 'transparent',
                      transition: 'background 0.05s',
                    }}
                  />
                  {/* Bottom half — :30 */}
                  <div
                    onMouseDown={() => handleMouseDown(dayIdx, hour + 0.5)}
                    onMouseEnter={() => handleMouseEnter(dayIdx, hour + 0.5)}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
                    onDrop={(e) => {
                      e.preventDefault()
                      const bookingId = e.dataTransfer.getData('bookingId')
                      if (bookingId && onBookingDrop) onBookingDrop(bookingId, days[dayIdx], hour + 0.5)
                    }}
                    style={{
                      height: '50%',
                      background: isSlotInDrag(dayIdx, hour + 0.5)
                        ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)'
                        : 'transparent',
                      transition: 'background 0.05s',
                    }}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Bookings overlay */}
        <div style={{
          position: 'absolute', top: 0, left: HOUR_COL_WIDTH, right: 0, bottom: 0,
          pointerEvents: 'none', height: TOTAL_HEIGHT,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', height: '100%' }}>
            {days.map((day, dayIdx) => {
              // Segments des bookings horaires (les multi-jours/all-day sont
              // déjà rendus dans la lane en haut — on les exclut ici).
              const segments = getBookingSegmentsForDay(hourlyBookings, day)
              const positioned = resolveOverlaps(segments)
              return (
                <div key={day.toISOString()} style={{ position: 'relative', pointerEvents: 'none' }}>
                  {positioned.map((seg) => {
                    const pos = getSegmentPosition(seg)
                    const width = 100 / seg.totalCols
                    const left = width * seg.col
                    // Pour les jours intermédiaires d'un booking multi-jours,
                    // on suffixe le titre par "(suite)" pour que le coach voie
                    // que le bloc continue. Le booking original est passé tel
                    // quel à BookingBlock pour conserver le onClick correct.
                    const isContinuation = !seg.isFirstDay
                    const displayBooking = isContinuation
                      ? { ...seg.booking, title: `${seg.booking.title} (suite)` }
                      : seg.booking
                    return (
                      <BookingBlock
                        key={`${seg.booking.id}-${day.toISOString()}`}
                        booking={displayBooking}
                        onClick={() => onBookingClick(seg.booking)}
                        style={{
                          top: pos.top,
                          height: pos.height,
                          left: `${left}%`,
                          width: `calc(${width}% - 4px)`,
                        }}
                      />
                    )
                  })}
                  {/* Current time indicator — only on today's column */}
                  {dayIdx === todayIndex && currentTimeTop >= 0 && currentTimeTop <= TOTAL_HEIGHT && (
                    <div
                      style={{
                        position: 'absolute',
                        top: currentTimeTop,
                        left: 0,
                        right: 0,
                        pointerEvents: 'none',
                        zIndex: 4,
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          top: -5,
                          left: -5,
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: 'var(--color-primary)',
                        }}
                      />
                      <div
                        style={{
                          height: 2,
                          background: 'var(--color-primary)',
                          width: '100%',
                        }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
