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
        padding: '14px 24px 0',
        borderBottom: '1px solid var(--border-primary)',
        background: 'var(--bg-primary)',
        position: 'sticky',
        top: 0,
        zIndex: 5,
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          gap: 2,
          padding: 3,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-primary)',
          borderRadius: 10,
          marginBottom: 14,
        }}
      >
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + '/')
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                padding: '7px 14px',
                fontSize: 13,
                fontWeight: 500,
                color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
                background: active ? 'var(--bg-active)' : 'transparent',
                border: active ? '1px solid var(--border-primary)' : '1px solid transparent',
                borderRadius: 7,
                textDecoration: 'none',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
                boxShadow: active ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
              }}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
