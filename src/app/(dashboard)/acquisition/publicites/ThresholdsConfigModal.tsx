'use client'

/**
 * Modale de configuration des seuils de santé KPI affichés sur la page
 * Publicités. Ouverte depuis un bouton en haut à droite. Édite green &
 * orange par KPI. Les défauts sont préchargés ; la sauvegarde persiste
 * via PUT /api/ads-thresholds dans la table ads_health_thresholds.
 */

import { useEffect, useState } from 'react'
import { X, RotateCcw, Loader2 } from 'lucide-react'
import {
  DEFAULT_THRESHOLDS,
  HEALTH_COLORS,
  type KpiThreshold,
} from './health-thresholds'

type Overrides = Record<string, { green?: number; orange?: number }>

interface Props {
  open: boolean
  onClose: () => void
  /** Called after a successful save, so the page can refresh thresholds. */
  onSaved?: (next: Overrides) => void
}

export default function ThresholdsConfigModal({ open, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [overrides, setOverrides] = useState<Overrides>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/ads-thresholds')
        const json = await res.json()
        if (!cancelled) setOverrides((json?.data ?? {}) as Overrides)
      } catch {
        if (!cancelled) setError('Erreur de chargement.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [open])

  if (!open) return null

  const effective = (key: string): { green: number; orange: number } => {
    const base = DEFAULT_THRESHOLDS[key]
    const o = overrides[key]
    return {
      green: o?.green ?? base.green,
      orange: o?.orange ?? base.orange,
    }
  }

  const setValue = (key: string, side: 'green' | 'orange', value: string) => {
    const num = Number(value)
    setOverrides(prev => {
      const next = { ...prev, [key]: { ...prev[key] } }
      if (Number.isFinite(num)) {
        next[key][side] = num
      } else {
        delete next[key][side]
      }
      return next
    })
  }

  const resetKpi = (key: string) => {
    setOverrides(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/ads-thresholds', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thresholds: overrides }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error ?? 'Erreur lors de la sauvegarde.')
        return
      }
      onSaved?.(json?.data as Overrides)
      onClose()
    } catch {
      setError('Erreur réseau.')
    } finally {
      setSaving(false)
    }
  }

  const grouped = Object.entries(DEFAULT_THRESHOLDS) as Array<[string, KpiThreshold]>

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-elevated, #141414)',
          border: '1px solid var(--border-primary, #262626)',
          borderRadius: 14, padding: 24,
          maxWidth: 760, width: '100%', maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: 0 }}>
              Seuils de santé des KPIs
            </h2>
            <p style={{ fontSize: 12, color: '#888', margin: '4px 0 0', maxWidth: 580, lineHeight: 1.5 }}>
              Quand un KPI dépasse ton seuil vert, la cellule est verte. Entre orange et vert, c&apos;est orange. En-dessous d&apos;orange, rouge. Tu peux remettre les défauts à tout moment.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', marginTop: 16, marginBottom: 16, marginRight: -8, paddingRight: 8 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#888', fontSize: 13, padding: 24 }}>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Chargement…
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {grouped.map(([key, t]) => {
                const eff = effective(key)
                const isOverridden = !!overrides[key] && (
                  overrides[key].green !== undefined || overrides[key].orange !== undefined
                )
                const dirHelper = t.direction === 'higher_is_better'
                  ? '↑ plus c\'est haut, mieux c\'est'
                  : '↓ plus c\'est bas, mieux c\'est'
                return (
                  <div key={key} style={{
                    background: '#0a0a0a',
                    border: '1px solid #1f1f1f',
                    borderRadius: 10, padding: '12px 14px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', margin: 0 }}>
                          {t.label}
                        </p>
                        <p style={{ fontSize: 11, color: '#666', margin: '2px 0 0' }}>
                          {dirHelper}
                        </p>
                      </div>
                      {isOverridden && (
                        <button
                          onClick={() => resetKpi(key)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            background: 'transparent', border: '1px solid #333',
                            color: '#888', fontSize: 11, padding: '3px 8px',
                            borderRadius: 6, cursor: 'pointer', flexShrink: 0,
                          }}
                        >
                          <RotateCcw size={11} /> Défaut
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <ThresholdInput
                        color={HEALTH_COLORS.green}
                        labelTop={t.direction === 'higher_is_better' ? 'Vert si ≥' : 'Vert si ≤'}
                        value={eff.green}
                        unit={t.unit}
                        onChange={v => setValue(key, 'green', v)}
                      />
                      <ThresholdInput
                        color={HEALTH_COLORS.orange}
                        labelTop={t.direction === 'higher_is_better' ? 'Orange si ≥' : 'Orange si ≤'}
                        value={eff.orange}
                        unit={t.unit}
                        onChange={v => setValue(key, 'orange', v)}
                      />
                      <div style={{
                        flex: 1, fontSize: 11, color: '#555', textAlign: 'right',
                      }}>
                        {t.direction === 'higher_is_better'
                          ? `Rouge si < ${eff.orange}${t.unit}`
                          : `Rouge si > ${eff.orange}${t.unit}`}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 11, color: error ? '#E53E3E' : '#555' }}>
            {error ?? 'Les changements sont propres à ton workspace.'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              disabled={saving}
              style={{
                background: 'transparent', border: '1px solid #333', color: '#888',
                fontSize: 13, padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
              }}
            >
              Annuler
            </button>
            <button
              onClick={save}
              disabled={saving || loading}
              style={{
                background: saving ? '#333' : '#1877F2',
                color: '#fff', fontSize: 13, fontWeight: 600,
                padding: '8px 18px', borderRadius: 8, border: 'none',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving || loading ? 0.7 : 1,
              }}
            >
              {saving ? 'Sauvegarde…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ThresholdInput({
  color, labelTop, value, unit, onChange,
}: {
  color: string
  labelTop: string
  value: number
  unit: string
  onChange: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 10, fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {labelTop}
      </span>
      <div style={{
        display: 'inline-flex', alignItems: 'center',
        background: '#000', border: `1px solid ${color}40`,
        borderRadius: 6, padding: '4px 6px',
      }}>
        <input
          type="number"
          step="any"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            color: '#fff', fontSize: 13, fontFamily: 'monospace',
            width: 64, textAlign: 'right',
          }}
        />
        <span style={{ fontSize: 11, color: '#888', marginLeft: 4 }}>{unit}</span>
      </div>
    </div>
  )
}
