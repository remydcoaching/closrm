'use client'

import { useState } from 'react'
import Sidebar from './Sidebar'

export default function DashboardShell({ children, logoUrl }: { children: React.ReactNode; logoUrl?: string | null }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} logoUrl={logoUrl} />
      <main style={{
        marginLeft: collapsed ? 64 : 220,
        minHeight: '100vh',
        transition: 'margin-left 0.2s ease',
      }}>
        {children}
      </main>
    </div>
  )
}
