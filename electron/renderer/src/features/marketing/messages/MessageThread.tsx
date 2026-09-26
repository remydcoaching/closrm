// Chat thread with day separators and grouped timestamps — same rendering
// rules as the web ConversationThread (used for Instagram and Email).
import { useEffect, useRef } from 'react'

export interface ThreadItem {
  id: string
  mine: boolean
  text: string | null
  sentAt: string
  pending?: boolean
  mediaUrl?: string | null
  mediaType?: string | null
  /** Extra meta shown next to the time (email delivery status). */
  status?: string | null
}

function sameDay(a: string, b: string): boolean {
  const x = new Date(a)
  const y = new Date(b)
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate()
}

function daySeparator(iso: string): string {
  const now = new Date()
  if (sameDay(iso, now.toISOString())) return "Aujourd'hui"
  const y = new Date()
  y.setDate(y.getDate() - 1)
  if (sameDay(iso, y.toISOString())) return 'Hier'
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

export function MessageThread({ items }: { items: ThreadItem[] }) {
  const endRef = useRef<HTMLDivElement>(null)
  const prevLen = useRef(0)

  useEffect(() => {
    if (items.length !== prevLen.current) endRef.current?.scrollIntoView({ behavior: prevLen.current === 0 ? 'auto' : 'smooth' })
    prevLen.current = items.length
  }, [items.length])

  if (items.length === 0) return <div className="mk-thread-empty">Aucun message</div>

  return (
    <div className="mk-thread-messages">
      {items.map((m, i) => {
        const prev = i > 0 ? items[i - 1] : null
        const next = i < items.length - 1 ? items[i + 1] : null
        const showSep = !prev || !sameDay(prev.sentAt, m.sentAt)
        const lastInGroup = !next || next.mine !== m.mine || !sameDay(next.sentAt, m.sentAt)
        return (
          <div key={m.id}>
            {showSep && (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <span className="mk-date-sep">{daySeparator(m.sentAt)}</span>
              </div>
            )}
            <div className={`mk-msg-row ${m.mine ? 'mk-msg-row--me' : ''}`}>
              <div className="mk-msg-col">
                {m.mediaUrl &&
                  (m.mediaType === 'video' ? (
                    <video className="mk-msg-media" src={m.mediaUrl} controls />
                  ) : m.mediaType === 'audio' ? (
                    <audio src={m.mediaUrl} controls />
                  ) : (
                    <img className="mk-msg-media" src={m.mediaUrl} alt="" referrerPolicy="no-referrer" />
                  ))}
                {m.text && <div className={`mk-bubble ${m.pending ? 'mk-bubble--pending' : ''}`}>{m.text}</div>}
                {lastInGroup && (
                  <span className="mk-msg-meta">
                    {m.status && <span>{m.status}</span>}
                    <span>{m.pending ? 'Envoi…' : new Date(m.sentAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })}
      <div ref={endRef} />
    </div>
  )
}
