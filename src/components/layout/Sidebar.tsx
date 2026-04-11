'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, Phone, Bell, BarChart2, Database,
  Zap, Megaphone, Mail, Settings, Plug, PanelLeftClose, PanelLeft, LogOut,
  CalendarDays, CalendarRange, Layers, Share2, MessageCircle, MessagesSquare, Sparkles, Users2,
  GraduationCap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isRouteVisible } from '@/lib/permissions'
import type { WorkspaceRole } from '@/types'
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
      { label: 'Chat équipe', href: '/equipe/messages', icon: MessagesSquare },
      { label: 'Formation', href: '/equipe/formation', icon: GraduationCap },
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
      { label: 'Equipe', href: '/parametres/equipe', icon: Users2 },
    ],
  },
]

export default function Sidebar({ collapsed, onToggle, logoUrl }: { collapsed: boolean; onToggle: () => void; logoUrl?: string | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const W = collapsed ? 64 : 220
  const [userRole, setUserRole] = useState<WorkspaceRole>('admin')

  useEffect(() => {
    async function fetchRole() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Try workspace_members first
        const { data: member } = await supabase
          .from('workspace_members')
          .select('role')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle()

        if (member) {
          setUserRole(member.role as WorkspaceRole)
          return
        }

        // Fallback to users table
        const { data: profile } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profile) {
          setUserRole((profile.role === 'coach' ? 'admin' : profile.role) as WorkspaceRole)
        }
      } catch {
        // Default to admin on error (most permissive — avoids hiding nav on transient failures)
      }
    }
    fetchRole()
  }, [])

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
        {NAV.map((group) => {
          const visibleItems = group.items.filter(item => isRouteVisible(item.href, userRole))
          if (visibleItems.length === 0) return null
          return (
          <div key={group.title} style={{ marginBottom: 20 }}>
            {!collapsed && (
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-label)', padding: '0 10px', marginBottom: 6, letterSpacing: '0.2em', textTransform: 'uppercase' as const }}>
                {group.title}
              </div>
            )}
            {visibleItems.map((item) => {
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
                }}
                  onMouseEnter={e => {
                    if (!active) {
                      e.currentTarget.style.background = 'var(--bg-hover)'
                      e.currentTarget.style.color = 'var(--text-primary)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = 'var(--text-tertiary)'
                    }
                  }}
                >
                  <Icon size={16} style={{ flexShrink: 0 }} />
                  {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{item.label}</span>}
                </Link>
              )
            })}
          </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: 8, borderTop: '1px solid var(--border-primary)', flexShrink: 0 }}>
        <ThemeToggle collapsed={collapsed} />
        <button onClick={logout} title={collapsed ? 'Déconnexion' : undefined} style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          padding: collapsed ? '8px 0' : '7px 10px', justifyContent: collapsed ? 'center' : 'flex-start',
          borderRadius: 8, fontSize: 13, color: 'var(--text-tertiary)', background: 'transparent',
          border: 'none', cursor: 'pointer', transition: 'all 0.15s ease',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
        >
          <LogOut size={16} style={{ flexShrink: 0 }} />
          {!collapsed && <span>Déconnexion</span>}
        </button>
      </div>
    </aside>
  )
}
