'use client'

import { useState } from 'react'
import { X, Plus, Mail, Trophy, Bell, BarChart, Phone, Clock, PhoneMissed, MessageCircle, Zap } from 'lucide-react'
import { workflowTemplates, WorkflowTemplate } from '@/lib/workflows/templates'

interface Props {
  open: boolean
  onClose: () => void
  onCreateFromTemplate: (templateId: string) => void
  onCreateBlank: (name: string) => void
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
  calls: 'APPELS',
  instagram: 'INSTAGRAM',
  booking: 'RESERVATIONS',
}

const categoryColors: Record<string, string> = {
  leads: '#5b9bf5',
  calls: '#38A169',
  instagram: '#E1306C',
  booking: '#D69E2E',
}

export default function NewWorkflowModal({ open, onClose, onCreateFromTemplate, onCreateBlank }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [blankName, setBlankName] = useState('')
  const [showNameInput, setShowNameInput] = useState(false)

  if (!open) return null

  // Group templates by category
  const grouped: Record<string, WorkflowTemplate[]> = {}
  for (const t of workflowTemplates) {
    if (!grouped[t.category]) grouped[t.category] = []
    grouped[t.category].push(t)
  }

  const handleBlankSubmit = () => {
    if (blankName.trim()) {
      onCreateBlank(blankName.trim())
      setBlankName('')
      setShowNameInput(false)
    }
  }

  const handleClose = () => {
    setBlankName('')
    setShowNameInput(false)
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-primary)',
        borderRadius: 16,
        maxWidth: 680, width: '92%',
        maxHeight: '82vh', overflowY: 'auto',
        padding: 0,
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-primary)',
          position: 'sticky', top: 0,
          background: 'var(--bg-elevated)',
          borderRadius: '16px 16px 0 0',
          zIndex: 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'rgba(229,62,62,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Zap size={16} style={{ color: '#E53E3E' }} />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Nouveau workflow
            </h2>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: 'var(--bg-hover)', border: 'none', color: 'var(--text-tertiary)',
              cursor: 'pointer', padding: 6, borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 24 }}>
          {/* Blank workflow card */}
          {!showNameInput ? (
            <div
              style={{
                background: 'var(--bg-hover)',
                border: '2px dashed var(--border-primary)',
                borderRadius: 12, padding: 18,
                cursor: 'pointer', marginBottom: 28,
                borderColor: hoveredId === 'blank' ? 'rgba(229,62,62,0.35)' : 'var(--border-primary)',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={() => setHoveredId('blank')}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => setShowNameInput(true)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'rgba(229,62,62,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Plus size={18} style={{ color: '#E53E3E' }} />
                </div>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', display: 'block' }}>
                    Workflow vide
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, display: 'block' }}>
                    Partir de zero et configurer chaque etape manuellement.
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              background: 'var(--bg-hover)',
              border: '1px solid var(--border-primary)',
              borderRadius: 12, padding: 18,
              marginBottom: 28,
            }}>
              <label style={{
                fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)',
                marginBottom: 8, display: 'block',
              }}>
                Nom du workflow
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={blankName}
                  onChange={e => setBlankName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleBlankSubmit() }}
                  placeholder="Ex : Bienvenue nouveau lead..."
                  autoFocus
                  style={{
                    flex: 1,
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: 8,
                    padding: '10px 12px',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handleBlankSubmit}
                  disabled={!blankName.trim()}
                  style={{
                    background: blankName.trim() ? '#E53E3E' : 'var(--border-primary)',
                    color: blankName.trim() ? '#fff' : 'var(--text-muted)',
                    fontWeight: 600, fontSize: 13,
                    padding: '10px 20px', borderRadius: 8,
                    border: 'none',
                    cursor: blankName.trim() ? 'pointer' : 'not-allowed',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Creer
                </button>
                <button
                  onClick={() => { setShowNameInput(false); setBlankName('') }}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border-primary)',
                    color: 'var(--text-tertiary)',
                    borderRadius: 8, padding: '10px 14px',
                    cursor: 'pointer', fontSize: 13,
                  }}
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

          {/* Section header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            marginBottom: 18,
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Partir d&apos;un template
            </span>
            <div style={{
              flex: 1, height: 1,
              background: 'var(--border-primary)',
            }} />
          </div>

          {/* Templates grouped by category */}
          {Object.entries(grouped).map(([category, templates]) => {
            const catColor = categoryColors[category] || '#5b9bf5'
            return (
              <div key={category} style={{ marginBottom: 24 }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: catColor,
                  textTransform: 'uppercase' as const, letterSpacing: '0.15em',
                  marginBottom: 10,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span style={{
                    width: 4, height: 4, borderRadius: '50%',
                    background: catColor,
                  }} />
                  {categoryLabels[category] || category.toUpperCase()}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  {templates.map(t => (
                    <div
                      key={t.id}
                      style={{
                        background: hoveredId === t.id ? 'var(--bg-hover)' : 'var(--bg-primary)',
                        border: '1px solid',
                        borderColor: hoveredId === t.id ? 'rgba(229,62,62,0.25)' : 'var(--border-primary)',
                        borderRadius: 10, padding: 16,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={() => setHoveredId(t.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onClick={() => onCreateFromTemplate(t.id)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <span style={{ color: catColor, display: 'flex', alignItems: 'center' }}>
                          {iconMap[t.icon] || <Zap size={18} />}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                          {t.name}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4, marginLeft: 30 }}>
                        {t.description}
                      </div>
                      {t.requires_integration && t.requires_integration.length > 0 && (
                        <div style={{
                          fontSize: 10, color: '#D69E2E', marginTop: 8, marginLeft: 30,
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                          <Bell size={10} />
                          Requiert {t.requires_integration.join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
