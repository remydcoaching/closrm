// Same creation flow as the previous LeadCreatePage (POST /api/leads, same
// fields, same default source), presented as a modal instead of a route so
// the split-view list/detail layout stays in place — matches the web's own
// LeadForm.tsx pattern (modal, not full navigation) more closely too.
import { useState } from 'react'
import { api, ApiError } from '../../lib/api-client'
import { Input } from '../../design-system/Input'
import { Button } from '../../design-system/Button'
import type { Lead } from './types'
import './lead-create-modal.css'

export function LeadCreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: (lead: Lead) => void }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await api.post<{ data: Lead }>('/api/leads', {
        first_name: firstName,
        last_name: lastName,
        phone,
        email,
        source: 'manuel',
      })
      onCreated(res.data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inconnue')
      setSaving(false)
    }
  }

  return (
    <div className="lead-create-overlay" onClick={onClose}>
      <div className="lead-create-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Nouveau lead</h2>
        <form onSubmit={handleSubmit}>
          <Input placeholder="Prénom" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus />
          <Input placeholder="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          <Input placeholder="Téléphone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          {error && <p className="lead-create-error">{error}</p>}
          <div className="lead-create-actions">
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Création…' : 'Créer le lead'}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
