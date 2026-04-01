'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, FileText, Layers } from 'lucide-react'
import Link from 'next/link'
import { FUNNEL_TEMPLATES } from '@/lib/funnels/templates'

const CATEGORY_LABELS: Record<string, string> = {
  vsl: 'VSL',
  capture: 'Capture',
  complet: 'Complet',
  merci: 'Merci',
}

export default function NewFunnelPage() {
  const router = useRouter()
  const [creating, setCreating] = useState<string | null>(null)

  async function createFunnel(templateId: string | null, name: string) {
    if (creating) return
    setCreating(templateId ?? 'blank')

    try {
      const body: Record<string, string> = { name }
      if (templateId) body.template_id = templateId

      const res = await fetch('/api/funnels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const json = await res.json()
      if (json.data?.id) {
        router.push(`/acquisition/funnels/${json.data.id}`)
      }
    } catch {
      setCreating(null)
    }
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <Link
          href="/acquisition/funnels"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 13, color: '#888', textDecoration: 'none', marginBottom: 16,
          }}
        >
          <ArrowLeft size={14} />
          Retour aux funnels
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: '8px 0 0' }}>
          Nouveau funnel
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
          Choisissez un template ou partez de zero
        </p>
      </div>

      {/* Blank option */}
      <div
        onClick={() => createFunnel(null, 'Mon funnel')}
        style={{
          background: '#141414', border: '1px dashed #333', borderRadius: 12,
          padding: 24, cursor: 'pointer', marginBottom: 24,
          opacity: creating ? 0.5 : 1,
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#555' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#333' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'rgba(255,255,255,0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <FileText size={18} color="#555" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>Page vierge</div>
            <div style={{ fontSize: 12, color: '#666' }}>
              Partez de zero avec une page vide
            </div>
          </div>
          {creating === 'blank' && (
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#888' }}>Creation...</span>
          )}
        </div>
      </div>

      {/* Templates */}
      <div style={{ fontSize: 13, fontWeight: 600, color: '#888', marginBottom: 12 }}>
        Templates
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 16,
      }}>
        {FUNNEL_TEMPLATES.map(template => (
          <div
            key={template.id}
            onClick={() => createFunnel(template.id, template.name)}
            style={{
              background: '#141414', border: '1px solid #262626', borderRadius: 12,
              padding: 20, cursor: 'pointer',
              opacity: creating ? 0.5 : 1,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#444' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#262626' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: 'rgba(229,62,62,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Layers size={16} color="#E53E3E" />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={{
                  padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600,
                  background: 'rgba(255,255,255,0.05)', color: '#888',
                }}>
                  {CATEGORY_LABELS[template.category] || template.category}
                </span>
                <span style={{
                  padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600,
                  background: 'rgba(255,255,255,0.05)', color: '#888',
                }}>
                  {template.pages.length} page{template.pages.length > 1 ? 's' : ''}
                </span>
              </div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 6 }}>
              {template.name}
            </div>
            <div style={{ fontSize: 12, color: '#666', lineHeight: 1.5 }}>
              {template.description}
            </div>
            {creating === template.id && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>Creation...</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
