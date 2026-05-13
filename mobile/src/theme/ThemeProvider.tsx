import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Appearance } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { getTheme, setTheme as setThemeSingleton, type Theme } from './colors'

type Mode = 'auto' | Theme
const STORAGE_KEY = 'closrm.theme.mode'

interface ThemeContextValue {
  /** Thème effectif (résolu après auto). */
  theme: Theme
  /** Mode persistant choisi par l'user. */
  mode: Mode
  setMode: (m: Mode) => Promise<void>
  toggle: () => Promise<void>
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme hors ThemeProvider')
  return ctx
}

const resolveTheme = (mode: Mode): Theme => {
  if (mode === 'auto') {
    return Appearance.getColorScheme() === 'light' ? 'light' : 'dark'
  }
  return mode
}

interface Props {
  children: (theme: Theme) => React.ReactNode
}

/** Provider — accepte une render-prop pour qu'on puisse forcer le remount
 *  de l'arbre enfant sur changement de thème (via key). Sans ça les
 *  composants qui ont déjà rendu gardent les couleurs précédentes en
 *  mémoire (les inline-styles ne re-évaluent pas le proxy). */
export function ThemeProvider({ children }: Props) {
  const [mode, setModeState] = useState<Mode>('auto')
  const [theme, setThemeStateInternal] = useState<Theme>(() => {
    const t = resolveTheme('auto')
    setThemeSingleton(t)
    return t
  })

  // Hydrate depuis SecureStore au démarrage
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const stored = await SecureStore.getItemAsync(STORAGE_KEY)
        if (cancelled) return
        const m: Mode =
          stored === 'dark' || stored === 'light' || stored === 'auto' ? (stored as Mode) : 'auto'
        const t = resolveTheme(m)
        setThemeSingleton(t)
        setModeState(m)
        setThemeStateInternal(t)
      } catch {
        /* default auto */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Réagit au changement de mode système quand on est en 'auto'
  useEffect(() => {
    if (mode !== 'auto') return
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      const t: Theme = colorScheme === 'light' ? 'light' : 'dark'
      setThemeSingleton(t)
      setThemeStateInternal(t)
    })
    return () => sub.remove()
  }, [mode])

  const setMode = useCallback(async (m: Mode) => {
    const t = resolveTheme(m)
    setThemeSingleton(t)
    setModeState(m)
    setThemeStateInternal(t)
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, m)
    } catch {
      /* swallow */
    }
  }, [])

  const toggle = useCallback(async () => {
    // toggle bascule explicitement entre dark et light (sort de 'auto')
    const next: Mode = getTheme() === 'dark' ? 'light' : 'dark'
    await setMode(next)
  }, [setMode])

  // key = theme : force le remount de l'arbre enfant à chaque changement
  // → tous les composants re-renderent et lisent le nouveau proxy `colors`.
  return (
    <ThemeContext.Provider value={{ theme, mode, setMode, toggle }}>
      {children(theme)}
    </ThemeContext.Provider>
  )
}
