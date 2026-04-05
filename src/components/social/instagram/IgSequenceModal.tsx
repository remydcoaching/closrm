'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { IG_SEQ_TYPES } from './constants'
import type { SeqTypeKey } from './constants'

interface Props {
  onClose: () => void
  onSaved: () => void
}

export default function IgSequenceModal({ onClose, onSaved }: Props) {
  const [name, setName] = useState('')
  const [type, setType] = useState<SeqTypeKey>('confiance')
  const [objective, setObjective] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nameError, setNameError] = useState(false)

  const selectedTypeColor = IG_SEQ_TYPES[type]?.color ?? '#888'

  const handleSave = async () => {
    if (!name.trim()) {
      setNameError(true)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/instagram/sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          sequence_type: type,
          objective: objective.trim() || undefined,
          notes: notes.trim() || undefined,
          published_at: new Date().toISOString(),
        }),
      })
      if (!res.ok) throw new Error('Erreur lors de la creation')
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <div style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
        borderRadius: 16, padding: 28, width: 480, maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Nouvelle séquence</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div style={{
            background: '#ef444422', border: '1px solid #ef4444', borderRadius: 8,
            padding: '8px 14px', marginBottom: 16, fontSize: 12, color: '#ef4444',
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Nom *</label>
            <input
              value={name}
              onChange={e => { setName(e.target.value); if (e.target.value.trim()) setNameError(false) }}
              placeholder="Ex: Séquence confiance lundi"
              style={{
                width: '100%', padding: '10px 12px', fontSize: 13,
                background: 'var(--bg-primary)', color: 'var(--text-primary)',
                border: `1px solid ${nameError ? '#ef4444' : 'var(--border-primary)'}`,
                borderRadius: 8, outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 0.2s ease',
              }}
            />
            {nameError && (
              <span style={{ fontSize: 11, color: '#ef4444', marginTop: 4, display: 'block' }}>Le nom est requis</span>
            )}
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Type</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: selectedTypeColor, flexShrink: 0 }} />
              <select value={type} onChange={e => setType(e.target.value as SeqTypeKey)}
                style={{ flex: 1, padding: '10px 12px', fontSize: 13, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }}>
                {Object.entries(IG_SEQ_TYPES).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Objectif</label>
            <input value={objective} onChange={e => setObjective(e.target.value)} placeholder="Ex: Générer 10 DMs"
              style={{ width: '100%', padding: '10px 12px', fontSize: 13, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Notes optionnelles..."
              style={{ width: '100%', padding: '10px 12px', fontSize: 13, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', borderRadius: 8, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', fontSize: 13, color: 'var(--text-tertiary)', background: 'none', border: '1px solid var(--border-primary)', borderRadius: 8, cursor: 'pointer' }}>
            Annuler
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, color: '#fff', background: 'var(--color-primary)', border: 'none', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Création...' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  )
}
