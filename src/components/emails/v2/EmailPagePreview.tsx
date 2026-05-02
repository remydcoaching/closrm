'use client'

import { useMemo, useRef, useEffect, useCallback, useState as useLocalState } from 'react'
import { Laptop, Smartphone } from 'lucide-react'
import type { EmailBlock } from '@/types'
import type { EmailPresetOverride } from '@/lib/email/design-types'
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
}

interface BlockRect {
  id: string
  top: number
  height: number
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
      isPreview: true,
    })
  }, [blocks, presetId, presetOverride])

  const iframeWidth = mode === 'mobile' ? 375 : 600
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [blockRects, setBlockRects] = useLocalState<BlockRect[]>([])
  const [iframeHeight, setIframeHeight] = useLocalState(680)

  const measureBlocks = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    try {
      const doc = iframe.contentDocument
      if (!doc) return
      const body = doc.body
      if (body) {
        const h = body.scrollHeight
        if (h > 100) setIframeHeight(h)
      }
      const trs = doc.querySelectorAll('[data-block-id]')
      const rects: BlockRect[] = []
      trs.forEach((el) => {
        const id = el.getAttribute('data-block-id')
        if (!id) return
        const rect = (el as HTMLElement).getBoundingClientRect()
        rects.push({ id, top: rect.top, height: rect.height })
      })
      setBlockRects(rects)
    } catch {
      // cross-origin: can't access
    }
  }, [])

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    const onLoad = () => {
      measureBlocks()
      const doc = iframe.contentDocument
      if (doc) {
        const obs = new MutationObserver(measureBlocks)
        obs.observe(doc.body, { childList: true, subtree: true, attributes: true })
        return () => obs.disconnect()
      }
    }
    iframe.addEventListener('load', onLoad)
    return () => iframe.removeEventListener('load', onLoad)
  }, [html, measureBlocks])

  useEffect(() => {
    const t = setTimeout(measureBlocks, 300)
    return () => clearTimeout(t)
  }, [html, mode, measureBlocks])

  function handleOverlayClick(blockId: string) {
    onSelectBlock(blockId)
  }

  function handleBackgroundClick() {
    onSelectBlock(null)
  }

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
        onClick={handleBackgroundClick}
        style={{
          flex: 1,
          padding: '32px 20px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
        }}
      >
        <div ref={wrapperRef} style={{ width: iframeWidth, maxWidth: '100%', position: 'relative' }}>
          <iframe
            ref={iframeRef}
            sandbox="allow-same-origin"
            srcDoc={html}
            style={{
              width: iframeWidth,
              height: iframeHeight,
              border: 'none',
              borderRadius: 10,
              transition: 'width 0.2s ease',
              boxShadow: '0 4px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.04)',
              display: 'block',
            }}
          />
          {/* Clickable overlay layer */}
          {blockRects.map((br) => {
            const isSelected = br.id === selectedBlockId
            return (
              <div
                key={br.id}
                onClick={(e) => {
                  e.stopPropagation()
                  handleOverlayClick(br.id)
                }}
                style={{
                  position: 'absolute',
                  top: br.top,
                  left: 0,
                  width: '100%',
                  height: br.height,
                  cursor: 'pointer',
                  borderRadius: 4,
                  border: isSelected ? '2px solid #3b82f6' : '2px solid transparent',
                  background: isSelected
                    ? 'rgba(59,130,246,0.06)'
                    : 'transparent',
                  transition: 'border-color 0.15s, background 0.15s',
                  zIndex: 1,
                  boxSizing: 'border-box',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(59,130,246,0.4)'
                    ;(e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.03)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    ;(e.currentTarget as HTMLElement).style.borderColor = 'transparent'
                    ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                  }
                }}
              />
            )
          })}
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
