'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Video, Music2, Camera, Mic, BookOpen, FileText, ExternalLink, Check, Link as LinkIcon } from 'lucide-react'
import type { LeadMagnet, LeadMagnetPlatform } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  onPick: (magnet: LeadMagnet) => void
  selectedId?: string
}

const PLATFORM_META: Record<LeadMagnetPlatform, { label: string; icon: typeof Video; color: string }> = {
  youtube:   { label: 'YouTube',   icon: Video,   color: '#FF0000' },
  tiktok:    { label: 'TikTok',    icon: Music2,    color: '#69C9D0' },
  instagram: { label: 'Instagram', icon: Camera,    color: '#EC4899' },
  podcast:   { label: 'Podcast',   icon: Mic,       color: '#8B5CF6' },
  blog:      { label: 'Blog',      icon: BookOpen,  color: '#5b9bf5' },
  pdf:       { label: 'PDF',       icon: FileText,  color: '#D69E2E' },
  other:     { label: 'Autre',     icon: LinkIcon,  color: '#9CA3AF' },
}

export default function LeadMagnetPicker({ open, onClose, onPick, selectedId }: Props) {
  const [magnets, setMagnets] = useState<LeadMagnet[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch('/api/lead-magnets')
      .then((r) => r.json())
      .then((json) => setMagnets(json.lead_magnets ?? []))
      .finally(() => setLoading(false))
  }, [open])

  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 640, maxWidth: 'calc(100vw - 40px)',
          maxHeight: 'calc(100vh - 80px)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-primary)',
          borderRadius: 14,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border-primary)',
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              Choisir un lead magnet
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Le lien sera personnalisé par lead pour tracker les clics
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', color: 'var(--text-secondary)',
              cursor: 'pointer', padding: 6, borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          ><X size={16} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40, color: 'var(--text-muted)' }}>
              <Loader2 size={18} />
            </div>
          )}
          {!loading && magnets.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, fontSize: 13, color: 'var(--text-muted)' }}>
              <div style={{ marginBottom: 12 }}>Aucun lead magnet pour l&apos;instant.</div>
              <a
                href="/acquisition/lead-magnets"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 12, color: '#5b9bf5', textDecoration: 'none',
                }}
              >
                Aller à la bibliothèque <ExternalLink size={12} />
              </a>
            </div>
          )}
          {!loading && magnets.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {magnets.map((m) => (
                <MagnetRow
                  key={m.id}
                  magnet={m}
                  selected={m.id === selectedId}
                  onClick={() => onPick(m)}
                />
              ))}
            </div>
          )}
        </div>

        <div style={{
          padding: '12px 20px', borderTop: '1px solid var(--border-primary)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <a
            href="/acquisition/lead-magnets"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none',
            }}
          >
            Gérer la bibliothèque <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </div>
  )
}

function MagnetRow({ magnet, selected, onClick }: {
  magnet: LeadMagnet
  selected: boolean
  onClick: () => void
}) {
  const meta = PLATFORM_META[magnet.platform] ?? PLATFORM_META.other
  const Icon = meta.icon
  const [h, setH] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 14px', borderRadius: 8,
        background: selected ? `${meta.color}1F` : (h ? 'var(--bg-hover)' : 'var(--bg-surface)'),
        border: `1px solid ${selected ? meta.color : (h ? 'var(--border-primary)' : 'transparent')}`,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.12s',
        width: '100%',
      }}
    >
      <div style={{
        width: 34, height: 34, borderRadius: 7,
        background: `${meta.color}26`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={16} style={{ color: meta.color }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          {magnet.title}
        </div>
        <div style={{
          fontSize: 11, color: 'var(--text-muted)', marginTop: 2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          <span style={{ color: meta.color, fontWeight: 600 }}>{meta.label}</span> · {magnet.url}
        </div>
      </div>
      {selected && <Check size={16} style={{ color: meta.color, flexShrink: 0 }} />}
    </button>
  )
}
