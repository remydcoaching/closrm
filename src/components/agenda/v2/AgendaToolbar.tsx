'use client'

/**
 * Toolbar agenda v2 — Phase 3a minimaliste :
 *  [Jour | Semaine | Mois]   ← prev   Aujourd'hui   suivant →     <titre période>
 *
 * Day et Month sont visibles mais désactivés en Phase 3a (les vues n'existent
 * pas encore). On les active en Phase 4.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react'

export type AgendaViewMode = 'day' | 'week' | 'month'

const LABELS: Record<AgendaViewMode, string> = {
  day: 'Jour',
  week: 'Semaine',
  month: 'Mois',
}

interface AgendaToolbarProps {
  viewMode: AgendaViewMode
  onViewModeChange: (mode: AgendaViewMode) => void
  /** Modes désactivés (rendu greyed out, click ignoré). Phase 3a : ['day', 'month']. */
  disabledModes?: AgendaViewMode[]
  periodLabel: string
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}

export function AgendaToolbar({
  viewMode,
  onViewModeChange,
  disabledModes = [],
  periodLabel,
  onPrev,
  onNext,
  onToday,
}: AgendaToolbarProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 20px',
        height: 56,
        borderBottom: '1px solid var(--agenda-grid-line-strong)',
        background: 'var(--bg-primary)',
        flexShrink: 0,
      }}
    >
      {/* View mode pill group */}
      <div
        style={{
          display: 'flex',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-secondary)',
          borderRadius: 8,
          padding: 3,
          gap: 2,
        }}
      >
        {(['day', 'week', 'month'] as AgendaViewMode[]).map((mode) => {
          const active = viewMode === mode
          const disabled = disabledModes.includes(mode)
          return (
            <button
              key={mode}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onViewModeChange(mode)}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: 'none',
                background: active ? 'var(--border-secondary)' : 'transparent',
                color: disabled
                  ? 'var(--text-disabled)'
                  : active
                    ? 'var(--text-primary)'
                    : 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                transition: 'all 0.15s',
              }}
              aria-disabled={disabled}
            >
              {LABELS[mode]}
            </button>
          )
        })}
      </div>

      {/* Nav prev / today / next */}
      <button
        type="button"
        onClick={onPrev}
        aria-label="Précédent"
        style={navBtnStyle}
      >
        <ChevronLeft size={16} />
      </button>
      <button
        type="button"
        onClick={onToday}
        style={{
          padding: '5px 12px',
          borderRadius: 6,
          border: '1px solid var(--border-secondary)',
          background: 'transparent',
          color: 'var(--text-secondary)',
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        Aujourd&apos;hui
      </button>
      <button
        type="button"
        onClick={onNext}
        aria-label="Suivant"
        style={navBtnStyle}
      >
        <ChevronRight size={16} />
      </button>

      {/* Titre période */}
      <span
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--text-primary)',
          textTransform: 'capitalize',
          flex: 1,
        }}
      >
        {periodLabel}
      </span>

      {/* Badge v2 — pour bien identifier qu'on est sur la nouvelle version */}
      <span
        style={{
          padding: '2px 8px',
          borderRadius: 4,
          background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
          color: 'var(--color-primary)',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}
      >
        Beta v2
      </span>
    </div>
  )
}

const navBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--border-secondary)',
  borderRadius: 6,
  cursor: 'pointer',
  color: 'var(--text-secondary)',
  display: 'flex',
  alignItems: 'center',
  padding: '5px 6px',
}
