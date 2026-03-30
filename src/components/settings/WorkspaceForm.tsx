'use client'

import { useState } from 'react'

interface Props {
  workspace: { id: string; name: string; timezone: string }
  onSave: () => void
}

const TIMEZONES = [
  { value: 'Europe/Paris', label: 'Europe/Paris (GMT+1/+2)' },
  { value: 'Europe/London', label: 'Europe/London (GMT+0/+1)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (GMT+1/+2)' },
  { value: 'Europe/Brussels', label: 'Europe/Brussels (GMT+1/+2)' },
  { value: 'Europe/Zurich', label: 'Europe/Zurich (GMT+1/+2)' },
  { value: 'Europe/Rome', label: 'Europe/Rome (GMT+1/+2)' },
  { value: 'Europe/Madrid', label: 'Europe/Madrid (GMT+1/+2)' },
  { value: 'Europe/Lisbon', label: 'Europe/Lisbon (GMT+0/+1)' },
  { value: 'America/New_York', label: 'America/New York (GMT-5/-4)' },
  { value: 'America/Chicago', label: 'America/Chicago (GMT-6/-5)' },
  { value: 'America/Los_Angeles', label: 'America/Los Angeles (GMT-8/-7)' },
  { value: 'America/Toronto', label: 'America/Toronto (GMT-5/-4)' },
  { value: 'America/Montreal', label: 'America/Montréal (GMT-5/-4)' },
  { value: 'Africa/Casablanca', label: 'Africa/Casablanca (GMT+0/+1)' },
  { value: 'Africa/Tunis', label: 'Africa/Tunis (GMT+1)' },
  { value: 'Africa/Abidjan', label: 'Africa/Abidjan (GMT+0)' },
  { value: 'Africa/Dakar', label: 'Africa/Dakar (GMT+0)' },
  { value: 'Indian/Reunion', label: 'Indian/Réunion (GMT+4)' },
  { value: 'Pacific/Tahiti', label: 'Pacific/Tahiti (GMT-10)' },
  { value: 'America/Guadeloupe', label: 'America/Guadeloupe (GMT-4)' },
  { value: 'America/Martinique', label: 'America/Martinique (GMT-4)' },
  { value: 'America/Cayenne', label: 'America/Cayenne (GMT-3)' },
]

export default function WorkspaceForm({ workspace, onSave }: Props) {
  const [name, setName] = useState(workspace.name)
  const [timezone, setTimezone] = useState(workspace.timezone)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    if (name.trim().length < 2) {
      setError('Le nom doit faire au moins 2 caractères.')
      setSaving(false)
      return
    }

    try {
      const res = await fetch('/api/workspaces', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), timezone }),
      })

      if (!res.ok) {
        const json = await res.json()
        setError(json.error || 'Erreur sauvegarde')
        return
      }

      setSuccess(true)
      onSave()
    } catch {
      setError('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    fontSize: 14,
    color: '#fff',
    background: '#0f0f11',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 6,
    outline: 'none',
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2 style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 20 }}>
        Workspace
      </h2>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, color: '#888', marginBottom: 6 }}>
          Nom du workspace
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(null); setSuccess(false) }}
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 13, color: '#888', marginBottom: 6 }}>
          Fuseau horaire
        </label>
        <select
          value={timezone}
          onChange={(e) => { setTimezone(e.target.value); setSuccess(false) }}
          style={{
            ...inputStyle,
            appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 12px center',
            paddingRight: 32,
          }}
        >
          {TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p style={{ fontSize: 13, color: '#ef4444', marginBottom: 12 }}>{error}</p>
      )}
      {success && (
        <p style={{ fontSize: 13, color: '#00C853', marginBottom: 12 }}>Workspace mis à jour.</p>
      )}

      <button
        type="submit"
        disabled={saving}
        style={{
          padding: '8px 20px',
          fontSize: 14,
          fontWeight: 500,
          color: '#fff',
          background: '#00C853',
          border: 'none',
          borderRadius: 6,
          cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? 'Enregistrement...' : 'Enregistrer'}
      </button>
    </form>
  )
}
