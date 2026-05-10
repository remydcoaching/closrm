import React, { useEffect, useMemo, useRef } from 'react'
import { View, Text, ScrollView, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { AgendaItem } from '../../types/agenda'
import { Avatar } from '../ui/Avatar'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'

const HOUR_LABEL_WIDTH = 56
const HOUR_ROW_HEIGHT = 64 // hauteur de l'espace par heure dans la grille (pour le rendu visuel)
// Heures affichées dans la grille — minimum 6h, étendu si events en dehors.
const DEFAULT_START_HOUR = 6
const DEFAULT_END_HOUR = 23

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
 * Timeline agenda en mode "grille horaire avec events groupés par heure".
 *
 * Choix de design : on abandonne le positionnement absolu pixel-perfect
 * (qui marchait pas avec des données denses ou bizarres) au profit d'une
 * liste groupée par heure. Chaque heure = 1 ligne avec son label à gauche
 * et les events qui démarrent dans cette heure stackés à droite. Plus
 * jamais de bug de chevauchement visuel ou de stack à 06h.
 */
export function AgendaTimeline({ items, date, onPressItem }: Props) {
  // Plage horaire dynamique : 6h-23h par défaut, étendue si events en dehors.
  const { startHour, endHour } = useMemo(() => {
    let minH = DEFAULT_START_HOUR
    let maxH = DEFAULT_END_HOUR
    for (const it of items) {
      const start = new Date(it.scheduled_at)
      const startH = start.getHours()
      if (startH < minH) minH = Math.max(0, startH)
      if (startH > maxH) maxH = Math.min(23, startH)
    }
    return { startHour: minH, endHour: maxH }
  }, [items])

  // Group events par heure de début. Plusieurs events à la même heure → ils
  // stackent verticalement dans le bloc de l'heure.
  const eventsByHour = useMemo(() => {
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

  const isToday = sameDay(date, new Date())
  const nowHour = isToday ? new Date().getHours() + new Date().getMinutes() / 60 : null

  // Auto-scroll : aujourd'hui vers l'heure courante, sinon vers le 1er event.
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
    const y = (targetHour - startHour) * HOUR_ROW_HEIGHT
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
      {hours.map((h, idx) => {
        const events = eventsByHour.get(h) ?? []
        const isCurrentHour = nowHour != null && Math.floor(nowHour) === h
        return (
          <View
            key={h}
            style={{
              flexDirection: 'row',
              minHeight: HOUR_ROW_HEIGHT,
              borderTopWidth: idx === 0 ? 0 : 0.33,
              borderTopColor: colors.border,
              paddingVertical: 6,
              paddingRight: spacing.lg,
            }}
          >
            {/* Hour label */}
            <View
              style={{
                width: HOUR_LABEL_WIDTH,
                paddingTop: 2,
                paddingRight: spacing.sm,
                alignItems: 'flex-end',
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: isCurrentHour ? '700' : '500',
                  color: isCurrentHour ? colors.danger : colors.textTertiary,
                  letterSpacing: 0.4,
                }}
              >
                {String(h).padStart(2, '0')}:00
              </Text>
              {isCurrentHour ? (
                <View
                  style={{
                    marginTop: 4,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    backgroundColor: colors.danger,
                    borderRadius: 6,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 9,
                      fontWeight: '700',
                      color: '#fff',
                      letterSpacing: 0.5,
                    }}
                  >
                    NOW
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Events column */}
            <View style={{ flex: 1, gap: 6 }}>
              {events.length === 0 ? (
                <View style={{ height: HOUR_ROW_HEIGHT - 12 }} />
              ) : (
                events.map((item) => (
                  <EventCard key={item.id} item={item} onPress={() => onPressItem(item)} />
                ))
              )}
            </View>
          </View>
        )
      })}
    </ScrollView>
  )
}

function EventCard({ item, onPress }: { item: AgendaItem; onPress: () => void }) {
  const color = colorForItem(item)
  const isDone = item.outcome === 'done'
  const isNoShow = item.outcome === 'no_show'
  const lead = item.lead_name
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: isDone ? 0.55 : pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          backgroundColor: color + '22',
          borderWidth: 1,
          borderColor: color + '44',
          borderLeftWidth: 4,
          borderLeftColor: color,
          borderRadius: 10,
          padding: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        }}
      >
        {/* Time */}
        <View style={{ minWidth: 50 }}>
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 14,
              fontWeight: '700',
              letterSpacing: -0.2,
            }}
          >
            {formatTime(item.scheduled_at)}
          </Text>
          <Text style={{ ...t.caption2, color: colors.textTertiary, fontWeight: '500' }}>
            {formatDuration(item.duration_minutes)}
          </Text>
        </View>

        {/* Avatar (lead) ou icône (perso) */}
        {lead ? (
          <Avatar name={lead} size={30} />
        ) : (
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: color + '33',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons
              name={
                item.kind === 'personal'
                  ? 'person-outline'
                  : item.source === 'call'
                    ? 'call'
                    : 'calendar-outline'
              }
              size={14}
              color={color}
            />
          </View>
        )}

        {/* Title + label */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{
              color: colors.textPrimary,
              fontSize: 14,
              fontWeight: '600',
              letterSpacing: -0.2,
            }}
          >
            {item.title}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              marginTop: 2,
            }}
          >
            <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: color }} />
            <Text
              numberOfLines={1}
              style={{
                fontSize: 11,
                color,
                fontWeight: '700',
                letterSpacing: 0.2,
              }}
            >
              {labelForKind(item)}
            </Text>
            {item.location_name ? (
              <Text
                numberOfLines={1}
                style={{
                  ...t.caption2,
                  color: colors.textSecondary,
                  flex: 1,
                }}
              >
                · {item.location_name}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Statuts visuels */}
        {isNoShow ? (
          <Ionicons name="alert-circle" size={14} color={colors.warning} />
        ) : isDone ? (
          <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
        ) : null}
      </View>
    </Pressable>
  )
}
