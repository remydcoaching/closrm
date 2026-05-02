'use client'

/**
 * Toolbar agenda v2 :
 *  [Jour | Semaine | Mois]   ← prev   Aujourd'hui   suivant →     <titre période>   [Templates] [Importer]
 */

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, LayoutTemplate, PanelLeft } from 'lucide-react'
import type { PlanningTemplate } from '@/types'

export type AgendaViewMode = 'day' | 'week' | 'month'

const LABELS: Record<AgendaViewMode, string> = {
  day: 'Jour',
  week: 'Semaine',
  month: 'Mois',
}

interface AgendaToolbarProps {
  viewMode: AgendaViewMode
  onViewModeChange: (mode: AgendaViewMode) => void
  /** Modes désactivés (rendu greyed out, click ignoré). Phase 3a : ['day', 'month']. */
  disabledModes?: AgendaViewMode[]
  periodLabel: string
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  /** Liste des templates de planning disponibles pour l'import. */
  templates?: PlanningTemplate[]
  /** Callback déclenché quand l'utilisateur sélectionne un template à importer
   *  pour la semaine actuelle. */
  onImportTemplate?: (templateId: string) => void
  /** État + toggle de la sidebar gauche (mini-cal + filtres calendriers). */
  sidebarOpen?: boolean
  onToggleSidebar?: () => void
}

export function AgendaToolbar({
  viewMode,
  onViewModeChange,
  disabledModes = [],
  periodLabel,
  onPrev,
  onNext,
  onToday,
  templates = [],
  onImportTemplate,
  sidebarOpen,
  onToggleSidebar,
}: AgendaToolbarProps) {
  const [showImport, setShowImport] = useState(false)
  const importRef = useRef<HTMLDivElement>(null)

  // Ferme le dropdown quand on clique en dehors
  useEffect(() => {
    if (!showImport) return
    const onDocClick = (e: MouseEvent) => {
      if (!importRef.current) return
      if (!importRef.current.contains(e.target as Node)) setShowImport(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [showImport])

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 20px',
        height: 56,
        borderBottom: '1px solid var(--agenda-grid-line-strong)',
        background: 'var(--bg-primary)',
        flexShrink: 0,
      }}
    >
      {/* Sidebar toggle */}
      {onToggleSidebar && (
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? 'Masquer la barre latérale' : 'Afficher la barre latérale'}
          aria-pressed={sidebarOpen}
          style={{
            ...navBtnStyle,
            background: sidebarOpen ? 'var(--bg-hover)' : 'transparent',
            color: sidebarOpen ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}
        >
          <PanelLeft size={15} />
        </button>
      )}

      {/* View mode pill group */}
      <div
        style={{
          display: 'flex',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-secondary)',
          borderRadius: 8,
          padding: 3,
          gap: 2,
        }}
      >
        {(['day', 'week', 'month'] as AgendaViewMode[]).map((mode) => {
          const active = viewMode === mode
          const disabled = disabledModes.includes(mode)
          return (
            <button
              key={mode}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onViewModeChange(mode)}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: 'none',
                background: active ? 'var(--border-secondary)' : 'transparent',
                color: disabled
                  ? 'var(--text-disabled)'
                  : active
                    ? 'var(--text-primary)'
                    : 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                transition: 'all 0.15s',
              }}
              aria-disabled={disabled}
            >
              {LABELS[mode]}
            </button>
          )
        })}
      </div>

      {/* Nav prev / today / next */}
      <button
        type="button"
        onClick={onPrev}
        aria-label="Précédent"
        style={navBtnStyle}
      >
        <ChevronLeft size={16} />
      </button>
      <button
        type="button"
        onClick={onToday}
        style={{
          padding: '5px 12px',
          borderRadius: 6,
          border: '1px solid var(--border-secondary)',
          background: 'transparent',
          color: 'var(--text-secondary)',
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        Aujourd&apos;hui
      </button>
      <button
        type="button"
        onClick={onNext}
        aria-label="Suivant"
        style={navBtnStyle}
      >
        <ChevronRight size={16} />
      </button>

      {/* Titre période */}
      <span
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--text-primary)',
          textTransform: 'capitalize',
          flex: 1,
        }}
      >
        {periodLabel}
      </span>

      {/* Templates link */}
      <Link
        href="/agenda/templates"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 6,
          border: '1px solid var(--border-secondary)',
          background: 'transparent',
          color: 'var(--text-secondary)',
          fontSize: 12,
          textDecoration: 'none',
          cursor: 'pointer',
        }}
      >
        <LayoutTemplate size={13} /> Templates
      </Link>

      {/* Import template dropdown */}
      {onImportTemplate && (
        <div ref={importRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setShowImport((v) => !v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 6,
              border: `1px solid ${showImport ? 'var(--color-primary)' : 'var(--border-secondary)'}`,
              background: showImport ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'transparent',
              color: showImport ? 'var(--color-primary)' : 'var(--text-secondary)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <LayoutTemplate size={13} /> Importer
          </button>
          {showImport && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 4,
                width: 240,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-secondary)',
                borderRadius: 8,
                padding: 4,
                zIndex: 30,
                boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
              }}
            >
              {templates.length === 0 ? (
                <div style={{ padding: '12px 10px', fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.5 }}>
                  Aucun template.{' '}
                  <Link href="/agenda/templates" style={{ color: 'var(--color-primary)' }}>
                    Créer un template
                  </Link>
                </div>
              ) : (
                templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      onImportTemplate(t.id)
                      setShowImport(false)
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 10px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: 6,
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    <div style={{ fontWeight: 500 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {t.blocks.length} bloc{t.blocks.length > 1 ? 's' : ''}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Badge v2 — pour bien identifier qu'on est sur la nouvelle version */}
      <span
        style={{
          padding: '2px 8px',
          borderRadius: 4,
          background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
          color: 'var(--color-primary)',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}
      >
        Beta v2
      </span>
    </div>
  )
}

const navBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--border-secondary)',
  borderRadius: 6,
  cursor: 'pointer',
  color: 'var(--text-secondary)',
  display: 'flex',
  alignItems: 'center',
  padding: '5px 6px',
}
