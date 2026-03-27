'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { loginSchema, type LoginFormData } from '@/lib/validations/auth'
import { Mail, Lock, ArrowRight, Loader2 } from 'lucide-react'

const input: React.CSSProperties = {
  width: '100%', background: 'rgba(9,9,11,0.8)', border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 10, padding: '12px 14px 12px 42px', color: '#fff', fontSize: 13, outline: 'none',
}

export default function LoginPage() {
  const router = useRouter()
  const [fd, setFd] = useState<LoginFormData>({ email: '', password: '' })
  const [errs, setErrs] = useState<Partial<Record<keyof LoginFormData, string>>>({})
  const [sErr, setSErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErrs({}); setSErr(null)
    const r = loginSchema.safeParse(fd)
    if (!r.success) { const fe: Partial<Record<keyof LoginFormData, string>> = {}; r.error.issues.forEach((i) => { const f = i.path[0] as keyof LoginFormData; if (!fe[f]) fe[f] = i.message }); setErrs(fe); return }
    setLoading(true)
    try {
      const { error } = await createClient().auth.signInWithPassword({ email: r.data.email, password: r.data.password })
      if (error) { setSErr('Email ou mot de passe incorrect.'); setLoading(false); return }
      router.push('/dashboard'); router.refresh()
    } catch { setSErr('Une erreur est survenue.'); setLoading(false) }
  }

  const lbl: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 700, color: '#555', marginBottom: 8, letterSpacing: '0.15em', textTransform: 'uppercase' }
  const ico: React.CSSProperties = { position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#555' }

  return (
    <div style={{ background: 'linear-gradient(135deg, rgba(17,17,19,0.9), rgba(12,12,14,0.95))', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '36px 32px', boxShadow: '0 0 60px rgba(0,200,83,0.04)' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Bon retour 👋</h2>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 28 }}>Connectez-vous à votre espace ClosRM</p>

      <form onSubmit={submit}>
        <div style={{ marginBottom: 18 }}>
          <label style={lbl}>Email</label>
          <div style={{ position: 'relative' }}>
            <Mail size={15} style={ico} />
            <input type="email" value={fd.email} onChange={(e) => setFd({ ...fd, email: e.target.value })} style={input} placeholder="coach@example.com" />
          </div>
          {errs.email && <p style={{ fontSize: 11, color: '#ef4444', marginTop: 6 }}>{errs.email}</p>}
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Mot de passe</label>
          <div style={{ position: 'relative' }}>
            <Lock size={15} style={ico} />
            <input type="password" value={fd.password} onChange={(e) => setFd({ ...fd, password: e.target.value })} style={input} placeholder="••••••••" />
          </div>
          {errs.password && <p style={{ fontSize: 11, color: '#ef4444', marginTop: 6 }}>{errs.password}</p>}
        </div>

        <div style={{ textAlign: 'right', marginBottom: 20 }}>
          <Link href="/reset-password" style={{ fontSize: 12, color: '#888', textDecoration: 'none' }}>Mot de passe oublié ?</Link>
        </div>

        {sErr && (
          <div style={{ fontSize: 13, color: '#ef4444', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)', borderRadius: 10, padding: '10px 14px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />{sErr}
          </div>
        )}

        <button type="submit" disabled={loading} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: 'linear-gradient(135deg, #00C853, #00A844)', color: '#fff', fontWeight: 600,
          fontSize: 14, padding: '13px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
          boxShadow: '0 4px 24px rgba(0,200,83,0.2)', opacity: loading ? 0.6 : 1,
        }}>
          {loading ? <Loader2 size={16} /> : <>Se connecter <ArrowRight size={16} /></>}
        </button>
      </form>

      <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: '#888' }}>Pas encore de compte ? <Link href="/register" style={{ color: '#00C853', fontWeight: 600, textDecoration: 'none' }}>S&apos;inscrire</Link></p>
      </div>
    </div>
  )
}
