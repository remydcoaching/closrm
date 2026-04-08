# Messages Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Messages page with a 3-column CRM/Intercom layout and add real-time message polling from Meta API.

**Architecture:** 3-column layout (conversations list | thread | contact panel). Polling switches from Supabase-only to Meta API direct for active conversations. Contact panel shows pipeline context from lead data. Each column is a focused component.

**Tech Stack:** Next.js 14 App Router, React, Tailwind CSS, Supabase, Meta Graph API

**Spec:** `docs/superpowers/specs/2026-04-08-messages-redesign.md`

---

### Task 1: Redesign ConversationList component

**Files:**
- Modify: `src/components/messages/ConversationList.tsx`

- [ ] **Step 1: Rewrite ConversationList with premium design**

Replace the full content of `src/components/messages/ConversationList.tsx`:

```tsx
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
    <div className="flex gap-[11px] px-4 py-3">
      <div className="w-10 h-10 rounded-full bg-[#161616] animate-pulse shrink-0" />
      <div className="flex-1 min-w-0 space-y-2 py-1">
        <div className="flex justify-between">
          <div className="h-3.5 w-24 bg-[#161616] rounded animate-pulse" />
          <div className="h-3 w-8 bg-[#161616] rounded animate-pulse" />
        </div>
        <div className="h-3 w-40 bg-[#161616] rounded animate-pulse" />
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
      <div className="flex flex-col items-center justify-center py-16 px-4 gap-3">
        <svg className="w-10 h-10 text-[#444] opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c)}
            className={`flex gap-[11px] px-4 py-3 w-full border-none cursor-pointer text-left relative transition-colors duration-150
              ${isSelected
                ? 'bg-[#141414]'
                : 'bg-transparent hover:bg-[#131313]'
              }`}
          >
            {isSelected && (
              <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-gradient-to-b from-[#E53E3E] to-[#C53030]" />
            )}
            <div className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-sm font-bold overflow-hidden
              ${isSelected
                ? 'bg-gradient-to-br from-[#E53E3E] to-[#C53030]'
                : 'bg-gradient-to-br from-[#2a2a2a] to-[#1f1f1f] text-[#888]'
              }`}>
              {c.participant_avatar_url
                ? <img src={c.participant_avatar_url} alt="" className="w-full h-full object-cover" />
                : (c.participant_name?.[0] ?? c.participant_username?.[0] ?? '?')
              }
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-[3px]">
                <span className={`text-[13px] overflow-hidden text-ellipsis whitespace-nowrap ${hasUnread ? 'font-bold text-white' : 'font-semibold text-white'}`}>
                  {c.participant_name ?? c.participant_username ?? 'Inconnu'}
                </span>
                <span className="text-[10px] text-[#444] shrink-0 ml-2">{timeAgo(c.last_message_at)}</span>
              </div>
              <div className={`text-[11px] overflow-hidden text-ellipsis whitespace-nowrap ${hasUnread ? 'text-[#888] font-medium' : 'text-[#555]'}`}>
                {c.last_message_text ?? ''}
              </div>
            </div>
            {hasUnread && (
              <div className="min-w-[18px] h-[18px] px-[5px] rounded-full shrink-0 bg-[#E53E3E] flex items-center justify-center text-[9px] font-bold text-white self-center">
                {c.unread_count}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/messages/ConversationList.tsx
git commit -m "feat: redesign ConversationList — premium dark theme with active indicator"
```

---

### Task 2: Redesign ConversationThread component

**Files:**
- Modify: `src/components/messages/ConversationThread.tsx`

- [ ] **Step 1: Rewrite ConversationThread with premium bubbles**

Replace the full content of `src/components/messages/ConversationThread.tsx`:

```tsx
'use client'

import { useEffect, useRef } from 'react'
import type { IgMessage } from '@/types'

interface Props { messages: (IgMessage & { _optimistic?: boolean })[] }

function isSameDay(d1: string, d2: string): boolean {
  const a = new Date(d1)
  const b = new Date(d2)
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function isToday(dateStr: string): boolean {
  return isSameDay(dateStr, new Date().toISOString())
}

function isYesterday(dateStr: string): boolean {
  const d = new Date(dateStr)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return d.getFullYear() === yesterday.getFullYear() && d.getMonth() === yesterday.getMonth() && d.getDate() === yesterday.getDate()
}

function formatDateSeparator(dateStr: string): string {
  if (isToday(dateStr)) return "Aujourd'hui"
  if (isYesterday(dateStr)) return 'Hier'
  return new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function formatTimestamp(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function renderMedia(msg: IgMessage) {
  if (!msg.media_url) return null
  const type = msg.media_type?.toLowerCase()
  if (type === 'video') {
    return <div className="mb-1 max-w-[220px]"><video src={msg.media_url} controls className="w-full rounded-2xl" /></div>
  }
  if (type === 'audio') {
    return <div className="mb-1 max-w-[260px]"><audio src={msg.media_url} controls className="w-full h-10" /></div>
  }
  return (
    <div className="mb-1 max-w-[220px]">
      <img src={msg.media_url} alt="" className={`w-full rounded-2xl ${type === 'sticker' ? 'max-w-[120px]' : ''}`} />
    </div>
  )
}

export default function ConversationThread({ messages }: Props) {
  const endRef = useRef<HTMLDivElement>(null)
  const prevLengthRef = useRef(messages.length)

  useEffect(() => {
    if (messages.length > prevLengthRef.current || prevLengthRef.current === 0) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevLengthRef.current = messages.length
  }, [messages.length])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [messages.length === 0 ? 0 : messages[0]?.id])

  if (messages.length === 0) return (
    <div className="flex-1 flex items-center justify-center text-[#444] text-[13px]">
      Aucun message
    </div>
  )

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-1">
      {messages.map((msg, idx) => {
        const isUser = msg.sender_type === 'user'
        const isOptimistic = msg._optimistic
        const prevMsg = idx > 0 ? messages[idx - 1] : null
        const showDateSeparator = !prevMsg || !isSameDay(prevMsg.sent_at, msg.sent_at)

        return (
          <div key={msg.id}>
            {showDateSeparator && (
              <div className="flex items-center justify-center my-3">
                <div className="px-[14px] py-1 rounded-full bg-[#151515] border border-[#1f1f1f] text-[10px] text-[#555] font-medium">
                  {formatDateSeparator(msg.sent_at)}
                </div>
              </div>
            )}
            <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
              {renderMedia(msg)}
              {msg.text && (
                <div
                  className={`px-4 py-[10px] max-w-[300px] text-[13px] leading-[1.45] break-words
                    ${isUser
                      ? 'bg-gradient-to-br from-[#E53E3E] to-[#C53030] text-white rounded-[18px_18px_6px_18px]'
                      : 'bg-[#151515] border border-[#1f1f1f] text-[#ddd] rounded-[18px_18px_18px_6px]'
                    }
                    ${isOptimistic ? 'opacity-60' : ''}
                  `}
                  style={{ overflowWrap: 'anywhere' }}
                >
                  {msg.text}
                </div>
              )}
              <div className={`text-[9px] text-[#444] mt-[3px] px-[6px] flex items-center gap-1 ${isOptimistic ? 'italic' : ''}`}>
                {isOptimistic ? 'Envoi...' : formatTimestamp(msg.sent_at)}
              </div>
            </div>
          </div>
        )
      })}
      <div ref={endRef} />
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/messages/ConversationThread.tsx
git commit -m "feat: redesign ConversationThread — gradient bubbles, premium separators"
```

---

### Task 3: Redesign MessageInput component

**Files:**
- Modify: `src/components/messages/MessageInput.tsx`

- [ ] **Step 1: Rewrite MessageInput with premium design**

Replace the full content of `src/components/messages/MessageInput.tsx`:

```tsx
'use client'

import { useState, useRef } from 'react'
import { Send } from 'lucide-react'

interface Props {
  onSend: (text: string) => void
  disabled?: boolean
}

export default function MessageInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const isBusy = sending || disabled

  const handleSend = async () => {
    const trimmed = text.trim()
    if (!trimmed || isBusy) return
    setSending(true)
    try {
      await onSend(trimmed)
      setText('')
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const hasText = text.trim().length > 0

  return (
    <div className="px-5 py-3 border-t border-[#1a1a1a] flex gap-[10px] items-end bg-[#0d0d0d]">
      <textarea
        ref={inputRef}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Écrire un message..."
        rows={1}
        className="flex-1 px-4 py-[11px] text-[12px] bg-[#141414] text-[#ccc] border border-[#222] rounded-[14px] outline-none resize-none leading-[1.4] max-h-[120px] overflow-auto focus:border-[#333] transition-colors placeholder:text-[#555] font-[inherit]"
      />
      <button
        onClick={handleSend}
        disabled={!hasText || isBusy}
        className={`w-[38px] h-[38px] rounded-full border-none flex items-center justify-center shrink-0 transition-all duration-150
          ${hasText && !isBusy
            ? 'bg-gradient-to-br from-[#E53E3E] to-[#C53030] cursor-pointer hover:opacity-90 active:scale-95'
            : 'bg-[#1a1a1a] cursor-default'
          }
          ${isBusy ? 'opacity-60' : ''}
        `}
      >
        <Send size={15} className={hasText ? 'text-white' : 'text-[#444]'} />
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/messages/MessageInput.tsx
git commit -m "feat: redesign MessageInput — premium dark theme styling"
```

---

### Task 4: Create ContactPanel component

**Files:**
- Create: `src/components/messages/ContactPanel.tsx`

- [ ] **Step 1: Create ContactPanel**

Create `src/components/messages/ContactPanel.tsx`:

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import type { IgConversation, Lead, Call } from '@/types'

interface Props {
  conversation: IgConversation
}

interface ContactData {
  lead: Lead | null
  nextCall: Call | null
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  nouveau: { bg: 'rgba(59,130,246,0.1)', text: '#3B82F6', label: 'Nouveau' },
  setting_planifie: { bg: 'rgba(214,158,46,0.1)', text: '#D69E2E', label: 'Setting planifié' },
  no_show_setting: { bg: 'rgba(229,62,62,0.1)', text: '#E53E3E', label: 'No-show Setting' },
  closing_planifie: { bg: 'rgba(214,158,46,0.1)', text: '#D69E2E', label: 'Closing planifié' },
  no_show_closing: { bg: 'rgba(229,62,62,0.1)', text: '#E53E3E', label: 'No-show Closing' },
  clos: { bg: 'rgba(56,161,105,0.1)', text: '#38A169', label: 'Closé' },
  dead: { bg: 'rgba(229,62,62,0.1)', text: '#E53E3E', label: 'Dead' },
}

export default function ContactPanel({ conversation }: Props) {
  const [data, setData] = useState<ContactData>({ lead: null, nextCall: null })
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  const fetchLeadData = useCallback(async () => {
    if (!conversation.lead_id) return
    try {
      const res = await fetch(`/api/leads/${conversation.lead_id}`)
      if (!res.ok) return
      const json = await res.json()
      const lead = json.data as Lead
      setData(prev => ({ ...prev, lead }))
      setNotes(lead.notes ?? '')

      // Fetch next upcoming call
      const callsRes = await fetch(`/api/calls?lead_id=${lead.id}&outcome=pending&limit=1`)
      if (callsRes.ok) {
        const callsJson = await callsRes.json()
        setData(prev => ({ ...prev, nextCall: callsJson.data?.[0] ?? null }))
      }
    } catch { /* silent */ }
  }, [conversation.lead_id])

  useEffect(() => {
    fetchLeadData()
  }, [fetchLeadData])

  const saveNotes = async () => {
    if (!data.lead) return
    setSavingNotes(true)
    try {
      await fetch(`/api/leads/${data.lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
    } finally {
      setSavingNotes(false)
    }
  }

  const name = conversation.participant_name ?? conversation.participant_username ?? 'Inconnu'
  const initial = name[0] ?? '?'
  const status = data.lead ? STATUS_COLORS[data.lead.status] : null

  return (
    <div className="w-[280px] border-l border-[#1a1a1a] flex flex-col bg-[#0d0d0d] overflow-y-auto">
      {/* Header */}
      <div className="py-6 px-5 text-center border-b border-[#151515]">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#E53E3E] to-[#C53030] flex items-center justify-center text-[22px] font-bold mx-auto mb-[10px] shadow-[0_4px_16px_rgba(229,62,62,0.25)] overflow-hidden">
          {conversation.participant_avatar_url
            ? <img src={conversation.participant_avatar_url} alt="" className="w-full h-full object-cover" />
            : initial
          }
        </div>
        <div className="text-[15px] font-bold">{name}</div>
        {conversation.participant_username && (
          <div className="text-[11px] text-[#555] mt-0.5">@{conversation.participant_username}</div>
        )}
      </div>

      {/* Pipeline status */}
      {status && (
        <div className="px-5 py-[14px] border-b border-[#131313]">
          <div className="text-[9px] text-[#444] uppercase tracking-[0.8px] font-semibold mb-2">Statut pipeline</div>
          <div
            className="inline-flex items-center gap-[5px] px-3 py-1 rounded-full text-[11px] font-semibold border"
            style={{ background: status.bg, color: status.text, borderColor: `${status.text}20` }}
          >
            <span>●</span> {status.label}
          </div>
        </div>
      )}

      {/* Tags */}
      {data.lead && data.lead.tags.length > 0 && (
        <div className="px-5 py-[14px] border-b border-[#131313]">
          <div className="text-[9px] text-[#444] uppercase tracking-[0.8px] font-semibold mb-2">Tags</div>
          <div className="flex gap-[5px] flex-wrap">
            {data.lead.tags.map(tag => (
              <span key={tag} className="px-[10px] py-[3px] bg-[#161616] border border-[#1f1f1f] rounded-full text-[10px] text-[#888] font-medium">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Next RDV */}
      <div className="px-5 py-[14px] border-b border-[#131313]">
        <div className="text-[9px] text-[#444] uppercase tracking-[0.8px] font-semibold mb-2">Prochain RDV</div>
        {data.nextCall ? (
          <div className="bg-[#141414] border border-[#1f1f1f] rounded-[10px] p-[10px_12px] flex items-center gap-[10px]">
            <span className="text-base">📅</span>
            <div>
              <div className="text-[12px] text-[#ccc]">{data.nextCall.type === 'setting' ? 'Setting call' : 'Closing call'}</div>
              <div className="text-[10px] text-[#555] mt-0.5">
                {new Date(data.nextCall.scheduled_at).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                {' · '}
                {new Date(data.nextCall.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-[12px] text-[#444]">Aucun planifié</div>
        )}
      </div>

      {/* Actions */}
      <div className="px-5 py-[14px] border-b border-[#131313]">
        <div className="text-[9px] text-[#444] uppercase tracking-[0.8px] font-semibold mb-2">Actions</div>
        <div className="flex flex-col gap-[6px]">
          {conversation.lead_id && (
            <a
              href={`/leads/${conversation.lead_id}`}
              className="flex items-center gap-2 px-3 py-2 bg-[#131313] border border-[#1a1a1a] rounded-[10px] text-[11px] text-[#aaa] hover:bg-[#1a1a1a] hover:border-[#262626] hover:text-[#ccc] transition-all no-underline"
            >
              <span className="text-sm">📋</span> Fiche complète
            </a>
          )}
          {!conversation.lead_id && (
            <div className="text-[11px] text-[#444] italic">Aucun lead associé</div>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="px-5 py-[14px] flex-1">
        <div className="text-[9px] text-[#444] uppercase tracking-[0.8px] font-semibold mb-2">Notes</div>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onBlur={saveNotes}
          placeholder="Ajouter une note sur ce contact..."
          className="w-full bg-[#111] border border-[#1a1a1a] rounded-[10px] p-[10px_12px] text-[11px] text-[#999] min-h-[70px] font-[inherit] resize-none outline-none focus:border-[#333] transition-colors placeholder:text-[#444]"
        />
        {savingNotes && (
          <div className="text-[9px] text-[#555] mt-1">Sauvegarde...</div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/messages/ContactPanel.tsx
git commit -m "feat: create ContactPanel — pipeline status, tags, next RDV, notes"
```

---

### Task 5: Add Meta API polling endpoint for messages

**Files:**
- Modify: `src/app/api/instagram/messages/route.ts`

- [ ] **Step 1: Add `refresh` parameter to messages route**

The current route fetches from Supabase and lazy-loads from Meta if empty. Add a `refresh=true` parameter that always fetches latest messages from Meta API, upserts them, and returns fresh data. This is used by the 5s polling.

In `src/app/api/instagram/messages/route.ts`, add after the existing lazy-load block (line 85, before `return NextResponse.json({ data: data ?? [] })`):

```tsx
    // If refresh requested, fetch latest from Meta API and merge
    const shouldRefresh = request.nextUrl.searchParams.get('refresh') === 'true'
    if (shouldRefresh && data && data.length > 0) {
      try {
        const { data: account } = await supabase
          .from('ig_accounts')
          .select('ig_user_id, page_access_token')
          .eq('workspace_id', workspaceId)
          .eq('is_connected', true)
          .maybeSingle()

        if (account?.page_access_token && convo.ig_conversation_id) {
          const rawMessages = await fetchConversationMessages(
            account.page_access_token,
            convo.ig_conversation_id,
            20
          )

          if (rawMessages.length > 0) {
            const toUpsert = rawMessages.map(msg => ({
              workspace_id: workspaceId,
              conversation_id: conversationId,
              ig_message_id: msg.id,
              sender_type: msg.from.id === account.ig_user_id ? 'user' as const : 'participant' as const,
              text: msg.message ?? null,
              media_url: msg.attachments?.data?.[0]?.image_data?.url
                ?? msg.attachments?.data?.[0]?.video_data?.url
                ?? null,
              media_type: msg.attachments?.data?.[0]?.mime_type?.startsWith('video') ? 'video' as const
                : msg.attachments?.data?.[0]?.mime_type?.startsWith('image') ? 'image' as const
                : msg.attachments?.data?.[0]?.mime_type?.startsWith('audio') ? 'audio' as const
                : null,
              sent_at: msg.created_time,
              is_read: true,
            }))

            await supabase.from('ig_messages').upsert(toUpsert, { onConflict: 'ig_message_id' })

            const { data: refreshedData } = await supabase
              .from('ig_messages')
              .select('*')
              .eq('conversation_id', conversationId)
              .eq('workspace_id', workspaceId)
              .order('sent_at', { ascending: true })
              .limit(100)

            return NextResponse.json({ data: refreshedData ?? [] })
          }
        }
      } catch (refreshErr) {
        console.error('[API /instagram/messages] Refresh failed:', refreshErr)
      }
    }
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/instagram/messages/route.ts
git commit -m "feat: add refresh param to messages API — polls Meta API for new messages"
```

---

### Task 6: Rewrite page.tsx with 3-column layout + Meta polling

**Files:**
- Modify: `src/app/(dashboard)/acquisition/messages/page.tsx`

- [ ] **Step 1: Rewrite page with 3-column layout and Meta API polling**

Replace the full content of `src/app/(dashboard)/acquisition/messages/page.tsx`:

```tsx
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { RefreshCw } from 'lucide-react'
import ConversationList from '@/components/messages/ConversationList'
import ConversationThread from '@/components/messages/ConversationThread'
import MessageInput from '@/components/messages/MessageInput'
import ContactPanel from '@/components/messages/ContactPanel'
import IgNotConnected from '@/components/social/instagram/IgNotConnected'
import type { IgConversation, IgMessage } from '@/types'

export default function MessagesPage() {
  const [conversations, setConversations] = useState<IgConversation[]>([])
  const [selected, setSelected] = useState<IgConversation | null>(null)
  const [messages, setMessages] = useState<(IgMessage & { _optimistic?: boolean })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasAccount, setHasAccount] = useState(true)
  const [syncWarning, setSyncWarning] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sending, setSending] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialSyncDone = useRef(false)

  const handleSearchChange = (value: string) => {
    setSearch(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(value), 300)
  }

  useEffect(() => {
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [])

  const fetchConversations = useCallback(async (withSync = false) => {
    setLoading(true)
    setError(null)
    try {
      const accRes = await fetch('/api/instagram/account')
      const accJson = await accRes.json()
      if (!accJson.data) { setHasAccount(false); setLoading(false); return }

      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (withSync) params.set('sync', 'true')
      const res = await fetch(`/api/instagram/conversations?${params}`)
      if (!res.ok) throw new Error('Erreur lors du chargement des conversations')
      const json = await res.json()
      setConversations(json.data ?? [])
      setSyncWarning(json.syncWarning ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch])

  useEffect(() => {
    if (!initialSyncDone.current) {
      initialSyncDone.current = true
      fetchConversations(true)
    } else {
      fetchConversations(false)
    }
  }, [fetchConversations])

  const handleSync = async () => {
    setSyncing(true)
    await fetchConversations(true)
    setSyncing(false)
  }

  const fetchMessages = useCallback(async (convo: IgConversation) => {
    setSelected(convo)
    try {
      const res = await fetch(`/api/instagram/messages?conversation_id=${convo.id}`)
      const json = await res.json()
      setMessages(json.data ?? [])
    } catch {
      setMessages([])
    }
  }, [])

  const handleSend = async (text: string) => {
    if (!selected || sending) return
    setSending(true)

    const optimisticId = `optimistic-${Date.now()}`
    const optimisticMsg = {
      id: optimisticId, workspace_id: '', conversation_id: selected.id,
      sender_type: 'user' as const, text, sent_at: new Date().toISOString(),
      media_url: null, media_type: null, ig_message_id: null, is_read: true, _optimistic: true,
    }
    setMessages(prev => [...prev, optimisticMsg])

    try {
      const res = await fetch('/api/instagram/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: selected.id, text }),
      })
      if (res.ok) {
        const json = await res.json()
        setMessages(prev => prev.map(m => m.id === optimisticId ? json.data : m))
        setConversations(prev => prev.map(c =>
          c.id === selected.id ? { ...c, last_message_text: text, last_message_at: new Date().toISOString() } : c
        ))
      } else {
        setMessages(prev => prev.filter(m => m.id !== optimisticId))
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimisticId))
    } finally {
      setSending(false)
    }
  }

  // Poll messages from Meta API every 5s for active conversation
  useEffect(() => {
    if (!selected) return
    const interval = setInterval(() => {
      fetch(`/api/instagram/messages?conversation_id=${selected.id}&refresh=true`)
        .then(res => res.json())
        .then(json => { if (json.data) setMessages(json.data) })
        .catch(() => {})
    }, 5000)
    return () => clearInterval(interval)
  }, [selected?.id])

  // Poll conversation list every 30s
  useEffect(() => {
    if (!hasAccount) return
    const interval = setInterval(() => fetchConversations(false), 30000)
    return () => clearInterval(interval)
  }, [hasAccount, fetchConversations])

  if (!hasAccount) {
    return (
      <div className="px-10 py-8 max-w-[1400px]">
        <h1 className="text-[22px] font-bold text-white mb-1.5">Messages</h1>
        <p className="text-[13px] text-[#555] mb-6">Conversations Instagram</p>
        <IgNotConnected />
      </div>
    )
  }

  return (
    <div className="px-10 py-8 max-w-[1400px]">
      <div className="flex items-center justify-between mb-1.5">
        <h1 className="text-[22px] font-bold text-white">Messages</h1>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-3 py-1.5 text-[12px] font-medium text-[#888] bg-[#161616] border border-[#222] rounded-[10px] hover:bg-[#1a1a1a] hover:border-[#333] hover:text-[#aaa] transition-all disabled:opacity-50"
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Synchronisation...' : 'Synchroniser'}
        </button>
      </div>
      <p className="text-[13px] text-[#555] mb-4">Conversations Instagram</p>

      {syncWarning && (
        <div className="mb-4 px-4 py-3 rounded-[10px] bg-[#D69E2E]/10 border border-[#D69E2E]/20 text-[13px] text-[#D69E2E] flex items-start gap-2">
          <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <div><span className="font-medium">Sync : </span>{syncWarning}</div>
        </div>
      )}

      <div className="flex h-[calc(100vh-200px)] bg-[#0A0A0A] border border-[#1f1f1f] rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        {/* Col 1: Conversations */}
        <div className="w-[300px] border-r border-[#1a1a1a] flex flex-col bg-[#0d0d0d]">
          <div className="p-3">
            <input
              placeholder="🔍  Rechercher..."
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              className="w-full px-3 py-2 text-[12px] bg-[#161616] text-white border border-[#222] rounded-[10px] outline-none focus:border-[#333] transition-colors placeholder:text-[#555]"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {error ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 gap-3">
                <p className="text-[13px] text-[#444] text-center">{error}</p>
                <button onClick={() => fetchConversations(true)} className="px-4 py-1.5 text-[12px] font-medium bg-gradient-to-br from-[#E53E3E] to-[#C53030] text-white rounded-lg hover:opacity-90 transition-opacity">
                  Réessayer
                </button>
              </div>
            ) : (
              <ConversationList conversations={conversations} selected={selected} onSelect={fetchMessages} loading={loading} />
            )}
          </div>
        </div>

        {/* Col 2: Thread */}
        <div className="flex-1 flex flex-col">
          {selected ? (
            <>
              <div className="px-5 py-3 border-b border-[#1a1a1a] flex items-center gap-3">
                <div className="w-[34px] h-[34px] rounded-full bg-gradient-to-br from-[#E53E3E] to-[#C53030] flex items-center justify-center text-[13px] font-bold overflow-hidden shrink-0">
                  {selected.participant_avatar_url
                    ? <img src={selected.participant_avatar_url} alt="" className="w-full h-full object-cover" />
                    : (selected.participant_name?.[0] ?? selected.participant_username?.[0] ?? '?')
                  }
                </div>
                <div>
                  <div className="text-[14px] font-semibold text-white">{selected.participant_name ?? selected.participant_username}</div>
                  {selected.participant_username && <div className="text-[10px] text-[#555]">@{selected.participant_username}</div>}
                </div>
                {selected.lead_id && (
                  <a href={`/leads/${selected.lead_id}`} className="ml-auto px-3 py-[5px] bg-transparent border border-[#262626] rounded-lg text-[11px] text-[#E53E3E] hover:bg-[#E53E3E10] hover:border-[#E53E3E40] transition-all no-underline">
                    Voir le lead →
                  </a>
                )}
              </div>
              <ConversationThread messages={messages} />
              <MessageInput onSend={handleSend} disabled={sending} />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#444]">
              <svg className="w-12 h-12 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
              </svg>
              <p className="text-[13px]">Sélectionnez une conversation</p>
            </div>
          )}
        </div>

        {/* Col 3: Contact panel */}
        {selected && <ContactPanel conversation={selected} />}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/acquisition/messages/page.tsx"
git commit -m "feat: rewrite Messages page — 3-column layout, Meta API polling, contact panel"
```

---

### Task 7: Final verification and deploy

- [ ] **Step 1: Full TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Test locally**

Run: `npm run dev`
Open `http://localhost:3000/acquisition/messages`
Verify:
- 3-column layout renders
- Conversations load on sync
- Messages load when clicking a conversation
- Contact panel shows on the right
- Gradient bubbles render correctly
- Send a test message — optimistic update works

- [ ] **Step 3: Push and deploy**

```bash
git push origin feature/pierre-booking-location-types
```
Create PR to develop, merge, then PR develop to main, merge for production.
