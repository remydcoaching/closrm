'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
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
    meta_adset_id: string | null
    meta_ad_id: string | null
    source: string
    created_at: string
  }
  bookings: JourneyBooking[]
  events: JourneyEvent[]
  attribution: { first_touch: AttributionTouch; last_touch: AttributionTouch }
}

interface ResolvedObject {
  id: string
  name: string
  type: 'campaign' | 'adset' | 'ad'
  status: string
  campaign_id?: string
  adset_id?: string
}

type AttributionMap = Record<string, ResolvedObject | null>

interface Props {
  leadId: string
  /** Mode densifié pour les contextes étroits (side panel). Cache la timeline. */
  compact?: boolean
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

/**
 * Bloc attribution riche : reconstruit le path Campagne / Adset / Pub à
 * partir d'un seul touch.value (souvent un ad_id). Si le touch ne pointe
 * pas vers un objet Meta connu (fbclid, utm…), on tombe sur un fallback
 * monoligne avec la valeur brute.
 */
function AttributionPath({
  touch,
  label,
  attributionMap,
  loading,
}: {
  touch: AttributionTouch
  label: string
  attributionMap: AttributionMap
  loading: boolean
}) {
  const linkBase = '/acquisition/publicites'

  if (!touch.value) {
    return (
      <div style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
        borderRadius: 10, padding: '10px 12px', flex: 1, minWidth: 0,
      }}>
        <p style={{
          fontSize: 9, fontWeight: 700, color: 'var(--text-label)',
          textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <Megaphone size={10} /> {label}
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-label)' }}>Non disponible</p>
      </div>
    )
  }

  const resolved = attributionMap[touch.value]

  // Reconstruit la hiérarchie depuis l'objet résolu
  const items: { kind: string; name: string; id: string; href: string }[] = []
  if (resolved) {
    if (resolved.type === 'ad') {
      if (resolved.campaign_id) {
        const camp = attributionMap[resolved.campaign_id]
        if (camp) items.push({ kind: 'Campagne', name: camp.name, id: camp.id, href: `${linkBase}?level=campaigns` })
      }
      if (resolved.adset_id) {
        const adset = attributionMap[resolved.adset_id]
        if (adset) items.push({ kind: 'Adset', name: adset.name, id: adset.id, href: `${linkBase}?level=adsets` })
      }
      items.push({ kind: 'Pub', name: resolved.name, id: resolved.id, href: `/leads?meta_ad_id=${resolved.id}` })
    } else if (resolved.type === 'adset') {
      if (resolved.campaign_id) {
        const camp = attributionMap[resolved.campaign_id]
        if (camp) items.push({ kind: 'Campagne', name: camp.name, id: camp.id, href: `${linkBase}?level=campaigns` })
      }
      items.push({ kind: 'Adset', name: resolved.name, id: resolved.id, href: `${linkBase}?level=adsets` })
    } else {
      items.push({ kind: 'Campagne', name: resolved.name, id: resolved.id, href: `${linkBase}?level=campaigns` })
    }
  }

  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
      borderRadius: 10, padding: '10px 12px', flex: 1, minWidth: 0,
    }}>
      <p style={{
        fontSize: 9, fontWeight: 700, color: 'var(--text-label)',
        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8,
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <Megaphone size={10} /> {label}
        {touch.at && (
          <span style={{ marginLeft: 'auto', fontWeight: 500, color: 'var(--text-muted)', letterSpacing: 0, textTransform: 'none' }}>
            {formatDateTimeFR(touch.at)}
          </span>
        )}
      </p>
      {items.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.map((item) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize: 9, fontWeight: 700, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.1em', minWidth: 52,
              }}>
                {item.kind}
              </span>
              <Link
                href={item.href}
                title={item.id}
                style={{
                  fontSize: 12, color: 'var(--text-primary)', fontWeight: 500,
                  textDecoration: 'none', flex: 1, minWidth: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
              >
                {item.name}
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <p style={{
          fontSize: 12, color: 'var(--text-primary)', fontWeight: 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }} title={`${touch.source}: ${touch.value}`}>
          {loading ? '…' : `${touch.source ?? ''} = ${touch.value.length > 28 ? `${touch.value.slice(0, 28)}…` : touch.value}`}
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

export default function LeadJourneyBlock({ leadId, compact = false }: Props) {
  const [data, setData] = useState<JourneyPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(true)
  const [attributionMap, setAttributionMap] = useState<AttributionMap>({})
  const [resolvingAttribution, setResolvingAttribution] = useState(false)

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

  // Résolution attribution : 2 passes (touches + meta_* puis remontée parents)
  useEffect(() => {
    if (!data) return
    const initialIds = new Set<string>()
    const t1 = data.attribution.first_touch.value
    const t2 = data.attribution.last_touch.value
    if (t1) initialIds.add(t1)
    if (t2) initialIds.add(t2)
    if (data.lead.meta_campaign_id) initialIds.add(data.lead.meta_campaign_id)
    if (data.lead.meta_adset_id) initialIds.add(data.lead.meta_adset_id)
    if (data.lead.meta_ad_id) initialIds.add(data.lead.meta_ad_id)
    if (initialIds.size === 0) return

    let cancelled = false
    setResolvingAttribution(true)
    ;(async () => {
      try {
        const res = await fetch(`/api/meta/ad-attribution?ids=${[...initialIds].join(',')}`)
        if (!res.ok) return
        const json = await res.json()
        if (cancelled) return
        const firstMap: AttributionMap = json.data ?? {}

        // Collect parent IDs not yet resolved
        const parentIds = new Set<string>()
        for (const obj of Object.values(firstMap)) {
          if (obj?.campaign_id && !firstMap[obj.campaign_id]) parentIds.add(obj.campaign_id)
          if (obj?.adset_id && !firstMap[obj.adset_id]) parentIds.add(obj.adset_id)
        }

        if (parentIds.size === 0) {
          setAttributionMap(firstMap)
          return
        }

        const res2 = await fetch(`/api/meta/ad-attribution?ids=${[...parentIds].join(',')}`)
        if (!res2.ok) {
          setAttributionMap(firstMap)
          return
        }
        const json2 = await res2.json()
        if (cancelled) return
        setAttributionMap({ ...firstMap, ...(json2.data ?? {}) })
      } finally {
        if (!cancelled) setResolvingAttribution(false)
      }
    })()

    return () => { cancelled = true }
  }, [data])

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
      borderRadius: 14, padding: compact ? 14 : 20,
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
          {/* Attribution — Première pub + Dernière pub avec path complet */}
          <div style={{
            display: 'flex', gap: 8, marginBottom: 16,
            flexDirection: compact ? 'column' : 'row',
          }}>
            <AttributionPath
              touch={data.attribution.first_touch}
              label="Première pub"
              attributionMap={attributionMap}
              loading={resolvingAttribution}
            />
            <AttributionPath
              touch={data.attribution.last_touch}
              label="Dernière pub"
              attributionMap={attributionMap}
              loading={resolvingAttribution}
            />
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

          {/* Timeline — masquée en mode compact (side panel) */}
          {!compact && data.events.length > 0 && (
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
