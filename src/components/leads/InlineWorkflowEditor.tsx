'use client'

import { useState } from 'react'
import { X, RotateCcw, MessageCircle, Plus, Check } from 'lucide-react'
import { LeadSource } from '@/types'
import { WorkflowInlineStep } from '@/lib/leads/workflow-templates'

interface Props {
  source: LeadSource
  steps: WorkflowInlineStep[]
  onStepsChange: (steps: WorkflowInlineStep[]) => void
}

const CHANNEL_FOR_SOURCE: Record<string, 'whatsapp' | 'email' | 'instagram_dm' | 'manuel'> = {
  instagram_ads: 'instagram_dm',
  follow_ads: 'instagram_dm',
  facebook_ads: 'whatsapp',
  formulaire: 'email',
  funnel: 'email',
  manuel: 'manuel',
}

export default function InlineWorkflowEditor({ source, steps, onStepsChange }: Props) {
  const [relanceDays, setRelanceDays] = useState<number | null>(null)
  const [relanceCustom, setRelanceCustom] = useState(5)
  const [relanceReason, setRelanceReason] = useState('')
  const [nurturingDays, setNurturingDays] = useState<number | null>(null)
  const [nurturingCustom, setNurturingCustom] = useState(45)
  const [nurturingReason, setNurturingReason] = useState('')

  const defaultChannel = CHANNEL_FOR_SOURCE[source] ?? 'manuel'

  function addRelance() {
    const d = relanceDays === -1 ? relanceCustom : relanceDays
    if (!d) return
    onStepsChange([...steps, { channel: defaultChannel, delay_days: d, template_text: relanceReason || `Relance J+${d}` }])
    setRelanceDays(null)
    setRelanceReason('')
  }

  function addNurturing() {
    const d = nurturingDays === -1 ? nurturingCustom : nurturingDays
    if (!d) return
    onStepsChange([...steps, { channel: defaultChannel, delay_days: d, template_text: nurturingReason || `Nurturing J+${d}` }])
    setNurturingDays(null)
    setNurturingReason('')
  }

  function removeStep(index: number) {
    onStepsChange(steps.filter((_, i) => i !== index))
  }

  const inputS: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '8px 12px',
    background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
    borderRadius: 10, color: 'var(--text-primary)', fontSize: 12, outline: 'none',
  }

  function Chip({ label, active, color, onClick }: { label: string; active: boolean; color: string; onClick: () => void }) {
    const [hovered, setHovered] = useState(false)
    return (
      <button type="button" onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{
        padding: '7px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
        border: active ? `2px solid ${color}` : `1px solid ${hovered ? color + '60' : 'var(--border-primary)'}`,
        background: active ? `${color}15` : hovered ? `${color}08` : 'transparent',
        color: active ? color : hovered ? color : 'var(--text-tertiary)',
        transition: 'all 0.2s',
        boxShadow: active ? `0 0 12px ${color}20` : 'none',
      }}>
        {label}
      </button>
    )
  }

  return (
    <div style={{
      border: '1px solid var(--border-primary)', borderRadius: 14,
      background: 'linear-gradient(180deg, rgba(20,20,20,0.6) 0%, rgba(10,10,10,0.4) 100%)',
      overflow: 'hidden',
    }}>
      {/* Steps planifies */}
      {steps.length > 0 && (
        <div style={{ padding: '14px 16px 0 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Check size={12} />
            Relances planifiees ({steps.length})
          </div>
          {steps.map((step, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
              marginBottom: 6, transition: 'all 0.15s',
            }}>
              <div style={{
                fontSize: 11, fontWeight: 800, color: '#3b82f6', minWidth: 38, textAlign: 'center',
                padding: '3px 0', borderRadius: 6, background: 'rgba(59,130,246,0.1)',
              }}>
                J+{step.delay_days}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1, lineHeight: 1.3 }}>{step.template_text}</span>
              <button type="button" onClick={() => removeStep(i)} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                padding: 4, borderRadius: 6, opacity: 0.4, transition: 'all 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#ef4444' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '0.4'; e.currentTarget.style.color = 'var(--text-muted)' }}
              ><X size={14} /></button>
            </div>
          ))}
        </div>
      )}

      {/* Programmer une relance */}
      <div style={{ padding: '14px 16px 0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(59,130,246,0.12)' }}>
            <RotateCcw size={13} color="#3b82f6" />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.03em' }}>Programmer une relance</span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {[
            { label: 'J+1', d: 1 },
            { label: 'J+2', d: 2 },
            { label: 'J+7', d: 7 },
            { label: 'J+14', d: 14 },
            { label: 'J+30', d: 30 },
          ].map(p => (
            <Chip key={p.d} label={p.label} active={relanceDays === p.d} color="#3b82f6" onClick={() => setRelanceDays(relanceDays === p.d ? null : p.d)} />
          ))}
          <Chip label="Autre" active={relanceDays === -1} color="#3b82f6" onClick={() => setRelanceDays(relanceDays === -1 ? null : -1)} />
        </div>

        {/* Custom days input */}
        {relanceDays === -1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>J+</span>
            <input type="number" min={1} value={relanceCustom} onChange={e => setRelanceCustom(parseInt(e.target.value) || 1)} style={{ ...inputS, width: 65, textAlign: 'center', fontWeight: 700 }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>jours</span>
          </div>
        )}

        {/* Reason + add button */}
        {relanceDays !== null && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'stretch' }}>
            <input value={relanceReason} onChange={e => setRelanceReason(e.target.value)} placeholder="Raison (optionnel)" style={{ ...inputS, flex: 1 }} />
            <button type="button" onClick={addRelance} style={{
              padding: '0 16px', borderRadius: 10, fontSize: 12, fontWeight: 700,
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 'none',
              color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
              boxShadow: '0 2px 8px rgba(59,130,246,0.3)', whiteSpace: 'nowrap',
              transition: 'transform 0.1s',
            }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.02)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <Plus size={13} />Ajouter
            </button>
          </div>
        )}
      </div>

      {/* Separator */}
      <div style={{ height: 1, background: 'var(--border-primary)', margin: '14px 16px' }} />

      {/* Nurturing */}
      <div style={{ padding: '0 16px 16px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(245,158,11,0.12)' }}>
            <MessageCircle size={13} color="#f59e0b" />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.03em' }}>Nurturing</span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {[
            { label: '1 mois', d: 30 },
            { label: '2 mois', d: 60 },
            { label: '3 mois', d: 90 },
          ].map(p => (
            <Chip key={p.d} label={p.label} active={nurturingDays === p.d} color="#f59e0b" onClick={() => setNurturingDays(nurturingDays === p.d ? null : p.d)} />
          ))}
          <Chip label="Autre" active={nurturingDays === -1} color="#f59e0b" onClick={() => setNurturingDays(nurturingDays === -1 ? null : -1)} />
        </div>

        {nurturingDays === -1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>J+</span>
            <input type="number" min={1} value={nurturingCustom} onChange={e => setNurturingCustom(parseInt(e.target.value) || 1)} style={{ ...inputS, width: 65, textAlign: 'center', fontWeight: 700 }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>jours</span>
          </div>
        )}

        {nurturingDays !== null && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'stretch' }}>
            <input value={nurturingReason} onChange={e => setNurturingReason(e.target.value)} placeholder="Raison (optionnel)" style={{ ...inputS, flex: 1 }} />
            <button type="button" onClick={addNurturing} style={{
              padding: '0 16px', borderRadius: 10, fontSize: 12, fontWeight: 700,
              background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none',
              color: '#000', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
              boxShadow: '0 2px 8px rgba(245,158,11,0.3)', whiteSpace: 'nowrap',
              transition: 'transform 0.1s',
            }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.02)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <Plus size={13} />Ajouter
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
