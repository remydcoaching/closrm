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
    </div>
  )
}
