'use client'

/**
 * T-028 Phase 11 — Onglets de pages du funnel + menu de sélection de template
 * quand le coach clique sur le "+".
 *
 * Le menu propose 5 templates de page (validés avec Rémy le 2026-04-07) :
 * - Page vierge (Hero + Text + Footer)
 * - Page VSL classique (Hero + Video + Testimonials + CTA + Footer)
 * - Page de capture (Hero + Form + Footer)
 * - Page de remerciement (Hero "Merci" + Text + Footer)
 * - Page de prise de RDV (Hero + Booking + Footer)
 *
 * Le parent (`[id]/page.tsx`) reçoit le template choisi via `onAddPage(template)`
 * et construit les blocs correspondants via `getDefaultPageBlocksForTemplate()`.
 */

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { FunnelPage } from '@/types'
import { PAGE_TEMPLATES, type FunnelPageTemplate } from '@/lib/funnels/defaults'

interface Props {
  pages: FunnelPage[]
  activePageId: string
  onSelectPage: (id: string) => void
  onAddPage: (template: FunnelPageTemplate) => void
  onDeletePage: (id: string) => void
}

export default function FunnelPageTabs({
  pages,
  activePageId,
  onSelectPage,
  onAddPage,
  onDeletePage,
}: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const handleSelectTemplate = (template: FunnelPageTemplate) => {
    onAddPage(template)
    setMenuOpen(false)
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        overflow: 'visible',
      }}
    >
      {pages.map((page, index) => {
        const isActive = page.id === activePageId
        const isHovered = page.id === hoveredId
        return (
          <div
            key={page.id}
            onMouseEnter={() => setHoveredId(page.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => onSelectPage(page.id)}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? '#fff' : '#888',
              borderBottom: isActive ? '2px solid #E53E3E' : '2px solid transparent',
              background: isActive ? 'rgba(229,62,62,0.08)' : 'transparent',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            <span>{page.name}</span>
            {index > 0 && isHovered && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDeletePage(page.id)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  background: 'transparent',
                  border: 'none',
                  color: '#888',
                  cursor: 'pointer',
                  padding: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#E53E3E'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#888'
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        )
      })}

      {/* Bouton + + menu de templates */}
      <div style={{ position: 'relative', marginLeft: 4 }}>
        <button
          onClick={() => setMenuOpen((s) => !s)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 6,
            background: menuOpen ? 'rgba(229,62,62,0.12)' : 'transparent',
            border: menuOpen ? '1px solid rgba(229,62,62,0.4)' : '1px solid #333',
            color: menuOpen ? '#E53E3E' : '#888',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (!menuOpen) {
              e.currentTarget.style.borderColor = '#555'
              e.currentTarget.style.color = '#ccc'
            }
          }}
          onMouseLeave={(e) => {
            if (!menuOpen) {
              e.currentTarget.style.borderColor = '#333'
              e.currentTarget.style.color = '#888'
            }
          }}
          aria-label="Ajouter une page"
          title="Ajouter une page"
        >
          <Plus size={14} />
        </button>

        {menuOpen && (
          <>
            {/* Backdrop pour fermer au clic extérieur */}
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 50,
              }}
              onClick={() => setMenuOpen(false)}
              aria-hidden="true"
            />
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                width: 280,
                background: '#141414',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                padding: 6,
                zIndex: 51,
                boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <div
                style={{
                  padding: '8px 10px 4px',
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.4)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Choisir un template
              </div>
              {PAGE_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleSelectTemplate(template.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '10px 10px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: '#fff',
                    fontFamily: 'inherit',
                    width: '100%',
                    transition: 'background 0.12s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1, marginTop: 1, flexShrink: 0 }}>
                    {template.emoji}
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>
                      {template.label}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: 'rgba(255,255,255,0.5)',
                        lineHeight: 1.4,
                      }}
                    >
                      {template.description}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
