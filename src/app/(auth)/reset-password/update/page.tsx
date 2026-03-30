'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { updatePasswordSchema, type UpdatePasswordFormData } from '@/lib/validations/auth'
import { Lock, ArrowRight, Loader2 } from 'lucide-react'

const inputS: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)',
  border: '1px solid var(--border-primary)', borderRadius: 10,
  padding: '12px 14px 12px 42px', color: 'var(--text-primary)', fontSize: 13, outline: 'none',
}
const icoS: React.CSSProperties = { position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-label)' }
const lblS: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-label)', marginBottom: 8, letterSpacing: '0.15em', textTransform: 'uppercase' }

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [formData, setFormData] = useState<UpdatePasswordFormData>({ password: '', confirmPassword: '' })
  const [errors, setErrors] = useState<Partial<Record<keyof UpdatePasswordFormData, string>>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Supabase envoie le token recovery dans le hash — le client SDK le gère automatiquement
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })
    // Si déjà connecté (token dans les cookies), on est prêt
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setReady(true)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({}); setServerError(null)

    const result = updatePasswordSchema.safeParse(formData)
    if (!result.success) {
      const fe: Partial<Record<keyof UpdatePasswordFormData, string>> = {}
      result.error.issues.forEach((i) => { const f = i.path[0] as keyof UpdatePasswordFormData; if (!fe[f]) fe[f] = i.message })
      setErrors(fe); return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: result.data.password })
      if (error) {
        setServerError('Impossible de mettre à jour le mot de passe. Le lien a peut-être expiré.')
        setLoading(false)
        return
      }
      router.push('/dashboard')
      router.refresh()
    } catch {
      setServerError('Une erreur est survenue. Veuillez réessayer.')
      setLoading(false)
    }
  }

  if (!ready) {
    return (
      <div style={{ background: 'linear-gradient(135deg, rgba(17,17,19,0.9), rgba(12,12,14,0.95))', border: '1px solid var(--border-primary)', borderRadius: 16, padding: '36px 32px', boxShadow: '0 0 60px rgba(0,200,83,0.04)', textAlign: 'center' }}>
        <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginBottom: 16 }}>Vérification du lien en cours...</p>
        <Loader2 size={24} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ fontSize: 12, color: 'var(--text-label)', marginTop: 16 }}>
          Lien expiré ?{' '}
          <Link href="/reset-password" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>Redemander un lien</Link>
        </p>
      </div>
    )
  }

  return (
    <div style={{ background: 'linear-gradient(135deg, rgba(17,17,19,0.9), rgba(12,12,14,0.95))', border: '1px solid var(--border-primary)', borderRadius: 16, padding: '36px 32px', boxShadow: '0 0 60px rgba(0,200,83,0.04)' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Nouveau mot de passe</h2>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 28 }}>Choisissez votre nouveau mot de passe.</p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 18 }}>
          <label style={lblS}>Nouveau mot de passe</label>
          <div style={{ position: 'relative' }}>
            <Lock size={15} style={icoS} />
            <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} style={inputS} placeholder="8 caractères minimum" />
          </div>
          {errors.password && <p style={{ fontSize: 11, color: '#ef4444', marginTop: 6 }}>{errors.password}</p>}
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={lblS}>Confirmer le mot de passe</label>
          <div style={{ position: 'relative' }}>
            <Lock size={15} style={icoS} />
            <input type="password" value={formData.confirmPassword} onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} style={inputS} placeholder="••••••••" />
          </div>
          {errors.confirmPassword && <p style={{ fontSize: 11, color: '#ef4444', marginTop: 6 }}>{errors.confirmPassword}</p>}
        </div>

        {serverError && (
          <div style={{ fontSize: 13, color: '#ef4444', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)', borderRadius: 10, padding: '10px 14px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />{serverError}
          </div>
        )}

        <button type="submit" disabled={loading} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))', color: 'var(--text-primary)', fontWeight: 600,
          fontSize: 14, padding: '13px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
          boxShadow: '0 4px 24px rgba(0,200,83,0.2)', opacity: loading ? 0.6 : 1,
        }}>
          {loading ? <Loader2 size={16} /> : <>Mettre à jour <ArrowRight size={16} /></>}
        </button>
      </form>

      <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border-primary)', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
          Lien expiré ?{' '}
          <Link href="/reset-password" style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>Redemander un lien</Link>
        </p>
      </div>
    </div>
  )
}
