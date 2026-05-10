import React, { useMemo, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import type { MoreStackParamList } from '../../navigation/types'
import { useReelShots } from '../../hooks/useReelShots'
import { NavLarge } from '../../components/ui'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'

type Nav = NativeStackNavigationProp<MoreStackParamList, 'ReelsJourJ'>
type Rt = RouteProp<MoreStackParamList, 'ReelsJourJ'>

const placeIcon = (loc: string): string => {
  const l = loc.toLowerCase()
  if (l.includes('poulie') || l.includes('câble')) return '🏋️'
  if (l.includes('banc')) return '🛏️'
  if (l.includes('sol')) return '🟫'
  if (l.includes('miroir')) return '🪞'
  if (l.includes('plage') || l.includes('extér') || l.includes('dehors')) return '🌳'
  return '📍'
}

export function ReelsTournageJourJScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Rt>()
  const reelIds = route.params?.reelIds ?? null

  const { reels, byPlace, places, loading, error, refetch, patchShot } = useReelShots(reelIds)
  const [placeIdx, setPlaceIdx] = useState(0)

  const safeIdx = placeIdx >= places.length ? 0 : placeIdx
  const currentPlace = places[safeIdx] ?? null
  const allShots = currentPlace ? byPlace[currentPlace] : []
  const activeShots = allShots.filter((s) => !s.skipped)
  const skippedShots = allShots.filter((s) => s.skipped)

  // Group active shots par reel (sections "Reel · Titre")
  const reelGroups = useMemo(() => {
    const groups: Record<string, { title: string; shots: typeof activeShots }> = {}
    activeShots.forEach((s) => {
      if (!groups[s.reelId]) groups[s.reelId] = { title: s.reelTitle, shots: [] }
      groups[s.reelId].shots.push(s)
    })
    return groups
  }, [activeShots])

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          gap: spacing.sm,
        }}
      >
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{ padding: 4 }}>
          <Ionicons name="chevron-back" size={28} color={colors.primary} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => navigation.navigate('ReelsBrief', { reelIds })}
          hitSlop={8}
          style={{ padding: 4 }}
        >
          <Text style={{ ...t.body, color: colors.primary, fontWeight: '600' }}>Brief →</Text>
        </Pressable>
      </View>

      <NavLarge
        title="Jour J"
        subtitle={
          reelIds
            ? `${reelIds.length} reel${reelIds.length > 1 ? 's' : ''} · plan de tournage`
            : `${reels.length} reel${reels.length > 1 ? 's' : ''} · plan de tournage`
        }
      />

      {loading && places.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
          <Text style={{ ...t.body, color: colors.danger, textAlign: 'center', marginBottom: spacing.md }}>
            {error}
          </Text>
          <Pressable
            onPress={refetch}
            style={{
              paddingHorizontal: spacing.lg,
              paddingVertical: 10,
              backgroundColor: colors.bgSecondary,
              borderRadius: radius.md,
            }}
          >
            <Text style={{ ...t.subheadline, color: colors.textPrimary }}>Réessayer</Text>
          </Pressable>
        </View>
      ) : places.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md }}>
          <Text style={{ fontSize: 48 }}>🎉</Text>
          <Text style={{ ...t.bodyEmphasis, color: colors.textPrimary, textAlign: 'center' }}>
            Tous les shots sont tournés !
          </Text>
          <Text style={{ ...t.subheadline, color: colors.textSecondary, textAlign: 'center' }}>
            (ou aucun lieu n'est encore assigné)
          </Text>
        </View>
      ) : (
        <>
          {/* Header lieu courant + nav */}
          <View
            style={{
              marginHorizontal: spacing.lg,
              marginBottom: spacing.md,
              backgroundColor: colors.bgSecondary,
              borderRadius: radius.lg,
              padding: spacing.lg,
              borderLeftWidth: 3,
              borderLeftColor: colors.primary,
            }}
          >
            <Text
              style={{
                ...t.caption2,
                color: colors.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
                fontWeight: '700',
              }}
            >
              Lieu actuel · {safeIdx + 1}/{places.length}
            </Text>
            <Text style={{ ...t.title2, color: colors.textPrimary, marginTop: 4 }}>
              {placeIcon(currentPlace ?? '')} {currentPlace}
            </Text>
            <Text style={{ ...t.subheadline, color: colors.textSecondary, marginTop: 4 }}>
              {activeShots.length} shot{activeShots.length > 1 ? 's' : ''}
              {' · '}
              {Object.keys(reelGroups).length} reel{Object.keys(reelGroups).length > 1 ? 's' : ''}
              {skippedShots.length > 0
                ? ` · ${skippedShots.length} reporté${skippedShots.length > 1 ? 's' : ''}`
                : ''}
            </Text>
          </View>

          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              paddingBottom: 140,
              gap: spacing.md,
            }}
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={refetch}
                tintColor={colors.primary}
              />
            }
          >
            {Object.entries(reelGroups).map(([rid, g]) => (
              <View key={rid} style={{ gap: spacing.sm }}>
                <Text
                  style={{
                    ...t.footnote,
                    color: colors.textSecondary,
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                  }}
                >
                  Reel · {g.title}
                </Text>
                {g.shots.map((s) => (
                  <ShotCard
                    key={s.id}
                    shot={s}
                    onDone={() => void patchShot(s.id, { done: true, skipped: false })}
                    onSkip={() => void patchShot(s.id, { skipped: true })}
                  />
                ))}
              </View>
            ))}

            {activeShots.length === 0 && skippedShots.length === 0 ? (
              <View style={{ padding: spacing.xxl, alignItems: 'center', gap: spacing.sm }}>
                <Text style={{ fontSize: 36 }}>✅</Text>
                <Text style={{ ...t.body, color: colors.textSecondary, textAlign: 'center' }}>
                  Tout est tourné à ce lieu !
                </Text>
              </View>
            ) : null}

            {/* Section "à reporter" */}
            {skippedShots.length > 0 ? (
              <View
                style={{
                  marginTop: spacing.lg,
                  paddingTop: spacing.md,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  borderStyle: 'dashed',
                  gap: spacing.sm,
                }}
              >
                <Text
                  style={{
                    ...t.footnote,
                    color: colors.textSecondary,
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                  }}
                >
                  ⏭️ À reporter ({skippedShots.length})
                </Text>
                {skippedShots.map((s) => (
                  <View
                    key={s.id}
                    style={{
                      backgroundColor: colors.bgSecondary,
                      borderRadius: radius.md,
                      padding: spacing.md,
                      opacity: 0.6,
                      gap: 6,
                    }}
                  >
                    <Text style={{ ...t.caption2, color: colors.textTertiary }}>
                      Reel · {s.reelTitle} · Phrase {s.position}/{s.total}
                    </Text>
                    <Text style={{ ...t.body, color: colors.textPrimary, fontStyle: 'italic' }}>
                      « {s.text} »
                    </Text>
                    <Pressable
                      onPress={() => void patchShot(s.id, { skipped: false })}
                      style={{ alignSelf: 'flex-start' }}
                    >
                      <View
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderWidth: 1,
                          borderColor: colors.primary,
                          borderRadius: 6,
                          marginTop: 4,
                        }}
                      >
                        <Text style={{ ...t.caption1, color: colors.primary, fontWeight: '600' }}>
                          ↻ Remettre
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>

          {/* Footer nav lieux — sticky */}
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.md,
              paddingBottom: spacing.xl,
              backgroundColor: colors.bgPrimary,
              borderTopWidth: 0.33,
              borderTopColor: colors.border,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
            }}
          >
            <Pressable
              onPress={() => setPlaceIdx((safeIdx - 1 + places.length) % places.length)}
              style={{ flex: 1 }}
            >
              {({ pressed }) => (
                <View
                  style={{
                    paddingVertical: 12,
                    backgroundColor: colors.bgSecondary,
                    borderRadius: radius.md,
                    alignItems: 'center',
                    opacity: pressed ? 0.7 : 1,
                  }}
                >
                  <Text style={{ ...t.subheadline, color: colors.textPrimary, fontWeight: '600' }}>
                    ← Précédent
                  </Text>
                </View>
              )}
            </Pressable>
            <Pressable
              onPress={() => setPlaceIdx((safeIdx + 1) % places.length)}
              style={{ flex: 1.5 }}
            >
              {({ pressed }) => (
                <View
                  style={{
                    paddingVertical: 12,
                    backgroundColor: colors.primary,
                    borderRadius: radius.md,
                    alignItems: 'center',
                    opacity: pressed ? 0.85 : 1,
                  }}
                >
                  <Text style={{ ...t.subheadline, color: '#000', fontWeight: '700' }} numberOfLines={1}>
                    {places[(safeIdx + 1) % places.length]
                      ? `${placeIcon(places[(safeIdx + 1) % places.length])} ${places[(safeIdx + 1) % places.length]} →`
                      : 'Suivant →'}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  )
}

function ShotCard({
  shot,
  onDone,
  onSkip,
}: {
  shot: import('../../types/reel-shots').ShotInfo
  onDone: () => void
  onSkip: () => void
}) {
  return (
    <View
      style={{
        backgroundColor: colors.bgSecondary,
        borderRadius: radius.lg,
        padding: spacing.lg,
        gap: spacing.sm,
      }}
    >
      <Text
        style={{
          ...t.caption2,
          color: colors.textTertiary,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          fontWeight: '700',
        }}
      >
        Phrase {shot.position}/{shot.total}
      </Text>
      {shot.prevText ? (
        <Text
          numberOfLines={1}
          style={{
            ...t.caption1,
            color: colors.textTertiary,
            fontStyle: 'italic',
            paddingLeft: 10,
            borderLeftWidth: 2,
            borderLeftColor: colors.border,
          }}
        >
          ↑ {shot.prevText}
        </Text>
      ) : null}
      <Text
        style={{
          fontSize: 18,
          lineHeight: 26,
          fontWeight: '700',
          color: colors.textPrimary,
        }}
      >
        « {shot.text} »
      </Text>
      {shot.shotNote ? (
        <View
          style={{
            backgroundColor: colors.warning + '15',
            borderWidth: 1,
            borderColor: colors.warning + '40',
            borderRadius: radius.md,
            padding: 10,
          }}
        >
          <Text style={{ ...t.subheadline, color: colors.warning }}>🎥 {shot.shotNote}</Text>
        </View>
      ) : null}
      {shot.nextText ? (
        <Text
          numberOfLines={1}
          style={{
            ...t.caption1,
            color: colors.textTertiary,
            fontStyle: 'italic',
            paddingLeft: 10,
            borderLeftWidth: 2,
            borderLeftColor: colors.border,
          }}
        >
          ↓ {shot.nextText}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: 4 }}>
        <Pressable onPress={onDone} style={{ flex: 1 }}>
          {({ pressed }) => (
            <View
              style={{
                paddingVertical: 12,
                backgroundColor: '#22c55e',
                borderRadius: radius.md,
                alignItems: 'center',
                opacity: pressed ? 0.85 : 1,
              }}
            >
              <Text style={{ ...t.bodyEmphasis, color: '#fff' }}>✓ Tournée</Text>
            </View>
          )}
        </Pressable>
        <Pressable onPress={onSkip}>
          {({ pressed }) => (
            <View
              style={{
                paddingHorizontal: spacing.lg,
                paddingVertical: 12,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                alignItems: 'center',
                opacity: pressed ? 0.6 : 1,
              }}
            >
              <Text style={{ ...t.subheadline, color: colors.textSecondary }}>Reporter</Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  )
}
