'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, AlertTriangle, ExternalLink, RotateCw } from 'lucide-react'
import type { WizardState } from '@/app/(dashboard)/leads/import/import-client'
import type { ImportError } from '@/types'

interface Props {
  state: WizardState
  updateState: (partial: Partial<WizardState>) => void
}

export default function Step5_Recap({ state }: Props) {
  const router = useRouter()
  const batch = state.batch
  const [editedErrors, setEditedErrors] = useState<(ImportError & { edited?: Record<string, string> })[]>(
    () => (batch?.errors || []).map((e) => ({ ...e }))
  )
  const [reimporting, setReimporting] = useState(false)
  const [reimportResult, setReimportResult] = useState<string | null>(null)

  if (!batch) return null

  const counters = [
    { label: 'Créés', value: batch.created_count, bg: '#38A16920', color: '#38A169' },
    { label: 'Mis à jour', value: batch.updated_count, bg: '#3B82F620', color: '#3B82F6' },
    { label: 'Ignorés', value: batch.skipped_count, bg: '#66666620', color: '#666' },
    { label: 'Erreurs', value: batch.error_count, bg: '#E53E3E20', color: '#E53E3E' },
  ]

  const handleEditErrorField = (index: number, field: string, value: string) => {
    setEditedErrors((prev) => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        edited: { ...updated[index].edited, [field]: value },
      }
      return updated
    })
  }

  const handleReimportErrors = async () => {
    setReimporting(true)
    setReimportResult(null)

    const correctedRows: Record<string, string>[] = editedErrors
      .filter((e) => e.edited && Object.keys(e.edited).length > 0)
      .map((e) => {
        // Get the full original row and apply the correction
        const originalRow = state.mappedRows[e.row - 1] || {}
        return { ...originalRow, [e.field]: e.edited?.[e.field] || e.value }
      })

    if (correctedRows.length === 0) {
      setReimportResult('Aucune correction à réimporter.')
      setReimporting(false)
      return
    }

    try {
      const res = await fetch('/api/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: correctedRows,
          config: state.config,
          fileName: `${state.fileName} (corrections)`,
        }),
      })
      const json = await res.json()
      if (res.ok) {
        setReimportResult(`${json.data.created_count} leads créés, ${json.data.error_count} erreurs restantes.`)
      } else {
        setReimportResult(`Erreur : ${json.error}`)
      }
    } catch {
      setReimportResult('Erreur réseau.')
    } finally {
      setReimporting(false)
    }
  }

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        {batch.error_count === 0 ? (
          <CheckCircle2 size={48} color="#38A169" />
        ) : (
          <AlertTriangle size={48} color="#D69E2E" />
        )}
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 12 }}>
          Import terminé
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {counters.map((c) => (
          <div key={c.label} style={{
            padding: 16, borderRadius: 10, textAlign: 'center', background: c.bg,
          }}>
            <p style={{ fontSize: 28, fontWeight: 700, color: c.color, margin: 0 }}>{c.value}</p>
            <p style={{ fontSize: 12, color: c.color, margin: '4px 0 0' }}>{c.label}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => router.push(`/leads?import_batch_id=${batch.id}`)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600,
            background: 'var(--color-primary)', border: 'none', color: '#000', cursor: 'pointer',
          }}
        >
          <ExternalLink size={14} />
          Voir les leads importés
        </button>
        <button
          onClick={() => router.push('/leads/import')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', borderRadius: 8, fontSize: 14,
            background: 'transparent', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)', cursor: 'pointer',
          }}
        >
          Nouvel import
        </button>
        <button
          onClick={() => router.push('/leads/import/history')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', borderRadius: 8, fontSize: 14,
            background: 'transparent', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)', cursor: 'pointer',
          }}
        >
          Historique des imports
        </button>
      </div>

      {editedErrors.length > 0 && (
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
            Lignes en erreur ({editedErrors.length})
          </h3>
          <div style={{ borderRadius: 8, border: '1px solid var(--border-primary)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-secondary)', background: 'var(--bg-elevated)' }}>Ligne</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-secondary)', background: 'var(--bg-elevated)' }}>Champ</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-secondary)', background: 'var(--bg-elevated)' }}>Valeur originale</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-secondary)', background: 'var(--bg-elevated)' }}>Correction</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-secondary)', background: 'var(--bg-elevated)' }}>Raison</th>
                </tr>
              </thead>
              <tbody>
                {editedErrors.map((e, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                    <td style={{ padding: '8px 12px', color: '#E53E3E' }}>{e.row}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-primary)' }}>{e.field}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{e.value || '—'}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <input
                        type="text"
                        defaultValue={e.value}
                        onChange={(ev) => handleEditErrorField(i, e.field, ev.target.value)}
                        style={{
                          width: '100%', padding: '6px 8px', borderRadius: 4, fontSize: 13,
                          background: 'var(--bg-input)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)',
                        }}
                      />
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{e.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
            <button
              onClick={handleReimportErrors}
              disabled={reimporting}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: 'var(--color-primary)', border: 'none', color: '#000',
                cursor: reimporting ? 'not-allowed' : 'pointer',
                opacity: reimporting ? 0.6 : 1,
              }}
            >
              <RotateCw size={14} />
              {reimporting ? 'Réimport en cours...' : 'Réimporter les lignes corrigées'}
            </button>
            {reimportResult && (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>{reimportResult}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
