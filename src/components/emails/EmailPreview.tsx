'use client'

import { useState, useEffect } from 'react'
import type { EmailBlock } from '@/types'

interface Props {
  blocks: EmailBlock[]
  previewText?: string
}

export default function EmailPreview({ blocks, previewText }: Props) {
  const [html, setHtml] = useState('')
  const [mode, setMode] = useState<'desktop' | 'mobile'>('desktop')

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/emails/templates/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blocks, preview_text: previewText }),
        })
        if (res.ok) setHtml(await res.text())
      } catch {
        // ignore preview errors
      }
    }, 500) // debounce

    return () => clearTimeout(timer)
  }, [blocks, previewText])

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <button
          onClick={() => setMode('desktop')}
          style={{
            padding: '4px 12px', fontSize: 11, fontWeight: 500,
            background: mode === 'desktop' ? '#333' : '#1a1a1a',
            color: mode === 'desktop' ? '#fff' : '#666',
            border: '1px solid #333', borderRadius: 6, cursor: 'pointer',
          }}
        >
          Desktop
        </button>
        <button
          onClick={() => setMode('mobile')}
          style={{
            padding: '4px 12px', fontSize: 11, fontWeight: 500,
            background: mode === 'mobile' ? '#333' : '#1a1a1a',
            color: mode === 'mobile' ? '#fff' : '#666',
            border: '1px solid #333', borderRadius: 6, cursor: 'pointer',
          }}
        >
          Mobile
        </button>
      </div>

      <div style={{
        width: mode === 'mobile' ? 375 : '100%',
        margin: '0 auto',
        background: '#f4f4f5',
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid #333',
      }}>
        {html ? (
          <iframe
            srcDoc={html}
            style={{
              width: '100%',
              height: 500,
              border: 'none',
            }}
            title="Email preview"
          />
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: '#999', fontSize: 13 }}>
            Ajoute des blocs pour voir la preview
          </div>
        )}
      </div>
    </div>
  )
}
