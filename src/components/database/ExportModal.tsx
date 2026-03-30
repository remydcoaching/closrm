'use client'

import { useState } from 'react'
import { X, Download } from 'lucide-react'
import { ContactRow, ContactFilters } from '@/types'

interface ExportField {
  key: keyof ContactRow | 'full_name'
  label: string
  defaultChecked: boolean
}

const EXPORT_FIELDS: ExportField[] = [
  { key: 'full_name', label: 'Prénom / Nom', defaultChecked: true },
  { key: 'phone', label: 'Téléphone', defaultChecked: true },
  { key: 'email', label: 'Email', defaultChecked: true },
  { key: 'source', label: 'Source', defaultChecked: true },
  { key: 'status', label: 'Statut', defaultChecked: true },
  { key: 'tags', label: 'Tags', defaultChecked: true },
  { key: 'nb_calls', label: 'Nb appels', defaultChecked: true },
  { key: 'last_call_at', label: 'Dernier appel', defaultChecked: true },
  { key: 'notes', label: 'Notes', defaultChecked: false },
  { key: 'meta_campaign_id', label: 'ID campagne Meta', defaultChecked: false },
  { key: 'created_at', label: 'Date de création', defaultChecked: false },
  { key: 'updated_at', label: 'Dernière mise à jour', defaultChecked: false },
]

const SOURCE_LABELS: Record<string, string> = {
  facebook_ads: 'Facebook Ads',
  instagram_ads: 'Instagram Ads',
  formulaire: 'Formulaire',
  manuel: 'Manuel',
}

const STATUS_LABELS: Record<string, string> = {
  nouveau: 'Nouveau',
  setting_planifie: 'Setting planifié',
  no_show_setting: 'No-show Setting',
  closing_planifie: 'Closing planifié',
  no_show_closing: 'No-show Closing',
  clos: 'Closé',
  dead: 'Dead',
}

function buildQueryString(filters: ContactFilters): string {
  const params = new URLSearchParams()
  params.set('per_page', '1000')
  params.set('page', '1')
  if (filters.search) params.set('search', filters.search)
  if (filters.statuses.length > 0) params.set('status', filters.statuses.join(','))
  if (filters.sources.length > 0) params.set('source', filters.sources.join(','))
  if (filters.tags.length > 0) params.set('tags', filters.tags.join(','))
  if (filters.date_from) params.set('date_from', filters.date_from)
  if (filters.date_to) params.set('date_to', filters.date_to)
  if (filters.reached !== 'all') params.set('reached', filters.reached)
  return params.toString()
}

function contactsToCSV(contacts: ContactRow[], selectedFields: Set<ExportField['key']>): string {
  const BOM = '\uFEFF'

  const headers = EXPORT_FIELDS
    .filter(f => selectedFields.has(f.key))
    .map(f => f.label)

  const rows = contacts.map(c => {
    return EXPORT_FIELDS
      .filter(f => selectedFields.has(f.key))
      .map(f => {
        if (f.key === 'full_name') return `${c.first_name} ${c.last_name}`
        if (f.key === 'source') return SOURCE_LABELS[c.source] ?? c.source
        if (f.key === 'status') return STATUS_LABELS[c.status] ?? c.status
        if (f.key === 'tags') return c.tags.join('; ')
        if (f.key === 'last_call_at') {
          return c.last_call_at ? new Date(c.last_call_at).toLocaleDateString('fr-FR') : ''
        }
        if (f.key === 'created_at' || f.key === 'updated_at') {
          const val = c[f.key]
          return val ? new Date(val).toLocaleDateString('fr-FR') : ''
        }
        const val = c[f.key as keyof ContactRow]
        if (val === null || val === undefined) return ''
        const str = String(val)
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      })
      .join(',')
  })

  return BOM + [headers.join(','), ...rows].join('\n')
}

interface Props {
  filters: ContactFilters
  total: number
  onClose: () => void
}

export default function ExportModal({ filters, total, onClose }: Props) {
  const [selectedFields, setSelectedFields] = useState<Set<ExportField['key']>>(
    new Set(EXPORT_FIELDS.filter(f => f.defaultChecked).map(f => f.key))
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const exportCapped = total > 1000

  function toggleField(key: ExportField['key']) {
    setSelectedFields(prev => {
      const next = new Set(prev)
      if (next.has(key)) { next.delete(key) } else { next.add(key) }
      return next
    })
  }

  async function handleDownload() {
    setLoading(true)
    setError(null)
    try {
      const qs = buildQueryString(filters)
      const res = await fetch(`/api/contacts?${qs}`)
      if (!res.ok) throw new Error('Erreur lors de la récupération des données')
      const json = await res.json()
      const contacts: ContactRow[] = json.data

      const csv = contactsToCSV(contacts, selectedFields)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const date = new Date().toISOString().slice(0, 10)
      const a = document.createElement('a')
      a.href = url
      a.download = `contacts-${date}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: '#141414', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14, padding: 24, width: 400, maxWidth: '90vw',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Exporter en CSV</div>
            <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>Sélectionne les champs à inclure</div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#555', cursor: 'pointer',
            display: 'flex', alignItems: 'center',
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Champs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          {EXPORT_FIELDS.map(field => {
            const checked = selectedFields.has(field.key)
            return (
              <label key={String(field.key)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <div
                  onClick={() => toggleField(field.key)}
                  style={{
                    width: 15, height: 15, borderRadius: 4, flexShrink: 0,
                    background: checked ? '#00C853' : 'rgba(255,255,255,0.05)',
                    border: checked ? '1px solid #00C853' : '1px solid rgba(255,255,255,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {checked && <span style={{ color: '#000', fontSize: 9, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                </div>
                <span style={{ fontSize: 12, color: checked ? '#ccc' : '#666' }}>{field.label}</span>
              </label>
            )
          })}
        </div>

        {/* Info export */}
        <div style={{ fontSize: 11, color: '#444', marginBottom: exportCapped ? 6 : 14 }}>
          Export appliqué aux filtres actifs · {Math.min(total, 1000)} contacts
        </div>
        {exportCapped && (
          <div style={{ fontSize: 11, color: '#f59e0b', marginBottom: 14, padding: '6px 10px', background: 'rgba(245,158,11,0.08)', borderRadius: 6 }}>
            Export limité à 1000 contacts (total : {total})
          </div>
        )}

        {error && (
          <div style={{ fontSize: 11, color: '#ef4444', marginBottom: 12, padding: '6px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: 6 }}>
            {error}
          </div>
        )}

        {/* Boutons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '9px', borderRadius: 8, fontSize: 12,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            color: '#666', cursor: 'pointer',
          }}>
            Annuler
          </button>
          <button
            onClick={handleDownload}
            disabled={loading || selectedFields.size === 0}
            style={{
              flex: 1, padding: '9px', borderRadius: 8, fontSize: 12, fontWeight: 700,
              background: selectedFields.size === 0 ? 'rgba(255,255,255,0.05)' : '#00C853',
              border: 'none',
              color: selectedFields.size === 0 ? '#444' : '#000',
              cursor: selectedFields.size === 0 ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Download size={13} />
            {loading ? 'Génération...' : 'Télécharger'}
          </button>
        </div>
      </div>
    </div>
  )
}
