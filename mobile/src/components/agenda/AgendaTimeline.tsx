import React, { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, ScrollView, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { AgendaItem } from '../../types/agenda'
import { Avatar } from '../ui/Avatar'
import { colors } from '../../theme/colors'
import { type as t, spacing } from '../../theme/tokens'

// Grille horaire FIXE : 1 heure = 100 pt. Toujours.
// Les events sont positionnés en absolu PAR-DESSUS la grille, avec :
//   top = (startMin / 60 - startHour) * 100
//   height = (durationMin / 60) * 100 - 2  (proportionnel à la durée)
// → un 2h fait vraiment 198pt, un 1h fait 98pt, etc. Plus de compression.
const HOUR_HEIGHT = 100
const HOUR_LABEL_WIDTH = 56
const DEFAULT_START_HOUR = 6
const DEFAULT_END_HOUR = 23
const MIN_CARD_HEIGHT = 24
// Plafond de lanes — 2 pour garder les cards lisibles à 50% width quand
// plusieurs events se chevauchent.
const MAX_LANES = 2

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
  const slots: Slot[] = items
    .map((item) => {
      const start = new Date(item.scheduled_at)
      // Defensive : invalid date → skip cet item plutôt que de l'afficher à NaN.
      if (Number.isNaN(start.getTime())) {
        return null
      }
      const startMin = start.getHours() * 60 + start.getMinutes()
      const top = (startMin / 60 - startHour) * HOUR_HEIGHT
      const durMin =
        Number.isFinite(item.duration_minutes) && item.duration_minutes > 0
          ? item.duration_minutes
          : 30
      const naturalH = (durMin / 60) * HOUR_HEIGHT - 2
      const height = Math.max(MIN_CARD_HEIGHT, naturalH)
      return { item, top, height, bottom: top + height, lane: 0, group: -1 }
    })
    .filter((s): s is Slot => s !== null)
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
  // Plage horaire DATA-DRIVEN. On filtre les items invalides AVANT pour ne
  // pas polluer le calcul. Si aucun event valide → fallback defaults.
  // Si c'est aujourd'hui, on inclut l'heure actuelle dans la plage pour que
  // la NOW line s'affiche correctement.
  const { startHour, endHour } = useMemo(() => {
    const valid = items.filter((it) => {
      const d = new Date(it.scheduled_at)
      return (
        !Number.isNaN(d.getTime()) &&
        Number.isFinite(it.duration_minutes) &&
        it.duration_minutes > 0
      )
    })
    const isTodayCheck = sameDay(date, new Date())
    if (valid.length === 0) {
      return { startHour: DEFAULT_START_HOUR, endHour: DEFAULT_END_HOUR }
    }
    let minH = 24
    let maxH = 0
    for (const it of valid) {
      const start = new Date(it.scheduled_at)
      const startH = start.getHours() + start.getMinutes() / 60
      const endH = startH + it.duration_minutes / 60
      if (startH < minH) minH = startH
      if (endH > maxH) maxH = endH
    }
    // Si aujourd'hui, force la plage à englober l'heure courante (pour la NOW line).
    if (isTodayCheck) {
      const nowH = new Date().getHours() + new Date().getMinutes() / 60
      if (nowH < minH) minH = nowH
      if (nowH > maxH) maxH = nowH
    }
    return {
      startHour: Math.max(0, Math.floor(minH) - 1),
      endHour: Math.min(23, Math.ceil(maxH) + 1),
    }
  }, [items, date])
  const totalHeight = (endHour - startHour + 1) * HOUR_HEIGHT

  const positioned = useMemo(() => layoutItems(items, startHour), [items, startHour])

  // [TIMELINE DIAG 2026-05-15] log seulement quand les données changent
  // (pas à chaque render) + détection d'anomalie (event hors-bornes).
  useEffect(() => {
    const diag = {
      itemsCount: items.length,
      itemsRaw: items.map((it) => ({
        id: it.id,
        scheduled_at: it.scheduled_at,
        duration_minutes: it.duration_minutes,
        kind: it.kind,
        title: it.title,
      })),
      startHour,
      endHour,
      totalHeight,
      positionedCount: positioned.length,
      positioned: positioned.map((p) => ({
        id: p.item.id,
        title: p.item.title,
        top: p.top,
        height: p.height,
        bottom: p.top + p.height,
      })),
    }
    // eslint-disable-next-line no-console
    console.log('[timeline-diag]', JSON.stringify(diag))
    // Détection d'anomalie : event positionné hors-bornes du container.
    const outOfBounds = positioned.filter(
      (p) => p.top < 0 || p.top + p.height > totalHeight
    )
    if (outOfBounds.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        '[timeline-diag] OUT OF BOUNDS events',
        JSON.stringify({
          totalHeight,
          startHour,
          endHour,
          offenders: outOfBounds.map((p) => ({
            id: p.item.id,
            title: p.item.title,
            scheduled_at: p.item.scheduled_at,
            top: p.top,
            height: p.height,
          })),
        })
      )
    }
  }, [items, startHour, endHour, totalHeight, positioned])

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

  // Auto-scroll — on calcule la cible mais on attend que ScrollView ait
  // mesuré son content (onContentSizeChange) avant de scroller. Évite le
  // bug du setTimeout qui peut firer avant que la layout soit prête →
  // scrollTo clampé à 0 silencieusement.
  const scrollRef = useRef<ScrollView>(null)
  const hasAutoScrolledRef = useRef(false)
  const autoScrollTargetY = useMemo(() => {
    let target: number
    if (isToday) target = Math.max(startHour, new Date().getHours() - 1)
    else if (items.length > 0) {
      const first = Math.min(
        ...items
          .map((it) => new Date(it.scheduled_at).getHours())
          .filter((h) => !Number.isNaN(h))
      )
      target = Number.isFinite(first) ? Math.max(startHour, first - 1) : Math.max(startHour, 8)
    } else target = Math.max(startHour, 8)
    return (target - startHour) * HOUR_HEIGHT
  }, [isToday, items, startHour])

  // Reset le flag d'auto-scroll quand la date ou la plage change.
  useEffect(() => {
    hasAutoScrolledRef.current = false
  }, [date, startHour])

  const handleContentSizeChange = (_w: number, h: number) => {
    if (hasAutoScrolledRef.current) return
    if (h < autoScrollTargetY) return // pas encore prêt
    hasAutoScrolledRef.current = true
    scrollRef.current?.scrollTo({ y: autoScrollTargetY, animated: false })
  }

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
      onContentSizeChange={handleContentSizeChange}
    >
      <View
        style={{
          height: totalHeight,
          position: 'relative',
          paddingRight: spacing.lg,
          overflow: 'hidden',
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

        {/* Events absolument positionnés au-dessus de la grille.
            height explicite (au lieu de top:0/bottom:0) pour éviter les
            quirks de layout RN qui peuvent positionner les events hors
            de la grille en cas de scroll/parent layout étrange. */}
        <View
          style={{
            position: 'absolute',
            left: HOUR_LABEL_WIDTH,
            right: spacing.lg,
            top: 0,
            height: totalHeight,
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
        minHeight: height,
        maxHeight: height,
        paddingRight: lane < laneCount - 1 ? 3 : 0,
        opacity: isDone ? 0.55 : pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          height: '100%',
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
