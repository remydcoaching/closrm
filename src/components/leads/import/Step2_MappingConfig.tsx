'use client'

import { useMemo } from 'react'
import { ArrowLeft, ArrowRight, Circle } from 'lucide-react'
import { TARGET_FIELDS, applyMapping } from '@/lib/leads/csv-parser'
import type { ColumnMapping } from '@/lib/leads/csv-parser'
import type { WizardState } from '@/app/(dashboard)/leads/import/import-client'
import type { ImportDedupAction, ImportDedupStrategy, LeadSource, LeadStatus } from '@/types'

interface Props {
  state: WizardState
  updateState: (partial: Partial<WizardState>) => void
  onBack: () => void
  onNext: () => void
}

const FIELD_LABELS: Record<string, string> = {
  first_name: 'Prénom',
  last_name: 'Nom',
  email: 'Email',
  phone: 'Téléphone',
  instagram_handle: 'Instagram',
  source: 'Source',
  status: 'Statut',
  tags: 'Tags',
  notes: 'Notes',
  created_at: 'Date de création',
}

const CONFIDENCE_COLORS: Record<string, string> = {
  exact: '#38A169',
  partial: '#D69E2E',
  none: '#666',
}

const SOURCE_OPTIONS: { value: LeadSource; label: string }[] = [
  { value: 'manuel', label: 'Manuel' },
  { value: 'facebook_ads', label: 'Facebook Ads' },
  { value: 'instagram_ads', label: 'Instagram Ads' },
  { value: 'follow_ads', label: 'Follow Ads' },
  { value: 'formulaire', label: 'Formulaire' },
  { value: 'funnel', label: 'Funnel' },
]

const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: 'nouveau', label: 'Nouveau' },
  { value: 'setting_planifie', label: 'Setting planifié' },
  { value: 'closing_planifie', label: 'Closing planifié' },
  { value: 'clos', label: 'Closé' },
  { value: 'dead', label: 'Dead' },
]

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 13,
  background: '#1a1a1a', border: '1px solid #333', color: '#fff',
  cursor: 'pointer',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: '#A0A0A0', marginBottom: 6, display: 'block',
}

export default function Step2_MappingConfig({ state, updateState, onBack, onNext }: Props) {
  const { columnMappings, config } = state

  const hasRequiredField = useMemo(() => {
    return columnMappings.some(
      (m) => m.targetField === 'email' || m.targetField === 'phone'
    )
  }, [columnMappings])

  const updateMapping = (index: number, targetField: string | null) => {
    const updated = [...columnMappings]
    updated[index] = { ...updated[index], targetField, confidence: targetField ? 'exact' : 'none' }
    updateState({ columnMappings: updated })
  }

  const updateConfig = (partial: Partial<typeof config>) => {
    updateState({ config: { ...config, ...partial } })
  }

  const handleNext = () => {
    const mapping: Record<string, string> = {}
    for (const m of columnMappings) {
      if (m.targetField) mapping[m.csvHeader] = m.targetField
    }
    const mappedRows = applyMapping(state.rows, mapping)
    updateState({ config: { ...config, mapping }, mappedRows })
    onNext()
  }

  const usedTargets = new Set(columnMappings.map((m) => m.targetField).filter(Boolean))

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 32 }}>
        {/* Left: Mapping */}
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
            Mapping des colonnes
          </h2>
          <div style={{ borderRadius: 8, border: '1px solid #262626', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#A0A0A0', background: '#1a1a1a' }}>
                    Colonne CSV
                  </th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#A0A0A0', background: '#1a1a1a', width: 200 }}>
                    Champ ClosRM
                  </th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: '#A0A0A0', background: '#1a1a1a', width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {columnMappings.map((m, i) => (
                  <tr key={m.csvHeader} style={{ borderBottom: '1px solid #1a1a1a' }}>
                    <td style={{ padding: '8px 14px', color: '#fff' }}>{m.csvHeader}</td>
                    <td style={{ padding: '8px 14px' }}>
                      <select
                        value={m.targetField || ''}
                        onChange={(e) => updateMapping(i, e.target.value || null)}
                        style={{
                          ...selectStyle,
                          color: m.targetField ? '#fff' : '#666',
                        }}
                      >
                        <option value="">— Ignorer —</option>
                        {TARGET_FIELDS.map((f) => (
                          <option key={f} value={f} disabled={usedTargets.has(f) && f !== m.targetField}>
                            {FIELD_LABELS[f] || f}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                      <Circle
                        size={10}
                        fill={CONFIDENCE_COLORS[m.confidence]}
                        color={CONFIDENCE_COLORS[m.confidence]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!hasRequiredField && (
            <p style={{ fontSize: 12, color: '#E53E3E', marginTop: 8 }}>
              Au moins « Email » ou « Téléphone » doit être mappé pour continuer.
            </p>
          )}
        </div>

        {/* Right: Config */}
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
            Configuration
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Source par défaut</label>
              <select
                value={config.default_source}
                onChange={(e) => updateConfig({ default_source: e.target.value as LeadSource })}
                style={selectStyle}
              >
                {SOURCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Statut par défaut</label>
              <select
                value={config.default_status}
                onChange={(e) => updateConfig({ default_status: e.target.value as LeadStatus })}
                style={selectStyle}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Tags à appliquer au batch</label>
              <input
                type="text"
                placeholder="Ex: import-avril, prospect"
                value={config.batch_tags.join(', ')}
                onChange={(e) => updateConfig({
                  batch_tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                })}
                style={{ ...selectStyle, cursor: 'text' }}
              />
              <p style={{ fontSize: 11, color: '#666', marginTop: 4 }}>Séparez les tags par des virgules</p>
            </div>

            <div>
              <label style={labelStyle}>Stratégie de déduplication</label>
              {(['email', 'phone', 'email_and_phone', 'none'] as ImportDedupStrategy[]).map((s) => (
                <label key={s} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
                  fontSize: 13, color: '#fff', cursor: 'pointer',
                }}>
                  <input
                    type="radio"
                    name="dedup_strategy"
                    checked={config.dedup_strategy === s}
                    onChange={() => updateConfig({ dedup_strategy: s })}
                    style={{ accentColor: '#E53E3E' }}
                  />
                  {{ email: 'Par email', phone: 'Par téléphone', email_and_phone: 'Email + téléphone', none: 'Aucune' }[s]}
                </label>
              ))}
            </div>

            <div>
              <label style={labelStyle}>En cas de doublon</label>
              {(['skip', 'update', 'create'] as ImportDedupAction[]).map((a) => (
                <label key={a} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
                  fontSize: 13, color: '#fff', cursor: 'pointer',
                }}>
                  <input
                    type="radio"
                    name="dedup_action"
                    checked={config.dedup_action === a}
                    onChange={() => updateConfig({ dedup_action: a })}
                    style={{ accentColor: '#E53E3E' }}
                  />
                  {{ skip: "Ignorer (garder l'existant)", update: 'Mettre à jour', create: 'Créer quand même' }[a]}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
        <button onClick={onBack} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '10px 20px', borderRadius: 8, fontSize: 14,
          background: 'transparent', border: '1px solid #333', color: '#A0A0A0', cursor: 'pointer',
        }}>
          <ArrowLeft size={16} />
          Retour
        </button>
        <button
          onClick={handleNext}
          disabled={!hasRequiredField}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600,
            background: hasRequiredField ? '#E53E3E' : '#333', border: 'none',
            color: hasRequiredField ? '#000' : '#666', cursor: hasRequiredField ? 'pointer' : 'not-allowed',
          }}
        >
          Continuer
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}
