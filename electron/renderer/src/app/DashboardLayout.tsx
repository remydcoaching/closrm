import { Outlet } from 'react-router-dom'
import { Sidebar } from '../design-system/Sidebar'
import { useAuth } from '../lib/auth-context'
import { Button } from '../design-system/Button'

export function DashboardLayout() {
  const { logout } = useAuth()
  return (
    <div style={{ display: 'flex', height: '100vh', minHeight: 0, background: 'var(--color-bg)' }}>
      <Sidebar />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--color-bg)',
          overflow: 'hidden',
        }}
      >
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 'var(--space-3) var(--space-6)',
            borderBottom: '1px solid var(--color-border)',
            flexShrink: 0,
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)' }}>ClosRM</span>
          <Button variant="ghost" onClick={logout}>
            Déconnexion
          </Button>
        </header>
        <main style={{ flex: 1, minHeight: 0 }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
