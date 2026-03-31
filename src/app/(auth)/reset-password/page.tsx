'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { resetPasswordSchema, type ResetPasswordFormData } from '@/lib/validations/auth'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<Partial<Record<keyof ResetPasswordFormData, string>>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})
    setServerError(null)

    const result = resetPasswordSchema.safeParse({ email })
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof ResetPasswordFormData, string>> = {}
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof ResetPasswordFormData
        if (!fieldErrors[field]) fieldErrors[field] = issue.message
      })
      setErrors(fieldErrors)
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(result.data.email, {
        redirectTo: `${window.location.origin}/reset-password/update`,
      })

      if (error) {
        setServerError('Une erreur est survenue. Veuillez réessayer.')
        setLoading(false)
        return
      }

      setSent(true)
    } catch {
      setServerError('Une erreur est survenue. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-secondary)] rounded-xl p-8">
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">Email envoyé</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.
          Vérifiez votre boîte de réception et vos spams.
        </p>
        <Link
          href="/login"
          className="block w-full text-center bg-[var(--bg-elevated)] border border-[var(--border-secondary)] hover:border-[#00C853] text-[var(--text-primary)] font-medium py-2.5 rounded-lg transition-colors text-sm"
        >
          Retour à la connexion
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-[var(--bg-elevated)] border border-[var(--border-secondary)] rounded-xl p-8">
      <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Mot de passe oublié</h2>
      <p className="text-sm text-[var(--text-secondary)] mb-6">
        Entrez votre email pour recevoir un lien de réinitialisation.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-[var(--text-secondary)] mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-[var(--bg-primary)] border border-[var(--border-secondary)] rounded-lg px-3 py-2.5 text-[var(--text-primary)] text-sm placeholder-[var(--text-secondary)] focus:outline-none focus:border-[#00C853] transition-colors"
            placeholder="coach@example.com"
          />
          {errors.email && (
            <p className="text-xs text-[#00C853] mt-1">{errors.email}</p>
          )}
        </div>

        {serverError && (
          <p className="text-sm text-[#00C853] bg-[#00C853]/10 border border-[#00C853]/20 rounded-lg px-3 py-2">
            {serverError}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#00C853] hover:bg-[#00A844] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--text-primary)] font-medium py-2.5 rounded-lg transition-colors text-sm"
        >
          {loading ? 'Envoi…' : 'Envoyer le lien'}
        </button>
      </form>

      <p className="text-center text-sm text-[var(--text-secondary)] mt-6">
        <Link href="/login" className="text-[#00C853] hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </div>
  )
}
