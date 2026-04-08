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
    <div className="flex gap-2.5 px-4 py-3 border-b border-[#1a1a1a]">
      <div className="w-9 h-9 rounded-full bg-[#161616] animate-pulse shrink-0" />
      <div className="flex-1 min-w-0 space-y-2 py-1">
        <div className="flex justify-between">
          <div className="h-3 w-24 bg-[#161616] rounded animate-pulse" />
          <div className="h-2.5 w-7 bg-[#161616] rounded animate-pulse" />
        </div>
        <div className="h-2.5 w-36 bg-[#161616] rounded animate-pulse" />
      </div>
    </div>
  )
}

export default function ConversationList({ conversations, selected, onSelect, loading }: Props) {
  if (loading) {
    return (
      <div>
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonItem key={i} />
        ))}
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 gap-3 opacity-50">
        <svg className="w-10 h-10 text-[#444]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
        </svg>
        <p className="text-[13px] text-[#444]">Aucune conversation</p>
      </div>
    )
  }

  return (
    <div>
      {conversations.map(c => {
        const isSelected = selected?.id === c.id
        const hasUnread = c.unread_count > 0
        const initials = c.participant_name?.[0] ?? c.participant_username?.[0] ?? '?'

        return (
          <button
            key={c.id}
            onClick={() => onSelect(c)}
            className={`relative flex gap-2.5 px-4 py-3 w-full border-none cursor-pointer text-left border-b border-b-[#1a1a1a] transition-colors duration-150 ${
              isSelected ? 'bg-[#141414]' : 'bg-transparent hover:bg-[#131313]'
            }`}
          >
            {/* Active left bar */}
            {isSelected && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 rounded-r-full bg-gradient-to-b from-[#E53E3E] to-[#C53030]" />
            )}

            {/* Avatar */}
            <div
              className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-[13px] font-semibold overflow-hidden ${
                isSelected
                  ? 'bg-gradient-to-br from-[#E53E3E] to-[#C53030] text-white'
                  : 'bg-gradient-to-br from-[#2a2a2a] to-[#1f1f1f] text-[#888]'
              }`}
            >
              {c.participant_avatar_url ? (
                <img src={c.participant_avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-0.5">
                <span
                  className={`text-[13px] text-white overflow-hidden text-ellipsis whitespace-nowrap ${
                    hasUnread ? 'font-bold' : 'font-medium'
                  }`}
                >
                  {c.participant_name ?? c.participant_username ?? 'Inconnu'}
                </span>
                <span className="text-[10px] text-[#444] shrink-0 ml-2">
                  {timeAgo(c.last_message_at)}
                </span>
              </div>
              <div
                className={`text-[11px] overflow-hidden text-ellipsis whitespace-nowrap ${
                  hasUnread ? 'text-[#888]' : 'text-[#555]'
                }`}
              >
                {c.last_message_text ?? ''}
              </div>
            </div>

            {/* Unread badge */}
            {hasUnread && (
              <div className="min-w-[18px] h-[18px] rounded-full shrink-0 bg-[#E53E3E] flex items-center justify-center text-[10px] font-bold text-white self-center px-1">
                {c.unread_count}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
