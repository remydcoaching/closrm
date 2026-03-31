'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

const ThemeContext = createContext<{
  theme: Theme
  setTheme: (t: Theme) => void
}>({ theme: 'dark', setTheme: () => {} })

export function useTheme() {
  return useContext(ThemeContext)
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')

  useEffect(() => {
    const saved = localStorage.getItem('closrm-theme') as Theme | null
    if (saved === 'light' || saved === 'dark') {
      setThemeState(saved)
      document.documentElement.setAttribute('data-theme', saved)
    }
  }, [])

  function setTheme(t: Theme) {
    setThemeState(t)
    document.documentElement.setAttribute('data-theme', t)
    localStorage.setItem('closrm-theme', t)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
