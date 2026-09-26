// Step after login: "Quel est ton compte Instagram ?" — the handle every
// Hiker feature (analyse de ton compte, audience, contenu) works on. No
// Hiker call here (no credit spent): the first analysis is launched
// explicitly from Analyse › ciblage.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../lib/api-client'
import { useAuth } from '../lib/auth-context'
import { useInstagramAccount } from '../lib/instagram-account'
import { Input } from '../design-system/Input'
import './dashboard-layout.css'
import '../features/leads/lead-create-modal.css'

function HandleForm({ submitLabel, onSaved }: { submitLabel: string; onSaved: () => void }) {
  const { account, save } = useInstagramAccount()
  const [value, setValue] = useState(account?.username ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await save(value)
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible')
      setSaving(false)
    }
  }

  return (
    <form className="ig-onboarding-form" onSubmit={submit}>
      <div className="ig-onboarding-input">
        <span>@</span>
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="ton_pseudo" autoFocus />
      </div>
      {error && <p className="lead-create-error">{error}</p>}
      <button type="submit" className="ds-pill-button ds-pill-button--dark" disabled={saving || !value.trim()}>
        {saving ? 'Enregistrement…' : submitLabel}
      </button>
    </form>
  )
}

export function InstagramOnboarding() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const { skip } = useInstagramAccount()
  return (
    <div className="ig-onboarding">
      <div className="ig-onboarding-card">
        <div className="app-brand">
          <span className="app-brand-logo">C</span>
          ClosRM
        </div>
        <h1>Quel est ton compte Instagram ?</h1>
        <p>
          ClosRM l&apos;utilise pour analyser qui interagit avec tes contenus, ton audience et quels posts t&apos;amènent des leads. Aucun mot de passe Instagram n&apos;est
          demandé.
        </p>
        <HandleForm submitLabel="Continuer" onSaved={() => navigate('/dashboard')} />
        <button type="button" className="ds-pill-button" onClick={skip}>
          Faire plus tard
        </button>
        <p className="ig-onboarding-note">Enregistrer ton pseudo ne consomme aucun crédit : seules les analyses lancées depuis Analyse › ciblage en utilisent.</p>
        <button type="button" className="ig-onboarding-logout" onClick={logout}>
          Se déconnecter
        </button>
      </div>
    </div>
  )
}

export function InstagramAccountModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="lead-create-overlay" onClick={onClose}>
      <div className="lead-create-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Compte Instagram analysé</h2>
        <p className="ds-muted">Les analyses déjà faites restent disponibles ; les prochaines porteront sur ce compte.</p>
        <HandleForm submitLabel="Enregistrer" onSaved={onClose} />
      </div>
    </div>
  )
}
