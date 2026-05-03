'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface Tab {
  label: string
  href: string
}

/**
 * Sticky tab bar for grouped pages (Agenda, Leads, Stats, etc.)
 * Active tab is derived from the current pathname (matches by prefix or exact).
 */
export default function PageTabs({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname()

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '0 24px',
        borderBottom: '1px solid var(--border-primary)',
        background: 'var(--bg-primary)',
        position: 'sticky',
        top: 0,
        zIndex: 5,
      }}
    >
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(tab.href + '/')
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              padding: '14px 16px',
              fontSize: 13,
              fontWeight: active ? 600 : 500,
              color: active ? 'var(--color-primary)' : 'var(--text-tertiary)',
              borderBottom: `2px solid ${active ? 'var(--color-primary)' : 'transparent'}`,
              marginBottom: -1,
              textDecoration: 'none',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
