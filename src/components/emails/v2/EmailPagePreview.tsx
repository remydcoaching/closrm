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

  // Suppress unused-var warning from legacy selection overlay.
  void selectedBlockId
  void onSelectBlock

  return (
    <div
      style={{
        flex: 1,
        overflow: 'auto',
        background: '#0d0d0d',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          padding: '14px 20px',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #1f1f1f',
          background: '#0a0a0a',
          position: 'sticky',
          top: 0,
          zIndex: 2,
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 2,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            padding: 3,
          }}
        >
          <DeviceBtn active={mode === 'desktop'} onClick={() => onModeChange('desktop')}>
            <Laptop size={13} />
            <span>Desktop</span>
          </DeviceBtn>
          <DeviceBtn active={mode === 'mobile'} onClick={() => onModeChange('mobile')}>
            <Smartphone size={13} />
            <span>Mobile</span>
          </DeviceBtn>
        </div>
        {onTestSend && (
          <button
            onClick={onTestSend}
            style={{
              padding: '8px 16px',
              fontSize: 12,
              fontWeight: 600,
              background: 'transparent',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            Envoyer un test
          </button>
        )}
      </div>

      {/* Preview zone */}
      <div
        style={{
          flex: 1,
          padding: '32px 20px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
        }}
      >
        <div style={{ width: iframeWidth, maxWidth: '100%' }}>
          <iframe
            sandbox=""
            srcDoc={html}
            style={{
              width: iframeWidth,
              minHeight: 680,
              border: 'none',
              borderRadius: 10,
              background: '#fff',
              transition: 'width 0.2s ease',
              boxShadow: '0 4px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.04)',
            }}
          />
        </div>
      </div>

      {blocks.length === 0 && (
        <p style={{ color: '#666', fontSize: 13, textAlign: 'center', padding: '0 20px 24px' }}>
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
        padding: '6px 12px',
        fontSize: 11,
        fontWeight: 600,
        borderRadius: 6,
        border: 'none',
        background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
        color: active ? '#fff' : 'rgba(255,255,255,0.55)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  )
}
