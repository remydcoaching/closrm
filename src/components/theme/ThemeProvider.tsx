'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

const LIGHT_VARS: Record<string, string> = {
  '--bg-primary': '#ffffff',
  '--bg-secondary': '#f5f5f5',
  '--bg-elevated': '#ffffff',
  '--bg-input': '#f9fafb',
  '--bg-hover': 'rgba(0,0,0,0.04)',
  '--bg-subtle': 'rgba(0,0,0,0.02)',
  '--bg-active': 'rgba(0,200,83,0.08)',
  '--border-primary': 'rgba(0,0,0,0.08)',
  '--border-secondary': '#e5e7eb',
  '--text-primary': '#111827',
  '--text-secondary': '#6b7280',
  '--text-tertiary': '#9ca3af',
  '--text-muted': '#d1d5db',
  '--text-label': '#9ca3af',
  '--text-disabled': '#d1d5db',
  '--grid-line': 'rgba(0,0,0,0.03)',
  '--shadow-dropdown': 'rgba(0,0,0,0.15)',
  '--scrollbar-thumb': 'rgba(0,0,0,0.12)',
  '--scrollbar-hover': 'rgba(0,0,0,0.2)',
}

const ThemeContext = createContext<{
  theme: Theme
  setTheme: (t: Theme) => void
}>({ theme: 'dark', setTheme: () => {} })

export function useTheme() {
  return useContext(ThemeContext)
}

function applyTheme(t: Theme) {
  const el = document.documentElement
  if (t === 'light') {
    Object.entries(LIGHT_VARS).forEach(([k, v]) => el.style.setProperty(k, v))
  } else {
    Object.keys(LIGHT_VARS).forEach(k => el.style.removeProperty(k))
  }
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')

  useEffect(() => {
    const saved = localStorage.getItem('closrm-theme') as Theme | null
    if (saved === 'light') {
      setThemeState('light')
      applyTheme('light')
    }
  }, [])

  function setTheme(t: Theme) {
    setThemeState(t)
    applyTheme(t)
    localStorage.setItem('closrm-theme', t)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
