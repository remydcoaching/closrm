'use client'

import { useState } from 'react'
import Sidebar from './Sidebar'
import { cn } from '@/lib/utils'

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="h-screen bg-[#0A0A0A]">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <main
        className={cn(
          'h-screen overflow-y-auto transition-all duration-200',
          collapsed ? 'ml-[60px]' : 'ml-[220px]'
        )}
      >
        {children}
      </main>
    </div>
  )
}
