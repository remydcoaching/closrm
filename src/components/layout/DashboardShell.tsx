'use client'

import { useState } from 'react'
import Sidebar from './Sidebar'

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div style={{ minHeight: '100vh', background: '#09090b' }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
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
