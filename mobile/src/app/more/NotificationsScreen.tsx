import React, { useMemo, useState } from 'react'
import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { useNotifications } from '../../hooks/useNotifications'
import { NavLarge, NavIcon, FilterChips, Divider } from '../../components/ui'
import { colors } from '../../theme/colors'
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

const cta = (type: AppNotificationType): string | null => {
  switch (type) {
    case 'no_show':
      return 'Reprogrammer'
    case 'deal_closed':
      return 'Voir le deal'
    case 'dm_reply':
      return 'Ouvrir'
    default:
      return null
  }
}

const formatRelative = (iso: string): string => {
  const d = new Date(iso)
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000)
  if (diffMin < 1) return 'maintenant'
  if (diffMin < 60) return `${diffMin}min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `${diffH}h`
  const diffD = Math.round(diffH / 24)
  return `${diffD}j`
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

const dayLabel = (d: Date): string => {
  const today = new Date()
  if (sameDay(d, today)) return "AUJOURD'HUI"
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (sameDay(d, yesterday)) return 'HIER'
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }).toUpperCase()
}

export function NotificationsScreen() {
  const navigation = useNavigation()
  const { notifications, loading, refetch, markAllRead } = useNotifications()
  const [filterIdx, setFilterIdx] = useState(0)

  const filtered = useMemo(
    () => notifications.filter((n) => matchFilter(n, filterIdx)),
    [notifications, filterIdx],
  )

  // Group par jour avec headers
  const items = useMemo(() => {
    const out: ({ kind: 'header'; label: string; key: string } | { kind: 'notif'; n: AppNotification })[] = []
    let lastDay: Date | null = null
    for (const n of filtered) {
      const d = new Date(n.created_at)
      if (!lastDay || !sameDay(d, lastDay)) {
        out.push({ kind: 'header', label: dayLabel(d), key: `h-${d.toDateString()}` })
        lastDay = d
      }
      out.push({ kind: 'notif', n })
    }
    return out
  }, [filtered])

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }}>
        <NavIcon onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </NavIcon>
        <View style={{ flex: 1, marginLeft: 4 }}>
          <NavLarge
            title="Activité"
            subtitle={`${unreadCount} non lue${unreadCount > 1 ? 's' : ''} · ${filtered.length} aujourd'hui`}
          />
        </View>
      </View>

      <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginBottom: 10, gap: 8 }}>
        <View style={{ flex: 1 }}>
          <FilterChips
            items={FILTERS.map((f) => ({ label: f }))}
            activeIndex={filterIdx}
            onChange={setFilterIdx}
          />
        </View>
        {unreadCount > 0 ? (
          <Pressable onPress={markAllRead} style={{ paddingHorizontal: 8, justifyContent: 'center' }}>
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>
              Tout lu
            </Text>
          </Pressable>
        ) : null}
      </View>

      {loading && notifications.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => (it.kind === 'header' ? it.key : it.n.id)}
          ItemSeparatorComponent={({ leadingItem }: { leadingItem?: { kind: string } }) =>
            leadingItem?.kind === 'header' ? null : <Divider marginHorizontal={16} />
          }
          contentContainerStyle={{ paddingBottom: 80 }}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refetch} tintColor={colors.primary} />
          }
          renderItem={({ item }) => {
            if (item.kind === 'header') {
              return (
                <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>
                    {item.label}
                  </Text>
                </View>
              )
            }
            const n = item.n
            const { icon, color } = iconAndColor(n.type)
            const ctaLabel = cta(n.type)
            return (
              <Pressable
                style={({ pressed }) => ({
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  flexDirection: 'row',
                  gap: 12,
                  backgroundColor: pressed ? colors.bgElevated : 'transparent',
                })}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: color + '22',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name={icon} size={18} color={color} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontSize: 14,
                        fontWeight: n.read ? '400' : '700',
                        flex: 1,
                      }}
                      numberOfLines={1}
                    >
                      {n.title}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                      {formatRelative(n.created_at)}
                    </Text>
                  </View>
                  {n.subtitle ? (
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                      {n.subtitle}
                    </Text>
                  ) : null}
                  {ctaLabel ? (
                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600', marginTop: 2 }}>
                      {ctaLabel} →
                    </Text>
                  ) : null}
                </View>
                {!n.read ? (
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: colors.primary,
                      alignSelf: 'center',
                    }}
                  />
                ) : null}
              </Pressable>
            )
          }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                Aucune notification.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}
