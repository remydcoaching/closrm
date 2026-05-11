import React, { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, ScrollView, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { AgendaItem } from '../../types/agenda'
import { Avatar } from '../ui/Avatar'
import { colors } from '../../theme/colors'
import { type as t, spacing } from '../../theme/tokens'

// Grille horaire FIXE : 1 heure = 64 pt. Toujours.
// Les events sont positionnés en absolu PAR-DESSUS la grille, avec :
//   top = (startMin / 60 - startHour) * 64
//   height = (durationMin / 60) * 64 - 2  (proportionnel à la durée)
// → un 2h fait vraiment 128pt, un 1h fait 62pt, etc. Plus de compression.
const HOUR_HEIGHT = 64
const HOUR_LABEL_WIDTH = 56
const DEFAULT_START_HOUR = 6
const DEFAULT_END_HOUR = 23
// Min visuel pour qu'une card reste cliquable / lisible (= ~15min @ HOUR_HEIGHT 64).
const MIN_CARD_HEIGHT = 16
// Plafond de lanes en cas d'overlap (events qui se chevauchent visuellement).
const MAX_LANES = 3

interface Props {
  items: AgendaItem[]
  date: Date
  onPressItem: (item: AgendaItem) => void
}

interface Positioned {
  item: AgendaItem
  top: number
  height: number
  lane: number
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
 * Layout : top + height proportionnels, lanes pour les overlaps visuels.
 * On groupe les events qui se chevauchent (top+height) et on leur attribue
 * des lanes (max 3). Cap dur pour ne pas avoir des cards 3% de large.
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
    const naturalH = (item.duration_minutes / 60) * HOUR_HEIGHT - 2
    const height = Math.max(MIN_CARD_HEIGHT, naturalH)
    return { item, top, height, bottom: top + height, lane: 0, group: -1 }
  })
  slots.sort((a, b) => (a.top !== b.top ? a.top - b.top : b.height - a.height))

  // Groupes par overlap visuel (rectangle).
  let g = 0
  for (let i = 0; i < slots.length; i++) {
    if (slots[i].group >= 0) continue
    slots[i].group = g
    let grew = true
    while (grew) {
      grew = false
      for (let j = 0; j < slots.length; j++) {
        if (slots[j].group !== g) continue
        for (let k = 0; k < slots.length; k++) {
          if (slots[k].group >= 0) continue
          if (slots[j].top < slots[k].bottom && slots[j].bottom > slots[k].top) {
            slots[k].group = g
            grew = true
          }
        }
      }
    }
    g++
  }

  // Lanes par groupe.
  const result: Positioned[] = []
  for (let gi = 0; gi < g; gi++) {
    const group = slots.filter((s) => s.group === gi).sort((a, b) => a.top - b.top)
    const lanes: number[] = []
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
        lane: Math.min(s.lane, MAX_LANES - 1),
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
      const endH = Math.ceil(startH + it.duration_minutes / 60)
      if (startH < minH) minH = Math.max(0, startH)
      if (endH > maxH) maxH = Math.min(24, endH)
    }
    return { startHour: minH, endHour: maxH }
  }, [items])
  const totalHeight = (endHour - startHour + 1) * HOUR_HEIGHT

  const positioned = useMemo(() => layoutItems(items, startHour), [items, startHour])

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
    if (h < startHour || h > endHour + 1) return null
    return (h - startHour) * HOUR_HEIGHT
  }, [isToday, now, startHour, endHour])

  // Auto-scroll
  const scrollRef = useRef<ScrollView>(null)
  useEffect(() => {
    let target: number
    if (isToday) target = Math.max(startHour, new Date().getHours() - 1)
    else if (items.length > 0) {
      const first = Math.min(...items.map((it) => new Date(it.scheduled_at).getHours()))
      target = Math.max(startHour, first - 1)
    } else target = Math.max(startHour, 8)
    const y = (target - startHour) * HOUR_HEIGHT
    const id = setTimeout(() => scrollRef.current?.scrollTo({ y, animated: false }), 50)
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
        {/* Grille horaire fixe : 1 row par heure à HOUR_HEIGHT exactement */}
        {hours.map((h, idx) => (
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
                borderTopWidth: idx === 0 ? 0 : 0.33,
                borderTopColor: colors.border,
              }}
            />
          </View>
        ))}

        {/* Events absolument positionnés au-dessus de la grille */}
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
          {positioned.map(({ item, top, height, lane, laneCount }) => (
            <EventBlock
              key={item.id}
              item={item}
              top={top}
              height={height}
              lane={lane}
              laneCount={laneCount}
              onPress={() => onPressItem(item)}
            />
          ))}
        </View>

        {/* Now line */}
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
                width: HOUR_LABEL_WIDTH - 4,
                alignItems: 'flex-end',
                paddingRight: 4,
              }}
            >
              <View
                style={{
                  paddingHorizontal: 5,
                  paddingVertical: 2,
                  backgroundColor: colors.danger,
                  borderRadius: 4,
                }}
              >
                <Text style={{ fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.3 }}>
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
  lane,
  laneCount,
  onPress,
}: {
  item: AgendaItem
  top: number
  height: number
  lane: number
  laneCount: number
  onPress: () => void
}) {
  const color = colorForItem(item)
  const isDone = item.outcome === 'done'
  const isNoShow = item.outcome === 'no_show'
  const widthPct = 100 / laneCount
  const leftPct = lane * widthPct
  const compact = height < 26
  const medium = height >= 26 && height < 48
  const showChip = height >= 38
  const showLocation = height >= 56 && Boolean(item.location_name)
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        position: 'absolute',
        top,
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        height,
        paddingRight: lane < laneCount - 1 ? 3 : 0,
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
          paddingVertical: compact ? 0 : 4,
          overflow: 'hidden',
          flexDirection: compact ? 'row' : 'column',
          alignItems: compact ? 'center' : 'flex-start',
          gap: compact ? 6 : 1,
          justifyContent: compact ? 'flex-start' : 'flex-start',
        }}
      >
        {compact ? (
          <>
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: colors.textPrimary,
              }}
            >
              {formatTime(item.scheduled_at)}
            </Text>
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
            {isNoShow ? (
              <Ionicons name="alert-circle" size={10} color={colors.warning} />
            ) : isDone ? (
              <Ionicons name="checkmark-circle" size={10} color={colors.primary} />
            ) : null}
          </>
        ) : (
          <>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                width: '100%',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: colors.textPrimary,
                }}
              >
                {formatTime(item.scheduled_at)}
              </Text>
              <Text
                style={{
                  ...t.caption2,
                  color: colors.textTertiary,
                  fontWeight: '500',
                }}
              >
                · {formatDuration(item.duration_minutes)}
              </Text>
              <View style={{ flex: 1 }} />
              {isNoShow ? (
                <Ionicons name="alert-circle" size={11} color={colors.warning} />
              ) : isDone ? (
                <Ionicons name="checkmark-circle" size={11} color={colors.primary} />
              ) : null}
            </View>
            <Text
              numberOfLines={1}
              style={{
                fontSize: medium ? 12 : 13,
                fontWeight: '600',
                color: colors.textPrimary,
                marginTop: 1,
              }}
            >
              {item.title}
            </Text>
            {showChip ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
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
            {showLocation ? (
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
          </>
        )}
      </View>
      {item.lead_name && height >= 56 ? (
        <View
          style={{ position: 'absolute', top: 6, right: 6, opacity: 0.85 }}
          pointerEvents="none"
        >
          <Avatar name={item.lead_name} size={20} />
        </View>
      ) : null}
    </Pressable>
  )
}
