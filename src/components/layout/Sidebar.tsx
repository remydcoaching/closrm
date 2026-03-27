'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Phone,
  Bell,
  BarChart2,
  Database,
  Zap,
  Megaphone,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  {
    section: 'VENTES',
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
    section: 'ACQUISITION',
    items: [
      { label: 'Automations', href: '/acquisition/automations', icon: Zap },
      { label: 'Publicités', href: '/acquisition/publicites', icon: Megaphone },
    ],
  },
  {
    section: 'COMPTE',
    items: [
      { label: 'Paramètres', href: '/parametres/reglages', icon: Settings },
    ],
  },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-screen bg-[#141414] border-r border-[#262626] flex flex-col transition-all duration-200 z-40',
        collapsed ? 'w-[60px]' : 'w-[220px]'
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-[#262626]">
        {!collapsed && (
          <span className="text-lg font-bold text-white">
            Clos<span className="text-[#E53E3E]">RM</span>
          </span>
        )}
        <button
          onClick={onToggle}
          className="text-[#A0A0A0] hover:text-white transition-colors ml-auto"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {NAV_ITEMS.map((group) => (
          <div key={group.section} className="mb-4">
            {!collapsed && (
              <p className="text-[10px] font-semibold text-[#A0A0A0] px-2 mb-1 tracking-wider">
                {group.section}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon
                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors',
                        active
                          ? 'bg-[#E53E3E]/15 text-[#E53E3E]'
                          : 'text-[#A0A0A0] hover:text-white hover:bg-[#1A1A1A]'
                      )}
                    >
                      <Icon size={16} className="shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-2 border-t border-[#262626]">
        <button
          onClick={handleLogout}
          title={collapsed ? 'Déconnexion' : undefined}
          className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-[#A0A0A0] hover:text-white hover:bg-[#1A1A1A] transition-colors w-full"
        >
          <LogOut size={16} className="shrink-0" />
          {!collapsed && <span>Déconnexion</span>}
        </button>
      </div>
    </aside>
  )
}
