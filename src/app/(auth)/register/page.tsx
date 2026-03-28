'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { registerSchema, type RegisterFormData } from '@/lib/validations/auth'
import { Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react'

function mapErr(msg: string): string {
  if (msg.includes('already') || msg.includes('registered')) return 'Impossible de créer ce compte. Vérifiez vos informations ou essayez de vous connecter.'
  if (msg.includes('password')) return 'Le mot de passe ne respecte pas les critères requis.'
  return 'Une erreur est survenue. Veuillez réessayer.'
}

const inputS: React.CSSProperties = {
  width: '100%', background: 'rgba(9,9,11,0.8)', border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 10, padding: '12px 14px 12px 42px', color: '#fff', fontSize: 13, outline: 'none',
}
const lblS: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 700, color: '#555', marginBottom: 8, letterSpacing: '0.15em', textTransform: 'uppercase' }
const icoS: React.CSSProperties = { position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#555' }

export default function RegisterPage() {
  const router = useRouter()
  const [fd, setFd] = useState<RegisterFormData>({ fullName: '', email: '', password: '' })
  const [errs, setErrs] = useState<Partial<Record<keyof RegisterFormData, string>>>({})
  const [sErr, setSErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setErrs({}); setSErr(null)
    const r = registerSchema.safeParse(fd)
    if (!r.success) { const fe: Partial<Record<keyof RegisterFormData, string>> = {}; r.error.issues.forEach((i) => { const f = i.path[0] as keyof RegisterFormData; if (!fe[f]) fe[f] = i.message }); setErrs(fe); return }
    setLoading(true)
    try {
      const { error } = await createClient().auth.signUp({ email: r.data.email, password: r.data.password, options: { data: { full_name: r.data.fullName } } })
      if (error) { setSErr(mapErr(error.message)); setLoading(false); return }
      router.push('/dashboard'); router.refresh()
    } catch { setSErr('Une erreur est survenue.'); setLoading(false) }
  }

  const fields = [
    { key: 'fullName' as const, label: 'Nom complet', Icon: User, type: 'text', ph: 'Jean Dupont' },
    { key: 'email' as const, label: 'Email', Icon: Mail, type: 'email', ph: 'coach@example.com' },
    { key: 'password' as const, label: 'Mot de passe', Icon: Lock, type: 'password', ph: '8 caractères minimum' },
  ]

  return (
    <div style={{ background: 'linear-gradient(135deg, rgba(17,17,19,0.9), rgba(12,12,14,0.95))', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '36px 32px', boxShadow: '0 0 60px rgba(0,200,83,0.04)' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Créer un compte</h2>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 28 }}>Commencez à gérer vos leads en 2 minutes</p>

      <form onSubmit={onSubmit}>
        {fields.map((f) => (
          <div key={f.key} style={{ marginBottom: 18 }}>
            <label style={lblS}>{f.label}</label>
            <div style={{ position: 'relative' }}>
              <f.Icon size={15} style={icoS} />
              <input type={f.type} value={fd[f.key]} onChange={(e) => setFd({ ...fd, [f.key]: e.target.value })} style={inputS} placeholder={f.ph} />
            </div>
            {errs[f.key] && <p style={{ fontSize: 11, color: '#ef4444', marginTop: 6 }}>{errs[f.key]}</p>}
          </div>
        ))}

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
          {loading ? <Loader2 size={16} /> : <>Créer mon compte <ArrowRight size={16} /></>}
        </button>
      </form>

      <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: '#888' }}>Déjà un compte ? <Link href="/login" style={{ color: '#00C853', fontWeight: 600, textDecoration: 'none' }}>Se connecter</Link></p>
      </div>
    </div>
  )
}
