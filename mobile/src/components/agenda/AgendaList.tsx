import React, { useMemo } from 'react'
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { AgendaItem } from '../../types/agenda'
import { Avatar } from '../ui/Avatar'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'

interface Props {
  items: AgendaItem[]
  date: Date
  loading?: boolean
  onRefresh?: () => void
  onPressItem: (item: AgendaItem) => void
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

function labelForKind(item: AgendaItem): string {
  if (item.kind === 'closing') return 'Closing'
  if (item.kind === 'setting') return 'Setting'
  if (item.kind === 'personal') return 'Perso'
  return 'Booking'
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function formatDuration(min: number): string {
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

function formatAmount(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n)
}

/**
 * AgendaList — vue liste flat des events du jour. Plus lisible que la
 * timeline pour les jours chargés (>5 events). Group par tranche horaire
 * (matin / après-midi / soir) avec sticky-ish headers.
 */
export function AgendaList({ items, loading, onRefresh, onPressItem }: Props) {
  const sections = useMemo(() => {
    const morning: AgendaItem[] = []
    const afternoon: AgendaItem[] = []
    const evening: AgendaItem[] = []
    for (const it of items) {
      const h = new Date(it.scheduled_at).getHours()
      if (h < 12) morning.push(it)
      else if (h < 18) afternoon.push(it)
      else evening.push(it)
    }
    return [
      { label: 'Matin', items: morning },
      { label: 'Après-midi', items: afternoon },
      { label: 'Soir', items: evening },
    ].filter((s) => s.items.length > 0)
  }, [items])

  const now = Date.now()

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: spacing.lg }}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={loading ?? false}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        ) : undefined
      }
    >
      {sections.map((section, idx) => (
        <View key={section.label} style={{ marginTop: idx === 0 ? 0 : spacing.lg }}>
          <Text
            style={{
              ...t.caption2,
              color: colors.textTertiary,
              textTransform: 'uppercase',
              fontWeight: '700',
              letterSpacing: 0.6,
              marginBottom: spacing.sm,
              paddingHorizontal: 4,
            }}
          >
            {section.label} · {section.items.length}
          </Text>
          <View
            style={{
              backgroundColor: colors.bgSecondary,
              borderRadius: radius.lg,
              overflow: 'hidden',
            }}
          >
            {section.items.map((item, i) => (
              <ListRow
                key={item.id}
                item={item}
                isLast={i === section.items.length - 1}
                isPast={new Date(item.scheduled_at).getTime() < now}
                onPress={() => onPressItem(item)}
              />
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  )
}

function ListRow({
  item,
  isLast,
  isPast,
  onPress,
}: {
  item: AgendaItem
  isLast: boolean
  isPast: boolean
  onPress: () => void
}) {
  const color = colorForItem(item)
  const isDone = item.outcome === 'done'
  const isNoShow = item.outcome === 'no_show'
  const opacity = isDone ? 0.55 : isPast ? 0.85 : 1

  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 12,
            paddingHorizontal: spacing.md,
            borderBottomWidth: isLast ? 0 : 0.33,
            borderBottomColor: colors.border,
            opacity: pressed ? opacity * 0.7 : opacity,
            gap: spacing.md,
          }}
        >
          {/* Time gutter */}
          <View style={{ width: 56, alignItems: 'flex-start' }}>
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: 16,
                fontWeight: '700',
                letterSpacing: -0.3,
              }}
            >
              {formatTime(item.scheduled_at)}
            </Text>
            <Text
              style={{
                ...t.caption2,
                color: colors.textTertiary,
                marginTop: 2,
              }}
            >
              {formatDuration(item.duration_minutes)}
            </Text>
          </View>

          {/* Color bar */}
          <View
            style={{
              width: 3,
              alignSelf: 'stretch',
              backgroundColor: color,
              borderRadius: 1.5,
            }}
          />

          {/* Avatar (if lead) */}
          {item.lead_name ? (
            <Avatar name={item.lead_name} size={36} />
          ) : (
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
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
                size={16}
                color={color}
              />
            </View>
          )}

          {/* Content */}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{
                color: colors.textPrimary,
                fontSize: 15,
                fontWeight: '600',
                letterSpacing: -0.24,
              }}
            >
              {item.title}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                marginTop: 3,
              }}
            >
              <View
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 2.5,
                  backgroundColor: color,
                }}
              />
              <Text
                style={{
                  ...t.caption1,
                  color,
                  fontWeight: '700',
                }}
              >
                {labelForKind(item)}
              </Text>
              {item.location_name ? (
                <Text
                  numberOfLines={1}
                  style={{
                    ...t.caption1,
                    color: colors.textSecondary,
                    flex: 1,
                  }}
                >
                  · {item.location_name}
                </Text>
              ) : null}
              {isNoShow ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Ionicons name="alert-circle" size={11} color={colors.warning} />
                  <Text
                    style={{
                      ...t.caption2,
                      color: colors.warning,
                      fontWeight: '600',
                    }}
                  >
                    Absent
                  </Text>
                </View>
              ) : null}
              {isDone ? (
                <Ionicons name="checkmark-circle" size={11} color={colors.primary} />
              ) : null}
            </View>
          </View>

          {/* Amount */}
          {item.amount ? (
            <Text
              style={{
                color: colors.primary,
                fontSize: 15,
                fontWeight: '800',
                letterSpacing: -0.24,
                marginLeft: 4,
              }}
            >
              {formatAmount(item.amount)}
            </Text>
          ) : null}

          <Ionicons
            name="chevron-forward"
            size={16}
            color={colors.textTertiary}
            style={{ marginLeft: 4 }}
          />
        </View>
      )}
    </Pressable>
  )
}
