'use client'

import { useState } from 'react'
import type { FaqBlockConfig } from '@/types'

interface Props {
  config: FaqBlockConfig
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ borderBottom: '1px solid #eee' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 600, color: '#111' }}>{question}</span>
        <span style={{ fontSize: 22, color: '#888', lineHeight: 1, flexShrink: 0, marginLeft: 12 }}>
          {open ? '−' : '+'}
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 0 16px', fontSize: 15, lineHeight: 1.6, color: '#555' }}>
          {answer}
        </div>
      )}
    </div>
  )
}

export default function FaqBlock({ config }: Props) {
  return (
    <div style={{ padding: '40px 20px', maxWidth: 700, margin: '0 auto' }}>
      {config.title && (
        <h2 style={{ fontSize: 28, fontWeight: 700, color: '#111', margin: '0 0 24px', textAlign: 'center' }}>
          {config.title}
        </h2>
      )}
      <div>
        {(config.items || []).map((item, i) => (
          <FaqItem key={i} question={item.question} answer={item.answer} />
        ))}
      </div>
    </div>
  )
}
