// Same behavior as the web's ThresholdsConfigModal.tsx: loads GET
// /api/ads-thresholds, edits green/orange/red per KPI (defaults preloaded),
// "Défaut" resets one KPI, saves via PUT /api/ads-thresholds {thresholds}.
import { useEffect, useState } from 'react'
import { api, ApiError } from '../../../lib/api-client'
import { Input } from '../../../design-system/Input'
import { Button } from '../../../design-system/Button'
import '../../leads/lead-create-modal.css'
import { DEFAULT_THRESHOLDS, effectiveThreshold } from './health-thresholds'
import type { ThresholdOverrides } from './types'

type Side = 'green' | 'orange' | 'red'

export function ThresholdsModal({ onClose, onSaved }: { onClose: () => void; onSaved: (next: ThresholdOverrides) => void }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [overrides, setOverrides] = useState<ThresholdOverrides>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .get<{ data: ThresholdOverrides }>('/api/ads-thresholds')
      .then((res) => {
        if (!cancelled) setOverrides(res.data ?? {})
      })
      .catch(() => {
        if (!cancelled) setError('Erreur de chargement.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function setValue(key: string, side: Side, raw: string) {
    const n = Number(raw)
    setOverrides((prev) => {
      const entry = { ...(prev[key] ?? {}) }
      if (raw.trim() !== '' && Number.isFinite(n)) entry[side] = n
      else delete entry[side]
      return { ...prev, [key]: entry }
    })
  }

  function resetKpi(key: string) {
    setOverrides((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await api.put<{ data: ThresholdOverrides }>('/api/ads-thresholds', { thresholds: overrides })
      onSaved(res.data ?? {})
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur lors de la sauvegarde.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="lead-create-overlay" onClick={onClose}>
      <div className="lead-create-modal pub-thresholds-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Seuils de santé des KPIs</h2>
        <p className="ds-muted" style={{ margin: 0 }}>
          Quand un KPI dépasse ton seuil vert, la cellule est verte. Entre orange et vert, c'est orange. En-dessous d'orange, rouge. Tu peux
          remettre les défauts à tout moment.
        </p>

        <div className="pub-thresholds-body">
          {loading ? (
            <p className="ds-muted">Chargement…</p>
          ) : (
            Object.entries(DEFAULT_THRESHOLDS).map(([key, t]) => {
              const eff = effectiveThreshold(key, overrides)
              const o = overrides[key]
              const overridden = !!o && (o.green !== undefined || o.orange !== undefined || o.red !== undefined)
              const up = t.direction === 'higher_is_better'
              const fields: { side: Side; label: string }[] = [
                { side: 'green', label: up ? 'Vert si ≥' : 'Vert si ≤' },
                { side: 'orange', label: up ? 'Orange si ≥' : 'Orange si ≤' },
                { side: 'red', label: up ? 'Rouge si <' : 'Rouge si >' },
              ]
              return (
                <div key={key} className="pub-threshold">
                  <div>
                    <div className="pub-threshold-name">{t.label}</div>
                    <div className="pub-threshold-dir">{up ? "↑ plus c'est haut, mieux c'est" : "↓ plus c'est bas, mieux c'est"}</div>
                  </div>
                  <div className="pub-threshold-inputs">
                    {fields.map((f) => (
                      <div key={f.side} className={`pub-threshold-field pub-threshold-field--${f.side}`}>
                        <label>
                          {f.label} {t.unit && `(${t.unit})`}
                        </label>
                        <Input type="number" step="any" value={eff[f.side]} onChange={(e) => setValue(key, f.side, e.target.value)} />
                      </div>
                    ))}
                    {overridden && (
                      <button type="button" className="ds-pill-button" onClick={() => resetKpi(key)}>
                        ↺ Défaut
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="pub-modal-footer">
          <span className={error ? 'lead-create-error' : 'pub-modal-note'}>{error ?? 'Les changements sont propres à ton workspace.'}</span>
          <div className="lead-create-actions" style={{ marginTop: 0 }}>
            <Button type="button" onClick={onClose} disabled={saving}>
              Annuler
            </Button>
            <Button type="button" variant="primary" onClick={save} disabled={saving || loading}>
              {saving ? 'Sauvegarde…' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
