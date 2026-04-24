'use client'

import { useMemo } from 'react'
import { AlertCircle, CheckCircle2, Tag } from 'lucide-react'
import type { LeadSource, SourceMappingAction } from '@/types'

interface Props {
  uniqueValues: string[]
  mapping: Record<string, SourceMappingAction>
  onChange: (mapping: Record<string, SourceMappingAction>) => void
}

const SOURCE_LABELS: Record<LeadSource, string> = {
  facebook_ads: 'Facebook Ads',
  instagram_ads: 'Instagram Ads',
  follow_ads: 'Follow Ads',
  formulaire: 'Formulaire',
  manuel: 'Manuel',
  funnel: 'Funnel',
}

// Derived from SOURCE_LABELS so TypeScript enforces exhaustiveness: adding a
// new LeadSource forces adding a label, which flows through to this order.
const SOURCE_ORDER = Object.keys(SOURCE_LABELS) as LeadSource[]

// Encoded value for the <select> (separates action type from source)
function encodeAction(action: SourceMappingAction | undefined): string {
  if (!action) return ''
  if (action.type === 'map') return `map:${action.source}`
  if (action.type === 'tag') return 'tag'
  return 'ignore'
}

function decodeAction(value: string): SourceMappingAction | null {
  if (!value) return null
  if (value === 'tag') return { type: 'tag' }
  if (value === 'ignore') return { type: 'ignore' }
  if (value.startsWith('map:')) {
    return { type: 'map', source: value.slice(4) as LeadSource }
  }
  return null
}

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '6px 8px', borderRadius: 6, fontSize: 13,
  background: 'var(--bg-input)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)',
  cursor: 'pointer',
}

export default function SourceValueMapper({ uniqueValues, mapping, onChange }: Props) {
  const unresolvedCount = useMemo(
    () => uniqueValues.filter((v) => !mapping[v]).length,
    [uniqueValues, mapping],
  )

  const handleChange = (value: string, selectValue: string) => {
    const action = decodeAction(selectValue)
    const next = { ...mapping }
    if (action) {
      next[value] = action
    } else {
      delete next[value]
    }
    onChange(next)
  }

  if (uniqueValues.length === 0) return null

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Valeurs de source détectées ({uniqueValues.length})
        </h3>
        {unresolvedCount > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 12, color: '#E53E3E', fontWeight: 600,
          }}>
            <AlertCircle size={12} />
            {unresolvedCount} à régler
          </span>
        )}
      </div>

      <div style={{ borderRadius: 8, border: '1px solid var(--border-primary)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-elevated)' }}>
                Valeur CSV
              </th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-elevated)', width: 280 }}>
                Action
              </th>
              <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-elevated)', width: 80 }}>
                Résultat
              </th>
            </tr>
          </thead>
          <tbody>
            {uniqueValues.map((value) => {
              const action = mapping[value]
              const selectValue = encodeAction(action)
              return (
                <tr key={value} style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                  <td style={{ padding: '8px 14px', color: 'var(--text-primary)' }}>{value}</td>
                  <td style={{ padding: '8px 14px' }}>
                    <select
                      aria-label={`Action pour « ${value} »`}
                      value={selectValue}
                      onChange={(e) => handleChange(value, e.target.value)}
                      style={{
                        ...selectStyle,
                        color: selectValue ? 'var(--text-primary)' : 'var(--text-muted)',
                        borderColor: selectValue ? 'var(--border-primary)' : '#E53E3E',
                      }}
                    >
                      <option value="">— Choisir… —</option>
                      <optgroup label="Mapper vers une source ClosRM">
                        {SOURCE_ORDER.map((s) => (
                          <option key={s} value={`map:${s}`}>{SOURCE_LABELS[s]}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Autres">
                        <option value="tag">Convertir en tag</option>
                        <option value="ignore">Ignorer (source par défaut)</option>
                      </optgroup>
                    </select>
                  </td>
                  <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                    {!action ? (
                      <AlertCircle size={16} color="#E53E3E" />
                    ) : action.type === 'map' ? (
                      <CheckCircle2 size={16} color="#38A169" />
                    ) : action.type === 'tag' ? (
                      <Tag size={16} color="#3B82F6" />
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
