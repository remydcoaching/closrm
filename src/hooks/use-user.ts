'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User as AuthUser } from '@supabase/supabase-js'
import type { User } from '@/types'

interface UseUserReturn {
  authUser: AuthUser | null
  profile: User | null
  workspaceId: string | null
  loading: boolean
  error: string | null
}

export function useUser(): UseUserReturn {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function loadUser() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
          setAuthUser(null)
          setProfile(null)
          setLoading(false)
          return
        }

        setAuthUser(user)

        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single()

        if (profileError || !userProfile) {
          setError('Profil utilisateur introuvable.')
          setLoading(false)
          return
        }

        setProfile(userProfile as User)
      } catch {
        setError('Erreur lors du chargement du profil.')
      } finally {
        setLoading(false)
      }
    }

    loadUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT' || !session?.user) {
          setAuthUser(null)
          setProfile(null)
          return
        }

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setAuthUser(session.user)

          const { data: userProfile } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single()

          if (userProfile) {
            setProfile(userProfile as User)
          }
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return {
    authUser,
    profile,
    workspaceId: profile?.workspace_id ?? null,
    loading,
    error,
  }
}
