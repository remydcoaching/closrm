import React, { useMemo, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Modal,
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
import type { ReelShot } from '../../types/reel-shots'

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

  const { shots, reels, byPlace, places, loading, error, refetch, patchShot } = useReelShots(reelIds)
  const [placeIdx, setPlaceIdx] = useState(0)
  const [previewReelId, setPreviewReelId] = useState<string | null>(null)
  const [previewShotId, setPreviewShotId] = useState<string | null>(null)

  const previewShots = useMemo(() => {
    if (!previewReelId) return []
    return shots
      .filter((s) => s.social_post_id === previewReelId)
      .sort((a, b) => a.position - b.position)
  }, [shots, previewReelId])
  const previewReelTitle = previewReelId
    ? reels.find((r) => r.id === previewReelId)?.title ?? '(sans titre)'
    : ''

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
                    onPreview={() => {
                      setPreviewReelId(s.reelId)
                      setPreviewShotId(s.id)
                    }}
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

      <ReelPreviewModal
        visible={!!previewReelId}
        reelTitle={previewReelTitle}
        shots={previewShots}
        highlightShotId={previewShotId}
        onClose={() => {
          setPreviewReelId(null)
          setPreviewShotId(null)
        }}
      />
    </SafeAreaView>
  )
}

function ShotCard({
  shot,
  onDone,
  onSkip,
  onPreview,
}: {
  shot: import('../../types/reel-shots').ShotInfo
  onDone: () => void
  onSkip: () => void
  onPreview: () => void
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
        <View
          style={{
            paddingLeft: 10,
            borderLeftWidth: 2,
            borderLeftColor: colors.border,
          }}
        >
          <Text
            style={{
              fontSize: 9,
              color: '#666',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              marginBottom: 2,
            }}
          >
            ↑ Phrase précédente
          </Text>
          <Text
            numberOfLines={1}
            style={{ fontSize: 11, color: '#888', fontStyle: 'italic' }}
          >
            {shot.prevText}
          </Text>
        </View>
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
        <View
          style={{
            paddingLeft: 10,
            borderLeftWidth: 2,
            borderLeftColor: colors.border,
          }}
        >
          <Text
            style={{
              fontSize: 9,
              color: '#666',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              marginBottom: 2,
            }}
          >
            ↓ Phrase suivante
          </Text>
          <Text
            numberOfLines={1}
            style={{ fontSize: 11, color: '#888', fontStyle: 'italic' }}
          >
            {shot.nextText}
          </Text>
        </View>
      ) : null}

      {/* Bouton "Voir le reel entier" — contexte des phrases avant/après */}
      <Pressable onPress={onPreview} style={{ alignSelf: 'flex-start', marginTop: 4 }}>
        {({ pressed }) => (
          <View
            style={{
              paddingHorizontal: 11,
              paddingVertical: 6,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 6,
              opacity: pressed ? 0.6 : 1,
            }}
          >
            <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>
              👁 Voir le reel entier
            </Text>
          </View>
        )}
      </Pressable>
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

function ReelPreviewModal({
  visible,
  reelTitle,
  shots,
  highlightShotId,
  onClose,
}: {
  visible: boolean
  reelTitle: string
  shots: ReelShot[]
  highlightShotId: string | null
  onClose: () => void
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.85)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.lg,
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: 480,
            maxHeight: '85%',
            backgroundColor: '#0a0a0a',
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.lg,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <View
            style={{
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 9,
                  color: '#666',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                }}
              >
                Reel entier
              </Text>
              <Text
                style={{ ...t.bodyEmphasis, color: colors.textPrimary, marginTop: 2 }}
                numberOfLines={2}
              >
                {reelTitle}
              </Text>
              <Text style={{ ...t.caption1, color: colors.textTertiary, marginTop: 2 }}>
                {shots.length} phrase{shots.length > 1 ? 's' : ''}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={{ padding: 4 }}>
              <Text style={{ fontSize: 20, color: colors.textSecondary }}>✕</Text>
            </Pressable>
          </View>

          {/* Liste */}
          <ScrollView contentContainerStyle={{ padding: spacing.md, gap: 8 }}>
            {shots.length === 0 ? (
              <Text
                style={{
                  ...t.subheadline,
                  color: colors.textTertiary,
                  textAlign: 'center',
                  paddingVertical: 20,
                }}
              >
                Aucune phrase
              </Text>
            ) : (
              shots.map((s) => {
                const isCurrent = s.id === highlightShotId
                return (
                  <View
                    key={s.id}
                    style={{
                      backgroundColor: isCurrent ? 'rgba(255,0,0,0.08)' : '#141414',
                      borderWidth: 1,
                      borderColor: isCurrent ? '#FF0000' : colors.border,
                      borderRadius: 8,
                      padding: spacing.md,
                      gap: 4,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 4,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          color: isCurrent ? '#FF0000' : '#888',
                          fontWeight: '700',
                        }}
                      >
                        {s.position + 1}/{shots.length}
                      </Text>
                      {s.done ? (
                        <Text style={{ fontSize: 10, color: '#22c55e', fontWeight: '700' }}>
                          ✓ tournée
                        </Text>
                      ) : null}
                      {s.skipped && !s.done ? (
                        <Text style={{ fontSize: 10, color: colors.warning, fontWeight: '700' }}>
                          ⏭ reportée
                        </Text>
                      ) : null}
                      {s.location ? (
                        <Text style={{ fontSize: 10, color: colors.textSecondary }}>
                          📍 {s.location}
                        </Text>
                      ) : null}
                      {isCurrent ? (
                        <Text style={{ fontSize: 10, color: '#FF0000', fontWeight: '700' }}>
                          ← ici
                        </Text>
                      ) : null}
                    </View>
                    <Text
                      style={{
                        fontSize: 13,
                        lineHeight: 18,
                        color: s.done ? '#666' : colors.textPrimary,
                        textDecorationLine: s.done ? 'line-through' : 'none',
                        fontWeight: isCurrent ? '700' : '400',
                      }}
                    >
                      {s.text}
                    </Text>
                    {s.shot_note ? (
                      <View
                        style={{
                          marginTop: 6,
                          backgroundColor: colors.warning + '15',
                          borderWidth: 1,
                          borderColor: colors.warning + '40',
                          borderRadius: 6,
                          padding: 8,
                        }}
                      >
                        <Text style={{ fontSize: 11, color: colors.warning }}>
                          🎥 {s.shot_note}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                )
              })
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
