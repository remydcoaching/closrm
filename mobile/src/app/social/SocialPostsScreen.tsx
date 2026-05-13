import React, { useMemo, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Pressable,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import type { MoreStackParamList } from '../../navigation/types'
import { useSocialPosts } from '../../hooks/useSocialPosts'
import { NavLarge, FilterChips, FAB } from '../../components/ui'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'
import {
  PLATFORM_ICONS,
  STATUS_LABELS,
  type SocialPostStatus,
  type SocialPostWithPublications,
} from '../../types/social'

type Nav = NativeStackNavigationProp<MoreStackParamList, 'SocialPosts'>

type Filter = 'upcoming' | 'all' | 'draft' | 'published' | 'failed'

const FILTER_LABELS: { key: Filter; label: string }[] = [
  { key: 'upcoming', label: 'À venir' },
  { key: 'all', label: 'Tous' },
  { key: 'draft', label: 'Brouillons' },
  { key: 'published', label: 'Publiés' },
  { key: 'failed', label: 'Échecs' },
]

const STATUS_TINT: Record<SocialPostStatus, string> = {
  draft: '#9ca3af',
  scheduled: '#3b82f6',
  publishing: '#f59e0b',
  published: '#22c55e',
  partial: '#f97316',
  failed: '#ef4444',
}

const formatDayHeader = (iso: string): string => {
  const d = new Date(iso + 'T12:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(d)
  target.setHours(0, 0, 0, 0)
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000)
  if (diffDays === 0) return "Aujourd'hui"
  if (diffDays === 1) return 'Demain'
  if (diffDays === -1) return 'Hier'
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

const formatTime = (iso: string | null): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2, '0')}h${d
    .getMinutes()
    .toString()
    .padStart(2, '0')}`
}

const isoLocal = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function SocialPostsScreen() {
  const navigation = useNavigation<Nav>()
  const [filter, setFilter] = useState<Filter>('upcoming')

  const fetchParams = useMemo(() => {
    if (filter === 'upcoming') {
      const today = new Date()
      const inTwoMonths = new Date()
      inTwoMonths.setMonth(today.getMonth() + 2)
      return { planDateFrom: isoLocal(today), planDateTo: isoLocal(inTwoMonths) }
    }
    if (filter === 'draft') return { status: 'draft' }
    if (filter === 'published') return { status: 'published' }
    if (filter === 'failed') return { status: 'failed' }
    return {}
  }, [filter])

  const { posts, loading, error, refetch } = useSocialPosts(fetchParams)

  // Groupe par plan_date (ou date du scheduled_at si pas de plan_date)
  const grouped = useMemo(() => {
    const map = new Map<string, SocialPostWithPublications[]>()
    for (const p of posts) {
      const key =
        p.plan_date ??
        (p.scheduled_at ? isoLocal(new Date(p.scheduled_at)) : '0000-00-00')
      const arr = map.get(key) ?? []
      arr.push(p)
      map.set(key, arr)
    }
    // Sort each group by scheduled_at ascending then slot_index
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        const ta = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0
        const tb = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0
        if (ta !== tb) return ta - tb
        return (a.slot_index ?? 0) - (b.slot_index ?? 0)
      })
    }
    return Array.from(map.entries())
      .filter(([k]) => k !== '0000-00-00' || filter !== 'upcoming')
      .sort((a, b) => a[0].localeCompare(b[0]))
  }, [posts, filter])

  const filterIdx = FILTER_LABELS.findIndex((f) => f.key === filter)

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
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => navigation.navigate('ReelsJourJ', { reelIds: null })}
          hitSlop={8}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: colors.primary + '22',
          }}
        >
          <Text style={{ ...t.caption1, color: colors.primary, fontWeight: '700' }}>
            🎬 Jour J
          </Text>
        </Pressable>
      </View>

      <NavLarge title="Réseaux sociaux" subtitle="Calendrier de publication" />

      <View style={{ marginBottom: spacing.md }}>
        <FilterChips
          items={FILTER_LABELS.map((f) => ({ label: f.label }))}
          activeIndex={Math.max(0, filterIdx)}
          onChange={(i) => setFilter(FILTER_LABELS[i].key)}
        />
      </View>

      {loading && posts.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
          <Text style={{ ...t.body, color: colors.danger, textAlign: 'center' }}>
            {error}
          </Text>
          <Pressable
            onPress={() => void refetch()}
            style={{
              marginTop: spacing.md,
              paddingHorizontal: spacing.lg,
              paddingVertical: 10,
              backgroundColor: colors.bgSecondary,
              borderRadius: radius.md,
            }}
          >
            <Text style={{ ...t.subheadline, color: colors.textPrimary }}>Réessayer</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: 120,
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
              Aucun post.
            </Text>
          ) : (
            grouped.map(([day, arr]) => (
              <View key={day} style={{ gap: spacing.sm }}>
                <Text
                  style={{
                    ...t.footnote,
                    color: colors.textSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                    fontWeight: '700',
                  }}
                >
                  {formatDayHeader(day)}
                </Text>
                <View
                  style={{
                    backgroundColor: colors.bgSecondary,
                    borderRadius: radius.lg,
                    overflow: 'hidden',
                  }}
                >
                  {arr.map((p, idx) => (
                    <PostRow
                      key={p.id}
                      post={p}
                      separator={idx < arr.length - 1}
                      onPress={() =>
                        navigation.navigate('SocialPostDetail', { postId: p.id })
                      }
                    />
                  ))}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <FAB icon="add" onPress={() => navigation.navigate('SocialPostForm', {})} />
    </SafeAreaView>
  )
}

function PostRow({
  post,
  separator,
  onPress,
}: {
  post: SocialPostWithPublications
  separator: boolean
  onPress: () => void
}) {
  const tint = STATUS_TINT[post.status] ?? colors.textSecondary
  const platforms = post.publications.map((p) => p.platform)
  const time = formatTime(post.scheduled_at)
  const title =
    post.title ||
    post.hook ||
    (post.caption ? post.caption.slice(0, 80) : 'Sans titre')

  // Pattern strict CallSlot : Pressable porte juste opacité, View interne
  // fait le layout. Sinon RN casse parfois le flexDirection du style fonction.
  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <View
          style={{
            paddingHorizontal: spacing.md,
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            opacity: pressed ? 0.6 : 1,
            borderBottomWidth: separator ? 0.33 : 0,
            borderBottomColor: colors.border,
          }}
        >
          {/* Gutter heure — large 56px, aligné à droite */}
          <View style={{ width: 56, alignItems: 'flex-end' }}>
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: 17,
                fontWeight: '700',
                letterSpacing: -0.4,
              }}
            >
              {time}
            </Text>
          </View>

          {/* Bordure gauche colorée selon statut */}
          <View
            style={{
              width: 3,
              alignSelf: 'stretch',
              backgroundColor: tint,
              borderRadius: 1.5,
            }}
          />

          {/* Contenu — title + platforms inline */}
          <View style={{ flex: 1, gap: 3 }}>
            <Text
              numberOfLines={1}
              style={{
                ...t.bodyEmphasis,
                color: colors.textPrimary,
              }}
            >
              {title}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text
                style={{
                  ...t.caption2,
                  color: tint,
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                }}
              >
                {STATUS_LABELS[post.status]}
              </Text>
              {platforms.length > 0 ? (
                <View style={{ flexDirection: 'row', gap: 5 }}>
                  {platforms.map((pl) => (
                    <Ionicons
                      key={pl}
                      name={PLATFORM_ICONS[pl]}
                      size={12}
                      color={colors.textSecondary}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          </View>

          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        </View>
      )}
    </Pressable>
  )
}
