'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, Phone, Bell, BarChart2, Database,
  Zap, Megaphone, Settings, PanelLeftClose, PanelLeft, LogOut,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  {
    title: 'VENTES',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Leads', href: '/leads', icon: Users },
      { label: 'Closing', href: '/closing', icon: Phone },
      { label: 'Follow-ups', href: '/follow-ups', icon: Bell },
      { label: 'Statistiques', href: '/statistiques', icon: BarChart2 },
      { label: 'Base de données', href: '/base-de-donnees', icon: Database },
    ],
  },
  {
    title: 'ACQUISITION',
    items: [
      { label: 'Automations', href: '/acquisition/automations', icon: Zap },
      { label: 'Publicités', href: '/acquisition/publicites', icon: Megaphone },
    ],
  },
  {
    title: 'COMPTE',
    items: [
      { label: 'Paramètres', href: '/parametres/reglages', icon: Settings },
    ],
  },
]

export default function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const W = collapsed ? 64 : 220

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside style={{
      position: 'fixed', left: 0, top: 0, bottom: 0, width: W,
      background: '#0c0c0e', borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column', zIndex: 40,
      transition: 'width 0.2s ease',
    }}>
      {/* Header */}
      <div style={{
        height: 56, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between',
        padding: '0 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
      }}>
        {!collapsed && (
          <Link href="/dashboard" style={{ fontSize: 18, fontWeight: 700, color: '#fff', textDecoration: 'none' }}>
            Clos<span style={{ color: '#00C853' }}>RM</span>
          </Link>
        )}
        <button onClick={onToggle} style={{
          width: 28, height: 28, borderRadius: 6, background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer', color: '#666',
        }}>
          {collapsed ? <PanelLeft size={14} /> : <PanelLeftClose size={14} />}
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
        {NAV.map((group) => (
          <div key={group.title} style={{ marginBottom: 20 }}>
            {!collapsed && (
              <div style={{ fontSize: 9, fontWeight: 700, color: '#444', padding: '0 10px', marginBottom: 6, letterSpacing: '0.2em', textTransform: 'uppercase' as const }}>
                {group.title}
              </div>
            )}
            {group.items.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '8px 0' : '7px 10px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  borderRadius: 8, fontSize: 13, textDecoration: 'none', marginBottom: 2,
                  color: active ? '#00C853' : '#888',
                  background: active ? 'rgba(0,200,83,0.08)' : 'transparent',
                  transition: 'all 0.15s ease',
                }}>
                  <Icon size={16} style={{ flexShrink: 0 }} />
                  {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{item.label}</span>}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div style={{ padding: 8, borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <button onClick={logout} title={collapsed ? 'Déconnexion' : undefined} style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          padding: collapsed ? '8px 0' : '7px 10px', justifyContent: collapsed ? 'center' : 'flex-start',
          borderRadius: 8, fontSize: 13, color: '#888', background: 'transparent',
          border: 'none', cursor: 'pointer', transition: 'all 0.15s ease',
        }}>
          <LogOut size={16} style={{ flexShrink: 0 }} />
          {!collapsed && <span>Déconnexion</span>}
        </button>
      </div>
    </aside>
  )
}
