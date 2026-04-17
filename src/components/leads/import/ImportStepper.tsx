'use client'

import { Check } from 'lucide-react'

const STEPS = [
  'Upload & Aperçu',
  'Mapping & Config',
  'Vérification',
  'Import',
  'Récapitulatif',
]

interface ImportStepperProps {
  currentStep: number
}

export default function ImportStepper({ currentStep }: ImportStepperProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32 }}>
      {STEPS.map((label, index) => {
        const isActive = index === currentStep
        const isDone = index < currentStep
        const isFuture = index > currentStep

        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', flex: index < STEPS.length - 1 ? 1 : undefined }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: '50%',
              fontSize: 13, fontWeight: 600,
              background: isDone ? '#38A169' : isActive ? 'var(--color-primary)' : 'var(--border-primary)',
              color: isFuture ? 'var(--text-muted)' : '#fff',
              flexShrink: 0,
            }}>
              {isDone ? <Check size={16} /> : index + 1}
            </div>
            <span style={{
              marginLeft: 8, fontSize: 13, fontWeight: isActive ? 600 : 400,
              color: isFuture ? 'var(--text-muted)' : isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              whiteSpace: 'nowrap',
            }}>
              {label}
            </span>
            {index < STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 2, marginLeft: 12, marginRight: 12,
                background: isDone ? '#38A169' : 'var(--border-primary)',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
