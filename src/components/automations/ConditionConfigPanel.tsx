'use client'

import type { WorkflowStep, ConditionOperator } from '@/types'

interface Props {
  step: WorkflowStep
  onChange: (updates: Partial<WorkflowStep>) => void
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-input)',
  border: '1px solid var(--border-primary)',
  borderRadius: 8,
  padding: '10px 12px',
  color: 'var(--text-primary)',
  fontSize: 13,
  width: '100%',
  outline: 'none',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none' as const,
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-tertiary)',
  marginBottom: 6,
  display: 'block',
}

export default function ConditionConfigPanel({ step, onChange }: Props) {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 22, paddingBottom: 14,
        borderBottom: '1px solid var(--border-primary)',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'rgba(139,92,246,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            Condition
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Branchement Si / Sinon
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Champ</label>
        <select
          style={selectStyle}
          value={step.condition_field || ''}
          onChange={(e) => onChange({ condition_field: e.target.value || null })}
        >
          <option value="" disabled>Sélectionner...</option>
          <option value="lead.status">Statut du lead</option>
          <option value="lead.source">Source du lead</option>
          <option value="lead.tags">Tags du lead</option>
          <option value="lead.reached">Lead joint</option>
          <option value="lead.email">Email du lead</option>
        </select>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Opérateur</label>
        <select
          style={selectStyle}
          value={step.condition_operator || ''}
          onChange={(e) =>
            onChange({ condition_operator: (e.target.value as ConditionOperator) || null })
          }
        >
          <option value="" disabled>Sélectionner...</option>
          <option value="equals">Est égal à</option>
          <option value="not_equals">N&apos;est pas égal à</option>
          <option value="contains">Contient</option>
          <option value="not_contains">Ne contient pas</option>
        </select>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Valeur</label>
        <input
          type="text"
          style={inputStyle}
          placeholder="Valeur à comparer..."
          value={step.condition_value || ''}
          onChange={(e) => onChange({ condition_value: e.target.value || null })}
        />
      </div>

      <div
        style={{
          borderTop: '1px solid var(--border-primary)',
          paddingTop: 16,
          marginTop: 18,
        }}
      >
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Si vrai → Aller à l&apos;étape</label>
          <input
            type="number"
            style={inputStyle}
            placeholder="Suivante"
            min={1}
            value={step.on_true_step ?? ''}
            onChange={(e) =>
              onChange({ on_true_step: e.target.value ? parseInt(e.target.value) : null })
            }
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Si faux → Aller à l&apos;étape</label>
          <input
            type="number"
            style={inputStyle}
            placeholder="Arrêter"
            min={1}
            value={step.on_false_step ?? ''}
            onChange={(e) =>
              onChange({ on_false_step: e.target.value ? parseInt(e.target.value) : null })
            }
          />
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-label)', marginTop: 8 }}>
          Laissez vide pour continuer à l&apos;étape suivante (vrai) ou arrêter le workflow (faux).
        </div>
      </div>
    </div>
  )
}
