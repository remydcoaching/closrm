'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, FileText, Trash2, X } from 'lucide-react'
import type { EmailTemplate } from '@/types'
import { STARTER_TEMPLATES } from '@/lib/email/starter-templates'
import { getEmailPresetByIdOrDefault } from '@/lib/email/presets'

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
  const [showGallery, setShowGallery] = useState(false)
  const router = useRouter()

  async function handleCreateBlank() {
    const res = await fetch('/api/emails/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Nouveau template',
        preset_id: 'classique',
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

  async function handleCreateFromStarter(starterId: string) {
    const starter = STARTER_TEMPLATES.find((s) => s.id === starterId)
    if (!starter) return
    const res = await fetch('/api/emails/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: starter.name,
        subject: starter.subject,
        preset_id: starter.preset_id,
        blocks: starter.blocks,
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
          onClick={() => setShowGallery(true)}
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

      {showGallery && (
        <StarterGallery
          onClose={() => setShowGallery(false)}
          onBlank={handleCreateBlank}
          onSelect={handleCreateFromStarter}
        />
      )}

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
            onClick={() => setShowGallery(true)}
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

function StarterGallery({
  onClose,
  onBlank,
  onSelect,
}: {
  onClose: () => void
  onBlank: () => void
  onSelect: (starterId: string) => void
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 900,
          maxWidth: '100%',
          maxHeight: '90vh',
          background: '#0a0a0a',
          border: '1px solid #262626',
          borderRadius: 14,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #262626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff' }}>
              Choisir un point de départ
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888' }}>
              6 templates pré-bâtis ou pars d&apos;une page vierge.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#888',
              display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 20,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 14,
          }}
        >
          <button
            onClick={onBlank}
            style={{
              padding: 20,
              background: '#141414',
              border: '1px dashed #444',
              borderRadius: 10,
              cursor: 'pointer',
              textAlign: 'left',
              color: '#ccc',
              minHeight: 180,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div style={{ fontSize: 32, color: '#555' }}>+</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Vierge</div>
            <div style={{ fontSize: 12, color: '#666', textAlign: 'center' }}>
              Commence de zéro avec un seul bloc texte.
            </div>
          </button>

          {STARTER_TEMPLATES.map((s) => {
            const preset = getEmailPresetByIdOrDefault(s.preset_id)
            return (
              <button
                key={s.id}
                onClick={() => onSelect(s.id)}
                style={{
                  padding: 0,
                  background: '#141414',
                  border: '1px solid #262626',
                  borderRadius: 10,
                  cursor: 'pointer',
                  textAlign: 'left',
                  overflow: 'hidden',
                  minHeight: 180,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div
                  style={{
                    height: 70,
                    background: preset.primary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div style={{ display: 'flex', gap: 4 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 4, background: preset.containerBg }} />
                    <div style={{ width: 28, height: 28, borderRadius: 4, background: preset.footerBg }} />
                  </div>
                </div>
                <div style={{ padding: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                    {s.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#888', lineHeight: 1.4 }}>
                    {s.description}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
