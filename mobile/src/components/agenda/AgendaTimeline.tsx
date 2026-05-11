import React, { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, ScrollView, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { AgendaItem } from '../../types/agenda'
import { Avatar } from '../ui/Avatar'
import { colors } from '../../theme/colors'
import { type as t, spacing } from '../../theme/tokens'

// Hauteur d'une heure dans la grille = 80pt. Donne :
//   15min → 20pt  (titre + heure sur 1 ligne)
//   30min → 40pt  (+ chip type)
//   45min → 60pt  (+ avatar/lieu)
//   1h    → 80pt
//   3h    → 240pt (déborde sur les rows suivantes)
const HOUR_HEIGHT = 80
const HOUR_LABEL_WIDTH = 56
const DEFAULT_START_HOUR = 6
const DEFAULT_END_HOUR = 23
// Min height d'une card pour rester cliquable (= très courts events <10min).
const MIN_CARD_HEIGHT = 20

interface Props {
  items: AgendaItem[]
  date: Date
  onPressItem: (item: AgendaItem) => void
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
 * Timeline en grille horaire fixe (chaque heure = HOUR_HEIGHT pt), avec
 * cards à hauteur proportionnelle à la durée. Approche simple :
 *  - Pour chaque heure on render une row
 *  - À l'intérieur de chaque row : les events qui DÉMARRENT dans cette heure
 *  - Chaque card est rendue inline (pas d'absolute positioning) avec une
 *    hauteur = (duration / 60) * HOUR_HEIGHT. Si > HOUR_HEIGHT (event > 1h),
 *    la card déborde naturellement sur la row suivante grâce à `overflow:
 *    visible`. Les rows suivantes restent visuellement à leur place ; la
 *    card spanne juste l'espace.
 *
 *  - PAS d'algorithme d'overlap/lanes complexe : si deux events démarrent
 *    dans la même heure ils stackent verticalement dans la row, repoussant
 *    les events suivants vers le bas. C'est moins exact pixel-près qu'un
 *    Apple Calendar mais beaucoup plus robuste sur des données chargées.
 */
export function AgendaTimeline({ items, date, onPressItem }: Props) {
  // Plage horaire dynamique.
  const { startHour, endHour } = useMemo(() => {
    let minH = DEFAULT_START_HOUR
    let maxH = DEFAULT_END_HOUR
    for (const it of items) {
      const startH = new Date(it.scheduled_at).getHours()
      if (startH < minH) minH = Math.max(0, startH)
      if (startH > maxH) maxH = Math.min(23, startH)
    }
    return { startHour: minH, endHour: maxH }
  }, [items])

  // Group events par heure de début, triés.
  const byHour = useMemo(() => {
    const map = new Map<number, AgendaItem[]>()
    const sorted = [...items].sort(
      (a, b) =>
        new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    )
    for (const it of sorted) {
      const h = new Date(it.scheduled_at).getHours()
      const arr = map.get(h) ?? []
      arr.push(it)
      map.set(h, arr)
    }
    return map
  }, [items])

  const hours = useMemo(() => {
    const out: number[] = []
    for (let h = startHour; h <= endHour; h++) out.push(h)
    return out
  }, [startHour, endHour])

  // Now indicator
  const isToday = sameDay(date, new Date())
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!isToday) return
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [isToday])

  // Auto-scroll
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

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ position: 'relative' }}>
        {hours.map((h, idx) => {
          const events = byHour.get(h) ?? []
          const isCurrentHour =
            isToday && now.getHours() === h
          return (
            <View
              key={h}
              style={{
                minHeight: HOUR_HEIGHT,
                flexDirection: 'row',
                borderTopWidth: idx === 0 ? 0 : 0.33,
                borderTopColor: colors.border,
                paddingVertical: 4,
                paddingRight: spacing.lg,
              }}
            >
              {/* Hour label */}
              <View
                style={{
                  width: HOUR_LABEL_WIDTH,
                  alignItems: 'flex-end',
                  paddingRight: spacing.sm,
                  paddingTop: 0,
                }}
              >
                <Text
                  style={{
                    ...t.caption2,
                    color: isCurrentHour ? colors.danger : colors.textTertiary,
                    fontWeight: isCurrentHour ? '700' : '500',
                    marginTop: -6,
                  }}
                >
                  {String(h).padStart(2, '0')}:00
                </Text>
              </View>

              {/* Events colonne */}
              <View style={{ flex: 1, gap: 4 }}>
                {events.map((item) => (
                  <EventCard
                    key={item.id}
                    item={item}
                    onPress={() => onPressItem(item)}
                  />
                ))}
              </View>
            </View>
          )
        })}

        {/* Now line — positionnée en absolu par rapport au top de la grille */}
        {isToday ? <NowLine now={now} startHour={startHour} /> : null}
      </View>
    </ScrollView>
  )
}

function EventCard({ item, onPress }: { item: AgendaItem; onPress: () => void }) {
  const color = colorForItem(item)
  const isDone = item.outcome === 'done'
  const isNoShow = item.outcome === 'no_show'
  // Hauteur proportionnelle à la durée. Un 15min = 20pt, 45min = 60pt, 3h = 240pt.
  const height = Math.max(MIN_CARD_HEIGHT, (item.duration_minutes / 60) * HOUR_HEIGHT - 4)
  const compact = height < 32
  const medium = height >= 32 && height < 56
  const showChip = height >= 38
  const showLocation = height >= 60 && Boolean(item.location_name)
  const showAvatar = height >= 56 && Boolean(item.lead_name)
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        height,
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
          paddingHorizontal: 10,
          paddingVertical: compact ? 2 : 6,
          flexDirection: compact ? 'row' : 'column',
          alignItems: compact ? 'center' : 'flex-start',
          gap: compact ? 8 : 2,
          overflow: 'hidden',
        }}
      >
        {compact ? (
          // Mode compact (<32px) : tout sur une ligne
          <>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: colors.textPrimary,
                letterSpacing: -0.2,
              }}
            >
              {formatTime(item.scheduled_at)}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                fontSize: 12,
                fontWeight: '600',
                color: colors.textPrimary,
              }}
            >
              {item.title}
            </Text>
            <Text style={{ fontSize: 10, fontWeight: '700', color }}>
              {labelForKind(item).toUpperCase()}
            </Text>
            {isNoShow ? (
              <Ionicons name="alert-circle" size={11} color={colors.warning} />
            ) : isDone ? (
              <Ionicons name="checkmark-circle" size={11} color={colors.primary} />
            ) : null}
          </>
        ) : (
          // Mode normal : titre stack
          <>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                width: '100%',
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: colors.textPrimary,
                  letterSpacing: -0.2,
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
                <Ionicons name="alert-circle" size={12} color={colors.warning} />
              ) : isDone ? (
                <Ionicons name="checkmark-circle" size={12} color={colors.primary} />
              ) : null}
              {showAvatar ? <Avatar name={item.lead_name!} size={20} /> : null}
            </View>
            <Text
              numberOfLines={1}
              style={{
                fontSize: medium ? 13 : 14,
                fontWeight: '600',
                color: colors.textPrimary,
                letterSpacing: -0.2,
                marginTop: 2,
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
    </Pressable>
  )
}

function NowLine({ now, startHour }: { now: Date; startHour: number }) {
  const h = now.getHours() + now.getMinutes() / 60
  const top = (h - startHour) * HOUR_HEIGHT
  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: spacing.lg,
        top: top - 1,
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
  )
}
