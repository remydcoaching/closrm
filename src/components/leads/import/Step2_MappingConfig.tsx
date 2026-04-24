'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Circle, Info } from 'lucide-react'
import { TARGET_FIELDS, applyMapping, extractUniqueStatusValues, suggestStatusMapping } from '@/lib/leads/csv-parser'
import type { ColumnMapping } from '@/lib/leads/csv-parser'
import type { WizardState } from '@/app/(dashboard)/leads/import/import-client'
import StatusValueMapper from '@/components/leads/import/StatusValueMapper'
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
  background: 'var(--bg-input)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)',
  cursor: 'pointer',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'block',
}

export default function Step2_MappingConfig({ state, updateState, onBack, onNext }: Props) {
  const { columnMappings, config } = state
  const [showDedupTooltip, setShowDedupTooltip] = useState(false)

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

  // Détecter la colonne CSV mappée vers "status"
  const statusCsvHeader = useMemo(
    () => columnMappings.find((m) => m.targetField === 'status')?.csvHeader || null,
    [columnMappings],
  )

  // Extraire les valeurs uniques de cette colonne (vide si pas mappée)
  const uniqueStatusValues = useMemo(() => {
    if (!statusCsvHeader) return []
    return extractUniqueStatusValues(state.rows, statusCsvHeader)
  }, [state.rows, statusCsvHeader])

  // Auto-suggérer le mapping quand la colonne est (re)mappée ou les valeurs changent
  useEffect(() => {
    if (uniqueStatusValues.length === 0) {
      // Clear mapping when column unmapped
      if (Object.keys(config.status_value_mapping).length > 0) {
        updateConfig({ status_value_mapping: {} })
      }
      return
    }
    // Fill only values not yet in the mapping (don't overwrite user choices)
    const next = { ...config.status_value_mapping }
    let changed = false
    for (const value of uniqueStatusValues) {
      if (!next[value]) {
        const suggested = suggestStatusMapping(value)
        if (suggested) {
          next[value] = { type: 'map', status: suggested }
          changed = true
        }
      }
    }
    // Remove stale entries (values no longer present)
    for (const key of Object.keys(next)) {
      if (!uniqueStatusValues.includes(key)) {
        delete next[key]
        changed = true
      }
    }
    if (changed) {
      updateConfig({ status_value_mapping: next })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uniqueStatusValues])

  const hasUnresolvedStatusValues = useMemo(() => {
    return uniqueStatusValues.some((v) => !config.status_value_mapping[v])
  }, [uniqueStatusValues, config.status_value_mapping])

  const canContinue = hasRequiredField && !hasUnresolvedStatusValues

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
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
            Mapping des colonnes
          </h2>
          <div style={{ borderRadius: 8, border: '1px solid var(--border-primary)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-elevated)' }}>
                    Colonne CSV
                  </th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-elevated)', width: 200 }}>
                    Champ ClosRM
                  </th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-elevated)', width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {columnMappings.map((m, i) => (
                  <tr key={m.csvHeader} style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                    <td style={{ padding: '8px 14px', color: 'var(--text-primary)' }}>{m.csvHeader}</td>
                    <td style={{ padding: '8px 14px' }}>
                      <select
                        value={m.targetField || ''}
                        onChange={(e) => updateMapping(i, e.target.value || null)}
                        style={{
                          ...selectStyle,
                          color: m.targetField ? 'var(--text-primary)' : 'var(--text-muted)',
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
          {statusCsvHeader && uniqueStatusValues.length > 0 && (
            <StatusValueMapper
              uniqueValues={uniqueStatusValues}
              mapping={config.status_value_mapping}
              onChange={(m) => updateConfig({ status_value_mapping: m })}
            />
          )}
        </div>

        {/* Right: Config */}
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
            Configuration
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Source par défaut</label>
              <select
                value={config.default_source || ''}
                onChange={(e) => updateConfig({ default_source: (e.target.value || null) as LeadSource | null })}
                style={selectStyle}
              >
                <option value="">— Aucune (erreur si source inconnue) —</option>
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
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Séparez les tags par des virgules</p>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, position: 'relative' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Stratégie de déduplication</span>
                <div
                  style={{ position: 'relative', display: 'inline-flex' }}
                  onMouseEnter={() => setShowDedupTooltip(true)}
                  onMouseLeave={() => setShowDedupTooltip(false)}
                >
                  <Info size={14} color="var(--text-muted)" style={{ cursor: 'help' }} />
                  {showDedupTooltip && (
                    <div style={{
                      position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                      marginBottom: 8, width: 260, padding: '10px 12px', borderRadius: 8,
                      background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', zIndex: 10,
                      fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)',
                    }}>
                      Permet d'éviter les doublons si certains leads de votre fichier existent déjà dans ClosRM. On compare l'email, le téléphone, ou les deux pour détecter les contacts déjà présents.
                    </div>
                  )}
                </div>
              </div>
              {(['email', 'phone', 'email_and_phone', 'none'] as ImportDedupStrategy[]).map((s) => (
                <label key={s} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
                  fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer',
                }}>
                  <input
                    type="radio"
                    name="dedup_strategy"
                    checked={config.dedup_strategy === s}
                    onChange={() => updateConfig({ dedup_strategy: s })}
                    style={{ accentColor: 'var(--color-primary)' }}
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
                  fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer',
                }}>
                  <input
                    type="radio"
                    name="dedup_action"
                    checked={config.dedup_action === a}
                    onChange={() => updateConfig({ dedup_action: a })}
                    style={{ accentColor: 'var(--color-primary)' }}
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
          background: 'transparent', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)', cursor: 'pointer',
        }}>
          <ArrowLeft size={16} />
          Retour
        </button>
        <button
          onClick={handleNext}
          disabled={!canContinue}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600,
            background: canContinue ? 'var(--color-primary)' : 'var(--border-primary)', border: 'none',
            color: canContinue ? '#000' : 'var(--text-muted)', cursor: canContinue ? 'pointer' : 'not-allowed',
          }}
        >
          Continuer
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}
