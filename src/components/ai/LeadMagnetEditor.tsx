'use client'

import { useState } from 'react'
import { Plus, X, Link, FileText } from 'lucide-react'

interface LeadMagnet {
  title: string
  url: string
}

interface Props {
  value: string
  onChange: (value: string) => void
}

function parse(raw: string): LeadMagnet[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
  } catch { /* not JSON, parse as lines */ }
  return raw.split('\n').filter(Boolean).map(line => {
    const match = line.match(/^(.+?)\s*[|—-]\s*(https?:\/\/.+)$/)
    if (match) return { title: match[1].trim(), url: match[2].trim() }
    if (line.startsWith('http')) return { title: '', url: line.trim() }
    return { title: line.trim(), url: '' }
  })
}

function serialize(items: LeadMagnet[]): string {
  return JSON.stringify(items)
}

const inputS: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 12px',
  background: 'var(--bg-input)', border: '1px solid var(--border-primary)',
  borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none',
}

export default function LeadMagnetEditor({ value, onChange }: Props) {
  const [items, setItems] = useState<LeadMagnet[]>(() => {
    const parsed = parse(value)
    return parsed.length > 0 ? parsed : []
  })

  function update(newItems: LeadMagnet[]) {
    setItems(newItems)
    onChange(serialize(newItems))
  }

  function addItem() {
    update([...items, { title: '', url: '' }])
  }

  function removeItem(index: number) {
    update(items.filter((_, i) => i !== index))
  }

  function updateItem(index: number, field: 'title' | 'url', val: string) {
    update(items.map((item, i) => i === index ? { ...item, [field]: val } : item))
  }

  return (
    <div>
      {items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {items.map((item, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center',
              padding: '10px 12px', borderRadius: 10,
              background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
            }}>
              <div style={{ position: 'relative' }}>
                <FileText size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  value={item.title}
                  onChange={e => updateItem(i, 'title', e.target.value)}
                  placeholder="Titre du contenu"
                  style={{ ...inputS, paddingLeft: 32 }}
                />
              </div>
              <div style={{ position: 'relative' }}>
                <Link size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  value={item.url}
                  onChange={e => updateItem(i, 'url', e.target.value)}
                  placeholder="https://..."
                  style={{ ...inputS, paddingLeft: 32 }}
                />
              </div>
              <button onClick={() => removeItem(i)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 4, opacity: 0.5,
                transition: 'opacity 0.15s',
              }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {items.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
          Aucun contenu ajoute. Ajoutez vos videos, PDFs, masterclasses...
        </p>
      )}

      <button type="button" onClick={addItem} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        width: '100%', padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 500,
        border: '1px dashed var(--border-primary)', background: 'transparent',
        color: 'var(--text-tertiary)', cursor: 'pointer',
        transition: 'all 0.15s',
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#a855f7'; e.currentTarget.style.color = '#a855f7' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-primary)'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
      >
        <Plus size={14} />
        Ajouter un contenu
      </button>
    </div>
  )
}
