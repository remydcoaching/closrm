import React, { useEffect, useState } from 'react'
import { View, Text, ActivityIndicator, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { api } from '../../services/api'
import { colors } from '../../theme/colors'
import { type as t, spacing } from '../../theme/tokens'

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

interface JourneyLead {
  id: string
  visitor_id: string | null
  form_answers: Record<string, string>
  meta_campaign_id: string | null
  meta_adset_id: string | null
  meta_ad_id: string | null
  source: string
  created_at: string
}

interface JourneyPayload {
  lead: JourneyLead
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
}

const EVENT_LABEL: Record<string, string> = {
  view: 'A consulté',
  button_click: 'A cliqué',
  video_play: 'A regardé',
  form_submit: 'A rempli le formulaire',
}

const EVENT_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  view: 'eye-outline',
  button_click: 'finger-print-outline',
  video_play: 'play-circle-outline',
  form_submit: 'send-outline',
}

function formatDateTimeFR(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function leadPlatform(source: string): { label: string; glyph: string; color: string } | null {
  if (source === 'facebook_ads') return { label: 'Facebook', glyph: 'f', color: '#1877F2' }
  if (source === 'instagram_ads') return { label: 'Instagram', glyph: '◯', color: '#E1306C' }
  return null
}

function describeEvent(e: JourneyEvent): string {
  switch (e.event_type) {
    case 'view':
      return e.funnel_page_name ? `« ${e.funnel_page_name} »` : 'une page funnel'
    case 'button_click': {
      const text = e.metadata?.button_text
      return typeof text === 'string' && text ? `sur « ${text} »` : 'un bouton'
    }
    case 'video_play': {
      const m = e.metadata?.milestone
      return typeof m === 'number' ? `une vidéo jusqu'à ${m}%` : 'une vidéo'
    }
    case 'form_submit':
      return e.funnel_page_name ? `« ${e.funnel_page_name} »` : ''
    default:
      return ''
  }
}

/**
 * Affiche le parcours du lead — Plateforme, Première/Dernière pub avec
 * path Campagne/Adset/Pub, réponses Lead Form Meta, réponses booking et
 * activité chronologique. Réplique mobile-native du LeadJourneyBlock web.
 */
export default function LeadJourneyBlock({ leadId }: Props) {
  const [data, setData] = useState<JourneyPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [attributionMap, setAttributionMap] = useState<AttributionMap>({})
  const [open, setOpen] = useState(true)

  // Fetch journey
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const res = await api.get<{ data: JourneyPayload }>(`/api/leads/${leadId}/journey`)
        if (!cancelled && res?.data) setData(res.data)
      } catch {
        /* silent */
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [leadId])

  // Résolution attribution Meta — 2 passes (touches + meta_* puis parents)
  useEffect(() => {
    if (!data) return
    const initial = new Set<string>()
    if (data.attribution.first_touch.value) initial.add(data.attribution.first_touch.value)
    if (data.attribution.last_touch.value) initial.add(data.attribution.last_touch.value)
    if (data.lead.meta_campaign_id) initial.add(data.lead.meta_campaign_id)
    if (data.lead.meta_adset_id) initial.add(data.lead.meta_adset_id)
    if (data.lead.meta_ad_id) initial.add(data.lead.meta_ad_id)
    if (initial.size === 0) return

    let cancelled = false
    ;(async () => {
      try {
        const res1 = await api.get<{ data: AttributionMap }>(
          `/api/meta/ad-attribution?ids=${[...initial].join(',')}`,
        )
        if (cancelled) return
        const m1 = res1?.data ?? {}
        const parents = new Set<string>()
        for (const obj of Object.values(m1)) {
          if (obj?.campaign_id && !m1[obj.campaign_id]) parents.add(obj.campaign_id)
          if (obj?.adset_id && !m1[obj.adset_id]) parents.add(obj.adset_id)
        }
        if (parents.size === 0) {
          setAttributionMap(m1)
          return
        }
        const res2 = await api.get<{ data: AttributionMap }>(
          `/api/meta/ad-attribution?ids=${[...parents].join(',')}`,
        )
        if (cancelled) return
        setAttributionMap({ ...m1, ...(res2?.data ?? {}) })
      } catch {
        /* silent */
      }
    })()
    return () => { cancelled = true }
  }, [data])

  if (loading) {
    return (
      <View style={{
        backgroundColor: colors.bgElevated, borderRadius: 14, borderWidth: 1,
        borderColor: colors.border, padding: spacing.md, marginHorizontal: spacing.lg,
        marginBottom: spacing.xl, alignItems: 'center', flexDirection: 'row', gap: spacing.sm,
      }}>
        <ActivityIndicator color={colors.primary} size="small" />
        <Text style={{ ...t.caption1, color: colors.textSecondary }}>Chargement du parcours…</Text>
      </View>
    )
  }

  if (!data) return null

  const hasContent =
    data.events.length > 0 ||
    data.bookings.length > 0 ||
    Object.keys(data.lead.form_answers ?? {}).length > 0 ||
    !!data.attribution.first_touch.value
  if (!hasContent) return null

  const platform = leadPlatform(data.lead.source)

  return (
    <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.xl, gap: spacing.sm }}>
      {/* Header collapsible */}
      <Pressable
        onPress={() => setOpen(o => !o)}
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 4, marginLeft: 8,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="sparkles-outline" size={12} color={colors.textSecondary} />
          <Text style={{
            ...t.footnote, color: colors.textSecondary,
            textTransform: 'uppercase', letterSpacing: 0.5,
          }}>
            Parcours du lead
          </Text>
          <Text style={{ ...t.caption2, color: colors.textTertiary }}>
            · {data.events.length} évén. · {data.bookings.length} resa
          </Text>
        </View>
        <Ionicons
          name={open ? 'chevron-down' : 'chevron-forward'}
          size={14}
          color={colors.textTertiary}
        />
      </Pressable>

      {open && (
        <>
          <AttributionCard
            touch={data.attribution.first_touch}
            label="Première pub"
            attributionMap={attributionMap}
            platform={platform}
          />
          <AttributionCard
            touch={data.attribution.last_touch}
            label="Dernière pub"
            attributionMap={attributionMap}
            platform={platform}
          />

          <AnswersCard
            title="Réponses Lead Form Meta"
            answers={data.lead.form_answers ?? {}}
            icon="megaphone-outline"
          />

          {data.bookings.map((b) => {
            const entries = Object.entries(b.form_data ?? {})
              .filter(([, v]) => v !== null && v !== undefined && String(v).length > 0)
            if (entries.length === 0) return null
            return (
              <AnswersCard
                key={b.id}
                title={`Formulaire — ${b.calendar_name ?? 'Calendrier'}`}
                subtitle={`${formatDateTimeFR(b.scheduled_at)} · ${b.status}`}
                answers={Object.fromEntries(entries.map(([k, v]) => [k, String(v)]))}
                icon="calendar-outline"
              />
            )
          })}

          {data.events.length > 0 && (
            <View style={{
              backgroundColor: colors.bgElevated, borderRadius: 14,
              borderWidth: 1, borderColor: colors.border, padding: spacing.md,
            }}>
              <Text style={{
                ...t.footnote, color: colors.textSecondary,
                textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm,
              }}>
                Activité chronologique
              </Text>
              <View style={{ gap: 6 }}>
                {data.events.map((e) => (
                  <View key={e.id} style={{
                    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
                    paddingVertical: 4,
                  }}>
                    <Ionicons
                      name={EVENT_ICON[e.event_type] ?? 'pulse-outline'}
                      size={14}
                      color={colors.textTertiary}
                      style={{ marginTop: 1 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...t.caption1, color: colors.textPrimary }}>
                        {EVENT_LABEL[e.event_type] ?? e.event_type} {describeEvent(e)}
                      </Text>
                      <Text style={{ ...t.caption2, color: colors.textTertiary, marginTop: 1 }}>
                        {formatDateTimeFR(e.created_at)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </>
      )}
    </View>
  )
}

function AttributionCard({
  touch, label, attributionMap, platform,
}: {
  touch: AttributionTouch
  label: string
  attributionMap: AttributionMap
  platform: { label: string; glyph: string; color: string } | null
}) {
  if (!touch.value) {
    return (
      <View style={cardStyle}>
        <CardLabel>{label}</CardLabel>
        <Text style={{ ...t.caption1, color: colors.textTertiary }}>Non disponible</Text>
      </View>
    )
  }
  const resolved = attributionMap[touch.value]
  const items: { kind: string; name: string; id: string }[] = []
  if (resolved) {
    if (resolved.type === 'ad') {
      if (resolved.campaign_id) {
        const c = attributionMap[resolved.campaign_id]
        if (c) items.push({ kind: 'Campagne', name: c.name, id: c.id })
      }
      if (resolved.adset_id) {
        const a = attributionMap[resolved.adset_id]
        if (a) items.push({ kind: 'Adset', name: a.name, id: a.id })
      }
      items.push({ kind: 'Pub', name: resolved.name, id: resolved.id })
    } else if (resolved.type === 'adset') {
      if (resolved.campaign_id) {
        const c = attributionMap[resolved.campaign_id]
        if (c) items.push({ kind: 'Campagne', name: c.name, id: c.id })
      }
      items.push({ kind: 'Adset', name: resolved.name, id: resolved.id })
    } else {
      items.push({ kind: 'Campagne', name: resolved.name, id: resolved.id })
    }
  }

  return (
    <View style={cardStyle}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <CardLabel>{label}</CardLabel>
        {touch.at && (
          <Text style={{ ...t.caption2, color: colors.textTertiary }}>
            {formatDateTimeFR(touch.at)}
          </Text>
        )}
      </View>
      <View style={{ gap: 4 }}>
        {platform && (
          <PathRow
            kind="Plateforme"
            value={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{
                  width: 14, height: 14, borderRadius: 3, backgroundColor: platform.color,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff', lineHeight: 12 }}>
                    {platform.glyph}
                  </Text>
                </View>
                <Text style={{ ...t.caption1, color: colors.textPrimary, fontWeight: '500' }}>
                  {platform.label}
                </Text>
              </View>
            }
          />
        )}
        {items.length > 0 ? (
          items.map((it) => (
            <PathRow
              key={it.id}
              kind={it.kind}
              value={
                <Text
                  style={{ ...t.caption1, color: colors.textPrimary, fontWeight: '500' }}
                  numberOfLines={1}
                >
                  {it.name}
                </Text>
              }
            />
          ))
        ) : (
          <Text
            style={{ ...t.caption1, color: colors.textPrimary }}
            numberOfLines={1}
          >
            {touch.source ?? ''} = {touch.value.slice(0, 28)}{touch.value.length > 28 ? '…' : ''}
          </Text>
        )}
      </View>
    </View>
  )
}

function PathRow({ kind, value }: { kind: string; value: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text style={{
        ...t.caption2, color: colors.textTertiary,
        textTransform: 'uppercase', letterSpacing: 0.4,
        minWidth: 60, fontWeight: '700',
      }}>
        {kind}
      </Text>
      <View style={{ flex: 1, minWidth: 0 }}>{value}</View>
    </View>
  )
}

function AnswersCard({
  title, subtitle, answers, icon,
}: {
  title: string
  subtitle?: string
  answers: Record<string, string>
  icon: keyof typeof Ionicons.glyphMap
}) {
  const entries = Object.entries(answers).filter(
    ([, v]) => v !== null && v !== undefined && String(v).length > 0,
  )
  if (entries.length === 0) return null
  return (
    <View style={cardStyle}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm }}>
        <Ionicons name={icon} size={12} color={colors.textSecondary} />
        <Text style={{
          ...t.footnote, color: colors.textSecondary,
          textTransform: 'uppercase', letterSpacing: 0.4, flex: 1,
        }} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {subtitle && (
        <Text style={{ ...t.caption2, color: colors.textTertiary, marginBottom: 8 }}>
          {subtitle}
        </Text>
      )}
      <View style={{ gap: 8 }}>
        {entries.map(([k, v]) => (
          <View key={k} style={{ gap: 2 }}>
            <Text style={{
              ...t.caption2, color: colors.textTertiary,
              textTransform: 'uppercase', letterSpacing: 0.3,
            }}>
              {k.replace(/_/g, ' ')}
            </Text>
            <Text style={{ ...t.caption1, color: colors.textPrimary, fontWeight: '500' }}>
              {String(v)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{
      ...t.caption2, color: colors.textTertiary,
      textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: '700',
    }}>
      {children}
    </Text>
  )
}

const cardStyle = {
  backgroundColor: colors.bgElevated,
  borderRadius: 14,
  borderWidth: 1 as const,
  borderColor: colors.border,
  padding: spacing.md,
}
