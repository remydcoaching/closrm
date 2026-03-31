'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { EmailTemplate } from '@/types'

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/emails/templates')
      .then(r => r.json())
      .then(data => { setTemplates(Array.isArray(data) ? data : []); setLoading(false) })
  }, [])

  async function handleCreate() {
    const res = await fetch('/api/emails/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Nouveau template',
        blocks: [
          { id: 'block-1', type: 'text', config: { content: '<p>Bonjour {{prenom}},</p>' } },
          { id: 'footer', type: 'footer', config: { text: '© Mon Coaching' } },
        ],
      }),
    })
    if (res.ok) {
      const template = await res.json()
      router.push(`/acquisition/emails/templates/${template.id}`)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce template ?')) return
    await fetch(`/api/emails/templates/${id}`, { method: 'DELETE' })
    setTemplates(t => t.filter(tpl => tpl.id !== id))
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: 0 }}>Templates</h2>
          <p style={{ fontSize: 12, color: '#555', margin: '4px 0 0' }}>
            Crée et gère tes modèles d&apos;email
          </p>
        </div>
        <button onClick={handleCreate} style={{
          padding: '8px 18px', fontSize: 13, fontWeight: 600,
          background: 'var(--color-primary)', color: '#fff', border: 'none',
          borderRadius: 8, cursor: 'pointer',
        }}>
          + Nouveau template
        </button>
      </div>

      {loading ? (
        <div style={{ color: '#555', fontSize: 13 }}>Chargement...</div>
      ) : templates.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 60, color: '#555', fontSize: 13,
          background: '#141414', borderRadius: 12, border: '1px solid #262626',
        }}>
          Aucun template. Crée ton premier modèle d&apos;email !
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {templates.map(tpl => (
            <div key={tpl.id} style={{
              background: '#141414', border: '1px solid #262626', borderRadius: 12,
              padding: '16px 20px', cursor: 'pointer', transition: 'border-color 0.15s',
            }}
              onClick={() => router.push(`/acquisition/emails/templates/${tpl.id}`)}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{tpl.name}</div>
              <div style={{ fontSize: 12, color: '#555', marginBottom: 8 }}>
                {tpl.subject || 'Pas de sujet'}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#444' }}>
                  {tpl.blocks.length} bloc{tpl.blocks.length > 1 ? 's' : ''}
                </span>
                <button onClick={e => { e.stopPropagation(); handleDelete(tpl.id) }} style={{
                  fontSize: 11, color: '#555', background: 'none', border: 'none', cursor: 'pointer',
                }}>
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
