import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Appearance } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import {
  getTheme,
  setTheme as setThemeSingleton,
  setAccentColor,
  darkenHex,
  isValidHex,
  type Theme,
} from './colors'

type Mode = 'auto' | Theme
const STORAGE_KEY = 'closrm.theme.mode'
const ACCENT_KEY = 'closrm.accent_color_v1'

interface ThemeContextValue {
  /** Thème effectif (résolu après auto). */
  theme: Theme
  /** Mode persistant choisi par l'user. */
  mode: Mode
  setMode: (m: Mode) => Promise<void>
  toggle: () => Promise<void>
  /** Couleur d'accent actuelle (hex). null = défaut vert ClosRM. */
  accent: string | null
  /** Change la couleur d'accent ; null = reset au défaut. */
  setAccent: (hex: string | null) => Promise<void>
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
  /** Render-prop. La `key` qu'on calcule en interne (theme + accent) sert
   *  à forcer le remount de l'arbre quand l'un des deux change. */
  children: (theme: Theme, key: string) => React.ReactNode
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
  const [accent, setAccentState] = useState<string | null>(null)

  // Hydrate depuis SecureStore au démarrage
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [storedMode, storedAccent] = await Promise.all([
          SecureStore.getItemAsync(STORAGE_KEY),
          SecureStore.getItemAsync(ACCENT_KEY),
        ])
        if (cancelled) return
        const m: Mode =
          storedMode === 'dark' || storedMode === 'light' || storedMode === 'auto'
            ? (storedMode as Mode)
            : 'auto'
        const t = resolveTheme(m)
        setThemeSingleton(t)
        setModeState(m)
        setThemeStateInternal(t)
        if (storedAccent && isValidHex(storedAccent)) {
          applyAccentToSingleton(storedAccent)
          setAccentState(storedAccent)
        }
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

  const setAccent = useCallback(async (hex: string | null) => {
    if (hex !== null && !isValidHex(hex)) return
    if (hex) applyAccentToSingleton(hex)
    else setAccentColor({ dark: null, light: null })
    setAccentState(hex)
    try {
      if (hex) await SecureStore.setItemAsync(ACCENT_KEY, hex)
      else await SecureStore.deleteItemAsync(ACCENT_KEY)
    } catch {
      /* swallow */
    }
  }, [])

  // key = theme + accent : force le remount de l'arbre enfant à chaque
  // changement → tous les composants re-renderent et lisent le proxy `colors`
  // mis à jour. Indispensable pour les inline-styles qui ne re-évaluent pas
  // le proxy d'eux-mêmes.
  const remountKey = `${theme}:${accent ?? 'default'}`

  return (
    <ThemeContext.Provider value={{ theme, mode, setMode, toggle, accent, setAccent }}>
      {children(theme, remountKey)}
    </ThemeContext.Provider>
  )
}

function applyAccentToSingleton(hex: string) {
  // Dark : hex tel quel. Light : assombri 15% pour le contraste sur fond clair.
  setAccentColor({ dark: hex, light: darkenHex(hex, 15) })
}
