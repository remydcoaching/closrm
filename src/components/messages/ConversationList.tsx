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
    <div className="flex gap-3 px-5 py-[14px]">
      <div className="w-11 h-11 rounded-full bg-[var(--bg-elevated)] animate-pulse shrink-0" />
      <div className="flex-1 py-0.5">
        <div className="h-3 w-24 bg-[var(--bg-elevated)] rounded animate-pulse mb-2" />
        <div className="h-2.5 w-40 bg-[var(--bg-elevated)] rounded animate-pulse" />
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
      <div className="flex flex-col items-center justify-center py-16 px-4 gap-2">
        <svg className="w-8 h-8 text-[var(--text-tertiary)] opacity-40" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
        </svg>
        <span className="text-[13px] text-[var(--text-tertiary)]">Aucune conversation</span>
      </div>
    )
  }

  return (
    <div>
      {conversations.map(c => {
        const active = selected?.id === c.id
        const unread = c.unread_count > 0

        return (
          <button
            key={c.id}
            onClick={() => onSelect(c)}
            className={`relative flex gap-3 px-5 py-[14px] w-full border-none cursor-pointer text-left transition-colors duration-150
              ${active ? 'bg-[var(--bg-active)]' : 'bg-transparent hover:bg-[var(--bg-secondary)]'}`}
          >
            {active && (
              <div className="absolute left-0 top-[10px] bottom-[10px] w-[3px] rounded-r" style={{ background: 'var(--color-primary)' }} />
            )}
            <div
              className="w-11 h-11 rounded-full shrink-0 flex items-center justify-center text-[15px] font-semibold overflow-hidden"
              style={{
                background: active ? 'var(--color-primary)' : 'var(--bg-elevated)',
                color: active ? '#fff' : 'var(--text-tertiary)',
              }}
            >
              {c.participant_avatar_url
                ? <img src={c.participant_avatar_url} alt="" className="w-full h-full object-cover" />
                : (c.participant_name?.[0] ?? c.participant_username?.[0] ?? '?')
              }
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex justify-between items-center mb-1">
                <span className={`text-[13px] text-[var(--text-primary)] overflow-hidden text-ellipsis whitespace-nowrap ${unread ? 'font-bold' : 'font-medium'}`}>
                  {c.participant_name ?? c.participant_username ?? 'Inconnu'}
                </span>
                <span className="text-[10px] text-[var(--text-tertiary)] shrink-0 ml-2">{timeAgo(c.last_message_at)}</span>
              </div>
              <div className={`text-[12px] overflow-hidden text-ellipsis whitespace-nowrap ${unread ? 'text-[var(--text-secondary)]' : 'text-[var(--text-tertiary)]'}`}>
                {c.last_message_text ?? ''}
              </div>
            </div>
            {unread && (
              <div className="w-2 h-2 rounded-full shrink-0 self-center" style={{ background: 'var(--color-primary)' }} />
            )}
          </button>
        )
      })}
    </div>
  )
}
