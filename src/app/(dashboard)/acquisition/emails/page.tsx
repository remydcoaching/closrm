'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

const TABS = [
  { label: 'Dashboard', href: '/acquisition/emails' },
  { label: 'Templates', href: '/acquisition/emails/templates' },
  { label: 'Séquences', href: '/acquisition/emails/sequences' },
  { label: 'Campagnes', href: '/acquisition/emails/broadcasts' },
]

export default function EmailsDashboardPage() {
  const router = useRouter()
  const pathname = usePathname()
  const [period] = useState('30d')

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
        Emails
      </h1>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 24 }}>
        Séquences automatisées et campagnes email
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 32, borderBottom: '1px solid #262626', paddingBottom: 0 }}>
        {TABS.map(tab => {
          const active = pathname === tab.href
          return (
            <button
              key={tab.href}
              onClick={() => router.push(tab.href)}
              style={{
                padding: '8px 16px', fontSize: 13, fontWeight: 500,
                color: active ? 'var(--color-primary)' : '#666',
                background: 'none', border: 'none',
                borderBottom: active ? '2px solid var(--color-primary)' : '2px solid transparent',
                cursor: 'pointer', marginBottom: -1,
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Dashboard KPIs - placeholder for now */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
        <KpiCard label="Emails envoyés" value="—" period={period} />
        <KpiCard label="Taux d'ouverture" value="—" period={period} />
        <KpiCard label="Taux de clic" value="—" period={period} />
        <KpiCard label="Désinscrits" value="—" period={period} />
      </div>

      <div style={{
        textAlign: 'center', padding: 60, color: '#555', fontSize: 13,
        background: '#141414', borderRadius: 12, border: '1px solid #262626',
      }}>
        Les statistiques s&apos;afficheront ici une fois que tu auras envoyé des emails.
        <br />
        Commence par créer un template dans l&apos;onglet Templates.
      </div>
    </div>
  )
}

function KpiCard({ label, value, period: _ }: { label: string; value: string; period: string }) {
  return (
    <div style={{
      background: '#141414', border: '1px solid #262626', borderRadius: 12,
      padding: '16px 20px',
    }}>
      <div style={{ fontSize: 11, color: '#555', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>{value}</div>
    </div>
  )
}
