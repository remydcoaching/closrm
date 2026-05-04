'use client'

import { useMemo, useState } from 'react'
import { MessageSquare, MessageCircle, UserPlus, ExternalLink } from 'lucide-react'
import IntentBadge from './IntentBadge'
import { classifyIntent, INTENT_META, intentSortValue, type SocialIntent } from '@/lib/social/intent-classifier'

export interface InboxItem {
  id: string
  source: 'dm' | 'comment'
  username: string | null
  avatarUrl?: string | null
  text: string | null
  timestamp: string | null
  context?: string | null            // post caption, video title, etc.
  hasLead?: boolean                  // already linked to a lead
  externalUrl?: string | null
  onCreateLead?: () => void
  onOpen?: () => void
}

interface Props {
  items: InboxItem[]
  loading?: boolean
  emptyLabel?: string
  // Show only top N when collapsed — if undefined, no limit
  previewLimit?: number
  // When true, render the intent filter row
  showFilters?: boolean
  accentColor?: string
}

const FILTER_OPTIONS: ({ key: 'all' | SocialIntent; label: string; color?: string })[] = [
  { key: 'all',       label: 'Tout' },
  { key: 'rdv',       label: '🔥 RDV',       color: INTENT_META.rdv.color },
  { key: 'prix',      label: 'Prix',         color: INTENT_META.prix.color },
  { key: 'info',      label: 'Info',         color: INTENT_META.info.color },
  { key: 'objection', label: 'Objections',   color: INTENT_META.objection.color },
  { key: 'fan',       label: 'Fans',         color: INTENT_META.fan.color },
]

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  if (diff < 0) return ''
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}j`
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function truncate(s: string | null | undefined, n: number): string {
  if (!s) return ''
  return s.length > n ? s.slice(0, n) + '…' : s
}

export default function AcquisitionInbox({ items, loading, emptyLabel, previewLimit, showFilters, accentColor = '#a78bfa' }: Props) {
  const [filter, setFilter] = useState<'all' | SocialIntent>('all')

  const enriched = useMemo(() => {
    return items.map(item => ({
      ...item,
      intent: classifyIntent(item.text),
    }))
  }, [items])

  const filtered = useMemo(() => {
    const list = filter === 'all'
      ? enriched.filter(i => i.intent !== 'spam')
      : enriched.filter(i => i.intent === filter)

    return list.sort((a, b) => {
      const di = intentSortValue(b.intent) - intentSortValue(a.intent)
      if (di !== 0) return di
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0
      return tb - ta
    })
  }, [enriched, filter])

  const display = previewLimit != null ? filtered.slice(0, previewLimit) : filtered

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            height: 64, background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
            borderRadius: 10, animation: 'pulse 1.5s ease-in-out infinite',
          }} />
        ))}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {showFilters && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTER_OPTIONS.map(opt => {
            const active = filter === opt.key
            return (
              <button
                key={opt.key}
                onClick={() => setFilter(opt.key)}
                style={{
                  padding: '5px 11px', fontSize: 11, fontWeight: 600,
                  color: active ? '#fff' : 'var(--text-secondary)',
                  background: active ? (opt.color ?? accentColor) : 'var(--bg-elevated)',
                  border: `1px solid ${active ? (opt.color ?? accentColor) : 'var(--border-primary)'}`,
                  borderRadius: 14, cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      )}

      {display.length === 0 ? (
        <div style={{
          padding: 32, textAlign: 'center',
          background: 'var(--bg-secondary)', border: '1px dashed var(--border-primary)',
          borderRadius: 10, fontSize: 12, color: 'var(--text-tertiary)',
        }}>
          {emptyLabel ?? 'Aucun message à traiter pour cette intention.'}
        </div>
      ) : display.map(item => {
        const SourceIcon = item.source === 'dm' ? MessageSquare : MessageCircle
        return (
          <div
            key={item.id}
            style={{
              display: 'flex', gap: 12, padding: 12,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-primary)',
              borderLeft: `3px solid ${INTENT_META[item.intent].color}`,
              borderRadius: 10,
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: 'var(--bg-elevated)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)',
              backgroundImage: item.avatarUrl ? `url(${item.avatarUrl})` : undefined,
              backgroundSize: 'cover', backgroundPosition: 'center',
            }}>
              {!item.avatarUrl && (item.username?.[0]?.toUpperCase() ?? '?')}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <SourceIcon size={11} color="var(--text-tertiary)" />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                  {item.username ?? 'Anonyme'}
                </span>
                <IntentBadge intent={item.intent} size="xs" />
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{timeAgo(item.timestamp)}</span>
                {item.hasLead && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, color: '#10b981',
                    background: 'rgba(16,185,129,0.12)', padding: '2px 6px',
                    borderRadius: 3, letterSpacing: 0.3, textTransform: 'uppercase',
                  }}>Lead</span>
                )}
              </div>

              <p style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5, margin: 0, wordBreak: 'break-word' }}>
                {truncate(item.text, 200) || <em style={{ color: 'var(--text-tertiary)' }}>(message vide)</em>}
              </p>

              {item.context && (
                <div style={{
                  marginTop: 6, fontSize: 10, color: 'var(--text-tertiary)',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <span style={{ opacity: 0.5 }}>↳</span>
                  <span>sur {truncate(item.context, 80)}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {item.onOpen && (
                  <button
                    onClick={item.onOpen}
                    style={{
                      padding: '5px 10px', fontSize: 11, fontWeight: 600,
                      color: 'var(--text-secondary)',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: 6, cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    Ouvrir
                  </button>
                )}
                {item.onCreateLead && !item.hasLead && (
                  <button
                    onClick={item.onCreateLead}
                    style={{
                      padding: '5px 10px', fontSize: 11, fontWeight: 700,
                      color: '#fff',
                      background: accentColor,
                      border: 'none', borderRadius: 6, cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <UserPlus size={11} /> Créer un lead
                  </button>
                )}
                {item.externalUrl && (
                  <a
                    href={item.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '5px 10px', fontSize: 11, fontWeight: 600,
                      color: 'var(--text-tertiary)',
                      background: 'transparent',
                      border: '1px solid var(--border-primary)',
                      borderRadius: 6, textDecoration: 'none',
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <ExternalLink size={11} /> Voir
                  </a>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
