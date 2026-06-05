'use client'

import { useEffect, useState } from 'react'
import {
  Activity,
  Eye,
  MousePointerClick,
  PlayCircle,
  Send,
  Calendar,
  Megaphone,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Loader2,
} from 'lucide-react'

interface AttributionTouch {
  source: string | null
  value: string | null
  at: string | null
  raw: Record<string, unknown> | null
}

interface JourneyEvent {
  id: string
  event_type: string
  metadata: Record<string, unknown>
  funnel_page_id: string | null
  funnel_page_name: string | null
  created_at: string
}

interface JourneyBooking {
  id: string
  scheduled_at: string
  status: string
  duration_minutes: number
  form_data: Record<string, unknown>
  calendar_id: string | null
  calendar_name: string | null
}

interface JourneyPayload {
  lead: {
    id: string
    visitor_id: string | null
    form_answers: Record<string, string>
    meta_campaign_id: string | null
    meta_ad_id: string | null
    source: string
    created_at: string
  }
  bookings: JourneyBooking[]
  events: JourneyEvent[]
  attribution: { first_touch: AttributionTouch; last_touch: AttributionTouch }
}

interface Props {
  leadId: string
}

const EVENT_LABEL: Record<string, string> = {
  view: 'A consulté',
  button_click: 'A cliqué',
  video_play: 'A regardé',
  form_submit: 'A rempli le formulaire',
}

function EventIcon({ type }: { type: string }) {
  const size = 14
  switch (type) {
    case 'view':
      return <Eye size={size} />
    case 'button_click':
      return <MousePointerClick size={size} />
    case 'video_play':
      return <PlayCircle size={size} />
    case 'form_submit':
      return <Send size={size} />
    default:
      return <Activity size={size} />
  }
}

function formatDateTimeFR(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function describeEvent(e: JourneyEvent): string {
  switch (e.event_type) {
    case 'view':
      return e.funnel_page_name ? `la page « ${e.funnel_page_name} »` : 'une page funnel'
    case 'button_click': {
      const text = e.metadata?.button_text
      return typeof text === 'string' && text ? `sur « ${text} »` : 'un bouton'
    }
    case 'video_play': {
      const m = e.metadata?.milestone
      return typeof m === 'number' ? `une vidéo jusqu'à ${m} %` : 'une vidéo'
    }
    case 'form_submit':
      return e.funnel_page_name ? `sur « ${e.funnel_page_name} »` : ''
    default:
      return ''
  }
}

function TouchPill({ touch, label }: { touch: AttributionTouch; label: string }) {
  if (!touch.value) {
    return (
      <div style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
        borderRadius: 8, padding: '10px 12px', flex: 1, minWidth: 0,
      }}>
        <p style={{
          fontSize: 9, fontWeight: 700, color: 'var(--text-label)',
          textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4,
        }}>{label}</p>
        <p style={{ fontSize: 12, color: 'var(--text-label)' }}>Non disponible</p>
      </div>
    )
  }
  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
      borderRadius: 8, padding: '10px 12px', flex: 1, minWidth: 0,
    }}>
      <p style={{
        fontSize: 9, fontWeight: 700, color: 'var(--text-label)',
        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4,
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <Megaphone size={10} /> {label}
      </p>
      <p style={{
        fontSize: 12, color: 'var(--text-primary)', fontWeight: 600,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }} title={`${touch.source}: ${touch.value}`}>
        {touch.source} = {touch.value.length > 28 ? `${touch.value.slice(0, 28)}…` : touch.value}
      </p>
      {touch.at && (
        <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
          {formatDateTimeFR(touch.at)}
        </p>
      )}
    </div>
  )
}

function AnswersList({
  title,
  answers,
  icon,
}: {
  title: string
  answers: Record<string, unknown>
  icon: React.ReactNode
}) {
  const entries = Object.entries(answers).filter(([, v]) => v !== null && v !== undefined && String(v).length > 0)
  if (entries.length === 0) return null
  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
      borderRadius: 10, padding: 14, marginBottom: 10,
    }}>
      <p style={{
        fontSize: 10, fontWeight: 700, color: 'var(--text-label)',
        textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {icon} {title}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {entries.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {k.replace(/_/g, ' ')}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
              {String(v)}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LeadJourneyBlock({ leadId }: Props) {
  const [data, setData] = useState<JourneyPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function fetchJourney() {
      setLoading(true)
      try {
        const res = await fetch(`/api/leads/${leadId}/journey`)
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled) setData(json.data)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchJourney()
    return () => { cancelled = true }
  }, [leadId])

  if (loading) {
    return (
      <div style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
        borderRadius: 14, padding: 20, display: 'flex', alignItems: 'center', gap: 10,
        color: 'var(--text-muted)', fontSize: 13,
      }}>
        <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
        Chargement du parcours…
      </div>
    )
  }

  if (!data) return null

  const hasJourneyContent =
    data.events.length > 0 ||
    data.bookings.length > 0 ||
    Object.keys(data.lead.form_answers ?? {}).length > 0 ||
    !!data.attribution.first_touch.value

  if (!hasJourneyContent) return null

  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
      borderRadius: 14, padding: 20,
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          marginBottom: open ? 16 : 0,
        }}
      >
        <span style={{
          fontSize: 11, fontWeight: 700, color: 'var(--text-label)',
          textTransform: 'uppercase', letterSpacing: '0.12em',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Sparkles size={12} /> Parcours du lead
          <span style={{
            fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
            background: 'var(--bg-surface)', borderRadius: 4, padding: '1px 6px',
            textTransform: 'none', letterSpacing: 0,
          }}>
            {data.events.length} évén. · {data.bookings.length} resa
          </span>
        </span>
        {open ? <ChevronDown size={14} color="var(--text-muted)" /> : <ChevronRight size={14} color="var(--text-muted)" />}
      </button>

      {open && (
        <>
          {/* Attribution */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <TouchPill touch={data.attribution.first_touch} label="Première pub" />
            <TouchPill touch={data.attribution.last_touch} label="Dernière pub" />
          </div>

          {/* Meta Lead Form answers */}
          <AnswersList
            title="Réponses Lead Form Meta"
            answers={data.lead.form_answers ?? {}}
            icon={<Megaphone size={11} />}
          />

          {/* Booking answers */}
          {data.bookings.map((b) => (
            <div key={b.id} style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
              borderRadius: 10, padding: 14, marginBottom: 10,
            }}>
              <p style={{
                fontSize: 10, fontWeight: 700, color: 'var(--text-label)',
                textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <Calendar size={11} />
                {b.calendar_name ?? 'Réservation'} — {formatDateTimeFR(b.scheduled_at)}
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  color: b.status === 'confirmed' ? 'var(--color-success, #38A169)' : 'var(--text-muted)',
                  textTransform: 'none', letterSpacing: 0,
                }}>
                  · {b.status}
                </span>
              </p>
              <AnswersList title="Réponses du calendrier" answers={b.form_data ?? {}} icon={<Calendar size={11} />} />
            </div>
          ))}

          {/* Timeline */}
          {data.events.length > 0 && (
            <div>
              <p style={{
                fontSize: 10, fontWeight: 700, color: 'var(--text-label)',
                textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10,
              }}>
                Activité chronologique
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.events.map((e) => (
                  <div key={e.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '8px 10px', borderRadius: 8,
                    background: 'var(--bg-surface)', border: '1px solid var(--border-primary)',
                  }}>
                    <div style={{
                      color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center',
                      paddingTop: 2,
                    }}>
                      <EventIcon type={e.event_type} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>
                        {EVENT_LABEL[e.event_type] ?? e.event_type} {describeEvent(e)}
                      </p>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                        {formatDateTimeFR(e.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
