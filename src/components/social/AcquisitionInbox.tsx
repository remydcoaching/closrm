'use client'

import { useMemo, useState } from 'react'
import { MessageSquare, MessageCircle, UserPlus, ExternalLink, Eye, EyeOff, ChevronDown, Flame, Filter } from 'lucide-react'
import { classifyIntent, INTENT_META, intentSortValue, type SocialIntent } from '@/lib/social/intent-classifier'

export interface InboxItem {
  id: string
  source: 'dm' | 'comment'
  username: string | null
  avatarUrl?: string | null
  text: string | null
  timestamp: string | null
  context?: string | null
  hasLead?: boolean
  externalUrl?: string | null
  onCreateLead?: () => void
  onOpen?: () => void
}

interface Props {
  items: InboxItem[]
  loading?: boolean
  emptyLabel?: string
  previewLimit?: number
  showFilters?: boolean
  accentColor?: string
}

type ViewFilter = 'hot' | 'all' | SocialIntent

const FILTER_OPTIONS: ({ key: ViewFilter; label: string; icon?: React.ElementType; color?: string })[] = [
  { key: 'hot',       label: 'Chaud',     icon: Flame,  color: '#f59e0b' },
  { key: 'all',       label: 'Tout' },
  { key: 'rdv',       label: 'RDV',       color: INTENT_META.rdv.color },
  { key: 'prix',      label: 'Prix',      color: INTENT_META.prix.color },
  { key: 'info',      label: 'Info',      color: INTENT_META.info.color },
  { key: 'objection', label: 'Objections', color: INTENT_META.objection.color },
  { key: 'fan',       label: 'Fans',      color: INTENT_META.fan.color },
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
  if (days < 7) return `${days}j`
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

const HOT: SocialIntent[] = ['rdv', 'prix', 'info', 'objection']

export default function AcquisitionInbox({ items, loading, emptyLabel, previewLimit, showFilters, accentColor = '#a78bfa' }: Props) {
  const [filter, setFilter] = useState<ViewFilter>('hot')
  const [showSpam, setShowSpam] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const enriched = useMemo(() => items.map(i => ({ ...i, intent: classifyIntent(i.text) })), [items])

  const counts = useMemo(() => {
    const c: Record<ViewFilter, number> = {
      hot: 0, all: 0, rdv: 0, prix: 0, info: 0, objection: 0, fan: 0, neutre: 0, spam: 0,
    }
    for (const it of enriched) {
      c.all += 1
      c[it.intent] += 1
      if (HOT.includes(it.intent)) c.hot += 1
    }
    return c
  }, [enriched])

  const filtered = useMemo(() => {
    let list = enriched
    if (!showSpam) list = list.filter(i => i.intent !== 'spam')
    if (filter === 'hot') list = list.filter(i => HOT.includes(i.intent))
    else if (filter !== 'all') list = list.filter(i => i.intent === filter)

    return list.sort((a, b) => {
      const di = intentSortValue(b.intent) - intentSortValue(a.intent)
      if (di !== 0) return di
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0
      return tb - ta
    })
  }, [enriched, filter, showSpam])

  const display = previewLimit != null ? filtered.slice(0, previewLimit) : filtered

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--bg-elevated)', borderRadius: 8, overflow: 'hidden' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{
            height: 44, background: 'var(--bg-secondary)',
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
        ))}
      </div>
    )
  }

  return (
    <div>
      {showFilters && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          {FILTER_OPTIONS.map(opt => {
            const active = filter === opt.key
            const Icon = opt.icon
            const count = counts[opt.key]
            const isHot = opt.key === 'hot'
            return (
              <button
                key={opt.key}
                onClick={() => setFilter(opt.key)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '5px 11px', fontSize: 11, fontWeight: 700,
                  color: active ? '#fff' : 'var(--text-secondary)',
                  background: active ? (opt.color ?? accentColor) : 'var(--bg-elevated)',
                  border: `1px solid ${active ? (opt.color ?? accentColor) : 'var(--border-primary)'}`,
                  borderRadius: 14, cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {Icon && <Icon size={11} />}
                {opt.label}
                {isHot && count > 0 && !active && (
                  <span style={{
                    fontSize: 9, fontWeight: 800, padding: '1px 5px',
                    background: opt.color, color: '#fff', borderRadius: 8,
                  }}>{count}</span>
                )}
                {!isHot && active && count > 0 && (
                  <span style={{ fontSize: 9, fontWeight: 700, opacity: 0.85 }}>{count}</span>
                )}
              </button>
            )
          })}
          <div style={{ flex: 1 }} />
          {counts.spam > 0 && (
            <button
              onClick={() => setShowSpam(s => !s)}
              title={showSpam ? 'Masquer le bruit' : 'Afficher le bruit (emojis, "first"…)'}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '5px 9px', fontSize: 10, fontWeight: 600,
                color: 'var(--text-tertiary)', background: 'transparent',
                border: '1px solid var(--border-primary)', borderRadius: 14, cursor: 'pointer',
              }}
            >
              {showSpam ? <EyeOff size={10} /> : <Eye size={10} />}
              {showSpam ? 'Masquer' : 'Afficher'} bruit ({counts.spam})
            </button>
          )}
        </div>
      )}

      {display.length === 0 ? (
        <div style={{
          padding: 32, textAlign: 'center',
          background: 'var(--bg-secondary)', border: '1px dashed var(--border-primary)',
          borderRadius: 10, fontSize: 12, color: 'var(--text-tertiary)',
        }}>
          {filter === 'hot' && counts.all > 0
            ? 'Aucun signal d\'achat pour l\'instant. Tu peux passer en "Tout" pour voir tous les messages.'
            : (emptyLabel ?? 'Aucun message à traiter.')}
        </div>
      ) : (
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-primary)',
          borderRadius: 10, overflow: 'hidden',
        }}>
          {display.map((item, idx) => {
            const isExpanded = expanded === item.id
            const intentMeta = INTENT_META[item.intent]
            const isHot = HOT.includes(item.intent)
            const SourceIcon = item.source === 'dm' ? MessageSquare : MessageCircle
            return (
              <div
                key={item.id}
                style={{
                  borderTop: idx === 0 ? 'none' : '1px solid var(--border-primary)',
                  borderLeft: isHot ? `3px solid ${intentMeta.color}` : '3px solid transparent',
                  background: isExpanded ? 'var(--bg-elevated)' : 'transparent',
                  transition: 'background 0.1s',
                }}
              >
                {/* Compact row */}
                <button
                  onClick={() => setExpanded(isExpanded ? null : item.id)}
                  className="inbox-row"
                  style={{
                    width: '100%', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 14px',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'var(--text-primary)',
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    background: item.avatarUrl ? `url(${item.avatarUrl})` : 'var(--bg-elevated)',
                    backgroundSize: 'cover', backgroundPosition: 'center',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)',
                    border: '1px solid var(--border-primary)',
                  }}>
                    {!item.avatarUrl && (item.username?.[0]?.toUpperCase() ?? '?')}
                  </div>

                  {/* Source icon */}
                  <SourceIcon size={11} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />

                  {/* Username */}
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: 'var(--text-primary)',
                    flexShrink: 0, maxWidth: 130, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item.username ?? 'Anonyme'}
                  </span>

                  {/* Intent dot or badge — only for hot intents */}
                  {isHot && (
                    <span style={{
                      fontSize: 9, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase',
                      padding: '2px 6px', borderRadius: 3,
                      color: intentMeta.color, background: `${intentMeta.color}1a`,
                      border: `1px solid ${intentMeta.color}40`, flexShrink: 0,
                    }}>
                      {intentMeta.label}
                    </span>
                  )}

                  {/* Lead badge */}
                  {item.hasLead && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: '#10b981',
                      background: 'rgba(16,185,129,0.12)', padding: '1px 6px',
                      borderRadius: 3, letterSpacing: 0.3, textTransform: 'uppercase', flexShrink: 0,
                    }}>Lead</span>
                  )}

                  {/* Text preview */}
                  <span style={{
                    fontSize: 12, color: 'var(--text-secondary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    flex: 1, minWidth: 0,
                  }}>
                    {item.text ?? <em style={{ color: 'var(--text-tertiary)' }}>(vide)</em>}
                  </span>

                  {/* Timestamp */}
                  <span style={{
                    fontSize: 10, color: 'var(--text-tertiary)',
                    flexShrink: 0, marginLeft: 'auto', minWidth: 36, textAlign: 'right',
                  }}>
                    {timeAgo(item.timestamp)}
                  </span>

                  <ChevronDown size={12} color="var(--text-tertiary)" style={{
                    flexShrink: 0,
                    transform: isExpanded ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.15s',
                  }} />
                </button>

                {/* Expanded panel */}
                {isExpanded && (
                  <div style={{ padding: '4px 14px 14px 30px' }}>
                    <p style={{
                      fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5,
                      margin: '0 0 8px', wordBreak: 'break-word',
                    }}>
                      {item.text}
                    </p>
                    {item.context && (
                      <div style={{
                        fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 10,
                        padding: '6px 10px', background: 'var(--bg-secondary)',
                        borderLeft: '2px solid var(--border-primary)', borderRadius: 4,
                      }}>
                        ↳ {item.context}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {item.onOpen && (
                        <button
                          onClick={(e) => { e.stopPropagation(); item.onOpen?.() }}
                          style={{
                            padding: '5px 10px', fontSize: 11, fontWeight: 600,
                            color: 'var(--text-secondary)', background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-primary)', borderRadius: 6,
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                          }}
                        >Ouvrir</button>
                      )}
                      {item.onCreateLead && !item.hasLead && (
                        <button
                          onClick={(e) => { e.stopPropagation(); item.onCreateLead?.() }}
                          style={{
                            padding: '5px 10px', fontSize: 11, fontWeight: 700,
                            color: '#fff', background: accentColor,
                            border: 'none', borderRadius: 6, cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          <UserPlus size={11} /> Créer un lead
                        </button>
                      )}
                      {item.externalUrl && (
                        <a
                          href={item.externalUrl} target="_blank" rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            padding: '5px 10px', fontSize: 11, fontWeight: 600,
                            color: 'var(--text-tertiary)', background: 'transparent',
                            border: '1px solid var(--border-primary)', borderRadius: 6,
                            textDecoration: 'none',
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          <ExternalLink size={11} /> Voir
                        </a>
                      )}
                      {!isHot && (
                        <span style={{
                          marginLeft: 'auto', fontSize: 10, color: 'var(--text-tertiary)',
                          fontStyle: 'italic',
                        }}>
                          Pas de signal d&apos;achat détecté
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <style>{`
        .inbox-row:hover { background: var(--bg-elevated) !important; }
      `}</style>
    </div>
  )
}
