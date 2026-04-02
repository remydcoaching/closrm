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

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    await fetch('/api/instagram/sequences', {
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
    setSaving(false)
    onSaved()
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
        borderRadius: 16, padding: 28, width: 480, maxHeight: '80vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Nouvelle séquence</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Nom *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Séquence confiance lundi"
              style={{ width: '100%', padding: '10px 12px', fontSize: 13, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Type</label>
            <select value={type} onChange={e => setType(e.target.value as SeqTypeKey)}
              style={{ width: '100%', padding: '10px 12px', fontSize: 13, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }}>
              {Object.entries(IG_SEQ_TYPES).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
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
          <button onClick={handleSave} disabled={!name.trim() || saving}
            style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, color: '#fff', background: 'var(--color-primary)', border: 'none', borderRadius: 8, cursor: 'pointer', opacity: !name.trim() || saving ? 0.6 : 1 }}>
            {saving ? 'Création...' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  )
}
