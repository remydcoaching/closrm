'use client'

import type { EmailBlock, EmailBlockType } from '@/types'
import HeaderBlock from './blocks/HeaderBlock'
import TextBlock from './blocks/TextBlock'
import ImageBlock from './blocks/ImageBlock'
import ButtonBlock from './blocks/ButtonBlock'
import DividerBlock from './blocks/DividerBlock'
import FooterBlock from './blocks/FooterBlock'

interface Props {
  block: EmailBlock
  onChange: (block: EmailBlock) => void
  onDelete: () => void
  isFooter?: boolean
  dragHandleProps?: Record<string, unknown>
}

const BLOCK_LABELS: Record<EmailBlockType, string> = {
  header: 'En-tête',
  text: 'Texte',
  image: 'Image',
  button: 'Bouton',
  divider: 'Séparateur',
  footer: 'Pied de page',
}

export default function BlockRenderer({ block, onChange, onDelete, isFooter, dragHandleProps }: Props) {
  function handleConfigChange(config: EmailBlock['config']) {
    onChange({ ...block, config })
  }

  function renderEditor() {
    switch (block.type) {
      case 'header':
        return <HeaderBlock config={block.config as Parameters<typeof HeaderBlock>[0]['config']} onChange={handleConfigChange} />
      case 'text':
        return <TextBlock config={block.config as Parameters<typeof TextBlock>[0]['config']} onChange={handleConfigChange} />
      case 'image':
        return <ImageBlock config={block.config as Parameters<typeof ImageBlock>[0]['config']} onChange={handleConfigChange} />
      case 'button':
        return <ButtonBlock config={block.config as Parameters<typeof ButtonBlock>[0]['config']} onChange={handleConfigChange} />
      case 'divider':
        return <DividerBlock config={block.config as Parameters<typeof DividerBlock>[0]['config']} onChange={handleConfigChange} />
      case 'footer':
        return <FooterBlock config={block.config as Parameters<typeof FooterBlock>[0]['config']} onChange={handleConfigChange} />
    }
  }

  return (
    <div style={{
      background: '#1a1a1a',
      border: '1px solid #2a2a2a',
      borderRadius: 10,
      padding: '12px 16px',
      position: 'relative',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 4,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span {...dragHandleProps} style={{ cursor: 'grab', color: '#444', fontSize: 14, touchAction: 'none' }}>⠿</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {BLOCK_LABELS[block.type]}
          </span>
        </div>
        {!isFooter && (
          <button
            onClick={onDelete}
            style={{
              fontSize: 11, color: '#555', background: 'none', border: 'none',
              cursor: 'pointer', padding: '2px 6px',
            }}
          >
            Supprimer
          </button>
        )}
      </div>
      {renderEditor()}
    </div>
  )
}
