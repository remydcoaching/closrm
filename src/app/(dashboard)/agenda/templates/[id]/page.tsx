'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Save } from 'lucide-react'
import { PlanningTemplate, TemplateBlock } from '@/types'
import TemplateWeekEditor from '@/components/templates/TemplateWeekEditor'

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-input)',
  border: '1px solid var(--border-secondary)',
  borderRadius: 8,
  color: 'var(--text-primary)',
  padding: '8px 12px',
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: 'var(--text-secondary)',
  fontSize: 12,
  marginBottom: 6,
}

export default function TemplateEditorPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [blocks, setBlocks] = useState<TemplateBlock[]>([])

  const fetchTemplate = useCallback(async () => {
    try {
      const res = await fetch(`/api/planning-templates/${id}`)
      if (!res.ok) throw new Error('Template introuvable')
      const json = await res.json()
      const t: PlanningTemplate = json.data
      setName(t.name)
      setDescription(t.description ?? '')
      setBlocks(t.blocks)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchTemplate()
  }, [fetchTemplate])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch(`/api/planning-templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          blocks,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Erreur lors de la sauvegarde')
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Chargement...</p>
      </div>
    )
  }

  if (error && !name) {
    return (
      <div style={{ padding: 32 }}>
        <p style={{ color: '#ef4444', fontSize: 14 }}>{error}</p>
        <button
          onClick={() => router.push('/agenda/templates')}
          style={{
            marginTop: 12,
            background: 'none',
            border: '1px solid var(--border-secondary)',
            borderRadius: 8,
            color: 'var(--text-secondary)',
            fontSize: 13,
            padding: '6px 14px',
            cursor: 'pointer',
          }}
        >
          Retour aux templates
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px 24px' }}>
      {/* Back link */}
      <button
        onClick={() => router.push('/agenda/templates')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          background: 'none',
          border: 'none',
          color: 'var(--text-secondary)',
          fontSize: 13,
          cursor: 'pointer',
          padding: 0,
          marginBottom: 20,
        }}
      >
        <ChevronLeft size={15} />
        Retour aux templates
      </button>

      <form onSubmit={handleSave}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Name */}
          <div>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="Ex: Semaine type intense"
              style={{
                ...inputStyle,
                fontSize: 24,
                fontWeight: 800,
                padding: '12px 16px',
                border: 'none',
                borderBottom: '2px solid var(--border-secondary)',
                borderRadius: 0,
                background: 'transparent',
                letterSpacing: '-0.02em',
              }}
            />
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Description (optionnelle)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Décrivez ce template..."
              rows={2}
              style={{ ...inputStyle, fontSize: 13, resize: 'vertical' }}
            />
          </div>

          {/* Week grid editor */}
          <div>
            <label style={labelStyle}>Planning hebdomadaire</label>
            <p style={{ color: 'var(--text-tertiary)', fontSize: 12, margin: '0 0 12px' }}>
              Cliquez sur un créneau pour ajouter un bloc. Cliquez sur un bloc pour le modifier.
            </p>
            <div style={{
              background: '#0d0d0d',
              border: '1px solid rgba(128,128,128,0.25)',
              borderRadius: 4,
              overflow: 'hidden',
            }}>
              <TemplateWeekEditor blocks={blocks} onChange={setBlocks} />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: '#2d1515',
              border: '1px solid #E53E3E',
              borderRadius: 8,
              color: '#fc8181',
              fontSize: 13,
              padding: '8px 12px',
            }}>
              {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div style={{
              background: '#0f2a1a',
              border: '1px solid #38A169',
              borderRadius: 8,
              color: '#68d391',
              fontSize: 13,
              padding: '8px 12px',
            }}>
              Template sauvegardé avec succès.
            </div>
          )}

          {/* Save button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: saving ? 'var(--color-primary-hover)' : 'var(--color-primary)',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                padding: '10px 22px',
                cursor: saving ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
              <Save size={15} />
              {saving ? 'Sauvegarde...' : 'Enregistrer le template'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
