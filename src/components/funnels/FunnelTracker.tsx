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

    // ─── Page view + ad/UTM attribution capture ─────────────────────────
    // On every view we surface URL params (fbclid, gclid, utm_*) and the
    // referrer. The first event in a visitor's history that has any of these
    // is the first-touch ad; the last one before form_submit is the last-touch.
    function captureAttribution(): Record<string, string> {
      const out: Record<string, string> = {}
      try {
        const params = new URL(window.location.href).searchParams
        const keys = [
          'fbclid', 'gclid', 'ttclid', 'msclkid',
          'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
          'ad_id', 'adset_id', 'campaign_id',
        ]
        for (const k of keys) {
          const v = params.get(k)
          if (v) out[k] = v.slice(0, 200)
        }
        if (document.referrer) {
          out.referrer = document.referrer.slice(0, 300)
        }
        out.landing_path = window.location.pathname + window.location.search
      } catch {
        /* ignore — never block tracking */
      }
      return out
    }
    sendEvent('view', captureAttribution())

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
