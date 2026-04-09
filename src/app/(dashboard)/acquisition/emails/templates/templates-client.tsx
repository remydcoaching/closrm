'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, FileText, Trash2 } from 'lucide-react'
import type { EmailTemplate } from '@/types'

interface TemplatesClientProps {
  initialTemplates: EmailTemplate[]
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "À l'instant"
  if (diffMins < 60) return `il y a ${diffMins} min`
  if (diffHours < 24) return `il y a ${diffHours}h`
  if (diffDays < 7) return `il y a ${diffDays}j`
  if (diffDays < 30) return `il y a ${Math.floor(diffDays / 7)} sem.`
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

export default function TemplatesClient({ initialTemplates }: TemplatesClientProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>(initialTemplates)
  const router = useRouter()

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

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (!confirm('Supprimer ce template ?')) return
    await fetch(`/api/emails/templates/${id}`, { method: 'DELETE' })
    setTemplates(t => t.filter(tpl => tpl.id !== id))
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0 }}>Templates</h2>
          <p style={{ fontSize: 12, color: '#555', margin: '4px 0 0' }}>
            Crée et gère tes modèles d&apos;email
          </p>
        </div>
        <button
          onClick={handleCreate}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '9px 18px',
            fontSize: 13,
            fontWeight: 600,
            background: '#E53E3E',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            cursor: 'pointer',
          }}
        >
          <Plus size={15} />
          Nouveau template
        </button>
      </div>

      {/* Empty state */}
      {templates.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: 72,
          background: '#141414',
          borderRadius: 14,
          border: '1px solid #262626',
        }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'rgba(229,62,62,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <FileText size={22} color="#E53E3E" />
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 6 }}>
            Aucun template
          </div>
          <div style={{ fontSize: 13, color: '#555', marginBottom: 20 }}>
            Crée ton premier modèle d&apos;email
          </div>
          <button
            onClick={handleCreate}
            style={{
              padding: '8px 20px',
              fontSize: 13,
              fontWeight: 600,
              background: '#E53E3E',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Créer un template
          </button>
        </div>
      ) : (
        /* 3-column grid */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 14,
        }}>
          {templates.map(tpl => (
            <div
              key={tpl.id}
              onClick={() => router.push(`/acquisition/emails/templates/${tpl.id}`)}
              style={{
                background: '#141414',
                border: '1px solid #262626',
                borderRadius: 12,
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'border-color 0.15s, transform 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#333'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#262626'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              {/* Thumbnail area */}
              <div style={{
                height: 140,
                background: tpl.thumbnail_url ? `url(${tpl.thumbnail_url}) center/cover` : '#1a1a1a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderBottom: '1px solid #262626',
              }}>
                {!tpl.thumbnail_url && (
                  <FileText size={32} color="#333" />
                )}
              </div>

              {/* Info */}
              <div style={{ padding: '14px 16px' }}>
                <div style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#fff',
                  marginBottom: 6,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {tpl.name}
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{ fontSize: 11, color: '#555' }}>
                    {timeAgo(tpl.updated_at)}
                  </span>
                  <button
                    onClick={(e) => handleDelete(e, tpl.id)}
                    title="Supprimer"
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 6,
                      border: '1px solid #333',
                      background: 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Trash2 size={12} color="#666" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
