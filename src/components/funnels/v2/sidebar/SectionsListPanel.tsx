'use client'

/**
 * T-028b Phase 3 — Panneau "Sections" de la sidebar du builder.
 *
 * Affiche la liste des blocs de la page active avec :
 * - drag handle pour réorganiser via dnd-kit (le DndContext est dans FunnelBuilderV2)
 * - click pour sélectionner le bloc et l'éditer dans l'inspector
 * - icône delete au hover pour supprimer
 * - bouton "Ajouter une section" qui ouvre un menu déroulant des 12 types
 *
 * Les blocs Booking et Form sont affichés dans le menu d'ajout mais grisés
 * avec un label "À venir" et non-cliquables (cf. décision A-028a-01/02 +
 * fiche T-028c). Si un coach a déjà ces blocs en place dans son funnel
 * existant, ils restent éditables dans la liste — c'est juste l'ajout de
 * nouveaux qui est bloqué.
 */

import { useState } from 'react'
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical, X, Plus,
  // Icônes pour chaque type de bloc (remplacent les emojis)
  Crosshair, Video, Type, ImageIcon, MousePointerClick, DollarSign,
  MessageSquareQuote, HelpCircle, Timer, ArrowUpDown, PanelBottom,
  Calendar, FileText,
} from 'lucide-react'
import type { FunnelBlock, FunnelBlockType } from '@/types'

interface Props {
  blocks: FunnelBlock[]
  selectedBlockId: string | null
  onSelectBlock: (id: string | null) => void
  onAddBlock: (type: FunnelBlockType) => void
  onDeleteBlock: (id: string) => void
}

interface BlockTypeMeta {
  type: FunnelBlockType
  label: string
  icon: React.ReactNode
  /** Si true, le bloc est affiché grisé "À venir" et non-cliquable dans le menu d'ajout. */
  comingSoon?: boolean
}

const ICON_SIZE = 14

const BLOCK_TYPES: BlockTypeMeta[] = [
  { type: 'hero', label: 'Hero', icon: <Crosshair size={ICON_SIZE} /> },
  { type: 'video', label: 'Vidéo', icon: <Video size={ICON_SIZE} /> },
  { type: 'text', label: 'Texte', icon: <Type size={ICON_SIZE} /> },
  { type: 'image', label: 'Image', icon: <ImageIcon size={ICON_SIZE} /> },
  { type: 'cta', label: 'Bouton CTA', icon: <MousePointerClick size={ICON_SIZE} /> },
  { type: 'pricing', label: 'Tarification', icon: <DollarSign size={ICON_SIZE} /> },
  { type: 'testimonials', label: 'Témoignages', icon: <MessageSquareQuote size={ICON_SIZE} /> },
  { type: 'faq', label: 'FAQ', icon: <HelpCircle size={ICON_SIZE} /> },
  { type: 'countdown', label: 'Compte à rebours', icon: <Timer size={ICON_SIZE} /> },
  { type: 'spacer', label: 'Espacement', icon: <ArrowUpDown size={ICON_SIZE} /> },
  { type: 'footer', label: 'Footer', icon: <PanelBottom size={ICON_SIZE} /> },
  // Stubs "À venir" — visible mais non-ajoutables
  { type: 'booking', label: 'Réservation', icon: <Calendar size={ICON_SIZE} />, comingSoon: true },
  { type: 'form', label: 'Formulaire', icon: <FileText size={ICON_SIZE} />, comingSoon: true },
]

const BLOCK_LABELS: Record<FunnelBlockType, string> = BLOCK_TYPES.reduce(
  (acc, b) => ({ ...acc, [b.type]: b.label }),
  {} as Record<FunnelBlockType, string>,
)

const BLOCK_ICONS: Record<FunnelBlockType, React.ReactNode> = BLOCK_TYPES.reduce(
  (acc, b) => ({ ...acc, [b.type]: b.icon }),
  {} as Record<FunnelBlockType, React.ReactNode>,
)

export default function SectionsListPanel({
  blocks,
  selectedBlockId,
  onSelectBlock,
  onAddBlock,
  onDeleteBlock,
}: Props) {
  const [showAddMenu, setShowAddMenu] = useState(false)

  const handleSelectType = (type: FunnelBlockType) => {
    onAddBlock(type)
    setShowAddMenu(false)
  }

  return (
    <div style={panelStyle}>
      {/* Header */}
      <header style={headerStyle}>
        <span style={headerTitleStyle}>Sections</span>
        <span style={headerCountStyle}>{blocks.length}</span>
      </header>

      {/* Liste des blocs */}
      {blocks.length === 0 ? (
        <div style={emptyStateStyle}>
          <Plus size={24} style={{ marginBottom: 8, color: 'var(--text-secondary, #888)' }} />
          <span style={emptyTitleStyle}>Aucune section</span>
          <span style={emptyDescStyle}>
            Clique sur &quot;Ajouter&quot; ci-dessous pour commencer à construire ta page.
          </span>
        </div>
      ) : (
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div style={blocksListStyle}>
            {blocks.map((block) => (
              <SortableSectionRow
                key={block.id}
                block={block}
                isSelected={block.id === selectedBlockId}
                onSelect={() => onSelectBlock(block.id)}
                onDelete={() => onDeleteBlock(block.id)}
              />
            ))}
          </div>
        </SortableContext>
      )}

      {/* Bouton Ajouter une section + menu déroulant */}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setShowAddMenu((s) => !s)}
          style={addButtonStyle(showAddMenu)}
        >
          <Plus size={14} />
          <span>Ajouter une section</span>
        </button>

        {showAddMenu && (
          <>
            {/* Backdrop pour fermer au clic extérieur */}
            <div
              style={backdropStyle}
              onClick={() => setShowAddMenu(false)}
              aria-hidden="true"
            />
            <div style={menuStyle}>
              {BLOCK_TYPES.map((meta) => {
                const isComingSoon = meta.comingSoon === true
                return (
                  <button
                    key={meta.type}
                    type="button"
                    onClick={() => !isComingSoon && handleSelectType(meta.type)}
                    disabled={isComingSoon}
                    style={menuItemStyle(isComingSoon)}
                    title={
                      isComingSoon
                        ? 'Disponible bientôt — branchage avec les API internes en cours'
                        : `Ajouter un bloc ${meta.label}`
                    }
                  >
                    <span style={menuIconStyle}>{meta.icon}</span>
                    <span style={menuLabelStyle}>{meta.label}</span>
                    {isComingSoon && <span style={comingSoonTagStyle}>À venir</span>}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ─── Sous-composant SortableSectionRow ─────────────────────────────── */

function SortableSectionRow({
  block,
  isSelected,
  onSelect,
  onDelete,
}: {
  block: FunnelBlock
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } =
    useSortable({ id: block.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'background 0.15s ease, border-color 0.15s ease',
    background: isSelected ? 'rgba(0,200,83, 0.12)' : 'rgba(255,255,255,0.02)',
    border: isSelected
      ? '1px solid rgba(0,200,83, 0.5)'
      : '1px solid rgba(255,255,255,0.06)',
    borderRadius: 6,
    padding: '8px 6px',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    cursor: 'pointer',
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} onClick={onSelect}>
      {/* Drag handle */}
      <button
        ref={setActivatorNodeRef}
        {...listeners}
        type="button"
        style={dragHandleStyle}
        onClick={(e) => e.stopPropagation()}
        title="Glisser pour réorganiser"
        aria-label="Glisser pour réorganiser"
      >
        <GripVertical size={12} />
      </button>

      {/* Emoji + label */}
      <span style={rowIconStyle}>{BLOCK_ICONS[block.type]}</span>
      <span style={rowLabelStyle}>{BLOCK_LABELS[block.type]}</span>

      {/* Delete button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        style={deleteButtonStyle}
        title="Supprimer la section"
        aria-label="Supprimer la section"
      >
        <X size={12} />
      </button>
    </div>
  )
}

/* ─── Styles ────────────────────────────────────────────────────────── */

const panelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 4px',
}

const headerTitleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-primary, #fff)',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}

const headerCountStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: 'rgba(255,255,255,0.5)',
  background: 'rgba(255,255,255,0.06)',
  padding: '2px 8px',
  borderRadius: 50,
  minWidth: 24,
  textAlign: 'center',
}

const emptyStateStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  padding: '20px 12px',
  background: 'rgba(255,255,255,0.02)',
  border: '1px dashed rgba(255,255,255,0.08)',
  borderRadius: 8,
  gap: 4,
}

const emptyTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-primary, #fff)',
}

const emptyDescStyle: React.CSSProperties = {
  fontSize: 10,
  color: 'var(--text-secondary, #888)',
  maxWidth: 200,
  lineHeight: 1.4,
}

const blocksListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

const dragHandleStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'rgba(255,255,255,0.4)',
  cursor: 'grab',
  padding: 2,
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0,
}

const rowIconStyle: React.CSSProperties = {
  width: 18,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  color: 'var(--text-secondary, #888)',
}

const rowLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#fff',
  flex: 1,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const deleteButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'rgba(255,255,255,0.4)',
  cursor: 'pointer',
  padding: 2,
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0,
  borderRadius: 3,
}

const addButtonStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  width: '100%',
  padding: '8px 12px',
  fontSize: 11,
  fontWeight: 700,
  color: active ? 'var(--color-primary)' : '#fff',
  background: active ? 'rgba(0,200,83, 0.1)' : 'rgba(255,255,255,0.04)',
  border: active
    ? '1px dashed rgba(0,200,83, 0.5)'
    : '1px dashed rgba(255,255,255,0.15)',
  borderRadius: 8,
  cursor: 'pointer',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  fontFamily: 'inherit',
  transition: 'all 0.15s ease',
})

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 50,
}

const menuStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 'calc(100% + 4px)',
  left: 0,
  right: 0,
  maxHeight: 320,
  overflowY: 'auto',
  background: '#1a1a1a',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  padding: 4,
  zIndex: 51,
  boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
}

const menuItemStyle = (isComingSoon: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 10px',
  background: 'transparent',
  border: 'none',
  borderRadius: 4,
  cursor: isComingSoon ? 'not-allowed' : 'pointer',
  textAlign: 'left',
  color: isComingSoon ? 'rgba(255,255,255,0.4)' : '#fff',
  fontFamily: 'inherit',
  width: '100%',
  opacity: isComingSoon ? 0.6 : 1,
})

const menuIconStyle: React.CSSProperties = {
  width: 18,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  color: 'var(--text-secondary, #888)',
}

const menuLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  flex: 1,
}

const comingSoonTagStyle: React.CSSProperties = {
  fontSize: 8,
  padding: '2px 6px',
  background: 'rgba(255,255,255,0.08)',
  color: 'rgba(255,255,255,0.6)',
  borderRadius: 3,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  fontWeight: 700,
}
