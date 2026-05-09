import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import type { MoreStackParamList } from '../../navigation/types'
import { Button, NavLarge } from '../../components/ui'
import { api } from '../../services/api'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'
import {
  PLATFORM_ICONS,
  PLATFORM_LABELS,
  STATUS_LABELS,
  type SocialPostStatus,
  type SocialPostWithPublications,
} from '../../types/social'

type Nav = NativeStackNavigationProp<MoreStackParamList, 'SocialPostDetail'>
type Rt = RouteProp<MoreStackParamList, 'SocialPostDetail'>

const STATUS_TINT: Record<SocialPostStatus, string> = {
  draft: '#9ca3af',
  scheduled: '#3b82f6',
  publishing: '#f59e0b',
  published: '#22c55e',
  partial: '#f97316',
  failed: '#ef4444',
}

const formatDateTime = (iso: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })} · ${d.getHours().toString().padStart(2, '0')}h${d
    .getMinutes()
    .toString()
    .padStart(2, '0')}`
}

export function SocialPostDetailScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Rt>()
  const { postId } = route.params

  const [post, setPost] = useState<SocialPostWithPublications | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acting, setActing] = useState(false)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<{ data: SocialPostWithPublications }>(
        `/api/social/posts/${postId}`,
      )
      setPost(res.data ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement')
    } finally {
      setLoading(false)
    }
  }, [postId])

  useEffect(() => {
    void fetch()
  }, [fetch])

  const handleDelete = () => {
    Alert.alert('Supprimer ce post ?', 'Action irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          setActing(true)
          try {
            await api.delete(`/api/social/posts/${postId}`)
            navigation.goBack()
          } catch (e) {
            Alert.alert('Erreur', e instanceof Error ? e.message : 'Échec')
          } finally {
            setActing(false)
          }
        },
      },
    ])
  }

  const handleRetry = async () => {
    setActing(true)
    try {
      await api.post(`/api/social/posts/${postId}/retry`, {})
      await fetch()
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Échec')
    } finally {
      setActing(false)
    }
  }

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
      </View>

      <NavLarge title="Détail post" />

      {loading && !post ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
          <Text style={{ ...t.body, color: colors.danger, textAlign: 'center' }}>
            {error}
          </Text>
        </View>
      ) : post ? (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: 120,
            gap: spacing.lg,
          }}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={fetch} tintColor={colors.primary} />
          }
        >
          {/* Status badge */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
            }}
          >
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: STATUS_TINT[post.status] + '22',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: STATUS_TINT[post.status],
                }}
              />
              <Text
                style={{
                  ...t.caption1,
                  color: STATUS_TINT[post.status],
                  fontWeight: '700',
                }}
              >
                {STATUS_LABELS[post.status]}
              </Text>
            </View>
          </View>

          {/* Title / hook */}
          {post.title || post.hook ? (
            <View>
              <Text
                style={{
                  ...t.caption2,
                  color: colors.textSecondary,
                  fontWeight: '700',
                  letterSpacing: 0.4,
                  marginBottom: 6,
                }}
              >
                TITRE
              </Text>
              <Text style={{ ...t.title3, color: colors.textPrimary }}>
                {post.title || post.hook}
              </Text>
            </View>
          ) : null}

          {/* Caption */}
          {post.caption ? (
            <View>
              <Text
                style={{
                  ...t.caption2,
                  color: colors.textSecondary,
                  fontWeight: '700',
                  letterSpacing: 0.4,
                  marginBottom: 6,
                }}
              >
                CAPTION
              </Text>
              <View
                style={{
                  backgroundColor: colors.bgSecondary,
                  borderRadius: radius.md,
                  padding: spacing.md,
                }}
              >
                <Text style={{ ...t.body, color: colors.textPrimary }}>
                  {post.caption}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Schedule info */}
          <View
            style={{
              backgroundColor: colors.bgSecondary,
              borderRadius: radius.md,
              padding: spacing.md,
              gap: spacing.sm,
            }}
          >
            <Row label="Programmé pour" value={formatDateTime(post.scheduled_at)} />
            {post.published_at ? (
              <Row label="Publié à" value={formatDateTime(post.published_at)} />
            ) : null}
            {post.plan_date ? (
              <Row label="Plan date" value={post.plan_date} />
            ) : null}
          </View>

          {/* Publications */}
          {post.publications.length > 0 ? (
            <View>
              <Text
                style={{
                  ...t.caption2,
                  color: colors.textSecondary,
                  fontWeight: '700',
                  letterSpacing: 0.4,
                  marginBottom: 6,
                }}
              >
                PLATEFORMES
              </Text>
              <View
                style={{
                  backgroundColor: colors.bgSecondary,
                  borderRadius: radius.md,
                  overflow: 'hidden',
                }}
              >
                {post.publications.map((pub, idx) => (
                  <View
                    key={pub.id}
                    style={{
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.md,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                      borderBottomWidth: idx < post.publications.length - 1 ? 0.33 : 0,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <Ionicons
                      name={PLATFORM_ICONS[pub.platform]}
                      size={20}
                      color={colors.textPrimary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...t.body, color: colors.textPrimary }}>
                        {PLATFORM_LABELS[pub.platform]}
                      </Text>
                      {pub.error_message ? (
                        <Text
                          numberOfLines={2}
                          style={{ ...t.caption2, color: colors.danger, marginTop: 2 }}
                        >
                          {pub.error_message}
                        </Text>
                      ) : null}
                    </View>
                    <Text
                      style={{
                        ...t.caption1,
                        color:
                          pub.status === 'published'
                            ? colors.primary
                            : pub.status === 'failed'
                            ? colors.danger
                            : colors.textSecondary,
                        fontWeight: '600',
                      }}
                    >
                      {pub.status}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Actions */}
          <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
            {post.status === 'failed' || post.status === 'partial' ? (
              <Button
                label="Réessayer la publication"
                fullWidth
                size="md"
                onPress={handleRetry}
                loading={acting}
                disabled={acting}
              />
            ) : null}
            <Button
              label="Supprimer"
              variant="danger"
              fullWidth
              size="md"
              onPress={handleDelete}
              disabled={acting}
            />
          </View>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ ...t.subheadline, color: colors.textSecondary }}>{label}</Text>
      <Text style={{ ...t.subheadline, color: colors.textPrimary, fontWeight: '600' }}>
        {value}
      </Text>
    </View>
  )
}
