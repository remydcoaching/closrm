'use client'

import { useEffect, useRef, useState } from 'react'

interface DateTimePickerProps {
  /** YYYY-MM-DD */
  date: string
  /** HH:MM */
  time: string
  onChange: (date: string, time: string) => void
  disabled?: boolean
  /** YYYY-MM-DD — earliest selectable date (inclusive). Default: today. */
  minDate?: string
}

const MONTHS_FR = ['janvier', 'f\u00e9vrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'ao\u00fbt', 'septembre', 'octobre', 'novembre', 'd\u00e9cembre']
const DAYS_FR = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function parseYmd(s: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (!m) return null
  return { year: Number(m[1]), month: Number(m[2]) - 1, day: Number(m[3]) }
}

function formatDisplay(date: string, time: string): string {
  const p = parseYmd(date)
  if (!p) return 'Choisir une date'
  const d = new Date(p.year, p.month, p.day)
  const dayName = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'][d.getDay()]
  return `${dayName} ${p.day} ${MONTHS_FR[p.month]} ${p.year} \u00e0 ${time}`
}

function buildMonthGrid(year: number, month: number): { ymd: string; inMonth: boolean }[] {
  const firstOfMonth = new Date(year, month, 1)
  const offsetMon = (firstOfMonth.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: { ymd: string; inMonth: boolean }[] = []
  const prevDays = new Date(year, month, 0).getDate()
  for (let i = offsetMon - 1; i >= 0; i--) {
    const d = prevDays - i
    const m = month === 0 ? 11 : month - 1
    const y = month === 0 ? year - 1 : year
    cells.push({ ymd: `${y}-${pad(m + 1)}-${pad(d)}`, inMonth: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ ymd: `${year}-${pad(month + 1)}-${pad(d)}`, inMonth: true })
  }
  while (cells.length < 42) {
    const idx = cells.length - offsetMon - daysInMonth + 1
    const m = month === 11 ? 0 : month + 1
    const y = month === 11 ? year + 1 : year
    cells.push({ ymd: `${y}-${pad(m + 1)}-${pad(idx)}`, inMonth: false })
  }
  return cells
}

export default function DateTimePicker({
  date,
  time,
  onChange,
  disabled = false,
  minDate,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState<number>(() => parseYmd(date)?.year ?? new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState<number>(() => parseYmd(date)?.month ?? new Date().getMonth())
  const containerRef = useRef<HTMLDivElement>(null)
  const min = minDate ?? todayYmd()
  const today = todayYmd()

  useEffect(() => {
    const p = parseYmd(date)
    if (p) {
      setViewYear(p.year)
      setViewMonth(p.month)
    }
  }, [date])

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const grid = buildMonthGrid(viewYear, viewMonth)

  function changeMonth(delta: number) {
    let m = viewMonth + delta
    let y = viewYear
    if (m < 0) { m = 11; y -= 1 }
    if (m > 11) { m = 0; y += 1 }
    setViewMonth(m)
    setViewYear(y)
  }

  function pickDay(ymd: string) {
    if (ymd < min) return
    onChange(ymd, time)
  }

  function setTime(t: string) {
    onChange(date, t)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        style={{
          ...triggerStyle,
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
          borderColor: open ? 'var(--color-primary, #06b6d4)' : 'var(--border-primary)',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <CalendarIcon />
          <span>{formatDisplay(date, time)}</span>
        </span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div style={popoverStyle} role="dialog" aria-label="Selection de la date et de l heure">
          <div style={popoverHeaderStyle}>
            <button type="button" onClick={() => changeMonth(-1)} style={navBtnStyle} aria-label="Mois precedent">
              <ArrowLeft />
            </button>
            <div style={monthLabelStyle}>
              {MONTHS_FR[viewMonth]} {viewYear}
            </div>
            <button type="button" onClick={() => changeMonth(1)} style={navBtnStyle} aria-label="Mois suivant">
              <ArrowRight />
            </button>
          </div>

          <div style={dowRowStyle}>
            {DAYS_FR.map((d, i) => (
              <div key={i} style={dowCellStyle}>{d}</div>
            ))}
          </div>

          <div style={gridStyle}>
            {grid.map((cell) => {
              const selected = cell.ymd === date
              const isToday = cell.ymd === today
              const past = cell.ymd < min
              const disabledCell = past
              return (
                <button
                  key={cell.ymd}
                  type="button"
                  onClick={() => pickDay(cell.ymd)}
                  disabled={disabledCell}
                  style={{
                    ...dayCellStyle,
                    color: !cell.inMonth ? 'var(--text-tertiary, #555)' : disabledCell ? 'var(--text-tertiary, #555)' : 'var(--text-primary)',
                    opacity: disabledCell ? 0.35 : 1,
                    cursor: disabledCell ? 'not-allowed' : 'pointer',
                    background: selected
                      ? 'var(--color-primary, #06b6d4)'
                      : isToday
                        ? 'rgba(6, 182, 212, 0.12)'
                        : 'transparent',
                    borderColor: isToday && !selected ? 'rgba(6, 182, 212, 0.5)' : 'transparent',
                    fontWeight: selected || isToday ? 700 : 500,
                  }}
                  onMouseEnter={(e) => {
                    if (!selected && !disabledCell) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!selected && !disabledCell) {
                      e.currentTarget.style.background = isToday ? 'rgba(6, 182, 212, 0.12)' : 'transparent'
                    }
                  }}
                >
                  {Number(cell.ymd.slice(8, 10))}
                </button>
              )
            })}
          </div>

          <div style={timeRowStyle}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary, #888)', letterSpacing: 0.6 }}>HEURE</span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              style={timeInputStyle}
            />
          </div>

          <div style={footerStyle}>
            <button
              type="button"
              onClick={() => {
                onChange(today, time)
                setViewYear(Number(today.slice(0, 4)))
                setViewMonth(Number(today.slice(5, 7)) - 1)
              }}
              style={footerLinkStyle}
            >
              Aujourd&apos;hui
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={footerConfirmStyle}
            >
              Valider
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3.5" width="12" height="11" rx="1.5" />
      <path d="M2 6.5h12M5.5 2v3M10.5 2v3" />
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="6"
      viewBox="0 0 10 6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease', opacity: 0.6 }}
    >
      <path d="M1 1l4 4 4-4" />
    </svg>
  )
}

function ArrowLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3l-5 5 5 5" />
    </svg>
  )
}

function ArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3l5 5-5 5" />
    </svg>
  )
}

const triggerStyle: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 14px',
  fontSize: 13,
  fontWeight: 500,
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-primary)',
  borderRadius: 8,
  outline: 'none',
  textAlign: 'left',
  transition: 'border-color 0.15s ease',
}

const popoverStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 6px)',
  left: 0,
  zIndex: 50,
  width: 256,
  padding: 10,
  background: 'var(--bg-surface, #141414)',
  border: '1px solid var(--border-primary, #262626)',
  borderRadius: 10,
  boxShadow: '0 14px 40px rgba(0, 0, 0, 0.55), 0 2px 8px rgba(0, 0, 0, 0.35)',
}

const popoverHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 4,
  padding: '0 2px',
}

const monthLabelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--text-primary)',
  textTransform: 'capitalize',
  letterSpacing: 0.2,
}

const navBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 24,
  background: 'transparent',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-primary)',
  borderRadius: 5,
  cursor: 'pointer',
}

const dowRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  marginBottom: 2,
}

const dowCellStyle: React.CSSProperties = {
  textAlign: 'center',
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: 0.5,
  color: 'var(--text-tertiary, #888)',
  padding: '4px 0',
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: 1,
}

const dayCellStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 28,
  fontSize: 12,
  border: '1px solid transparent',
  borderRadius: 5,
  outline: 'none',
  transition: 'background-color 0.1s ease',
  background: 'transparent',
  color: 'var(--text-primary)',
}

const timeRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  marginTop: 8,
  padding: '8px 4px 0 6px',
  borderTop: '1px solid var(--border-primary)',
}

const timeInputStyle: React.CSSProperties = {
  width: 100,
  padding: '5px 8px',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: 'inherit',
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-primary)',
  borderRadius: 5,
  outline: 'none',
  colorScheme: 'dark',
  textAlign: 'center',
}

const footerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginTop: 4,
  padding: '0 2px',
}

const footerLinkStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  background: 'transparent',
  border: 'none',
  padding: '5px 2px',
  cursor: 'pointer',
}

const footerConfirmStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#fff',
  background: 'var(--color-primary, #06b6d4)',
  border: 'none',
  padding: '6px 14px',
  borderRadius: 5,
  cursor: 'pointer',
}
