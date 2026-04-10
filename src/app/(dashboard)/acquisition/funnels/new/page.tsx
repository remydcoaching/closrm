'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, FileText, Layers, LayoutGrid } from 'lucide-react'
import Link from 'next/link'
import { FUNNEL_TEMPLATES } from '@/lib/funnels/templates'

export default function NewFunnelPage() {
  const router = useRouter()
  const [creating, setCreating] = useState<string | null>(null)
  const [error, setError] = useState('')

  const funnelTemplates = FUNNEL_TEMPLATES.filter(t => t.kind === 'funnel')
  const pageTemplates = FUNNEL_TEMPLATES.filter(t => t.kind === 'page')

  async function createFunnel(templateId: string | null, name: string) {
    if (creating) return
    setCreating(templateId ?? 'blank')
    setError('')

    try {
      const body: Record<string, string> = { name }
      if (templateId) body.template_id = templateId

      const res = await fetch('/api/funnels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const json = await res.json()
      if (res.ok && json.data?.id) {
        router.push(`/acquisition/funnels/${json.data.id}`)
      } else {
        setError(json.error || 'Erreur lors de la création')
        setCreating(null)
      }
    } catch {
      setError('Erreur réseau')
      setCreating(null)
    }
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <Link
          href="/acquisition/funnels"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 13, color: 'var(--text-secondary, #888)', textDecoration: 'none',
            marginBottom: 16, padding: '4px 0', transition: 'color 0.15s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary, #fff)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary, #888)' }}
        >
          <ArrowLeft size={14} />
          Retour aux funnels
        </Link>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary, #fff)', margin: '8px 0 0', letterSpacing: '-0.02em' }}>
          Nouveau funnel
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary, #A0A0A0)', margin: '6px 0 0', lineHeight: 1.5 }}>
          Choisissez un template ou partez de zéro
        </p>
      </div>

      {error && (
        <div style={{
          background: 'rgba(229,62,62,0.08)', border: '1px solid rgba(229,62,62,0.25)',
          borderRadius: 10, padding: '12px 16px', marginBottom: 20,
          fontSize: 13, color: '#E53E3E', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {error}
        </div>
      )}

      {/* ─── Page vierge ─────────────────────────────────────────────── */}
      <div
        onClick={() => !creating && createFunnel(null, 'Mon funnel')}
        style={{
          background: 'var(--bg-secondary, #141414)',
          border: '1px dashed var(--border-primary, #333)',
          borderRadius: 12, padding: 24,
          cursor: creating ? 'not-allowed' : 'pointer',
          marginBottom: 36, opacity: creating ? 0.5 : 1,
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={e => { if (!creating) { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.background = 'rgba(0,200,83,0.03)' } }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-primary, #333)'; e.currentTarget.style.background = 'var(--bg-secondary, #141414)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <FileText size={20} color="var(--text-secondary, #666)" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary, #fff)' }}>Page vierge</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary, #888)', marginTop: 2 }}>
              Partez de zéro avec une page vide
            </div>
          </div>
          {creating === 'blank' && <Spinner />}
        </div>
      </div>

      {/* ─── Funnels complets ────────────────────────────────────────── */}
      <SectionHeader icon={<Layers size={14} />} title="Funnels complets" subtitle="Tunnels multi-pages prêts à l'emploi" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 36 }}>
        {funnelTemplates.map(template => (
          <TemplateCard
            key={template.id}
            template={template}
            creating={creating}
            onClick={() => createFunnel(template.id, template.name)}
          />
        ))}
      </div>

      {/* ─── Pages individuelles ─────────────────────────────────────── */}
      <SectionHeader icon={<LayoutGrid size={14} />} title="Pages individuelles" subtitle="Pages simples à utiliser seules ou à combiner" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {pageTemplates.map(template => (
          <TemplateCard
            key={template.id}
            template={template}
            creating={creating}
            onClick={() => createFunnel(template.id, template.name)}
          />
        ))}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 7,
        background: 'rgba(0,200,83,0.08)', border: '1px solid rgba(0,200,83,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--color-primary)',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #fff)', letterSpacing: '-0.01em' }}>
          {title}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary, #888)' }}>{subtitle}</div>
      </div>
    </div>
  )
}

function TemplateCard({
  template,
  creating,
  onClick,
}: {
  template: (typeof FUNNEL_TEMPLATES)[number]
  creating: string | null
  onClick: () => void
}) {
  const isComingSoon = template.comingSoon === true
  const isDisabled = !!creating || isComingSoon
  const pageCount = template.pages.length

  return (
    <div
      onClick={() => !isDisabled && onClick()}
      title={isComingSoon ? 'Ce template sera disponible bientôt' : undefined}
      style={{
        background: 'var(--bg-secondary, #141414)',
        border: '1px solid var(--border-primary, #262626)',
        borderRadius: 12, padding: 22,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: creating ? 0.5 : isComingSoon ? 0.55 : 1,
        transition: 'all 0.2s ease',
        position: 'relative',
      }}
      onMouseEnter={e => { if (!isDisabled) { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)' } }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-primary, #262626)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
    >
      {isComingSoon && (
        <div style={{
          position: 'absolute', top: 12, right: 12,
          padding: '3px 10px', borderRadius: 12, fontSize: 9, fontWeight: 700,
          background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%)',
          color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5,
          boxShadow: '0 2px 8px rgba(0,200,83,0.3)',
        }}>
          Bientot
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: 'rgba(0,200,83,0.08)', border: '1px solid rgba(0,200,83,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Layers size={16} color="var(--color-primary)" />
        </div>
        {!isComingSoon && pageCount > 0 && (
          <span style={{
            padding: '3px 10px', borderRadius: 12, fontSize: 10, fontWeight: 600,
            background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary, #888)',
            border: '1px solid rgba(255,255,255,0.04)',
          }}>
            {pageCount} page{pageCount > 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #fff)', marginBottom: 6 }}>
        {template.name}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary, #888)', lineHeight: 1.6 }}>
        {template.description}
      </div>
      {creating === template.id && (
        <div style={{ marginTop: 10 }}><Spinner /></div>
      )}
    </div>
  )
}

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 14, height: 14, border: '2px solid #333', borderTopColor: 'var(--color-primary)',
        borderRadius: '50%', animation: 'spin 0.8s linear infinite',
      }} />
      <span style={{ fontSize: 12, color: 'var(--text-secondary, #888)', fontWeight: 500 }}>Creation...</span>
    </div>
  )
}
