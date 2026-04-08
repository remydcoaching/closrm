'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, Phone, Bell, BarChart2, Database,
  Zap, Megaphone, Mail, Settings, Plug, PanelLeftClose, PanelLeft, LogOut,
  CalendarDays, CalendarRange, Layers, Share2, MessageCircle, Sparkles,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ThemeToggle from '@/components/theme/ThemeToggle'

const NAV = [
  {
    title: 'VENTES',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Agenda', href: '/agenda', icon: CalendarDays },
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
      { label: 'Funnels', href: '/acquisition/funnels', icon: Layers },
      { label: 'Automations', href: '/acquisition/automations', icon: Zap },
      { label: 'Emails', href: '/acquisition/emails', icon: Mail },
      { label: 'Réseaux sociaux', href: '/acquisition/reseaux-sociaux', icon: Share2 },
      { label: 'Messages', href: '/acquisition/messages', icon: MessageCircle },
      { label: 'Publicités', href: '/acquisition/publicites', icon: Megaphone },
    ],
  },
  {
    title: 'COMPTE',
    items: [
      { label: 'Paramètres', href: '/parametres/reglages', icon: Settings },
      { label: 'Intégrations', href: '/parametres/integrations', icon: Plug },
      { label: 'Calendriers', href: '/parametres/calendriers', icon: CalendarRange },
      { label: 'Assistant IA', href: '/parametres/assistant-ia', icon: Sparkles },
    ],
  },
]

export default function Sidebar({ collapsed, onToggle, logoUrl }: { collapsed: boolean; onToggle: () => void; logoUrl?: string | null }) {
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
      background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-primary)',
      display: 'flex', flexDirection: 'column', zIndex: 40,
      transition: 'width 0.2s ease',
    }}>
      {/* Header */}
      <div style={{
        height: 56, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between',
        padding: '0 16px', borderBottom: '1px solid var(--border-primary)', flexShrink: 0,
      }}>
        {!collapsed && (
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', textDecoration: 'none' }}>
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }} />
            ) : null}
            Clos<span style={{ color: 'var(--color-primary)' }}>RM</span>
          </Link>
        )}
        {collapsed && logoUrl && (
          <Link href="/dashboard" style={{ textDecoration: 'none' }}>
            <img src={logoUrl} alt="Logo" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }} />
          </Link>
        )}
        <button onClick={onToggle} style={{
          width: 28, height: 28, borderRadius: 6, background: 'var(--bg-hover)',
          border: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)',
        }}>
          {collapsed ? <PanelLeft size={14} /> : <PanelLeftClose size={14} />}
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
        {NAV.map((group) => (
          <div key={group.title} style={{ marginBottom: 20 }}>
            {!collapsed && (
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-label)', padding: '0 10px', marginBottom: 6, letterSpacing: '0.2em', textTransform: 'uppercase' as const }}>
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
                  color: active ? 'var(--color-primary)' : 'var(--text-tertiary)',
                  background: active ? 'var(--bg-active)' : 'transparent',
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

      {/* Footer */}
      <div style={{ padding: 8, borderTop: '1px solid var(--border-primary)', flexShrink: 0 }}>
        <ThemeToggle collapsed={collapsed} />
        <button onClick={logout} title={collapsed ? 'Déconnexion' : undefined} style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          padding: collapsed ? '8px 0' : '7px 10px', justifyContent: collapsed ? 'center' : 'flex-start',
          borderRadius: 8, fontSize: 13, color: 'var(--text-tertiary)', background: 'transparent',
          border: 'none', cursor: 'pointer', transition: 'all 0.15s ease',
        }}>
          <LogOut size={16} style={{ flexShrink: 0 }} />
          {!collapsed && <span>Déconnexion</span>}
        </button>
      </div>
    </aside>
  )
}
