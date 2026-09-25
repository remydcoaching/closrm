import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { api } from '../lib/api-client'
import { Sidebar } from '../design-system/Sidebar'
import { useAuth } from '../lib/auth-context'
import { Button } from '../design-system/Button'
import './dashboard-layout.css'

interface IgAccountStatus {
  ig_username: string | null
  is_connected: boolean
}

// "ClosRM · Instagram @handle · Connecté" next to the brand, like Insyder's
// header — reads the workspace's connected account (GET /api/instagram/account).
// Only the username and connection flag are kept from the response.
function useInstagramAccount() {
  const [account, setAccount] = useState<IgAccountStatus | null | undefined>(undefined)
  useEffect(() => {
    api
      .get<{ data: IgAccountStatus | null }>('/api/instagram/account')
      .then((res) => setAccount(res.data ? { ig_username: res.data.ig_username, is_connected: res.data.is_connected } : null))
      .catch(() => setAccount(null))
  }, [])
  return account
}

export function DashboardLayout() {
  const { logout } = useAuth()
  const igAccount = useInstagramAccount()
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
          <div className="app-header-brand">
            <span className="app-header-title">ClosRM</span>
            {igAccount !== undefined && (
              <span className={`app-header-ig ${igAccount?.is_connected ? 'app-header-ig--on' : ''}`}>
                <span className="app-header-ig-dot" />
                {igAccount?.is_connected
                  ? `Instagram @${igAccount.ig_username ?? '—'} · Connecté`
                  : 'Instagram non connecté'}
              </span>
            )}
          </div>
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
