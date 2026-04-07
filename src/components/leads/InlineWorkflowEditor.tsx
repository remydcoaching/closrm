'use client'

import { X, Plus } from 'lucide-react'
import { LeadSource } from '@/types'
import { WorkflowInlineStep, WORKFLOW_TEMPLATES_BY_SOURCE } from '@/lib/leads/workflow-templates'
import { useEffect, useRef } from 'react'

interface InlineWorkflowEditorProps {
  source: LeadSource
  steps: WorkflowInlineStep[]
  onStepsChange: (steps: WorkflowInlineStep[]) => void
}

const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: '#22c55e',
  email: '#3b82f6',
  instagram_dm: '#e879f9',
  manuel: '#6b7280',
}

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  instagram_dm: 'Instagram DM',
  manuel: 'Manuel',
}

const inputStyle = {
  boxSizing: 'border-box' as const,
  padding: '6px 10px',
  background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
  borderRadius: 6, color: 'var(--text-primary)', fontSize: 12, outline: 'none',
}

export default function InlineWorkflowEditor({ source, steps, onStepsChange }: InlineWorkflowEditorProps) {
  const prevSource = useRef(source)

  useEffect(() => {
    if (source !== prevSource.current && steps.length === 0) {
      const templates = WORKFLOW_TEMPLATES_BY_SOURCE[source] ?? []
      if (templates.length > 0) {
        onStepsChange([...templates])
      }
    }
    prevSource.current = source
  }, [source, steps.length, onStepsChange])

  function updateStep(index: number, field: keyof WorkflowInlineStep, value: string | number) {
    const updated = steps.map((s, i) => i === index ? { ...s, [field]: value } : s)
    onStepsChange(updated)
  }

  function removeStep(index: number) {
    onStepsChange(steps.filter((_, i) => i !== index))
  }

  function addStep() {
    onStepsChange([...steps, { channel: 'whatsapp', delay_days: 1, template_text: '' }])
  }

  return (
    <div style={{
      border: '1px solid var(--border-primary)', borderRadius: 10,
      padding: 14, background: 'rgba(20,20,20,0.5)',
    }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
        Etapes du workflow
      </p>

      {steps.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
          Aucune etape. Cliquez ci-dessous pour en ajouter.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {steps.map((step, i) => {
          const color = CHANNEL_COLORS[step.channel] ?? '#6b7280'
          return (
            <div key={i} style={{
              display: 'flex', flexDirection: 'column', gap: 8,
              padding: 10, borderRadius: 8,
              background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Channel badge */}
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                  background: `${color}15`, color, border: `1px solid ${color}30`,
                  whiteSpace: 'nowrap',
                }}>
                  {CHANNEL_LABELS[step.channel] ?? step.channel}
                </span>

                {/* Channel select */}
                <select
                  value={step.channel}
                  onChange={e => updateStep(i, 'channel', e.target.value)}
                  style={{ ...inputStyle, flex: 1, cursor: 'pointer', minWidth: 0 }}
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                  <option value="instagram_dm">Instagram DM</option>
                  <option value="manuel">Manuel</option>
                </select>

                {/* Delay */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>J+</span>
                  <input
                    type="number"
                    min={0}
                    value={step.delay_days}
                    onChange={e => updateStep(i, 'delay_days', parseInt(e.target.value) || 0)}
                    style={{ ...inputStyle, width: 50, textAlign: 'center' }}
                  />
                </div>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => removeStep(i)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', padding: 2, flexShrink: 0,
                  }}
                >
                  <X size={14} />
                </button>
              </div>

              {/* Template text */}
              <textarea
                value={step.template_text}
                onChange={e => updateStep(i, 'template_text', e.target.value)}
                rows={2}
                placeholder="Message template... (variables: {{prenom}}, {{nom}})"
                style={{ ...inputStyle, width: '100%', resize: 'vertical', lineHeight: 1.5 }}
              />
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={addStep}
        style={{
          display: 'flex', alignItems: 'center', gap: 5, marginTop: 10,
          padding: '6px 12px', borderRadius: 7, fontSize: 12,
          border: '1px dashed var(--border-primary)', background: 'transparent',
          color: 'var(--text-muted)', cursor: 'pointer', width: '100%', justifyContent: 'center',
        }}
      >
        <Plus size={13} /> Ajouter une etape
      </button>
    </div>
  )
}
