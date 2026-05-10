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

// Layout style Apple Calendar — détection d'overlap basée sur le rectangle
// VISUEL final (top, top+height), pas la durée temporelle. C'est le seul
// moyen d'éviter qu'un stack d'events de 15min séquentiels collés se
// chevauchent visuellement tout en étant dans la même lane.
function layoutItems(items: AgendaItem[]): PositionedItem[] {
  const VISUAL_MIN_HEIGHT = 22 // px : assez pour 1 ligne de texte (heure + titre)

  // Step 1 : pré-calcul (top, height) pour chaque item.
  type WithPos = {
    item: AgendaItem
    top: number
    height: number
    bottom: number
    lane: number
    group: number
  }
  const positioned: WithPos[] = items.map((item) => {
    const start = new Date(item.scheduled_at)
    const startMin = start.getHours() * 60 + start.getMinutes()
    const top = (startMin / 60 - START_HOUR) * HOUR_HEIGHT
    const naturalHeight = (item.duration_minutes / 60) * HOUR_HEIGHT - 2
    const height = Math.max(VISUAL_MIN_HEIGHT, naturalHeight)
    return { item, top, height, bottom: top + height, lane: 0, group: -1 }
  })

  // Step 2 : tri par top (puis par durée desc pour stabilité visuelle).
  positioned.sort((a, b) => {
    if (a.top !== b.top) return a.top - b.top
    return b.height - a.height
  })

  // Step 3 : groupes connectés par chevauchement VISUEL.
  let groupId = 0
  for (let i = 0; i < positioned.length; i++) {
    if (positioned[i].group >= 0) continue
    positioned[i].group = groupId
    // BFS sur les items qui se chevauchent visuellement avec ceux du groupe.
    let changed = true
    while (changed) {
      changed = false
      for (let j = 0; j < positioned.length; j++) {
        if (positioned[j].group !== groupId) continue
        for (let k = 0; k < positioned.length; k++) {
          if (positioned[k].group >= 0) continue
          if (
            positioned[j].top < positioned[k].bottom &&
            positioned[j].bottom > positioned[k].top
          ) {
            positioned[k].group = groupId
            changed = true
          }
        }
      }
    }
    groupId++
  }

  // Step 4 : pour chaque groupe, assignation greedy des lanes.
  const result: PositionedItem[] = []
  for (let g = 0; g < groupId; g++) {
    const group = positioned.filter((p) => p.group === g).sort((a, b) => a.top - b.top)
    const lanes: number[] = [] // bottom du dernier item de chaque lane
    for (const p of group) {
      let assigned = -1
      for (let i = 0; i < lanes.length; i++) {
        if (lanes[i] <= p.top) {
          assigned = i
          lanes[i] = p.bottom
          break
        }
      }
      if (assigned === -1) {
        lanes.push(p.bottom)
        assigned = lanes.length - 1
      }
      p.lane = assigned
    }
    const laneCount = Math.min(lanes.length, MAX_LANES)
    for (const p of group) {
      const visibleLane = Math.min(p.lane, MAX_LANES - 1)
      result.push({
        item: p.item,
        top: p.top,
        height: p.height,
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
            // Adapte le padding et le contenu en fonction de la hauteur du
            // block pour rester lisible sur des events de 15min sans déborder.
            const compact = height < 30
            const showLabel = height >= 38
            const showLocation = height >= 56 && Boolean(item.location_name)
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
                  paddingRight: laneIndex < laneCount - 1 ? 3 : 0,
                  opacity: isDone ? 0.55 : pressed ? 0.7 : 1,
                })}
              >
                <View
                  style={{
                    flex: 1,
                    backgroundColor: color + '33',
                    borderWidth: 0.5,
                    borderColor: color + '66',
                    borderLeftWidth: 3,
                    borderLeftColor: color,
                    borderRadius: 6,
                    paddingHorizontal: compact ? 6 : 8,
                    paddingVertical: compact ? 1 : 4,
                    overflow: 'hidden',
                    justifyContent: compact ? 'center' : 'flex-start',
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    {isNoShow ? (
                      <Ionicons name="alert-circle" size={11} color={colors.warning} />
                    ) : null}
                    <Text
                      numberOfLines={1}
                      style={{
                        color: colors.textPrimary,
                        fontSize: compact ? 11 : 12.5,
                        fontWeight: '700',
                        letterSpacing: -0.2,
                        flex: 1,
                      }}
                    >
                      {formatTime(item.scheduled_at)} · {item.title}
                    </Text>
                  </View>
                  {showLabel ? (
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 10,
                        color,
                        fontWeight: '700',
                        marginTop: 1,
                        letterSpacing: 0.2,
                      }}
                    >
                      {labelForKind(item).toUpperCase()}
                    </Text>
                  ) : null}
                  {showLocation ? (
                    <Text
                      numberOfLines={1}
                      style={{
                        ...t.caption1,
                        color: colors.textSecondary,
                        marginTop: 1,
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
