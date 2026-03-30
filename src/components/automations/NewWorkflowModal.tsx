'use client'

import { useState } from 'react'
import { X, Plus, Mail, Trophy, Bell, BarChart, Phone, Clock, PhoneMissed, MessageCircle } from 'lucide-react'
import { workflowTemplates, WorkflowTemplate } from '@/lib/workflows/templates'

interface Props {
  open: boolean
  onClose: () => void
  onCreateFromTemplate: (templateId: string) => void
  onCreateBlank: () => void
}

const iconMap: Record<string, React.ReactNode> = {
  mail: <Mail size={20} />,
  trophy: <Trophy size={20} />,
  bell: <Bell size={20} />,
  'bar-chart': <BarChart size={20} />,
  phone: <Phone size={20} />,
  clock: <Clock size={20} />,
  'phone-missed': <PhoneMissed size={20} />,
  instagram: <MessageCircle size={20} />,
}

const categoryLabels: Record<string, string> = {
  leads: 'LEADS',
  calls: 'CALLS',
  instagram: 'INSTAGRAM',
  booking: 'BOOKING',
}

export default function NewWorkflowModal({ open, onClose, onCreateFromTemplate, onCreateBlank }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  if (!open) return null

  // Group templates by category
  const grouped: Record<string, WorkflowTemplate[]> = {}
  for (const t of workflowTemplates) {
    if (!grouped[t.category]) grouped[t.category] = []
    grouped[t.category].push(t)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-primary)',
        borderRadius: 16,
        maxWidth: 700, width: '90%',
        maxHeight: '80vh', overflowY: 'auto',
        padding: 24,
        boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Nouveau workflow</h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', color: 'var(--text-tertiary)',
              cursor: 'pointer', padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Blank workflow card */}
        <div
          style={{
            background: 'var(--bg-hover)',
            border: '2px dashed var(--border-primary)',
            borderRadius: 10, padding: 16,
            cursor: 'pointer', marginBottom: 24,
            borderColor: hoveredId === 'blank' ? 'rgba(0,200,83,0.3)' : 'var(--border-primary)',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={() => setHoveredId('blank')}
          onMouseLeave={() => setHoveredId(null)}
          onClick={onCreateBlank}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Plus size={20} style={{ color: 'var(--color-primary)' }} />
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>Workflow vide</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Partir de zéro et configurer chaque étape manuellement.
          </div>
        </div>

        {/* Sub-header */}
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16 }}>
          Templates
        </div>

        {/* Templates grouped by category */}
        {Object.entries(grouped).map(([category, templates]) => (
          <div key={category} style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: 'var(--text-label)',
              textTransform: 'uppercase' as const, letterSpacing: '0.15em',
              marginBottom: 10,
            }}>
              {categoryLabels[category] || category.toUpperCase()}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {templates.map(t => (
                <div
                  key={t.id}
                  style={{
                    background: 'var(--bg-hover)',
                    border: '1px solid',
                    borderColor: hoveredId === t.id ? 'rgba(0,200,83,0.3)' : 'var(--border-primary)',
                    borderRadius: 10, padding: 16,
                    cursor: 'pointer',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={() => setHoveredId(t.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => onCreateFromTemplate(t.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ color: 'var(--color-primary)' }}>{iconMap[t.icon] || <Plus size={20} />}</span>
                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{t.name}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{t.description}</div>
                  {t.requires_integration && t.requires_integration.length > 0 && (
                    <div style={{ fontSize: 10, color: '#D69E2E', marginTop: 6 }}>
                      Requiert {t.requires_integration.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
