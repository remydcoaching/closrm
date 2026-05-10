import React, { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import type { MoreStackParamList } from '../../navigation/types'
import { useReelShots } from '../../hooks/useReelShots'
import { api } from '../../services/api'
import { NavLarge, Button } from '../../components/ui'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'
import type { ReelShot } from '../../types/reel-shots'

type Nav = NativeStackNavigationProp<MoreStackParamList, 'ReelsPrep'>
type Rt = RouteProp<MoreStackParamList, 'ReelsPrep'>

const placeIcon = (loc: string | null): string => {
  if (!loc) return '📍'
  const l = loc.toLowerCase()
  if (l.includes('poulie') || l.includes('câble')) return '🏋️'
  if (l.includes('banc')) return '🛏️'
  if (l.includes('sol')) return '🟫'
  if (l.includes('miroir')) return '🪞'
  if (l.includes('plage') || l.includes('extér') || l.includes('dehors')) return '🌳'
  return '📍'
}

export function ReelsTournagePrepScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Rt>()
  const reelIds = route.params?.reelIds ?? null

  const { shots, reels, loading, error, refetch, patchShot } = useReelShots(reelIds)
  const [knownLocations, setKnownLocations] = useState<string[]>([])
  const [pickerShot, setPickerShot] = useState<ReelShot | null>(null)
  const [syncing, setSyncing] = useState(false)

  // Charge la liste des lieux connus pour suggestion (autocomplete)
  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get<{ data: string[] }>('/api/reel-shots/locations')
        setKnownLocations(res.data ?? [])
      } catch {
        setKnownLocations([])
      }
    })()
  }, [])

  // Sync les phrases quand on ouvre la prep (split du script en shots)
  useEffect(() => {
    if (reels.length === 0) return
    void (async () => {
      setSyncing(true)
      try {
        await Promise.all(
          reels.map((r) =>
            api.post('/api/reel-shots/sync', { social_post_id: r.id }).catch(() => null),
          ),
        )
        await refetch()
      } finally {
        setSyncing(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reels.length])

  // Groupage par reel (chaque phrase ordonnée par position)
  const byReel = useMemo(() => {
    const groups: Record<string, ReelShot[]> = {}
    shots.forEach((s) => {
      if (!groups[s.social_post_id]) groups[s.social_post_id] = []
      groups[s.social_post_id].push(s)
    })
    Object.values(groups).forEach((arr) => arr.sort((a, b) => a.position - b.position))
    return groups
  }, [shots])

  // Compteurs : phrases avec lieu / phrases sans lieu
  const stats = useMemo(() => {
    const total = shots.length
    const withLoc = shots.filter((s) => !!s.location).length
    return { total, withLoc, missing: total - withLoc }
  }, [shots])

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
        {stats.withLoc > 0 ? (
          <Pressable
            onPress={() => navigation.navigate('ReelsJourJ', { reelIds })}
            hitSlop={8}
            style={{ padding: 4 }}
          >
            <Text style={{ ...t.body, color: colors.primary, fontWeight: '600' }}>Jour J →</Text>
          </Pressable>
        ) : null}
      </View>

      <NavLarge
        title="Préparer le tournage"
        subtitle={
          syncing
            ? 'Synchronisation des phrases…'
            : `${stats.withLoc}/${stats.total} phrase${stats.total > 1 ? 's' : ''} avec lieu`
        }
      />

      {loading && shots.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
          <Text style={{ ...t.body, color: colors.danger, textAlign: 'center' }}>{error}</Text>
        </View>
      ) : reels.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.sm }}>
          <Text style={{ fontSize: 48 }}>🎬</Text>
          <Text style={{ ...t.body, color: colors.textSecondary, textAlign: 'center' }}>
            Aucun reel à préparer
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: 40,
            gap: spacing.lg,
          }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} tintColor={colors.primary} />}
        >
          {reels.map((reel) => {
            const reelShots = byReel[reel.id] ?? []
            return (
              <View key={reel.id} style={{ gap: spacing.sm }}>
                <View
                  style={{
                    backgroundColor: colors.bgSecondary,
                    borderRadius: radius.md,
                    padding: spacing.md,
                    borderLeftWidth: 3,
                    borderLeftColor: colors.primary,
                  }}
                >
                  <Text style={{ ...t.bodyEmphasis, color: colors.textPrimary }}>
                    {reel.title || '(sans titre)'}
                  </Text>
                  <Text style={{ ...t.caption1, color: colors.textTertiary, marginTop: 4 }}>
                    {reelShots.length} phrase{reelShots.length > 1 ? 's' : ''}
                  </Text>
                </View>

                {reelShots.length === 0 ? (
                  <View
                    style={{
                      paddingVertical: spacing.lg,
                      alignItems: 'center',
                      backgroundColor: colors.bgSecondary,
                      borderRadius: radius.md,
                    }}
                  >
                    <Text style={{ ...t.subheadline, color: colors.textSecondary }}>
                      Pas de script — ajoute-le sur le web
                    </Text>
                  </View>
                ) : (
                  reelShots.map((shot) => (
                    <PhraseRow
                      key={shot.id}
                      shot={shot}
                      onPickLocation={() => setPickerShot(shot)}
                    />
                  ))
                )}
              </View>
            )
          })}
        </ScrollView>
      )}

      <LocationPickerModal
        visible={!!pickerShot}
        currentLocation={pickerShot?.location ?? null}
        knownLocations={knownLocations}
        onClose={() => setPickerShot(null)}
        onPick={async (loc) => {
          if (!pickerShot) return
          await patchShot(pickerShot.id, { location: loc })
          setPickerShot(null)
          // Refresh known locations si on en a ajouté un nouveau
          if (loc && !knownLocations.includes(loc)) {
            setKnownLocations((prev) => [...prev, loc])
          }
        }}
      />
    </SafeAreaView>
  )
}

function PhraseRow({ shot, onPickLocation }: { shot: ReelShot; onPickLocation: () => void }) {
  const hasLoc = !!shot.location
  return (
    <Pressable
      onPress={onPickLocation}
      style={({ pressed }) => ({
        backgroundColor: colors.bgSecondary,
        borderRadius: radius.md,
        padding: spacing.md,
        opacity: pressed ? 0.7 : 1,
        gap: 8,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text
          style={{
            ...t.caption2,
            color: colors.textTertiary,
            fontWeight: '700',
            letterSpacing: 0.4,
          }}
        >
          {(shot.position + 1).toString().padStart(2, '0')}
        </Text>
        <Text
          style={{ flex: 1, ...t.body, color: colors.textPrimary }}
          numberOfLines={3}
        >
          {shot.text}
        </Text>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          marginLeft: 24,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
          backgroundColor: hasLoc ? colors.primary + '22' : 'transparent',
          borderWidth: hasLoc ? 0 : 1,
          borderColor: colors.border,
          alignSelf: 'flex-start',
        }}
      >
        <Text
          style={{
            ...t.caption1,
            color: hasLoc ? colors.primary : colors.textSecondary,
            fontWeight: '600',
          }}
        >
          {placeIcon(shot.location)} {shot.location ?? 'Choisir un lieu…'}
        </Text>
      </View>
    </Pressable>
  )
}

function LocationPickerModal({
  visible,
  currentLocation,
  knownLocations,
  onClose,
  onPick,
}: {
  visible: boolean
  currentLocation: string | null
  knownLocations: string[]
  onClose: () => void
  onPick: (loc: string | null) => void
}) {
  const [custom, setCustom] = useState('')

  useEffect(() => {
    if (visible) setCustom('')
  }, [visible])

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.sheet,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            paddingBottom: spacing.xxxl,
            gap: spacing.md,
            maxHeight: '75%',
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.border,
              marginBottom: 4,
            }}
          />
          <Text style={{ ...t.title3, color: colors.textPrimary }}>Choisir un lieu</Text>
          {currentLocation ? (
            <Pressable
              onPress={() => onPick(null)}
              style={({ pressed }) => ({
                paddingVertical: 12,
                paddingHorizontal: spacing.md,
                borderRadius: radius.md,
                backgroundColor: colors.danger + '15',
                opacity: pressed ? 0.7 : 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              })}
            >
              <Ionicons name="close-circle" size={18} color={colors.danger} />
              <Text style={{ ...t.body, color: colors.danger, fontWeight: '600' }}>
                Retirer le lieu
              </Text>
            </Pressable>
          ) : null}

          <ScrollView
            style={{ maxHeight: 280 }}
            contentContainerStyle={{ gap: 6 }}
            keyboardShouldPersistTaps="handled"
          >
            {knownLocations.map((loc) => {
              const selected = loc === currentLocation
              return (
                <Pressable
                  key={loc}
                  onPress={() => onPick(loc)}
                  style={({ pressed }) => ({
                    paddingHorizontal: spacing.md,
                    paddingVertical: 12,
                    borderRadius: radius.md,
                    backgroundColor: selected ? colors.primary : colors.bgSecondary,
                    opacity: pressed ? 0.7 : 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  })}
                >
                  <Text style={{ ...t.body, color: selected ? '#000' : colors.textPrimary, fontWeight: selected ? '700' : '500' }}>
                    {placeIcon(loc)} {loc}
                  </Text>
                </Pressable>
              )
            })}
            {knownLocations.length === 0 ? (
              <Text style={{ ...t.subheadline, color: colors.textTertiary, textAlign: 'center', paddingVertical: 16 }}>
                Aucun lieu encore enregistré — ajoute le premier ci-dessous.
              </Text>
            ) : null}
          </ScrollView>

          <View style={{ gap: 8 }}>
            <Text style={{ ...t.caption1, color: colors.textSecondary, fontWeight: '600' }}>
              Ou nouveau lieu
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                value={custom}
                onChangeText={setCustom}
                placeholder="Ex : Salle de musculation"
                placeholderTextColor={colors.textTertiary}
                style={{
                  flex: 1,
                  backgroundColor: colors.bgSecondary,
                  borderRadius: radius.md,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  color: colors.textPrimary,
                  fontSize: 15,
                }}
                returnKeyType="done"
                onSubmitEditing={() => {
                  const v = custom.trim()
                  if (!v) return
                  onPick(v)
                }}
              />
              <Pressable
                onPress={() => {
                  const v = custom.trim()
                  if (!v) {
                    Alert.alert('Lieu vide', 'Tape un nom de lieu avant de valider.')
                    return
                  }
                  onPick(v)
                }}
                style={({ pressed }) => ({
                  paddingHorizontal: spacing.md,
                  paddingVertical: 12,
                  borderRadius: radius.md,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ ...t.body, color: '#000', fontWeight: '700' }}>Ajouter</Text>
              </Pressable>
            </View>
          </View>

          <View style={{ marginTop: 8 }}>
            <Button label="Annuler" variant="outline" fullWidth size="md" onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
