'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email ou mot de passe incorrect.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="bg-[#141414] border border-[#262626] rounded-xl p-8">
      <h2 className="text-xl font-semibold text-white mb-6">Connexion</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-[#A0A0A0] mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-[#0A0A0A] border border-[#262626] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#A0A0A0] focus:outline-none focus:border-[#E53E3E] transition-colors"
            placeholder="coach@example.com"
          />
        </div>

        <div>
          <label className="block text-sm text-[#A0A0A0] mb-1.5">Mot de passe</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full bg-[#0A0A0A] border border-[#262626] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#A0A0A0] focus:outline-none focus:border-[#E53E3E] transition-colors"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <p className="text-sm text-[#E53E3E] bg-[#E53E3E]/10 border border-[#E53E3E]/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#E53E3E] hover:bg-[#C53030] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
        >
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>

      <p className="text-center text-sm text-[#A0A0A0] mt-6">
        Pas encore de compte ?{' '}
        <Link href="/register" className="text-[#E53E3E] hover:underline">
          S&apos;inscrire
        </Link>
      </p>
    </div>
  )
}
