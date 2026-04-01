'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { FunnelPage } from '@/types'

interface Props {
  pages: FunnelPage[]
  activePageId: string
  onSelectPage: (id: string) => void
  onAddPage: () => void
  onDeletePage: (id: string) => void
}

export default function FunnelPageTabs({ pages, activePageId, onSelectPage, onAddPage, onDeletePage }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0, overflow: 'auto',
    }}>
      {pages.map((page, index) => {
        const isActive = page.id === activePageId
        const isHovered = page.id === hoveredId
        return (
          <div
            key={page.id}
            onMouseEnter={() => setHoveredId(page.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => onSelectPage(page.id)}
            style={{
              position: 'relative',
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', cursor: 'pointer',
              fontSize: 13, fontWeight: isActive ? 600 : 400,
              color: isActive ? '#fff' : '#888',
              borderBottom: isActive ? '2px solid #E53E3E' : '2px solid transparent',
              background: isActive ? 'rgba(229,62,62,0.08)' : 'transparent',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            <span>{page.name}</span>
            {index > 0 && isHovered && (
              <button
                onClick={e => {
                  e.stopPropagation()
                  onDeletePage(page.id)
                }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 16, height: 16, borderRadius: 4,
                  background: 'transparent', border: 'none',
                  color: '#888', cursor: 'pointer', padding: 0,
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#E53E3E' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#888' }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        )
      })}
      <button
        onClick={onAddPage}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 28, height: 28, borderRadius: 6,
          background: 'transparent', border: '1px solid #333',
          color: '#888', cursor: 'pointer', marginLeft: 4,
          flexShrink: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#555'; e.currentTarget.style.color = '#ccc' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#888' }}
      >
        <Plus size={14} />
      </button>
    </div>
  )
}
