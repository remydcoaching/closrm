'use client'

import { Check } from 'lucide-react'
import { STEP_LABEL, STEP_ORDER, type StepKey } from './slot-stepper'

interface StepperBarProps {
  active: StepKey
  completed: Record<StepKey, boolean>
  onSelect: (step: StepKey) => void
}

const SUCCESS_COLOR = '#22c55e'
const CIRCLE_SIZE = 32

export default function StepperBar({ active, completed, onSelect }: StepperBarProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '0 8px' }}>
      {STEP_ORDER.map((step, index) => {
        const isActive = step === active
        const isDone = completed[step]
        const isLast = index === STEP_ORDER.length - 1

        // Connecting line: green if left step (current) is complete, gray otherwise
        const lineColor = isDone ? SUCCESS_COLOR : 'var(--border-primary)'

        return (
          <div
            key={step}
            style={{ display: 'flex', alignItems: 'center', flex: isLast ? 0 : 1 }}
          >
            {/* Step node */}
            <div
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}
            >
              {/* Circle */}
              <button
                onClick={() => onSelect(step)}
                aria-label={STEP_LABEL[step]}
                style={{
                  width: CIRCLE_SIZE,
                  height: CIRCLE_SIZE,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  border: isDone
                    ? 'none'
                    : isActive
                    ? `2px solid var(--color-primary)`
                    : `2px solid var(--border-primary)`,
                  background: isDone
                    ? SUCCESS_COLOR
                    : isActive
                    ? 'var(--color-primary)'
                    : 'transparent',
                  transition: 'background 0.2s ease, border-color 0.2s ease',
                  flexShrink: 0,
                }}
              >
                {isDone ? (
                  <Check size={14} style={{ color: '#fff' }} />
                ) : (
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: isActive ? '#fff' : 'var(--text-tertiary)',
                    }}
                  >
                    {index + 1}
                  </span>
                )}
              </button>

              {/* Label */}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: isActive ? 700 : 400,
                  color: isActive ? 'var(--color-primary)' : 'var(--text-tertiary)',
                  whiteSpace: 'nowrap',
                  transition: 'color 0.2s ease',
                }}
              >
                {STEP_LABEL[step]}
              </span>
            </div>

            {/* Connecting line (not rendered after last step) */}
            {!isLast && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  background: lineColor,
                  marginBottom: 18, // align with circle centers (label offset)
                  transition: 'background 0.2s ease',
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
