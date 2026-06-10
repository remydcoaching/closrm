import React, { useMemo, useState } from 'react'
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { useNotifications } from '../../hooks/useNotifications'
import { NavLarge, FilterChips } from '../../components/ui'
import { colors } from '../../theme/colors'
import { type as t, spacing } from '../../theme/tokens'
import type { AppNotification, AppNotificationType } from '@shared/types'

const FILTERS = ['Tout', 'Deals', 'Leads', 'No-shows', 'Rappels'] as const

const matchFilter = (n: AppNotification, idx: number): boolean => {
  if (idx === 0) return true
  if (idx === 1) return n.type === 'deal_closed'
  if (idx === 2) return n.type === 'new_lead'
  if (idx === 3) return n.type === 'no_show'
  if (idx === 4) return n.type === 'call_reminder' || n.type === 'booking'
  return true
}

const iconAndColor = (
  type: AppNotificationType,
): { icon: keyof typeof Ionicons.glyphMap; color: string } => {
  switch (type) {
    case 'new_lead':
      return { icon: 'person-add', color: colors.info }
    case 'no_show':
      return { icon: 'alert-circle', color: colors.danger }
    case 'deal_closed':
      return { icon: 'cash', color: colors.primary }
    case 'dm_reply':
      return { icon: 'chatbubble-ellipses', color: colors.pink }
    case 'call_reminder':
      return { icon: 'time', color: colors.warning }
    case 'booking':
      return { icon: 'calendar', color: colors.purple }
  }
}

const formatRelative = (iso: string): string => {
  const d = new Date(iso)
  const diffMin = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000))
  if (diffMin < 1) return 'maintenant'
  if (diffMin < 60) return `${diffMin}min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `${diffH}h`
  const diffD = Math.round(diffH / 24)
  return `${diffD}j`
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

const dayLabel = (d: Date): string => {
  const today = new Date()
  if (sameDay(d, today)) return "Aujourd'hui"
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (sameDay(d, yesterday)) return 'Hier'
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

function NotifChip({ n }: { n: AppNotification }) {
  const { icon, color } = iconAndColor(n.type)
  const unread = !n.read

  return (
    <Pressable>
      {({ pressed }) => (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 999,
            backgroundColor: color + '14',
            borderWidth: 1,
            borderColor: color + '30',
            opacity: pressed ? 0.7 : 1,
          }}
        >
          {/* Icon box */}
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: color + '33',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 10,
            }}
          >
            <Ionicons name={icon} size={18} color={color} />
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{
                color: colors.textPrimary,
                fontSize: 15,
                fontWeight: unread ? '700' : '600',
                letterSpacing: -0.24,
              }}
            >
              {n.title}
            </Text>
            {n.subtitle ? (
              <Text
                numberOfLines={1}
                style={{
                  color: colors.textSecondary,
                  fontSize: 13,
                  marginTop: 2,
                }}
              >
                {n.subtitle}
              </Text>
            ) : null}
          </View>

          <View style={{ alignItems: 'flex-end', gap: 4, marginLeft: 8 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '500' }}>
              {formatRelative(n.created_at)}
            </Text>
            {unread ? (
              <View
                style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }}
              />
            ) : null}
          </View>
        </View>
      )}
    </Pressable>
  )
}

export function NotificationsScreen() {
  const navigation = useNavigation()
  const { notifications, loading, refetch, markAllRead } = useNotifications()
  const [filterIdx, setFilterIdx] = useState(0)

  const filtered = useMemo(
    () => notifications.filter((n) => matchFilter(n, filterIdx)),
    [notifications, filterIdx],
  )

  const grouped = useMemo(() => {
    const map = new Map<string, AppNotification[]>()
    for (const n of filtered) {
      const d = new Date(n.created_at)
      const key = dayLabel(d)
      const arr = map.get(key) ?? []
      arr.push(n)
      map.set(key, arr)
    }
    return Array.from(map.entries())
  }, [filtered])

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        }}
      >
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{ padding: 4 }}>
          <Ionicons name="chevron-back" size={28} color={colors.primary} />
        </Pressable>
        {unreadCount > 0 ? (
          <Pressable
            onPress={markAllRead}
            hitSlop={12}
            style={{ marginLeft: 'auto', padding: 4 }}
          >
            <Text style={{ ...t.body, color: colors.primary }}>Tout lu</Text>
          </Pressable>
        ) : null}
      </View>

      <NavLarge
        title="Activité"
        subtitle={`${unreadCount} non lue${unreadCount > 1 ? 's' : ''} · ${filtered.length} notification${filtered.length > 1 ? 's' : ''}`}
      />

      <View style={{ marginBottom: spacing.lg }}>
        <FilterChips
          items={FILTERS.map((f) => ({ label: f }))}
          activeIndex={filterIdx}
          onChange={setFilterIdx}
        />
      </View>

      {loading && notifications.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: 80,
            gap: spacing.lg,
          }}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refetch} tintColor={colors.primary} />
          }
        >
          {grouped.length === 0 ? (
            <Text
              style={{
                ...t.subheadline,
                color: colors.textSecondary,
                textAlign: 'center',
                paddingVertical: 60,
              }}
            >
              Aucune notification.
            </Text>
          ) : (
            grouped.map(([day, items]) => (
              <View key={day} style={{ gap: 10 }}>
                <Text
                  style={{
                    ...t.footnote,
                    color: colors.textSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    marginLeft: 8,
                  }}
                >
                  {day}
                </Text>
                {items.map((n) => (
                  <NotifChip key={n.id} n={n} />
                ))}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
