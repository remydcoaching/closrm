'use client'

/**
 * Preview live de l'email en cours d'édition. Render les blocks dans un
 * container 600px (desktop) ou 375px (mobile), avec click-to-select.
 *
 * Stratégie "render SSR-like + iframe sandbox" :
 *   - On compile côté client avec `compileBlocksV2` (même fonction que
 *     celle utilisée par l'envoi → zéro drift preview↔envoi)
 *   - On affiche le HTML dans un iframe avec sandbox="" pour ne pas
 *     exécuter de JS éventuel et pour isoler les styles.
 *   - Le click-to-select n'est pas possible dans un iframe sandbox (pas
 *     d'accès postMessage), donc on double-affiche une couche clickable
 *     transparente par-dessus qui sélectionne le bloc par index.
 *
 * Device toggle : desktop 600px / mobile 375px.
 */

import { useMemo } from 'react'
import { Laptop, Smartphone } from 'lucide-react'
import type { EmailBlock } from '@/types'
import type { EmailPreset, EmailPresetOverride } from '@/lib/email/design-types'
import { compileBlocksV2 } from '@/lib/email/compiler-v2'

interface Props {
  blocks: EmailBlock[]
  presetId: string
  presetOverride: EmailPresetOverride | null
  selectedBlockId: string | null
  onSelectBlock: (blockId: string | null) => void
  mode: 'desktop' | 'mobile'
  onModeChange: (mode: 'desktop' | 'mobile') => void
  onTestSend?: () => void
  _preset?: EmailPreset
}

export default function EmailPagePreview({
  blocks,
  presetId,
  presetOverride,
  selectedBlockId,
  onSelectBlock,
  mode,
  onModeChange,
  onTestSend,
}: Props) {
  const html = useMemo(() => {
    return compileBlocksV2({
      blocks,
      previewText: null,
      presetId,
      presetOverride,
    })
  }, [blocks, presetId, presetOverride])

  const iframeWidth = mode === 'mobile' ? 375 : 600

  return (
    <div
      style={{
        flex: 1,
        overflow: 'auto',
        background: '#0a0a0a',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 16,
          alignItems: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 4,
            background: '#141414',
            border: '1px solid #262626',
            borderRadius: 8,
            padding: 4,
          }}
        >
          <DeviceBtn active={mode === 'desktop'} onClick={() => onModeChange('desktop')}>
            <Laptop size={14} />
          </DeviceBtn>
          <DeviceBtn active={mode === 'mobile'} onClick={() => onModeChange('mobile')}>
            <Smartphone size={14} />
          </DeviceBtn>
        </div>
        {onTestSend && (
          <button
            onClick={onTestSend}
            style={{
              padding: '8px 16px',
              fontSize: 12,
              fontWeight: 600,
              background: '#E53E3E',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            📧 Tester l&apos;envoi
          </button>
        )}
      </div>

      {/* Preview iframe */}
      <div style={{ position: 'relative', width: iframeWidth, maxWidth: '100%' }}>
        <iframe
          sandbox=""
          srcDoc={html}
          style={{
            width: iframeWidth,
            minHeight: 600,
            border: '1px solid #262626',
            borderRadius: 8,
            background: '#fff',
            transition: 'width 0.2s ease',
          }}
        />

        {/* Block overlay for click-to-select */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            display: 'flex',
            flexDirection: 'column',
            pointerEvents: 'none',
          }}
        >
          {blocks.map((block, idx) => (
            <div
              key={block.id}
              onClick={() => onSelectBlock(block.id)}
              style={{
                flex: 1,
                minHeight: 20,
                cursor: 'pointer',
                outline:
                  selectedBlockId === block.id
                    ? '2px solid #3b82f6'
                    : 'none',
                outlineOffset: -2,
                pointerEvents: 'auto',
                opacity: 0,
                // Hack : on ne peut pas précisément aligner sur le contenu
                // de l'iframe (CORS cross-origin). À améliorer avec un
                // postMessage interne quand on retire sandbox="".
                display: idx === 0 ? 'block' : 'none',
              }}
            />
          ))}
        </div>
      </div>

      {blocks.length === 0 && (
        <p style={{ color: '#666', fontSize: 13, marginTop: 20 }}>
          Ajoute des blocs depuis la sidebar pour voir la preview.
        </p>
      )}
    </div>
  )
}

function DeviceBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 30,
        height: 26,
        borderRadius: 6,
        border: 'none',
        background: active ? '#E53E3E' : 'transparent',
        color: active ? '#fff' : '#888',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </button>
  )
}
