import React, { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, ScrollView, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { AgendaItem } from '../../types/agenda'
import { Avatar } from '../ui/Avatar'
import { colors } from '../../theme/colors'
import { type as t, spacing } from '../../theme/tokens'

// 1 heure = 80 pt. Donne :
//   15min → 18pt  (compact, heure + titre inline)
//   30min → 38pt  (+ chip type)
//   45min → 58pt  (+ chip + avatar)
//   1h    → 78pt  (+ lieu si dispo)
//   3h    → 238pt
// HOUR_HEIGHT 80 pour que 15min = 18pt = MIN_CARD_HEIGHT pile-poil. Comme ça
// des events séquentiels de 15min (06:00, 06:15, 06:30…) ne se chevauchent
// pas visuellement → chacun dans son groupe, full width, propre.
const HOUR_HEIGHT = 80
const HOUR_LABEL_WIDTH = 56
const DEFAULT_START_HOUR = 6
const DEFAULT_END_HOUR = 23
const MAX_LANES = 2
const MIN_CARD_HEIGHT = 18

interface Props {
  items: AgendaItem[]
  date: Date
  onPressItem: (item: AgendaItem) => void
}

interface Positioned {
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

function colorForItem(item: AgendaItem): string {
  if (item.color) return item.color
  switch (item.kind) {
    case 'closing':
      return colors.purple
    case 'setting':
      return colors.info
    case 'personal':
      return '#6b7280'
    default:
      return colors.primary
  }
}

function labelForKind(item: AgendaItem): string {
  if (item.kind === 'closing') return 'Closing'
  if (item.kind === 'setting') return 'Setting'
  if (item.kind === 'personal') return 'Perso'
  return 'Booking'
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function formatDuration(min: number): string {
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

/**
 * Layout par chevauchement VISUEL : on calcule (top, height) au pixel près
 * (proportionnel à la durée), puis on assigne les lanes pour les events qui
 * se chevauchent visuellement.
 */
function layoutItems(items: AgendaItem[], startHour: number): Positioned[] {
  type Slot = {
    item: AgendaItem
    top: number
    height: number
    bottom: number
    lane: number
    group: number
  }
  const slots: Slot[] = items.map((item) => {
    const start = new Date(item.scheduled_at)
    const startMin = start.getHours() * 60 + start.getMinutes()
    const top = (startMin / 60 - startHour) * HOUR_HEIGHT
    const naturalHeight = (item.duration_minutes / 60) * HOUR_HEIGHT - 2
    const height = Math.max(MIN_CARD_HEIGHT, naturalHeight)
    return { item, top, height, bottom: top + height, lane: 0, group: -1 }
  })

  // Tri par top puis durée desc (les events plus longs ont priorité de lane).
  slots.sort((a, b) => {
    if (a.top !== b.top) return a.top - b.top
    return b.height - a.height
  })

  // Détection de groupes visuellement connectés.
  let nextGroupId = 0
  for (let i = 0; i < slots.length; i++) {
    if (slots[i].group >= 0) continue
    slots[i].group = nextGroupId
    let grew = true
    while (grew) {
      grew = false
      for (let j = 0; j < slots.length; j++) {
        if (slots[j].group !== nextGroupId) continue
        for (let k = 0; k < slots.length; k++) {
          if (slots[k].group >= 0) continue
          if (slots[j].top < slots[k].bottom && slots[j].bottom > slots[k].top) {
            slots[k].group = nextGroupId
            grew = true
          }
        }
      }
    }
    nextGroupId++
  }

  const result: Positioned[] = []
  for (let g = 0; g < nextGroupId; g++) {
    const group = slots.filter((s) => s.group === g).sort((a, b) => a.top - b.top)
    const lanes: number[] = [] // bottom du dernier item de chaque lane
    for (const s of group) {
      let assigned = -1
      for (let i = 0; i < lanes.length; i++) {
        if (lanes[i] <= s.top) {
          assigned = i
          lanes[i] = s.bottom
          break
        }
      }
      if (assigned === -1) {
        lanes.push(s.bottom)
        assigned = lanes.length - 1
      }
      s.lane = assigned
    }
    const laneCount = Math.min(lanes.length, MAX_LANES)
    for (const s of group) {
      result.push({
        item: s.item,
        top: s.top,
        height: s.height,
        laneIndex: Math.min(s.lane, MAX_LANES - 1),
        laneCount,
      })
    }
  }
  return result
}

export function AgendaTimeline({ items, date, onPressItem }: Props) {
  // Plage horaire dynamique.
  const { startHour, endHour } = useMemo(() => {
    let minH = DEFAULT_START_HOUR
    let maxH = DEFAULT_END_HOUR
    for (const it of items) {
      const start = new Date(it.scheduled_at)
      const startH = start.getHours()
      const endH = Math.ceil((startH + it.duration_minutes / 60))
      if (startH < minH) minH = Math.max(0, startH)
      if (endH > maxH) maxH = Math.min(24, endH)
    }
    return { startHour: minH, endHour: maxH }
  }, [items])
  const totalHeight = (endHour - startHour + 1) * HOUR_HEIGHT

  const positioned = useMemo(
    () => layoutItems(items, startHour),
    [items, startHour]
  )

  const isToday = sameDay(date, new Date())
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!isToday) return
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [isToday])

  // Position de la ligne "now" en px depuis le top du timeline.
  const nowTop = useMemo(() => {
    if (!isToday) return null
    const h = now.getHours() + now.getMinutes() / 60
    if (h < startHour || h > endHour + 1) return null
    return (h - startHour) * HOUR_HEIGHT
  }, [isToday, now, startHour, endHour])

  // Auto-scroll : today → heure courante - 1, sinon premier event ou 8h.
  const scrollRef = useRef<ScrollView>(null)
  useEffect(() => {
    let targetHour: number
    if (isToday) {
      targetHour = Math.max(startHour, new Date().getHours() - 1)
    } else if (items.length > 0) {
      const first = Math.min(...items.map((it) => new Date(it.scheduled_at).getHours()))
      targetHour = Math.max(startHour, first - 1)
    } else {
      targetHour = Math.max(startHour, 8)
    }
    const y = (targetHour - startHour) * HOUR_HEIGHT
    const id = setTimeout(() => {
      scrollRef.current?.scrollTo({ y, animated: false })
    }, 50)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, startHour])

  const hours = useMemo(() => {
    const out: number[] = []
    for (let h = startHour; h <= endHour; h++) out.push(h)
    return out
  }, [startHour, endHour])

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={{
          height: totalHeight,
          position: 'relative',
          paddingRight: spacing.lg,
        }}
      >
        {/* Hour gridlines + labels */}
        {hours.map((h) => (
          <View
            key={h}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: (h - startHour) * HOUR_HEIGHT,
              height: HOUR_HEIGHT,
              flexDirection: 'row',
            }}
          >
            <View
              style={{
                width: HOUR_LABEL_WIDTH,
                alignItems: 'flex-end',
                paddingRight: spacing.sm,
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
            <View
              style={{
                flex: 1,
                borderTopWidth: 0.33,
                borderTopColor: colors.border,
              }}
            />
          </View>
        ))}

        {/* Events layer */}
        <View
          style={{
            position: 'absolute',
            left: HOUR_LABEL_WIDTH,
            right: spacing.lg,
            top: 0,
            bottom: 0,
          }}
          pointerEvents="box-none"
        >
          {positioned.map(({ item, top, height, laneIndex, laneCount }) => (
            <EventBlock
              key={item.id}
              item={item}
              top={top}
              height={height}
              laneIndex={laneIndex}
              laneCount={laneCount}
              onPress={() => onPressItem(item)}
            />
          ))}
        </View>

        {/* Now line — traverse toute la largeur */}
        {nowTop != null ? (
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: spacing.lg,
              top: nowTop - 1,
              flexDirection: 'row',
              alignItems: 'center',
              zIndex: 100,
            }}
            pointerEvents="none"
          >
            <View
              style={{
                width: HOUR_LABEL_WIDTH - 8,
                alignItems: 'flex-end',
                paddingRight: 4,
              }}
            >
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  backgroundColor: colors.danger,
                  borderRadius: 4,
                }}
              >
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: '800',
                    color: '#fff',
                    letterSpacing: 0.3,
                  }}
                >
                  {now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: colors.danger,
                marginLeft: -4,
              }}
            />
            <View style={{ flex: 1, height: 2, backgroundColor: colors.danger }} />
          </View>
        ) : null}
      </View>
    </ScrollView>
  )
}

function EventBlock({
  item,
  top,
  height,
  laneIndex,
  laneCount,
  onPress,
}: {
  item: AgendaItem
  top: number
  height: number
  laneIndex: number
  laneCount: number
  onPress: () => void
}) {
  const color = colorForItem(item)
  const isDone = item.outcome === 'done'
  const isNoShow = item.outcome === 'no_show'
  const widthPct = 100 / laneCount
  const leftPct = laneIndex * widthPct
  // Adapte le contenu selon la hauteur dispo.
  const compact = height < 32
  const medium = height >= 32 && height < 56
  const showTitle = true
  const showChip = height >= 42
  const showLocation = height >= 64 && Boolean(item.location_name)
  return (
    <Pressable
      onPress={onPress}
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
          backgroundColor: color + '22',
          borderWidth: 0.5,
          borderColor: color + '44',
          borderLeftWidth: 3,
          borderLeftColor: color,
          borderRadius: 8,
          paddingHorizontal: compact ? 6 : 8,
          paddingVertical: compact ? 1 : 4,
          overflow: 'hidden',
          flexDirection: compact ? 'row' : 'column',
          alignItems: compact ? 'center' : 'flex-start',
          gap: compact ? 6 : 2,
        }}
      >
        {/* Ligne titre principale */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            width: compact ? undefined : '100%',
            flex: compact ? 1 : undefined,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              fontSize: compact ? 11 : medium ? 12 : 13,
              fontWeight: '700',
              color: colors.textPrimary,
              letterSpacing: -0.2,
              flex: compact ? undefined : 1,
            }}
          >
            {formatTime(item.scheduled_at)}
          </Text>
          {!compact ? (
            <Text
              numberOfLines={1}
              style={{
                ...t.caption2,
                color: colors.textTertiary,
                fontWeight: '500',
              }}
            >
              · {formatDuration(item.duration_minutes)}
            </Text>
          ) : null}
          {compact && showTitle ? (
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                fontSize: 11,
                fontWeight: '600',
                color: colors.textPrimary,
              }}
            >
              {item.title}
            </Text>
          ) : null}
          {isNoShow ? (
            <Ionicons name="alert-circle" size={11} color={colors.warning} />
          ) : isDone ? (
            <Ionicons name="checkmark-circle" size={11} color={colors.primary} />
          ) : null}
        </View>

        {/* Titre (mode non-compact) */}
        {!compact && showTitle ? (
          <Text
            numberOfLines={1}
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: colors.textPrimary,
              letterSpacing: -0.2,
            }}
          >
            {item.title}
          </Text>
        ) : null}

        {/* Chip type (medium+) */}
        {showChip ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: color }} />
            <Text
              style={{
                fontSize: 10,
                fontWeight: '700',
                color,
                letterSpacing: 0.3,
                textTransform: 'uppercase',
              }}
            >
              {labelForKind(item)}
            </Text>
          </View>
        ) : null}

        {/* Lieu (large) */}
        {showLocation ? (
          <Text
            numberOfLines={1}
            style={{
              ...t.caption1,
              color: colors.textSecondary,
            }}
          >
            {item.location_name}
          </Text>
        ) : null}
      </View>
      {/* Avatar discret en bas droite si lead, mode non-compact */}
      {item.lead_name && height >= 50 ? (
        <View
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            opacity: 0.85,
          }}
          pointerEvents="none"
        >
          <Avatar name={item.lead_name} size={20} />
        </View>
      ) : null}
    </Pressable>
  )
}
