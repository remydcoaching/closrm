'use client'

/**
 * T-028b — Nouveau builder Funnels v2.
 *
 * Remplace l'ancien `src/components/funnels/FunnelBuilder.tsx` (legacy buggé,
 * sera supprimé en Phase 8 de T-028b une fois cette nouvelle version validée).
 *
 * Architecture 3 colonnes :
 * - Sidebar gauche (280px) : Direction artistique (preset + effets) + Sections (drag&drop)
 * - Preview centrale (flex) : `<FunnelPagePreview funnel={...} />` avec design system live
 * - Inspector droit (320px, optionnel) : éditeur de bloc sélectionné
 *
 * Phases d'implémentation (cf. fiche T-028b) :
 * - Phase 1 (cette version) : layout vide avec placeholders
 * - Phase 2 : panneau Direction artistique (presets + 4 pickers + toggle 🔗 + 10 effects)
 * - Phase 3 : liste de sections drag&drop + bouton ajouter
 * - Phase 4 : preview live + toggle device
 * - Phase 5 : inspector latéral (réutilise FunnelBlockConfig existant)
 * - Phase 6 : undo/redo + autosave
 * - Phase 7 : polish
 * - Phase 8 : suppression du legacy
 *
 * Le composant prend les mêmes props que le legacy + 2 nouveaux :
 * - `funnel` : la donnée funnel complète (avec preset_id, preset_override, effects_config)
 * - `onFunnelDesignChange` : callback quand le coach change preset/override/effects
 *
 * Le parent (`page.tsx`) reste responsable du chargement du funnel et des appels
 * API de sauvegarde — ce builder n'orchestre que l'UI d'édition.
 */

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import type {
  Funnel,
  FunnelBlock,
  FunnelBlockType,
  FunnelBlockConfig,
  FunnelPage,
  FunnelPresetOverrideJSON,
  FunnelEffectsConfigJSON,
} from '@/types'
import { SlidersHorizontal } from 'lucide-react'
import type { BlockEffectsJSON } from '@/types'
import FunnelPagePreview, { type FunnelPreviewMode } from '../FunnelPagePreview'
import FunnelBlockConfigPanel from '../FunnelBlockConfig'
import DirectionArtistiquePanel from './sidebar/DirectionArtistiquePanel'
import SectionsListPanel from './sidebar/SectionsListPanel'
import BlockEffectsPanel from './inspector/BlockEffectsPanel'
import { createDefaultBlock } from '@/lib/funnels/defaults'

// Labels FR des types de blocs (utilisés dans le header de l'inspector)
const BLOCK_LABELS: Record<FunnelBlockType, string> = {
  hero: 'Hero',
  video: 'Vidéo',
  text: 'Texte',
  image: 'Image',
  cta: 'Bouton CTA',
  pricing: 'Tarification',
  testimonials: 'Témoignages',
  faq: 'FAQ',
  countdown: 'Compte à rebours',
  spacer: 'Espacement',
  footer: 'Footer',
  booking: 'Réservation',
  form: 'Formulaire',
}

interface Props {
  /** Funnel parent (avec design system v2). */
  funnel: Pick<Funnel, 'id' | 'preset_id' | 'preset_override' | 'effects_config'>
  /** Pages du funnel. */
  pages: FunnelPage[]
  /** ID de la page actuellement éditée. */
  activePageId: string
  /** Callback de mise à jour des pages (blocs). Appelé par drag&drop, ajout, suppression, édition. */
  onPagesChange: (pages: FunnelPage[]) => void
  /**
   * Callback de mise à jour du design du funnel (preset, override, effects).
   * Le parent doit persister ça via PUT /api/funnels/[id].
   */
  onFunnelDesignChange: (changes: {
    preset_id?: string
    preset_override?: FunnelPresetOverrideJSON | null
    effects_config?: FunnelEffectsConfigJSON
  }) => void
  /** Mode d'affichage du preview (desktop / tablet / mobile). */
  mode: FunnelPreviewMode
}

/* T-028 Phase 10 — getDefaultConfig() a été extraite dans
 * src/lib/funnels/defaults.ts (fonction `getDefaultBlockConfig`) pour être
 * réutilisable depuis la page admin (getDefaultPageBlocks) et éviter la
 * duplication. On utilise maintenant `createDefaultBlock(type)` qui génère
 * un bloc complet avec ID + config. */

export default function FunnelBuilderV2({
  funnel,
  pages,
  activePageId,
  onPagesChange,
  onFunnelDesignChange,
  mode,
}: Props) {
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const activePage = pages.find((p) => p.id === activePageId)
  const blocks = activePage?.blocks ?? []
  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) ?? null

  // ─── Helpers de mutation ──────────────────────────────────────────────────

  function updateActivePageBlocks(updater: (currentBlocks: FunnelBlock[]) => FunnelBlock[]) {
    const currentPage = pages.find((p) => p.id === activePageId)
    if (!currentPage) return
    const newBlocks = updater(currentPage.blocks ?? [])
    onPagesChange(
      pages.map((p) => (p.id === activePageId ? { ...p, blocks: newBlocks } : p))
    )
  }

  function handleAddBlock(type: FunnelBlockType) {
    const newBlock = createDefaultBlock(type)
    updateActivePageBlocks((current) => [...current, newBlock])
    setSelectedBlockId(newBlock.id)
  }

  function handleDeleteBlock(blockId: string) {
    updateActivePageBlocks((current) => current.filter((b) => b.id !== blockId))
    if (selectedBlockId === blockId) setSelectedBlockId(null)
  }

  function handleBlockChange(updatedBlock: FunnelBlock) {
    updateActivePageBlocks((current) =>
      current.map((b) => (b.id === updatedBlock.id ? updatedBlock : b))
    )
  }

  /**
   * T-028 Phase 9 — Callback du BlockEffectsPanel : met à jour uniquement
   * le champ `effects` du bloc sélectionné. On merge sur la config actuelle
   * pour ne pas écraser les autres champs (titre, ctaText, etc.).
   */
  function handleBlockEffectsChange(effects: BlockEffectsJSON) {
    if (!selectedBlock) return
    const nextConfig = { ...selectedBlock.config, effects } as FunnelBlockConfig
    handleBlockChange({ ...selectedBlock, config: nextConfig })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = blocks.findIndex((b) => b.id === active.id)
    const newIndex = blocks.findIndex((b) => b.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    updateActivePageBlocks(() => arrayMove(blocks, oldIndex, newIndex))
  }

  // ─── Rendu ───────────────────────────────────────────────────────────────

  return (
    <div style={containerStyle}>
      {/* T-028b Phase 7 — keyframes globaux utilisés par les indicateurs */}
      <style>{`
        @keyframes fnl-builder-pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }
        @keyframes fnl-builder-fade-in { from { opacity: 0 } to { opacity: 1 } }
      `}</style>

      {/* ─── COLONNE GAUCHE : SIDEBAR ────────────────────────────────────── */}
      <aside style={sidebarStyle}>
        {/* Phase 2 — Panneau Direction artistique (preset + couleurs + effets) */}
        <DirectionArtistiquePanel
          presetId={funnel.preset_id}
          presetOverride={funnel.preset_override}
          effectsConfig={funnel.effects_config}
          onDesignChange={onFunnelDesignChange}
        />

        {/* Séparateur visuel */}
        <div style={sidebarSeparatorStyle} />

        {/* Phase 3 — Liste des sections drag&drop + bouton ajouter */}
        <SectionsListPanel
          blocks={blocks}
          selectedBlockId={selectedBlockId}
          onSelectBlock={setSelectedBlockId}
          onAddBlock={handleAddBlock}
          onDeleteBlock={handleDeleteBlock}
          onReorderBlocks={(reordered) => updateActivePageBlocks(() => reordered)}
        />
      </aside>

      {/* ─── COLONNE CENTRALE : PREVIEW ──────────────────────────────────── */}
      <main style={previewStyle}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <FunnelPagePreview
            blocks={blocks}
            selectedBlockId={selectedBlockId}
            onSelectBlock={setSelectedBlockId}
            onDeleteBlock={handleDeleteBlock}
            mode={mode}
            funnel={funnel}
          />
        </DndContext>
      </main>

      {/* ─── COLONNE DROITE : INSPECTOR ──────────────────────────────────── */}
      <aside style={inspectorStyle}>
        {selectedBlock ? (
          <div>
            {/* Header avec label du bloc + bouton "désélectionner" */}
            <div style={inspectorHeaderStyle}>
              <span style={inspectorHeaderTitleStyle}>
                {BLOCK_LABELS[selectedBlock.type] ?? selectedBlock.type}
              </span>
              <button
                type="button"
                onClick={() => setSelectedBlockId(null)}
                style={inspectorCloseStyle}
                title="Désélectionner"
                aria-label="Désélectionner le bloc"
              >
                ×
              </button>
            </div>
            <FunnelBlockConfigPanel block={selectedBlock} onChange={handleBlockChange} pages={pages} blocks={blocks} />
            {/* T-028 Phase 9 — Panneau des effets propres au bloc
                (shimmer, button shine) affiché uniquement pour Hero/CTA/Text */}
            <BlockEffectsPanel
              block={selectedBlock}
              onChange={handleBlockEffectsChange}
            />
          </div>
        ) : (
          <div style={inspectorEmptyStyle}>
            <SlidersHorizontal size={24} style={{ marginBottom: 8, color: 'var(--text-secondary, #888)' }} />
            <span style={inspectorEmptyTitleStyle}>Inspector</span>
            <span style={inspectorEmptyDescStyle}>
              Sélectionne une section dans la liste de gauche ou clique sur un bloc dans
              le preview pour éditer son contenu.
            </span>
          </div>
        )}
      </aside>

    </div>
  )
}

/* ─── Styles ──────────────────────────────────────────────────────────── */

const containerStyle: React.CSSProperties = {
  display: 'flex',
  height: '100%',
  overflow: 'hidden',
  position: 'relative',
}

const sidebarStyle: React.CSSProperties = {
  width: 300,
  flexShrink: 0,
  borderRight: '1px solid var(--border-primary, #262626)',
  background: 'var(--bg-secondary, #141414)',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: 14,
}

const sidebarSeparatorStyle: React.CSSProperties = {
  height: 1,
  background: 'rgba(255,255,255,0.06)',
  margin: '4px 0',
}

const previewStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  minWidth: 0,
}

const inspectorStyle: React.CSSProperties = {
  width: 320,
  flexShrink: 0,
  borderLeft: '1px solid var(--border-primary, #262626)',
  background: 'var(--bg-secondary, #141414)',
  overflowY: 'auto',
  padding: 16,
}

const inspectorHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 12,
  paddingBottom: 10,
  borderBottom: '1px solid rgba(255,255,255,0.06)',
}

const inspectorHeaderTitleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-primary, #fff)',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}

const inspectorCloseStyle: React.CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 4,
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'rgba(255,255,255,0.6)',
  fontSize: 16,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  fontFamily: 'inherit',
  lineHeight: 1,
}

const inspectorEmptyStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  padding: '32px 16px',
  background: 'rgba(255,255,255,0.02)',
  border: '1px dashed rgba(255,255,255,0.08)',
  borderRadius: 10,
  gap: 6,
}

const inspectorEmptyTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--text-primary, #fff)',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}

const inspectorEmptyDescStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-secondary, #888)',
  lineHeight: 1.5,
  maxWidth: 240,
}

