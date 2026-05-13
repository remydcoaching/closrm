import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
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
  type SocialPlatform,
} from '../../types/social'

type Nav = NativeStackNavigationProp<MoreStackParamList, 'SocialPostForm'>
type Rt = RouteProp<MoreStackParamList, 'SocialPostForm'>

const PLATFORMS: SocialPlatform[] = ['instagram', 'youtube', 'tiktok']

const HOURS = Array.from({ length: 13 }, (_, i) => 8 + i) // 08-20
const MINUTES = [0, 15, 30, 45]

const isoLocal = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function SocialPostFormScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Rt>()
  const initialDate = route.params?.initialDate
    ? new Date(route.params.initialDate)
    : (() => {
        const d = new Date()
        d.setDate(d.getDate() + 1) // demain par défaut
        d.setHours(10, 0, 0, 0)
        return d
      })()

  const [title, setTitle] = useState('')
  const [caption, setCaption] = useState('')
  const [platforms, setPlatforms] = useState<Set<SocialPlatform>>(
    new Set<SocialPlatform>(['instagram']),
  )
  const [date, setDate] = useState<Date>(initialDate)
  const [hour, setHour] = useState<number>(initialDate.getHours())
  const [minute, setMinute] = useState<number>(
    [0, 15, 30, 45].includes(initialDate.getMinutes()) ? initialDate.getMinutes() : 0,
  )
  const [statusKind, setStatusKind] = useState<'draft' | 'scheduled'>('scheduled')
  const [submitting, setSubmitting] = useState(false)

  const togglePlatform = (p: SocialPlatform) => {
    setPlatforms((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  const buildScheduledAt = (): string => {
    const d = new Date(date)
    d.setHours(hour, minute, 0, 0)
    return d.toISOString()
  }

  const submit = async () => {
    if (!title.trim() && !caption.trim()) {
      Alert.alert('Manquant', 'Ajoute au moins un titre ou une caption.')
      return
    }
    if (statusKind === 'scheduled' && platforms.size === 0) {
      Alert.alert(
        'Plateformes manquantes',
        'Sélectionne au moins une plateforme pour programmer le post.',
      )
      return
    }
    setSubmitting(true)
    try {
      const scheduledAt = buildScheduledAt()
      const planDate = isoLocal(date)
      await api.post('/api/social/posts', {
        title: title.trim() || null,
        caption: caption.trim() || null,
        status: statusKind,
        scheduled_at: statusKind === 'scheduled' ? scheduledAt : null,
        plan_date: planDate,
        publications:
          statusKind === 'scheduled'
            ? Array.from(platforms).map((p) => ({
                platform: p,
                scheduled_at: scheduledAt,
              }))
            : [],
      })
      navigation.goBack()
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Échec création')
    } finally {
      setSubmitting(false)
    }
  }

  // Day selector — 14 prochains jours
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + i)
    return d
  })

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
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={{ padding: 4 }}
        >
          <Ionicons name="chevron-back" size={28} color={colors.primary} />
        </Pressable>
      </View>

      <NavLarge title="Nouveau post" subtitle="Programmer une publication" />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: 120,
          gap: spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Titre */}
        <Field label="TITRE">
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Hook ou titre interne"
            placeholderTextColor={colors.textTertiary}
            style={inputStyle()}
            maxLength={300}
          />
        </Field>

        {/* Caption */}
        <Field label="CAPTION">
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="Le texte qui ira avec le post…"
            placeholderTextColor={colors.textTertiary}
            multiline
            style={[
              inputStyle(),
              { minHeight: 100, textAlignVertical: 'top', paddingTop: 12 },
            ]}
            maxLength={2200}
          />
          <Text
            style={{
              ...t.caption2,
              color: colors.textTertiary,
              marginTop: 4,
              textAlign: 'right',
            }}
          >
            {caption.length}/2200
          </Text>
        </Field>

        {/* Statut */}
        <Field label="ÉTAT">
          <View
            style={{
              flexDirection: 'row',
              gap: 4,
              backgroundColor: colors.bgSecondary,
              borderRadius: 10,
              padding: 4,
            }}
          >
            {(['draft', 'scheduled'] as const).map((k) => {
              const active = statusKind === k
              return (
                <Pressable
                  key={k}
                  onPress={() => setStatusKind(k)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 8,
                    backgroundColor: active ? colors.primary : 'transparent',
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      ...t.subheadline,
                      color: active ? '#000' : colors.textPrimary,
                      fontWeight: '600',
                    }}
                  >
                    {k === 'draft' ? 'Brouillon' : 'Programmé'}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </Field>

        {statusKind === 'scheduled' ? (
          <>
            {/* Plateformes */}
            <Field label="PLATEFORMES">
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {PLATFORMS.map((p) => {
                  const selected = platforms.has(p)
                  return (
                    <Pressable
                      key={p}
                      onPress={() => togglePlatform(p)}
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        borderRadius: 10,
                        backgroundColor: selected ? colors.primary : colors.bgElevated,
                        borderWidth: 1,
                        borderColor: selected ? colors.primary : colors.border,
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Ionicons
                        name={PLATFORM_ICONS[p]}
                        size={18}
                        color={selected ? '#000' : colors.textPrimary}
                      />
                      <Text
                        style={{
                          ...t.caption1,
                          color: selected ? '#000' : colors.textPrimary,
                          fontWeight: '600',
                        }}
                      >
                        {PLATFORM_LABELS[p]}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </Field>

            {/* Date */}
            <Field label="JOUR">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6 }}
              >
                {days.map((d) => {
                  const selected =
                    d.getFullYear() === date.getFullYear() &&
                    d.getMonth() === date.getMonth() &&
                    d.getDate() === date.getDate()
                  return (
                    <Pressable
                      key={d.toISOString()}
                      onPress={() => setDate(d)}
                      style={{
                        width: 52,
                        paddingVertical: 8,
                        borderRadius: 12,
                        backgroundColor: selected ? colors.primary : colors.bgElevated,
                        borderWidth: 1,
                        borderColor: selected ? colors.primary : colors.border,
                        alignItems: 'center',
                      }}
                    >
                      <Text
                        style={{
                          ...t.caption2,
                          color: selected ? '#000' : colors.textSecondary,
                          fontWeight: '700',
                          letterSpacing: 0.4,
                        }}
                      >
                        {d
                          .toLocaleDateString('fr-FR', { weekday: 'short' })
                          .replace('.', '')
                          .toUpperCase()}
                      </Text>
                      <Text
                        style={{
                          ...t.title3,
                          color: selected ? '#000' : colors.textPrimary,
                          fontWeight: '700',
                          marginTop: 2,
                        }}
                      >
                        {d.getDate()}
                      </Text>
                    </Pressable>
                  )
                })}
              </ScrollView>
            </Field>

            {/* Heure — grid 4 colonnes */}
            <Field label="HEURE">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {HOURS.map((h) => {
                  const selected = h === hour
                  return (
                    <Pressable
                      key={h}
                      onPress={() => setHour(h)}
                      style={{
                        width: '23.5%',
                        paddingVertical: 10,
                        borderRadius: 10,
                        backgroundColor: selected ? colors.primary : colors.bgElevated,
                        borderWidth: 1,
                        borderColor: selected ? colors.primary : colors.border,
                        alignItems: 'center',
                      }}
                    >
                      <Text
                        style={{
                          ...t.body,
                          color: selected ? '#000' : colors.textPrimary,
                          fontWeight: '600',
                        }}
                      >
                        {h.toString().padStart(2, '0')}h
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                {MINUTES.map((m) => {
                  const selected = m === minute
                  return (
                    <Pressable
                      key={m}
                      onPress={() => setMinute(m)}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 10,
                        backgroundColor: selected ? colors.primary : colors.bgElevated,
                        borderWidth: 1,
                        borderColor: selected ? colors.primary : colors.border,
                        alignItems: 'center',
                      }}
                    >
                      <Text
                        style={{
                          ...t.body,
                          color: selected ? '#000' : colors.textPrimary,
                          fontWeight: '600',
                        }}
                      >
                        :{m.toString().padStart(2, '0')}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </Field>
          </>
        ) : null}

        <View style={{ marginTop: spacing.md }}>
          <Button
            label={
              submitting
                ? 'Création…'
                : statusKind === 'scheduled'
                ? `Programmer · ${hour}h${minute.toString().padStart(2, '0')}`
                : 'Enregistrer en brouillon'
            }
            fullWidth
            size="lg"
            disabled={submitting}
            loading={submitting}
            onPress={submit}
          />
        </View>

        {submitting ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
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
        {label}
      </Text>
      {children}
    </View>
  )
}

function inputStyle() {
  return {
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
  } as const
}
