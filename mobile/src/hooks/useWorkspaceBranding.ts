import { useEffect, useRef, useState } from 'react'
import * as SecureStore from 'expo-secure-store'
import { supabase } from '../services/supabase'
import { useAuth } from './useAuth'
import { setAccentColor, darkenHex, isValidHex } from '../theme/colors'

const STORAGE_KEY = 'closrm.accent_color_v1'

interface BrandingState {
  accentColor: string | null
  loading: boolean
}

/**
 * Charge workspace.accent_color depuis Supabase + persiste en SecureStore
 * pour l'avoir au démarrage suivant sans flash visuel.
 *
 * Injecte la couleur dans le singleton theme via setAccentColor() — elle est
 * appliquée à `colors.primary` partout. Le ThemeProvider est responsable de
 * forcer un remount en cas de changement (cf onApplied).
 */
export function useWorkspaceBranding(onApplied?: () => void): BrandingState & {
  save: (hex: string) => Promise<void>
} {
  const { user } = useAuth()
  const [accentColor, setLocal] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const onAppliedRef = useRef(onApplied)
  onAppliedRef.current = onApplied

  // Cache local au démarrage : applique tout de suite la couleur cachée.
  useEffect(() => {
    void (async () => {
      try {
        const cached = await SecureStore.getItemAsync(STORAGE_KEY)
        if (cached && isValidHex(cached)) {
          applyAccent(cached)
          setLocal(cached)
        }
      } catch {
        /* noop */
      }
    })()
  }, [])

  // Sync depuis Supabase quand user dispo.
  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const { data: profile } = await supabase
          .from('users')
          .select('workspace_id')
          .eq('id', user.id)
          .maybeSingle()
        const workspaceId = (profile as { workspace_id?: string } | null)?.workspace_id
        if (!workspaceId || cancelled) return
        const { data: ws } = await supabase
          .from('workspaces')
          .select('accent_color')
          .eq('id', workspaceId)
          .maybeSingle()
        if (cancelled) return
        const hex = (ws as { accent_color?: string } | null)?.accent_color ?? null
        if (hex && isValidHex(hex)) {
          applyAccent(hex)
          setLocal(hex)
          await SecureStore.setItemAsync(STORAGE_KEY, hex).catch(() => {})
          onAppliedRef.current?.()
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  const save = async (hex: string) => {
    if (!isValidHex(hex)) throw new Error('Hex invalide')
    if (!user) throw new Error('Non authentifié')
    const { data: profile } = await supabase
      .from('users')
      .select('workspace_id')
      .eq('id', user.id)
      .maybeSingle()
    const workspaceId = (profile as { workspace_id?: string } | null)?.workspace_id
    if (!workspaceId) throw new Error('Workspace introuvable')
    const { error } = await supabase
      .from('workspaces')
      .update({ accent_color: hex })
      .eq('id', workspaceId)
    if (error) throw error
    applyAccent(hex)
    setLocal(hex)
    await SecureStore.setItemAsync(STORAGE_KEY, hex).catch(() => {})
    onAppliedRef.current?.()
  }

  return { accentColor, loading, save }
}

function applyAccent(hex: string) {
  // En dark on prend le hex tel quel. En light on assombrit légèrement
  // pour garder du contraste sur fond blanc (mêmes 15% que web).
  setAccentColor({ dark: hex, light: darkenHex(hex, 15) })
}
