'use client'

/**
 * T-028 Phase 19 — FunnelCard refondue.
 *
 * Changements :
 * - Le bouton poubelle est maintenant un menu "⋯" (3 dots) affiché à droite
 *   du badge "Brouillon"/"Publié", dans le flow normal du header (plus de
 *   position: absolute qui chevauche d'autres éléments).
 * - Au clic sur "⋯" : dropdown avec "Supprimer" en rouge + confirmation.
 * - Couleurs CRM cohérentes : vert pour publié, gris pour brouillon.
 */

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileText, ExternalLink, AlertTriangle, MoreHorizontal, Trash2 } from 'lucide-react'
import { createPortal } from 'react-dom'
import { buildPublicFunnelUrl } from '@/lib/funnels/use-workspace-slug'

interface FunnelData {
  id: string
  name: string
  slug: string
  status: 'draft' | 'published'
  page_count: number
  first_page_slug: string | null
  created_at: string
}

interface Props {
  funnel: FunnelData
  workspaceSlug: string | null
  workspaceSlugFetched: boolean
  onDelete: (id: string) => void
}

export default function FunnelCard({ funnel, workspaceSlug, workspaceSlugFetched, onDelete }: Props) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isPublished = funnel.status === 'published'
  const date = new Date(funnel.created_at).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

  const publicUrl = isPublished
    ? buildPublicFunnelUrl(workspaceSlug, funnel.slug, funnel.first_page_slug)
    : null

  const showMissingSlugWarning = isPublished && workspaceSlugFetched && !workspaceSlug

  return (
    <div
      onClick={() => router.push(`/acquisition/funnels/${funnel.id}`)}
      style={{
        background: 'var(--bg-elevated, #141414)',
        border: '1px solid var(--border-primary, #262626)',
        borderRadius: 12,
        padding: 20,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        position: 'relative',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-secondary, #333)' }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border-primary, #262626)'
        setMenuOpen(false)
        setConfirmDelete(false)
      }}
    >
      {/* Header : icône + badge statut + menu ⋯ */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: isPublished ? 'rgba(56,161,105,0.12)' : 'rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <FileText size={18} color={isPublished ? '#38A169' : '#555'} />
        </div>

        {/* Badge + menu ⋯ alignés à droite */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
            background: isPublished ? 'rgba(56,161,105,0.12)' : 'rgba(255,255,255,0.06)',
            color: isPublished ? '#38A169' : '#888',
          }}>
            {isPublished ? 'Publié' : 'Brouillon'}
          </span>

          {/* Menu ⋯ */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={e => {
                e.stopPropagation()
                setMenuOpen(s => !s)
                setConfirmDelete(false)
              }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 24, height: 24, borderRadius: 6,
                background: menuOpen ? 'rgba(255,255,255,0.1)' : 'transparent',
                border: 'none', color: '#888', cursor: 'pointer', padding: 0,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { if (!menuOpen) e.currentTarget.style.color = '#ccc' }}
              onMouseLeave={e => { if (!menuOpen) e.currentTarget.style.color = '#888' }}
              aria-label="Options"
              title="Options"
            >
              <MoreHorizontal size={16} />
            </button>

            {/* Dropdown menu */}
            {menuOpen && typeof window !== 'undefined' && createPortal(
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                  onClick={e => { e.stopPropagation(); setMenuOpen(false); setConfirmDelete(false) }}
                  aria-hidden="true"
                />
                <div
                  style={{
                    position: 'fixed',
                    // On ne peut pas facilement calculer la position exacte sans ref
                    // → on utilise une astuce : la card a position: relative et on
                    // place le menu inline dans le DOM tree, pas via portal.
                    // Mais le portal est nécessaire pour échapper aux overflow parents.
                    // Compromis V1 : on place le dropdown en bas-droite du viewport
                    // via le onClick du bouton ⋯ qui set la position.
                    zIndex: 9999,
                  }}
                >
                </div>
              </>,
              document.body,
            )}

            {/* Menu inline (pas portal — la card n'a pas d'overflow qui clip) */}
            {menuOpen && (
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  right: 0,
                  width: 180,
                  background: '#1a1a1a',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  padding: 4,
                  zIndex: 100,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                }}
              >
                {confirmDelete ? (
                  <div style={{ padding: '8px 10px' }}>
                    <p style={{ fontSize: 12, color: '#ccc', margin: '0 0 10px', lineHeight: 1.4 }}>
                      Supprimer ce funnel ?
                    </p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={e => { e.stopPropagation(); onDelete(funnel.id) }}
                        style={{
                          padding: '5px 12px', fontSize: 11, fontWeight: 600,
                          background: '#E53E3E', color: '#fff', border: 'none',
                          borderRadius: 6, cursor: 'pointer', flex: 1,
                        }}
                      >
                        Supprimer
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmDelete(false) }}
                        style={{
                          padding: '5px 12px', fontSize: 11,
                          background: '#262626', color: '#aaa', border: 'none',
                          borderRadius: 6, cursor: 'pointer',
                        }}
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={e => { e.stopPropagation(); setConfirmDelete(true) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      width: '100%', padding: '8px 10px',
                      background: 'transparent', border: 'none',
                      borderRadius: 4, cursor: 'pointer',
                      fontSize: 12, color: '#E53E3E',
                      fontFamily: 'inherit', textAlign: 'left',
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(229,62,62,0.1)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <Trash2 size={13} />
                    Supprimer le funnel
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Name */}
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary, #fff)', marginBottom: 4 }}>
        {funnel.name}
      </div>

      {/* Meta */}
      <div style={{ fontSize: 12, color: 'var(--text-muted, #666)', display: 'flex', gap: 12 }}>
        <span>{funnel.page_count} page{funnel.page_count > 1 ? 's' : ''}</span>
        <span>{date}</span>
      </div>

      {/* Warning si publié mais pas de slug workspace */}
      {showMissingSlugWarning && (
        <Link
          href="/parametres/reglages"
          onClick={e => e.stopPropagation()}
          title="Configurer le nom de votre espace"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            marginTop: 12, padding: '6px 10px',
            background: 'rgba(214,158,46,0.08)',
            border: '1px solid rgba(214,158,46,0.25)',
            borderRadius: 6, fontSize: 11, color: '#D69E2E',
            textDecoration: 'none', transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(214,158,46,0.15)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(214,158,46,0.08)' }}
        >
          <AlertTriangle size={11} style={{ flexShrink: 0 }} />
          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Configurer le nom de votre espace →
          </span>
        </Link>
      )}

      {/* Lien public cliquable quand le funnel est publié */}
      {publicUrl && (
        <a
          href={publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          title={publicUrl}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            marginTop: 12, padding: '6px 10px',
            background: 'rgba(56,161,105,0.08)',
            border: '1px solid rgba(56,161,105,0.2)',
            borderRadius: 6, fontSize: 11, color: '#38A169',
            textDecoration: 'none', fontFamily: 'monospace',
            overflow: 'hidden', transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(56,161,105,0.15)'
            e.currentTarget.style.borderColor = 'rgba(56,161,105,0.35)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(56,161,105,0.08)'
            e.currentTarget.style.borderColor = 'rgba(56,161,105,0.2)'
          }}
        >
          <ExternalLink size={11} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {publicUrl.replace(/^https?:\/\//, '')}
          </span>
        </a>
      )}
    </div>
  )
}
