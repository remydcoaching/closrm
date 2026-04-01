'use client'

import { useEffect } from 'react'

interface Props {
  funnelPageId: string
}

/**
 * Client component that handles funnel page tracking:
 * - Sends a "view" event on mount
 * - Attaches click listeners on [data-cta] elements
 * - Listens for YouTube iframe postMessage for video progress
 */
export default function FunnelTracker({ funnelPageId }: Props) {
  useEffect(() => {
    const API = '/api/public/f/events'

    // ─── Visitor ID ───────────────────────────────────────────────────────
    function getVisitorId(): string {
      const match = document.cookie.match(/(^|;)\s*_closrm_vid=([^;]+)/)
      if (match) return match[2]
      const id = crypto.randomUUID
        ? crypto.randomUUID()
        : `v-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
      document.cookie = `_closrm_vid=${id};path=/;max-age=31536000;SameSite=Lax`
      return id
    }

    const visitorId = getVisitorId()

    function sendEvent(eventType: string, metadata?: Record<string, unknown>) {
      const payload = JSON.stringify({
        funnel_page_id: funnelPageId,
        event_type: eventType,
        visitor_id: visitorId,
        metadata: metadata ?? {},
      })
      try {
        navigator.sendBeacon(API, payload)
      } catch {
        fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => {})
      }
    }

    // ─── Page view ──────────────────────────────────────────────────────
    sendEvent('view')

    // ─── CTA click tracking ─────────────────────────────────────────────
    function handleClick(e: MouseEvent) {
      const el = (e.target as HTMLElement).closest('[data-cta]') as HTMLElement | null
      if (!el) return
      sendEvent('button_click', {
        button_text: (el.textContent ?? '').trim().slice(0, 100),
        target_url: (el as HTMLAnchorElement).href ?? el.dataset.cta ?? '',
      })
    }
    document.addEventListener('click', handleClick)

    // ─── YouTube video tracking ─────────────────────────────────────────
    const ytMilestones: Record<string, Record<number, boolean>> = {}

    function handleMessage(e: MessageEvent) {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        if (!data?.event) return

        if (
          data.event === 'infoDelivery' &&
          data.info &&
          typeof data.info.currentTime === 'number' &&
          typeof data.info.duration === 'number'
        ) {
          const pct = Math.floor((data.info.currentTime / data.info.duration) * 100)
          const key = data.id || 'unknown'
          if (!ytMilestones[key]) ytMilestones[key] = {}

          for (const m of [25, 50, 75, 100]) {
            if (pct >= m && !ytMilestones[key][m]) {
              ytMilestones[key][m] = true
              sendEvent('video_play', { milestone: m, iframe_id: key })
            }
          }
        }
      } catch {
        // Ignore non-YouTube messages
      }
    }
    window.addEventListener('message', handleMessage)

    // Cleanup
    return () => {
      document.removeEventListener('click', handleClick)
      window.removeEventListener('message', handleMessage)
    }
  }, [funnelPageId])

  return null
}
