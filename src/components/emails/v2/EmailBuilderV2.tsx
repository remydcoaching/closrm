'use client'

/**
 * Email Builder v2 — layout 3 colonnes inspiré de FunnelBuilderV2.
 *
 * Sidebar 300px : Direction artistique + Sections list
 * Preview flex : live preview via iframe sandbox (EmailPagePreview)
 * Inspector 320px : éditeur du bloc sélectionné (optionnel)
 */

import { useState } from 'react'
import type { EmailBlock, EmailTemplate } from '@/types'
import type { EmailPresetOverride } from '@/lib/email/design-types'
import EmailDirectionArtistiquePanel from './sidebar/EmailDirectionArtistiquePanel'
import EmailSectionsListPanel from './sidebar/EmailSectionsListPanel'
import EmailBlockInspector from './inspector/EmailBlockInspector'
import EmailPagePreview from './EmailPagePreview'

interface Props {
  template: Pick<EmailTemplate, 'id' | 'preset_id' | 'preset_override'>
  blocks: EmailBlock[]
  onBlocksChange: (blocks: EmailBlock[]) => void
  onDesignChange: (changes: { presetId?: string; presetOverride?: EmailPresetOverride | null }) => void
  onTestSend?: () => void
}

export default function EmailBuilderV2({
  template,
  blocks,
  onBlocksChange,
  onDesignChange,
  onTestSend,
}: Props) {
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [mode, setMode] = useState<'desktop' | 'mobile'>('desktop')
  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) || null
  const presetId = template.preset_id || 'classique'
  const presetOverride = (template.preset_override as EmailPresetOverride | null) || null

  function handleBlockChange(updatedBlock: EmailBlock) {
    onBlocksChange(blocks.map((b) => (b.id === updatedBlock.id ? updatedBlock : b)))
  }

  return (
    <div
      style={{
        display: 'flex',
        height: 'calc(100vh - 120px)',
        border: '1px solid #262626',
        borderRadius: 12,
        overflow: 'hidden',
        background: '#0a0a0a',
      }}
    >
      {/* Sidebar 300px */}
      <div
        style={{
          width: 300,
          flexShrink: 0,
          borderRight: '1px solid #262626',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        <EmailDirectionArtistiquePanel
          presetId={presetId}
          presetOverride={presetOverride}
          onDesignChange={onDesignChange}
        />
        <EmailSectionsListPanel
          blocks={blocks}
          selectedBlockId={selectedBlockId}
          onBlocksChange={onBlocksChange}
          onSelectBlock={setSelectedBlockId}
        />
      </div>

      {/* Preview */}
      <EmailPagePreview
        blocks={blocks}
        presetId={presetId}
        presetOverride={presetOverride}
        selectedBlockId={selectedBlockId}
        onSelectBlock={setSelectedBlockId}
        mode={mode}
        onModeChange={setMode}
        onTestSend={onTestSend}
      />

      {/* Inspector 320px */}
      {selectedBlock && (
        <div
          style={{
            width: 320,
            flexShrink: 0,
            borderLeft: '1px solid #262626',
            background: '#0f0f0f',
          }}
        >
          <EmailBlockInspector
            block={selectedBlock}
            onChange={handleBlockChange}
            onClose={() => setSelectedBlockId(null)}
          />
        </div>
      )}
    </div>
  )
}
