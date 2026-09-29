// App shell — floating sidebar + Insyder-style top bar:
// [logo ClosRM] [(avatar) @handle · ● Connecté (ig)] ............ [user ▾]
// If no Instagram account is known after login, the onboarding asks for it
// before anything else (every Hiker feature needs it).
import { useEffect, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '../design-system/Sidebar'
import { Avatar } from '../design-system/Avatar'
import { useAuth } from '../lib/auth-context'
import { InstagramAccountProvider, useInstagramAccount } from '../lib/instagram-account'
import { StoryCollectorProvider, useStoryCollector } from '../lib/story-collector'
import { InstagramAccountModal, InstagramOnboarding } from './InstagramOnboarding'
import { LoadingState } from '../design-system/States'
import './dashboard-layout.css'

const InstagramGlyph = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
)

export function DashboardLayout() {
  return (
    <InstagramAccountProvider>
      <Shell />
    </InstagramAccountProvider>
  )
}

function Shell() {
  const { account, skipped } = useInstagramAccount()
  const [editing, setEditing] = useState(false)

  if (account === undefined) return <LoadingState label="Chargement de votre compte…" />
  if (account === null && !skipped) return <InstagramOnboarding />

  return (
    <StoryCollectorProvider>
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <header className="app-topbar">
          <div className="app-topbar-left">
            <span className="app-brand">
              <span className="app-brand-logo" aria-hidden="true">
                <svg width="100%" height="100%" viewBox="0 0 30 30">
                  <path d="M19.55 20.05 A6.8 6.8 0 1 1 19.55 9.95" fill="none" stroke="#fff" strokeWidth="3.35" strokeLinecap="round" />
                  <circle cx="15" cy="15" r="2.1" fill="#fff" />
                </svg>
              </span>
              ClosRM
            </span>
            {account ? (
              <button type="button" className="app-ig-pill" onClick={() => setEditing(true)} title="Changer de compte Instagram">
                <OwnInstagramAvatar username={account.username} />
                <span className="app-ig-pill-text">
                  <span className="app-ig-pill-handle">@{account.username}</span>
                  <span className="app-ig-pill-status">
                    <i /> Connecté
                  </span>
                </span>
                <span className="app-ig-pill-glyph">{InstagramGlyph}</span>
              </button>
            ) : (
              <button type="button" className="app-ig-pill app-ig-pill--empty" onClick={() => setEditing(true)}>
                <span className="app-ig-pill-glyph">{InstagramGlyph}</span>
                <span className="app-ig-pill-handle">Ajouter mon compte Instagram</span>
              </button>
            )}
          </div>
          <UserMenu />
        </header>
        <main className="app-content">
          <Outlet />
        </main>
      </div>
      {editing && <InstagramAccountModal onClose={() => setEditing(false)} />}
    </div>
    </StoryCollectorProvider>
  )
}

function UserMenu() {
  const { session, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const meta = (session?.user.user_metadata ?? {}) as { full_name?: string; name?: string }
  const name = meta.full_name || meta.name || session?.user.email?.split('@')[0] || 'Mon compte'

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div className="app-user" ref={ref}>
      <button type="button" className="app-user-button" onClick={() => setOpen((o) => !o)}>
        <Avatar name={name} size={30} />
        <span className="app-user-name">{name}</span>
        <span className="app-user-caret">▾</span>
      </button>
      {open && (
        <div className="app-user-menu">
          <div className="app-user-menu-email">{session?.user.email}</div>
          <button type="button" onClick={logout}>
            Déconnexion
          </button>
        </div>
      )}
    </div>
  )
}

/** The coach's own Instagram picture, read from their session (main process). */
function OwnInstagramAvatar({ username }: { username: string }) {
  const { status } = useStoryCollector()
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    if (!status?.connected) return
    window.closrm?.instagram?.ownPicture(username).then(setSrc).catch(() => setSrc(null))
  }, [status?.connected, username])
  return <Avatar name={username} size={30} src={src} />
}
