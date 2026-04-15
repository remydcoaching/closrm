'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, ArrowRight, Loader2, Check, Pencil } from 'lucide-react'
import type { WizardState } from '@/app/(dashboard)/leads/import/import-client'
import type { ImportError, ImportPreviewResult } from '@/types'

interface Props {
  state: WizardState
  updateState: (partial: Partial<WizardState>) => void
  onBack: () => void
  onNext: () => void
}

type Tab = 'create' | 'update' | 'skip' | 'errors' | 'corrected'

interface CorrectedError {
  original: ImportError
  correctedValue: string
}

export default function Step3_PreviewDiff({ state, updateState, onBack, onNext }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('create')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [corrected, setCorrected] = useState<CorrectedError[]>([])
  const [remainingErrors, setRemainingErrors] = useState<ImportError[]>([])

  useEffect(() => {
    const fetchPreview = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/leads/import/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: state.mappedRows, config: state.config }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Erreur serveur')
        const result = json.data as ImportPreviewResult
        updateState({ previewResult: result })
        setRemainingErrors(result.error_details)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      } finally {
        setLoading(false)
      }
    }
    fetchPreview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleStartEdit = (index: number, currentValue: string) => {
    setEditingIndex(index)
    setEditValue(currentValue)
  }

  const handleApplyCorrection = useCallback((errorIndex: number) => {
    const err = remainingErrors[errorIndex]
    if (!err) return

    // Update the mapped row with the corrected value
    const rowIdx = err.row - 1
    const updatedRows = [...state.mappedRows]
    if (updatedRows[rowIdx]) {
      updatedRows[rowIdx] = { ...updatedRows[rowIdx], [err.field]: editValue }
      updateState({ mappedRows: updatedRows })
    }

    // Move from errors to corrected
    setCorrected((prev) => [...prev, { original: err, correctedValue: editValue }])
    setRemainingErrors((prev) => prev.filter((_, i) => i !== errorIndex))
    setEditingIndex(null)
    setEditValue('')
  }, [remainingErrors, editValue, state.mappedRows, updateState])

  const preview = state.previewResult

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <Loader2 size={32} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 12 }}>Analyse en cours...</p>
        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <p style={{ fontSize: 14, color: '#E53E3E' }}>{error}</p>
        <button onClick={onBack} style={{
          marginTop: 16, padding: '10px 20px', borderRadius: 8, fontSize: 14,
          background: 'transparent', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)', cursor: 'pointer',
        }}>
          Retour
        </button>
      </div>
    )
  }

  if (!preview) return null

  const totalToCreate = preview.to_create + corrected.length
  const totalErrors = remainingErrors.length

  const counters: { key: Tab; count: number; color: string; bg: string; label: string }[] = [
    { key: 'create', count: totalToCreate, color: '#38A169', bg: '#38A16920', label: 'À créer' },
    { key: 'update', count: preview.to_update, color: '#3B82F6', bg: '#3B82F620', label: 'À mettre à jour' },
    { key: 'skip', count: preview.to_skip, color: 'var(--text-muted)', bg: 'var(--bg-subtle)', label: 'Ignorés' },
    { key: 'errors', count: totalErrors, color: '#E53E3E', bg: '#E53E3E20', label: 'Erreurs' },
  ]

  if (corrected.length > 0) {
    counters.push({ key: 'corrected', count: corrected.length, color: '#38A169', bg: '#38A16915', label: 'Corrigés' })
  }

  return (
    <div>
      {/* Counters */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${counters.length}, 1fr)`, gap: 12, marginBottom: 24 }}>
        {counters.map((c) => (
          <button
            key={c.key}
            onClick={() => setActiveTab(c.key)}
            style={{
              padding: '16px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
              background: c.bg,
              border: activeTab === c.key ? `2px solid ${c.color}` : '2px solid transparent',
            }}
          >
            <p style={{ fontSize: 28, fontWeight: 700, color: c.color, margin: 0 }}>
              {c.count}
            </p>
            <p style={{ fontSize: 12, color: c.color, margin: '4px 0 0' }}>
              {c.label}
            </p>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{
        background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border-primary)',
        padding: 16, minHeight: 200,
      }}>
        {/* Create tab */}
        {activeTab === 'create' && preview.sample_creates.length > 0 && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
              Exemples de leads à créer ({totalToCreate} au total) :
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {Object.keys(preview.sample_creates[0]).map((k) => (
                    <th key={k} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-primary)' }}>{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.sample_creates.map((row, i) => (
                  <tr key={i}>
                    {Object.values(row).map((v, j) => (
                      <td key={j} style={{ padding: '8px 12px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-secondary)' }}>{String(v) || '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'create' && preview.sample_creates.length === 0 && totalToCreate > 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', padding: 24 }}>
            {totalToCreate} leads à créer.
          </p>
        )}

        {/* Update tab */}
        {activeTab === 'update' && preview.sample_updates.length > 0 && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
              Exemples de mises à jour :
            </p>
            {preview.sample_updates.map((u, i) => (
              <div key={i} style={{ marginBottom: 16, padding: 12, background: 'var(--bg-subtle)', borderRadius: 6 }}>
                <p style={{ fontSize: 12, color: '#3B82F6', marginBottom: 8 }}>Mise à jour #{i + 1}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                  <div>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Avant</p>
                    {Object.entries(u.before).slice(0, 5).map(([k, v]) => (
                      <p key={k} style={{ color: 'var(--text-secondary)', margin: '2px 0' }}>{k}: {String(v)}</p>
                    ))}
                  </div>
                  <div>
                    <p style={{ color: '#3B82F6', marginBottom: 4 }}>Après</p>
                    {Object.entries(u.after).map(([k, v]) => (
                      <p key={k} style={{ color: 'var(--text-primary)', margin: '2px 0' }}>{k}: {String(v)}</p>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Errors tab — editable */}
        {activeTab === 'errors' && remainingErrors.length > 0 && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
              Corrigez les erreurs ci-dessous, puis cliquez sur le bouton pour déplacer le lead dans « À créer ».
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-primary)' }}>Ligne</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-primary)' }}>Champ</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-primary)' }}>Valeur</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-primary)' }}>Raison</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-primary)', width: 90 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {remainingErrors.map((e, i) => (
                  <tr key={`${e.row}-${e.field}-${i}`} style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                    <td style={{ padding: '8px 12px', color: '#E53E3E' }}>{e.row}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-primary)' }}>{e.field}</td>
                    <td style={{ padding: '8px 12px' }}>
                      {editingIndex === i ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(ev) => setEditValue(ev.target.value)}
                          onKeyDown={(ev) => { if (ev.key === 'Enter') handleApplyCorrection(i) }}
                          autoFocus
                          style={{
                            width: '100%', padding: '5px 8px', borderRadius: 4, fontSize: 13,
                            background: 'var(--bg-input)', border: '1px solid var(--color-primary)', color: 'var(--text-primary)',
                            outline: 'none',
                          }}
                        />
                      ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>{e.value || '—'}</span>
                      )}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: 12 }}>{e.reason}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      {editingIndex === i ? (
                        <button
                          onClick={() => handleApplyCorrection(i)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                            background: '#38A169', border: 'none', color: '#fff', cursor: 'pointer',
                          }}
                        >
                          <Check size={12} />
                          Appliquer
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStartEdit(i, e.value)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '4px 10px', borderRadius: 6, fontSize: 12,
                            background: 'transparent', border: '1px solid var(--border-primary)',
                            color: 'var(--text-secondary)', cursor: 'pointer',
                          }}
                        >
                          <Pencil size={12} />
                          Corriger
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'errors' && remainingErrors.length === 0 && (
          <p style={{ fontSize: 13, color: '#38A169', textAlign: 'center', padding: 24 }}>
            Toutes les erreurs ont été corrigées !
          </p>
        )}

        {/* Corrected tab — before/after */}
        {activeTab === 'corrected' && corrected.length > 0 && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
              Corrections appliquées — ces leads seront importés :
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-primary)' }}>Ligne</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-primary)' }}>Champ</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-primary)' }}>Avant</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-primary)' }}>Après</th>
                </tr>
              </thead>
              <tbody>
                {corrected.map((c, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                    <td style={{ padding: '8px 12px', color: 'var(--text-primary)' }}>{c.original.row}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-primary)' }}>{c.original.field}</td>
                    <td style={{ padding: '8px 12px', color: '#E53E3E', textDecoration: 'line-through' }}>{c.original.value || '—'}</td>
                    <td style={{ padding: '8px 12px', color: '#38A169', fontWeight: 600 }}>{c.correctedValue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Skip tab */}
        {activeTab === 'skip' && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>
            {preview.to_skip > 0
              ? `${preview.to_skip} lignes seront ignorées (doublons détectés).`
              : 'Aucun doublon détecté.'}
          </p>
        )}

        {/* Empty states for create/update */}
        {activeTab === 'create' && totalToCreate === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>
            Aucun lead à créer.
          </p>
        )}
        {activeTab === 'update' && preview.to_update === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>
            Aucune mise à jour.
          </p>
        )}
      </div>

      {/* Navigation */}
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
          onClick={onNext}
          disabled={totalToCreate === 0 && preview.to_update === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600,
            background: (totalToCreate > 0 || preview.to_update > 0) ? 'var(--color-primary)' : 'var(--bg-subtle)',
            border: 'none',
            color: (totalToCreate > 0 || preview.to_update > 0) ? '#000' : 'var(--text-muted)',
            cursor: (totalToCreate > 0 || preview.to_update > 0) ? 'pointer' : 'not-allowed',
          }}
        >
          Lancer l'import
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}
