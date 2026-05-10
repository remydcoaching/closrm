'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import PageTabs from './PageTabs'
import { TAB_GROUPS } from '@/lib/layout/page-tab-groups'

function findTabGroupForPath(pathname: string) {
  for (const group of Object.values(TAB_GROUPS)) {
    const match = group.tabs.some((t) => pathname === t.href || pathname.startsWith(t.href + '/'))
    if (match) return group
  }
  return null
}

export default function DashboardShell({ children, logoUrl }: { children: React.ReactNode; logoUrl?: string | null }) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const activeGroup = findTabGroupForPath(pathname)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} logoUrl={logoUrl} />
      <main style={{
        marginLeft: collapsed ? 64 : 220,
        minHeight: '100vh',
        transition: 'margin-left 0.2s ease',
      }}>
        {activeGroup && <PageTabs tabs={activeGroup.tabs} />}
        {children}
      </main>

      {/* DEBUG MARKER — confirme que la nouvelle build est bien chargée
          chez l'utilisateur. Si vous voyez ce bandeau, mes derniers commits
          (color picker, inline edit, popup central) sont en prod. À retirer
          une fois le bug deploy résolu. */}
      <div
        data-debug-build="2026-05-10-v2"
        style={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          zIndex: 99999,
          background: '#ff00ff',
          color: '#000',
          padding: '10px 16px',
          borderRadius: 12,
          fontSize: 13,
          fontWeight: 700,
          fontFamily: 'monospace',
          boxShadow: '0 4px 24px rgba(255,0,255,0.6), 0 0 0 3px #fff',
          letterSpacing: 0.5,
          pointerEvents: 'none',
        }}
      >
        🟣 BUILD OK — 22:40
      </div>
    </div>
  )
}
