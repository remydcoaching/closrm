'use client'

import { useMemo, useState } from 'react'
import { MessageSquare, MessageCircle, UserPlus, ExternalLink, Eye, EyeOff, ChevronDown, Inbox as InboxIcon, CheckCircle2, Layers } from 'lucide-react'
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

type StatusFilter = 'todo' | 'linked' | 'all'
type SourceFilter = 'all' | 'dm' | 'comment'

const HOT: SocialIntent[] = ['rdv', 'prix', 'info', 'objection']

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
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export default function AcquisitionInbox({ items, loading, emptyLabel, previewLimit, showFilters, accentColor = '#a78bfa' }: Props) {
  const [status, setStatus] = useState<StatusFilter>('todo')
  const [source, setSource] = useState<SourceFilter>('all')
  const [showSpam, setShowSpam] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const enriched = useMemo(() => items.map(i => ({ ...i, intent: classifyIntent(i.text) })), [items])

  const counts = useMemo(() => {
    let todo = 0, linked = 0, spam = 0, dm = 0, comment = 0
    for (const it of enriched) {
      if (it.intent === 'spam') { spam += 1; continue }
      if (it.hasLead) linked += 1
      else todo += 1
      if (it.source === 'dm') dm += 1
      else comment += 1
    }
    return { todo, linked, all: enriched.length - spam, spam, dm, comment }
  }, [enriched])

  const filtered = useMemo(() => {
    let list = enriched
    if (!showSpam) list = list.filter(i => i.intent !== 'spam')
    if (status === 'todo')   list = list.filter(i => !i.hasLead)
    if (status === 'linked') list = list.filter(i =>  i.hasLead)
    if (source !== 'all') list = list.filter(i => i.source === source)

    return list.sort((a, b) => {
      // Hot intent first within same status
      const di = intentSortValue(b.intent) - intentSortValue(a.intent)
      if (di !== 0) return di
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0
      return tb - ta
    })
  }, [enriched, status, source, showSpam])

  const display = previewLimit != null ? filtered.slice(0, previewLimit) : filtered

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--bg-elevated)', borderRadius: 8, overflow: 'hidden' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ height: 44, background: 'var(--bg-secondary)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
    )
  }

  const STATUS_OPTIONS: { key: StatusFilter; label: string; icon: React.ElementType; count: number }[] = [
    { key: 'todo',   label: 'À traiter',     icon: InboxIcon,     count: counts.todo },
    { key: 'linked', label: 'Liés à un lead', icon: CheckCircle2, count: counts.linked },
    { key: 'all',    label: 'Tout',          icon: Layers,        count: counts.all },
  ]

  return (
    <div>
      {showFilters && (
        <div style={{
          display: 'flex', gap: 16, alignItems: 'center', marginBottom: 14,
          flexWrap: 'wrap',
        }}>
          {/* Status segmented control */}
          <div style={{
            display: 'flex', background: 'var(--bg-elevated)',
            border: '1px solid var(--border-primary)', borderRadius: 8, padding: 2,
          }}>
            {STATUS_OPTIONS.map(opt => {
              const active = status === opt.key
              const Icon = opt.icon
              return (
                <button
                  key={opt.key}
                  onClick={() => setStatus(opt.key)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', fontSize: 12, fontWeight: 600,
                    color: active ? '#fff' : 'var(--text-secondary)',
                    background: active ? accentColor : 'transparent',
                    border: 'none', borderRadius: 6, cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <Icon size={12} />
                  {opt.label}
                  <span style={{
                    fontSize: 10, fontWeight: 800,
                    padding: '1px 6px', borderRadius: 8,
                    background: active ? 'rgba(255,255,255,0.25)' : 'var(--bg-secondary)',
                    color: active ? '#fff' : 'var(--text-tertiary)',
                  }}>{opt.count}</span>
                </button>
              )
            })}
          </div>

          {/* Source filter (only show if both DMs and comments exist) */}
          {counts.dm > 0 && counts.comment > 0 && (
            <div style={{
              display: 'flex', background: 'var(--bg-elevated)',
              border: '1px solid var(--border-primary)', borderRadius: 8, padding: 2,
            }}>
              {(['all', 'dm', 'comment'] as SourceFilter[]).map(s => {
                const active = source === s
                const label = s === 'all' ? 'Tout' : s === 'dm' ? 'DMs' : 'Commentaires'
                return (
                  <button
                    key={s}
                    onClick={() => setSource(s)}
                    style={{
                      padding: '6px 11px', fontSize: 11, fontWeight: 600,
                      color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
                      background: active ? 'var(--bg-secondary)' : 'transparent',
                      border: 'none', borderRadius: 6, cursor: 'pointer',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          )}

          <div style={{ flex: 1 }} />

          {counts.spam > 0 && (
            <button
              onClick={() => setShowSpam(s => !s)}
              title="Bruit = emojis seuls, 'first', 🔥🔥, etc."
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '5px 10px', fontSize: 10, fontWeight: 600,
                color: 'var(--text-tertiary)', background: 'transparent',
                border: '1px solid var(--border-primary)', borderRadius: 14, cursor: 'pointer',
              }}
            >
              {showSpam ? <EyeOff size={10} /> : <Eye size={10} />}
              Bruit ({counts.spam})
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
          {status === 'todo'   ? 'Aucun message à traiter — tout est à jour 🎉' :
           status === 'linked' ? 'Aucun message rattaché à un lead pour l’instant.' :
           (emptyLabel ?? 'Aucun message.')}
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

                  <SourceIcon size={11} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />

                  <span style={{
                    fontSize: 12, fontWeight: 700, color: 'var(--text-primary)',
                    flexShrink: 0, maxWidth: 130, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item.username ?? 'Anonyme'}
                  </span>

                  {item.hasLead && (
                    <span title="Rattaché à un lead" style={{
                      fontSize: 9, fontWeight: 700, color: '#10b981',
                      background: 'rgba(16,185,129,0.12)', padding: '1px 6px',
                      borderRadius: 3, letterSpacing: 0.3, textTransform: 'uppercase', flexShrink: 0,
                    }}>Lead</span>
                  )}

                  <span style={{
                    fontSize: 12, color: 'var(--text-secondary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    flex: 1, minWidth: 0,
                  }}>
                    {item.text ?? <em style={{ color: 'var(--text-tertiary)' }}>(vide)</em>}
                  </span>

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
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <style>{`.inbox-row:hover { background: var(--bg-elevated) !important; }`}</style>
    </div>
  )
}
