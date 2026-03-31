'use client'

import { useState, useEffect } from 'react'
import type { WorkflowStep, EmailTemplate } from '@/types'

interface SequenceStep {
  step_type: 'action' | 'delay'
  action_type?: string
  action_config: Record<string, unknown>
  delay_value?: number
  delay_unit?: string
}

interface Props {
  steps: SequenceStep[]
  onChange: (steps: SequenceStep[]) => void
}

export default function SequenceTimeline({ steps, onChange }: Props) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])

  useEffect(() => {
    fetch('/api/emails/templates').then(r => r.json()).then(d => setTemplates(Array.isArray(d) ? d : []))
  }, [])

  function addEmailStep() {
    const newSteps = [...steps]
    if (newSteps.length > 0) {
      // Add delay before new email
      newSteps.push({ step_type: 'delay', delay_value: 1, delay_unit: 'days', action_config: {} })
    }
    newSteps.push({
      step_type: 'action',
      action_type: 'send_email',
      action_config: { template_id: '' },
    })
    onChange(newSteps)
  }

  function updateStep(index: number, updates: Partial<SequenceStep>) {
    const newSteps = steps.map((s, i) => i === index ? { ...s, ...updates } : s)
    onChange(newSteps)
  }

  function removeStep(index: number) {
    const newSteps = [...steps]
    // If removing an email step, also remove the preceding delay
    if (newSteps[index].step_type === 'action' && index > 0 && newSteps[index - 1].step_type === 'delay') {
      newSteps.splice(index - 1, 2)
    } else {
      newSteps.splice(index, 1)
    }
    onChange(newSteps)
  }

  const emailStepCount = steps.filter(s => s.step_type === 'action').length

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {steps.map((step, i) => (
          <div key={i}>
            {step.step_type === 'delay' ? (
              // Delay connector
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '8px 0 8px 20px',
              }}>
                <div style={{
                  width: 2, height: 24, background: '#333',
                  marginLeft: 10,
                }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: '#666' }}>Attendre</span>
                  <input
                    type="number"
                    min={1}
                    value={step.delay_value || 1}
                    onChange={e => updateStep(i, { delay_value: Number(e.target.value) })}
                    style={{
                      width: 50, padding: '4px 6px', fontSize: 12,
                      background: '#0a0a0a', border: '1px solid #333', borderRadius: 6,
                      color: '#fff', outline: 'none', textAlign: 'center',
                    }}
                  />
                  <select
                    value={step.delay_unit || 'days'}
                    onChange={e => updateStep(i, { delay_unit: e.target.value })}
                    style={{
                      padding: '4px 8px', fontSize: 12,
                      background: '#0a0a0a', border: '1px solid #333', borderRadius: 6,
                      color: '#fff', outline: 'none',
                    }}
                  >
                    <option value="minutes">min</option>
                    <option value="hours">heures</option>
                    <option value="days">jours</option>
                  </select>
                </div>
              </div>
            ) : (
              // Email step
              <div style={{
                background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 10,
                padding: '12px 16px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>
                    Email {steps.filter((s, j) => j <= i && s.step_type === 'action').length}
                  </span>
                  {emailStepCount > 1 && (
                    <button onClick={() => removeStep(i)} style={{
                      fontSize: 11, color: '#555', background: 'none', border: 'none', cursor: 'pointer',
                    }}>
                      Supprimer
                    </button>
                  )}
                </div>
                <select
                  value={(step.action_config?.template_id as string) || ''}
                  onChange={e => updateStep(i, {
                    action_config: { ...step.action_config, template_id: e.target.value },
                  })}
                  style={{
                    width: '100%', padding: '8px 10px', fontSize: 13,
                    background: '#0a0a0a', border: '1px solid #333', borderRadius: 8,
                    color: '#fff', outline: 'none',
                  }}
                >
                  <option value="">Choisir un template...</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name} — {t.subject || 'Sans sujet'}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        ))}
      </div>

      <button onClick={addEmailStep} style={{
        marginTop: 12, padding: '8px 18px', fontSize: 13, fontWeight: 500,
        background: '#1a1a1a', color: '#aaa', border: '1px solid #333',
        borderRadius: 8, cursor: 'pointer', width: '100%',
      }}>
        + Ajouter un email
      </button>
    </div>
  )
}
