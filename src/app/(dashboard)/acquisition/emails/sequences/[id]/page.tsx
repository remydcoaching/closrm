'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import SequenceTimeline from '@/components/emails/SequenceTimeline'

interface SequenceStep {
  step_type: 'action' | 'delay'
  action_type?: string
  action_config: Record<string, unknown>
  delay_value?: number
  delay_unit?: string
}

export default function SequenceEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [name, setName] = useState('')
  const [status, setStatus] = useState('brouillon')
  const [steps, setSteps] = useState<SequenceStep[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch(`/api/emails/sequences/${id}`)
      .then(r => r.json())
      .then(data => {
        setName(data.name || '')
        setStatus(data.status || 'brouillon')
        const sorted = (data.workflow_steps || []).sort(
          (a: { step_order: number }, b: { step_order: number }) => a.step_order - b.step_order
        )
        setSteps(sorted.map((s: Record<string, unknown>) => ({
          step_type: s.step_type,
          action_type: s.action_type,
          action_config: s.action_config || {},
          delay_value: s.delay_value,
          delay_unit: s.delay_unit,
        })))
      })
  }, [id])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    await fetch(`/api/emails/sequences/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        status,
        steps: steps.map((s, i) => ({ ...s, step_order: i })),
      }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 700 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <button onClick={() => router.push('/acquisition/emails/sequences')} style={{
          fontSize: 13, color: '#666', background: 'none', border: 'none', cursor: 'pointer',
        }}>
          ← Retour aux séquences
        </button>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {saved && <span style={{ fontSize: 12, color: '#00C853' }}>Sauvegardé</span>}
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            style={{
              padding: '7px 10px', fontSize: 12,
              background: '#0a0a0a', border: '1px solid #333', borderRadius: 8,
              color: '#fff', outline: 'none',
            }}
          >
            <option value="brouillon">Brouillon</option>
            <option value="actif">Actif</option>
            <option value="inactif">Inactif</option>
          </select>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '8px 20px', fontSize: 13, fontWeight: 600,
            background: 'var(--color-primary)', color: '#fff', border: 'none',
            borderRadius: 8, cursor: 'pointer', opacity: saving ? 0.6 : 1,
          }}>
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 4 }}>Nom de la séquence</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          style={{
            width: '100%', padding: '8px 12px', fontSize: 14,
            background: '#0a0a0a', border: '1px solid #333', borderRadius: 8,
            color: '#fff', outline: 'none',
          }}
        />
      </div>

      <h3 style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 12 }}>Étapes</h3>
      <SequenceTimeline steps={steps} onChange={setSteps} />
    </div>
  )
}
