import React, { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, ScrollView, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { AgendaItem } from '../../types/agenda'
import { colors } from '../../theme/colors'
import { type as t, spacing } from '../../theme/tokens'

const HOUR_HEIGHT = 56 // hauteur d'une heure en pt
const START_HOUR = 6
const END_HOUR = 23
const GUTTER_WIDTH = 56
const TOTAL_HEIGHT = (END_HOUR - START_HOUR + 1) * HOUR_HEIGHT
// Au-delà de cette durée, on considère que c'est un événement "all-day"
// (typiquement importé de Google) et on le sort du timeline pour ne pas
// noyer la grille horaire.
const LONG_EVENT_THRESHOLD_MIN = 4 * 60
// Plafond pour le nombre de lanes. Au-delà on stack visuellement (pas de
// stripes 3% de large illisibles).
const MAX_LANES = 4

interface Props {
  items: AgendaItem[]
  date: Date
  onPressItem: (item: AgendaItem) => void
  onPressEmpty?: (hour: number) => void
}

interface PositionedItem {
  item: AgendaItem
  top: number
  height: number
  laneIndex: number
  laneCount: number
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

function hourFromIso(iso: string): number {
  const d = new Date(iso)
  return d.getHours() + d.getMinutes() / 60
}

function colorForItem(item: AgendaItem): string {
  if (item.color) return item.color
  switch (item.kind) {
    case 'closing':
      return colors.purple
    case 'setting':
      return colors.info
    case 'personal':
      return colors.cyan
    default:
      return colors.primary
  }
}

// Layout overlap : groupe les items qui se chevauchent et leur attribue
// une "lane" (colonne dans la zone visible). Algorithme simple en O(n²) suffisant
// pour une journée (typiquement < 30 items).
function layoutItems(items: AgendaItem[]): PositionedItem[] {
  const sorted = [...items].sort(
    (a, b) =>
      new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  )
  type Slot = {
    item: AgendaItem
    startMin: number
    endMin: number
    lane: number
  }
  // Padded minimum = la durée minimum nécessaire pour que le block atteigne
  // sa hauteur visuelle min (32px). Sans ce padding, des events séquentiels
  // de 15min se chevauchent VISUELLEMENT (chaque card forcée à 32px chevauche
  // la suivante) mais le layout les met tous en lane 0 → empilement illisible.
  // On utilise donc cette durée padded pour la détection d'overlap.
  const VISUAL_MIN = 32
  const PADDED_MIN = Math.ceil((VISUAL_MIN / HOUR_HEIGHT) * 60) + 4 // ~38min
  const slots: Slot[] = sorted.map((item) => {
    const start = new Date(item.scheduled_at)
    const startMin = start.getHours() * 60 + start.getMinutes()
    const endMin = startMin + Math.max(PADDED_MIN, item.duration_minutes)
    return { item, startMin, endMin, lane: 0 }
  })

  // Group items qui se chevauchent (graph connecté).
  const groups: Slot[][] = []
  for (const s of slots) {
    let placed = false
    for (const g of groups) {
      if (g.some((x) => s.startMin < x.endMin && s.endMin > x.startMin)) {
        g.push(s)
        placed = true
        break
      }
    }
    if (!placed) groups.push([s])
  }

  // Pour chaque groupe : assigner les lanes greedy (plus petite lane libre).
  const result: PositionedItem[] = []
  for (const g of groups) {
    const sortedG = [...g].sort((a, b) => a.startMin - b.startMin)
    const lanes: number[] = [] // endMin de chaque lane
    for (const s of sortedG) {
      let assigned = -1
      for (let i = 0; i < lanes.length; i++) {
        if (lanes[i] <= s.startMin) {
          assigned = i
          lanes[i] = s.endMin
          break
        }
      }
      if (assigned === -1) {
        assigned = lanes.length
        lanes.push(s.endMin)
      }
      s.lane = assigned
    }
    const laneCount = Math.min(lanes.length, MAX_LANES)
    for (const s of sortedG) {
      const startHour = s.startMin / 60
      const top = (startHour - START_HOUR) * HOUR_HEIGHT
      const height = Math.max(32, ((s.endMin - s.startMin) / 60) * HOUR_HEIGHT - 2)
      // Si ce slot a été assigné à une lane > MAX_LANES-1, on le clamp à la
      // dernière lane visible (overlap accepté sur cette colonne).
      const visibleLane = Math.min(s.lane, MAX_LANES - 1)
      result.push({
        item: s.item,
        top,
        height,
        laneIndex: visibleLane,
        laneCount,
      })
    }
  }
  return result
}

export function AgendaTimeline({ items, date, onPressItem, onPressEmpty }: Props) {
  // Sépare les events "longs" (>= 4h) → bandeau compact en haut. Évite que
  // des all-day Google noient la grille horaire.
  const { longEvents, timelineItems } = useMemo(() => {
    const longs: AgendaItem[] = []
    const shorts: AgendaItem[] = []
    for (const it of items) {
      if (it.duration_minutes >= LONG_EVENT_THRESHOLD_MIN) longs.push(it)
      else shorts.push(it)
    }
    return { longEvents: longs, timelineItems: shorts }
  }, [items])
  const positioned = useMemo(() => layoutItems(timelineItems), [timelineItems])
  const isToday = sameDay(date, new Date())

  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!isToday) return
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [isToday])

  const nowTop = useMemo(() => {
    if (!isToday) return null
    const h = now.getHours() + now.getMinutes() / 60
    if (h < START_HOUR || h > END_HOUR + 1) return null
    return (h - START_HOUR) * HOUR_HEIGHT
  }, [isToday, now])

  // Auto-scroll : sur today vers l'heure courante - 1, sinon vers 8h.
  const scrollRef = useRef<ScrollView>(null)
  useEffect(() => {
    const target = isToday
      ? Math.max(START_HOUR, now.getHours() - 1)
      : 8
    const y = (target - START_HOUR) * HOUR_HEIGHT
    // setTimeout pour laisser le scroll se monter
    const id = setTimeout(() => {
      scrollRef.current?.scrollTo({ y, animated: false })
    }, 50)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  const hours = useMemo(() => {
    const out: number[] = []
    for (let h = START_HOUR; h <= END_HOUR; h++) out.push(h)
    return out
  }, [])

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
      {longEvents.length > 0 ? (
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.sm,
            gap: 6,
          }}
        >
          <Text
            style={{
              ...t.caption2,
              color: colors.textTertiary,
              textTransform: 'uppercase',
              fontWeight: '700',
              letterSpacing: 0.4,
              marginBottom: 2,
            }}
          >
            Toute la journée · {longEvents.length}
          </Text>
          {longEvents.map((it) => {
            const color = colorForItem(it)
            return (
              <Pressable
                key={it.id}
                onPress={() => onPressItem(it)}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                    borderRadius: 8,
                    backgroundColor: color + '26',
                    borderLeftWidth: 3,
                    borderLeftColor: color,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      color: colors.textPrimary,
                      fontSize: 13,
                      fontWeight: '600',
                    }}
                  >
                    {it.title}
                  </Text>
                  <Text style={{ ...t.caption1, color, fontWeight: '700' }}>
                    {labelForKind(it)}
                  </Text>
                </View>
              </Pressable>
            )
          })}
        </View>
      ) : null}
      <View style={{ height: TOTAL_HEIGHT, position: 'relative' }}>
        {/* Hour grid */}
        {hours.map((h) => (
          <View
            key={h}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: (h - START_HOUR) * HOUR_HEIGHT,
              height: HOUR_HEIGHT,
              flexDirection: 'row',
            }}
          >
            <View
              style={{
                width: GUTTER_WIDTH,
                paddingTop: 0,
                paddingRight: spacing.sm,
                alignItems: 'flex-end',
              }}
            >
              <Text
                style={{
                  ...t.caption2,
                  color: colors.textTertiary,
                  fontWeight: '500',
                  marginTop: -6,
                }}
              >
                {String(h).padStart(2, '0')}:00
              </Text>
            </View>
            <Pressable
              onPress={() => onPressEmpty?.(h)}
              style={{
                flex: 1,
                borderTopWidth: 0.33,
                borderTopColor: colors.border,
              }}
            />
          </View>
        ))}

        {/* Items */}
        <View
          style={{
            position: 'absolute',
            left: GUTTER_WIDTH,
            right: spacing.lg,
            top: 0,
            bottom: 0,
          }}
          pointerEvents="box-none"
        >
          {positioned.map(({ item, top, height, laneIndex, laneCount }) => {
            const color = colorForItem(item)
            const isDone = item.outcome === 'done'
            const isNoShow = item.outcome === 'no_show'
            const widthPct = 100 / laneCount
            const leftPct = laneIndex * widthPct
            return (
              <Pressable
                key={item.id}
                onPress={() => onPressItem(item)}
                style={({ pressed }) => ({
                  position: 'absolute',
                  top,
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  height,
                  paddingRight: laneIndex < laneCount - 1 ? 4 : 0,
                  opacity: isDone ? 0.5 : pressed ? 0.7 : 1,
                })}
              >
                <View
                  style={{
                    flex: 1,
                    backgroundColor: color + '33',
                    borderWidth: 1,
                    borderColor: color + '66',
                    borderLeftWidth: 3,
                    borderLeftColor: color,
                    borderRadius: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 6,
                    overflow: 'hidden',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {isNoShow ? (
                      <Ionicons name="alert-circle" size={12} color={colors.warning} />
                    ) : null}
                    <Text
                      numberOfLines={1}
                      style={{
                        color: colors.textPrimary,
                        fontSize: 13,
                        fontWeight: '700',
                        letterSpacing: -0.2,
                        flex: 1,
                      }}
                    >
                      {formatTime(item.scheduled_at)} · {item.title}
                    </Text>
                  </View>
                  {height > 38 ? (
                    <Text
                      numberOfLines={1}
                      style={{
                        ...t.caption1,
                        color,
                        fontWeight: '600',
                        marginTop: 2,
                      }}
                    >
                      {labelForKind(item)}
                    </Text>
                  ) : null}
                  {height > 60 && item.location_name ? (
                    <Text
                      numberOfLines={1}
                      style={{
                        ...t.caption1,
                        color: colors.textSecondary,
                        marginTop: 2,
                      }}
                    >
                      {item.location_name}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            )
          })}
        </View>

        {/* Now indicator */}
        {nowTop != null ? (
          <View
            style={{
              position: 'absolute',
              left: GUTTER_WIDTH - 4,
              right: 0,
              top: nowTop,
              flexDirection: 'row',
              alignItems: 'center',
              zIndex: 10,
            }}
            pointerEvents="none"
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: colors.danger,
              }}
            />
            <View
              style={{
                flex: 1,
                height: 1.5,
                backgroundColor: colors.danger,
              }}
            />
          </View>
        ) : null}
      </View>
    </ScrollView>
  )
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function labelForKind(item: AgendaItem): string {
  if (item.kind === 'closing') return 'Closing'
  if (item.kind === 'setting') return 'Setting'
  if (item.kind === 'personal') return 'Perso'
  return 'Booking'
}
