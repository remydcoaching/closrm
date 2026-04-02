'use client'

import type { IgConversation } from '@/types'

interface Props {
  conversations: IgConversation[]
  selected: IgConversation | null
  onSelect: (c: IgConversation) => void
  loading: boolean
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}j`
}

export default function ConversationList({ conversations, selected, onSelect, loading }: Props) {
  if (loading) return <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>Chargement...</div>
  if (conversations.length === 0) return <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>Aucune conversation</div>

  return (
    <div>
      {conversations.map(c => {
        const isSelected = selected?.id === c.id
        return (
          <button key={c.id} onClick={() => onSelect(c)} style={{
            display: 'flex', gap: 10, padding: '12px 16px', width: '100%',
            background: isSelected ? 'var(--bg-active)' : 'transparent',
            border: 'none', cursor: 'pointer', textAlign: 'left',
            borderBottom: '1px solid var(--border-primary)',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              background: 'var(--bg-elevated)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden',
            }}>
              {c.participant_avatar_url
                ? <img src={c.participant_avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (c.participant_name?.[0] ?? c.participant_username?.[0] ?? '?')
              }
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: c.unread_count > 0 ? 700 : 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.participant_name ?? c.participant_username ?? 'Inconnu'}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>{timeAgo(c.last_message_at)}</span>
              </div>
              <div style={{ fontSize: 12, color: c.unread_count > 0 ? 'var(--text-secondary)' : 'var(--text-tertiary)', fontWeight: c.unread_count > 0 ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.last_message_text ?? ''}
              </div>
            </div>
            {c.unread_count > 0 && (
              <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', alignSelf: 'center' }}>
                {c.unread_count}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
