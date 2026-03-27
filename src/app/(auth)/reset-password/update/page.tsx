'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { updatePasswordSchema, type UpdatePasswordFormData } from '@/lib/validations/auth'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [formData, setFormData] = useState<UpdatePasswordFormData>({
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof UpdatePasswordFormData, string>>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})
    setServerError(null)

    const result = updatePasswordSchema.safeParse(formData)
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof UpdatePasswordFormData, string>> = {}
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof UpdatePasswordFormData
        if (!fieldErrors[field]) fieldErrors[field] = issue.message
      })
      setErrors(fieldErrors)
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        password: result.data.password,
      })

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

  return (
    <div className="bg-[#141414] border border-[#262626] rounded-xl p-8">
      <h2 className="text-xl font-semibold text-white mb-2">Nouveau mot de passe</h2>
      <p className="text-sm text-[#A0A0A0] mb-6">
        Choisissez votre nouveau mot de passe.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-[#A0A0A0] mb-1.5">Nouveau mot de passe</label>
          <input
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="w-full bg-[#0A0A0A] border border-[#262626] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#A0A0A0] focus:outline-none focus:border-[#00C853] transition-colors"
            placeholder="8 caractères minimum"
          />
          {errors.password && (
            <p className="text-xs text-[#00C853] mt-1">{errors.password}</p>
          )}
        </div>

        <div>
          <label className="block text-sm text-[#A0A0A0] mb-1.5">Confirmer le mot de passe</label>
          <input
            type="password"
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            className="w-full bg-[#0A0A0A] border border-[#262626] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#A0A0A0] focus:outline-none focus:border-[#00C853] transition-colors"
            placeholder="••••••••"
          />
          {errors.confirmPassword && (
            <p className="text-xs text-[#00C853] mt-1">{errors.confirmPassword}</p>
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
          className="w-full bg-[#00C853] hover:bg-[#00A844] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
        >
          {loading ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}
        </button>
      </form>

      <p className="text-center text-sm text-[#A0A0A0] mt-6">
        Lien expiré ?{' '}
        <Link href="/reset-password" className="text-[#00C853] hover:underline">
          Redemander un lien
        </Link>
      </p>
    </div>
  )
}
