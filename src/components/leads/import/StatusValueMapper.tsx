'use client'

import { useMemo } from 'react'
import { AlertCircle, CheckCircle2, Tag } from 'lucide-react'
import type { LeadStatus, StatusMappingAction } from '@/types'
import { useStatusConfig } from '@/lib/workspace/config-context'

interface Props {
  uniqueValues: string[]
  mapping: Record<string, StatusMappingAction>
  onChange: (mapping: Record<string, StatusMappingAction>) => void
}

// Encoded value for the <select> (separates action type from status)
function encodeAction(action: StatusMappingAction | undefined): string {
  if (!action) return ''
  if (action.type === 'map') return `map:${action.status}`
  if (action.type === 'tag') return 'tag'
  return 'ignore'
}

function decodeAction(value: string): StatusMappingAction | null {
  if (!value) return null
  if (value === 'tag') return { type: 'tag' }
  if (value === 'ignore') return { type: 'ignore' }
  if (value.startsWith('map:')) {
    return { type: 'map', status: value.slice(4) as LeadStatus }
  }
  return null
}

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '6px 8px', borderRadius: 6, fontSize: 13,
  background: 'var(--bg-input)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)',
  cursor: 'pointer',
}

export default function StatusValueMapper({ uniqueValues, mapping, onChange }: Props) {
  const statusConfig = useStatusConfig()
  const STATUS_LABELS: Record<LeadStatus, string> = Object.fromEntries(
    statusConfig.map((e) => [e.key, e.label]),
  ) as Record<LeadStatus, string>
  const STATUS_ORDER = statusConfig.filter((e) => e.visible).map((e) => e.key)

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
          Valeurs de statut détectées ({uniqueValues.length})
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
                      <optgroup label="Mapper vers un statut ClosRM">
                        {STATUS_ORDER.map((s) => (
                          <option key={s} value={`map:${s}`}>{STATUS_LABELS[s]}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Autres">
                        <option value="tag">Convertir en tag</option>
                        <option value="ignore">Ignorer (statut par défaut)</option>
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
