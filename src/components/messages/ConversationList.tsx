'use client'

import type { IgConversation } from '@/types'

interface Props {
  conversations: IgConversation[]
  selected: IgConversation | null
  onSelect: (c: IgConversation) => void
  loading: boolean
}

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''
  const diff = Date.now() - date.getTime()
  if (diff < 0) return ''
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}j`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}sem`
  const months = Math.floor(days / 30)
  return `${months}mo`
}

function SkeletonItem() {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '14px 20px' }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--bg-elevated)', flexShrink: 0 }} className="animate-pulse" />
      <div style={{ flex: 1, paddingTop: 4 }}>
        <div style={{ height: 12, width: 100, background: 'var(--bg-elevated)', borderRadius: 6, marginBottom: 8 }} className="animate-pulse" />
        <div style={{ height: 10, width: 150, background: 'var(--bg-elevated)', borderRadius: 6 }} className="animate-pulse" />
      </div>
    </div>
  )
}

export default function ConversationList({ conversations, selected, onSelect, loading }: Props) {
  if (loading) {
    return <div>{Array.from({ length: 7 }).map((_, i) => <SkeletonItem key={i} />)}</div>
  }

  if (conversations.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: 8 }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth={1.5} style={{ opacity: 0.4 }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
        </svg>
        <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Aucune conversation</span>
      </div>
    )
  }

  return (
    <div>
      {conversations.map(c => {
        const active = selected?.id === c.id
        const unread = c.unread_count > 0
        const initial = (c.participant_name?.[0] ?? c.participant_username?.[0] ?? '?').toUpperCase()

        return (
          <div
            key={c.id}
            onClick={() => onSelect(c)}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter') onSelect(c) }}
            style={{
              display: 'flex',
              gap: 12,
              padding: '14px 20px',
              cursor: 'pointer',
              position: 'relative',
              background: active ? 'var(--bg-active)' : 'transparent',
              transition: 'background 0.15s',
              outline: 'none',
              border: 'none',
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-secondary)' }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
          >
            {active && (
              <div style={{ position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderRadius: '0 4px 4px 0', background: 'var(--color-primary)' }} />
            )}

            {/* Avatar */}
            <div style={{
              width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 600, overflow: 'hidden',
              background: c.participant_avatar_url ? 'transparent' : (active ? 'var(--color-primary)' : 'var(--bg-elevated)'),
              color: active ? '#fff' : 'var(--text-tertiary)',
            }}>
              {c.participant_avatar_url
                ? <img src={c.participant_avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initial
              }
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{
                  fontSize: 14, color: 'var(--text-primary)',
                  fontWeight: unread ? 700 : 500,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {c.participant_name ?? c.participant_username ?? 'Inconnu'}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0, marginLeft: 8 }}>
                  {timeAgo(c.last_message_at)}
                </span>
              </div>
              <div style={{
                fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                color: unread ? 'var(--text-secondary)' : 'var(--text-tertiary)',
              }}>
                {c.last_message_text ?? ''}
              </div>
            </div>

            {unread && (
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0, alignSelf: 'center' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
