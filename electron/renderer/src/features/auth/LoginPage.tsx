import { useState } from 'react'
import { useAuth } from '../../lib/auth-context'
import { Button } from '../../design-system/Button'
import { Input } from '../../design-system/Input'
import { Card } from '../../design-system/Card'

type Mode = 'password' | 'magic-link'

export function LoginPage() {
  const { requestMagicLink, loginWithPassword, startupError } = useAuth()
  const [mode, setMode] = useState<Mode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setError(null)

    const { error: err } = mode === 'password' ? await loginWithPassword(email, password) : await requestMagicLink(email)

    if (err) {
      setError(err)
      setStatus('error')
      return
    }
    // Password login resolves the session synchronously via onAuthStateChange
    // (App.tsx re-renders past RequireAuth once `session` is set) — no
    // intermediate "sent" screen needed for that path.
    setStatus(mode === 'magic-link' ? 'sent' : 'idle')
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--color-bg-subtle)' }}>
      <Card style={{ width: 380, padding: 'var(--space-8)' }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 'var(--radius-md)',
            background: 'var(--gradient-accent)',
            marginBottom: 'var(--space-4)',
          }}
        />
        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, margin: 0 }}>ClosRM</h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: 4, marginBottom: 'var(--space-6)' }}>
          Connectez-vous à votre espace
        </p>

        {status === 'sent' ? (
          <p style={{ fontSize: 'var(--font-size-sm)' }}>
            Un lien de connexion a été envoyé à <strong>{email}</strong>. Ouvrez-le pour accéder à l'application.
          </p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <Input
              type="email"
              placeholder="votre@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
            {mode === 'password' && (
              <Input
                type="password"
                placeholder="Mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            )}
            {(error || startupError) && <p style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-xs)' }}>{error ?? startupError}</p>}
            <Button type="submit" variant="primary" disabled={status === 'sending' || !email || (mode === 'password' && !password)}>
              {status === 'sending' ? 'Connexion…' : mode === 'password' ? 'Se connecter' : 'Recevoir un lien de connexion'}
            </Button>
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'password' ? 'magic-link' : 'password')
                setError(null)
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-tertiary)',
                fontSize: 'var(--font-size-xs)',
                cursor: 'pointer',
                textAlign: 'center',
                padding: 'var(--space-1)',
              }}
            >
              {mode === 'password' ? 'Utiliser un lien de connexion par email' : 'Utiliser mon mot de passe'}
            </button>
          </form>
        )}
      </Card>
    </div>
  )
}
