'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import type { WizardState } from '@/app/(dashboard)/leads/import/import-client'
import type { ImportPreviewResult } from '@/types'

interface Props {
  state: WizardState
  updateState: (partial: Partial<WizardState>) => void
  onBack: () => void
  onNext: () => void
}

type Tab = 'create' | 'update' | 'skip' | 'errors'

const COUNTER_STYLES: Record<Tab, { bg: string; color: string; label: string }> = {
  create:  { bg: '#38A16920', color: '#38A169', label: 'À créer' },
  update:  { bg: '#3B82F620', color: '#3B82F6', label: 'À mettre à jour' },
  skip:    { bg: '#66666620', color: '#666', label: 'Ignorés' },
  errors:  { bg: '#E53E3E20', color: '#E53E3E', label: 'Erreurs' },
}

export default function Step3_PreviewDiff({ state, updateState, onBack, onNext }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('create')

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
        updateState({ previewResult: json.data as ImportPreviewResult })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      } finally {
        setLoading(false)
      }
    }
    fetchPreview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const preview = state.previewResult

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <Loader2 size={32} color="#E53E3E" style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ fontSize: 14, color: '#A0A0A0', marginTop: 12 }}>Analyse en cours...</p>
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
          background: 'transparent', border: '1px solid #333', color: '#A0A0A0', cursor: 'pointer',
        }}>
          Retour
        </button>
      </div>
    )
  }

  if (!preview) return null

  const counts: Record<Tab, number> = {
    create: preview.to_create,
    update: preview.to_update,
    skip: preview.to_skip,
    errors: preview.errors,
  }

  return (
    <div>
      {/* Counters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {(Object.keys(COUNTER_STYLES) as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '16px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
              background: COUNTER_STYLES[tab].bg,
              border: activeTab === tab ? `2px solid ${COUNTER_STYLES[tab].color}` : '2px solid transparent',
            }}
          >
            <p style={{ fontSize: 28, fontWeight: 700, color: COUNTER_STYLES[tab].color, margin: 0 }}>
              {counts[tab]}
            </p>
            <p style={{ fontSize: 12, color: COUNTER_STYLES[tab].color, margin: '4px 0 0' }}>
              {COUNTER_STYLES[tab].label}
            </p>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{
        background: '#141414', borderRadius: 8, border: '1px solid #262626',
        padding: 16, minHeight: 200,
      }}>
        {activeTab === 'create' && preview.sample_creates.length > 0 && (
          <div>
            <p style={{ fontSize: 13, color: '#A0A0A0', marginBottom: 12 }}>
              Exemples de leads à créer :
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {Object.keys(preview.sample_creates[0]).map((k) => (
                    <th key={k} style={{ padding: '8px 12px', textAlign: 'left', color: '#A0A0A0', borderBottom: '1px solid #262626' }}>{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.sample_creates.map((row, i) => (
                  <tr key={i}>
                    {Object.values(row).map((v, j) => (
                      <td key={j} style={{ padding: '8px 12px', color: '#fff', borderBottom: '1px solid #1a1a1a' }}>{String(v) || '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'update' && preview.sample_updates.length > 0 && (
          <div>
            <p style={{ fontSize: 13, color: '#A0A0A0', marginBottom: 12 }}>
              Exemples de mises à jour :
            </p>
            {preview.sample_updates.map((u, i) => (
              <div key={i} style={{ marginBottom: 16, padding: 12, background: '#1a1a1a', borderRadius: 6 }}>
                <p style={{ fontSize: 12, color: '#3B82F6', marginBottom: 8 }}>Mise à jour #{i + 1}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                  <div>
                    <p style={{ color: '#666', marginBottom: 4 }}>Avant</p>
                    {Object.entries(u.before).slice(0, 5).map(([k, v]) => (
                      <p key={k} style={{ color: '#A0A0A0', margin: '2px 0' }}>{k}: {String(v)}</p>
                    ))}
                  </div>
                  <div>
                    <p style={{ color: '#3B82F6', marginBottom: 4 }}>Après</p>
                    {Object.entries(u.after).map(([k, v]) => (
                      <p key={k} style={{ color: '#fff', margin: '2px 0' }}>{k}: {String(v)}</p>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'errors' && preview.error_details.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#A0A0A0', borderBottom: '1px solid #262626' }}>Ligne</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#A0A0A0', borderBottom: '1px solid #262626' }}>Champ</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#A0A0A0', borderBottom: '1px solid #262626' }}>Valeur</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#A0A0A0', borderBottom: '1px solid #262626' }}>Raison</th>
              </tr>
            </thead>
            <tbody>
              {preview.error_details.map((e, i) => (
                <tr key={i}>
                  <td style={{ padding: '8px 12px', color: '#E53E3E', borderBottom: '1px solid #1a1a1a' }}>{e.row}</td>
                  <td style={{ padding: '8px 12px', color: '#fff', borderBottom: '1px solid #1a1a1a' }}>{e.field}</td>
                  <td style={{ padding: '8px 12px', color: '#A0A0A0', borderBottom: '1px solid #1a1a1a' }}>{e.value || '—'}</td>
                  <td style={{ padding: '8px 12px', color: '#A0A0A0', borderBottom: '1px solid #1a1a1a' }}>{e.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'skip' && (
          <p style={{ fontSize: 13, color: '#666', textAlign: 'center', padding: 24 }}>
            {preview.to_skip > 0
              ? `${preview.to_skip} lignes seront ignorées (doublons détectés).`
              : 'Aucun doublon détecté.'}
          </p>
        )}

        {counts[activeTab] === 0 && activeTab !== 'skip' && (
          <p style={{ fontSize: 13, color: '#666', textAlign: 'center', padding: 24 }}>
            Aucun élément dans cette catégorie.
          </p>
        )}
      </div>

      {/* Navigation */}
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
          onClick={onNext}
          disabled={preview.to_create === 0 && preview.to_update === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600,
            background: (preview.to_create > 0 || preview.to_update > 0) ? '#E53E3E' : '#333',
            border: 'none',
            color: (preview.to_create > 0 || preview.to_update > 0) ? '#000' : '#666',
            cursor: (preview.to_create > 0 || preview.to_update > 0) ? 'pointer' : 'not-allowed',
          }}
        >
          Lancer l'import
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}
