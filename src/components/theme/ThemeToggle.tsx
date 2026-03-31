'use client'

import { Sun, Moon } from 'lucide-react'
import { useTheme } from './ThemeProvider'
import { useEffect, useState } from 'react'

export default function ThemeToggle({ collapsed }: { collapsed?: boolean }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) return null

  const isDark = theme === 'dark'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={collapsed ? (isDark ? 'Mode clair' : 'Mode sombre') : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: collapsed ? '8px 0' : '7px 10px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: 8,
        fontSize: 13,
        color: 'var(--text-tertiary)',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      {isDark ? <Sun size={16} style={{ flexShrink: 0 }} /> : <Moon size={16} style={{ flexShrink: 0 }} />}
      {!collapsed && <span>{isDark ? 'Mode clair' : 'Mode sombre'}</span>}
    </button>
  )
}
