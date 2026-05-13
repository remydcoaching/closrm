import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Switch,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { api } from '../../services/api'
import { NavLarge } from '../../components/ui'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'
import { PUSH_TYPES_META, type PushType } from '../../types/notifications'

interface Pref {
  type: string
  enabled: boolean
}

export function NotificationSettingsScreen() {
  const navigation = useNavigation()
  const [prefs, setPrefs] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPrefs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<{ data: Pref[] }>('/api/notification-preferences')
      const map: Record<string, boolean> = {}
      ;(res.data ?? []).forEach((p) => {
        map[p.type] = p.enabled
      })
      setPrefs(map)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement préférences')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchPrefs()
  }, [fetchPrefs])

  // Default = enabled si pas de row
  const isEnabled = (type: PushType): boolean => prefs[type] ?? true

  const toggle = async (type: PushType, next: boolean) => {
    // Optimistic
    setPrefs((prev) => ({ ...prev, [type]: next }))
    try {
      await api.patch('/api/notification-preferences', { type, enabled: next })
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Échec mise à jour')
      // Rollback
      setPrefs((prev) => ({ ...prev, [type]: !next }))
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

      <NavLarge
        title="Notifications"
        subtitle="Choisis ce qui te ping sur le téléphone"
      />

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
          <Text style={{ ...t.body, color: colors.danger, textAlign: 'center', marginBottom: spacing.md }}>
            {error}
          </Text>
          <Pressable
            onPress={fetchPrefs}
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
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 40, gap: spacing.sm }}>
          <Text
            style={{
              ...t.footnote,
              color: colors.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginLeft: 8,
              marginBottom: 4,
              marginTop: 4,
            }}
          >
            Push notifications
          </Text>
          {PUSH_TYPES_META.map((meta, idx) => {
            const enabled = isEnabled(meta.type)
            return (
              <View
                key={meta.type}
                style={{
                  backgroundColor: colors.bgSecondary,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  flexDirection: 'row',
                  gap: spacing.md,
                  alignItems: 'center',
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: meta.tint + '22',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons
                    name={meta.icon as keyof typeof Ionicons.glyphMap}
                    size={18}
                    color={meta.tint}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ ...t.bodyEmphasis, color: colors.textPrimary }}>
                    {meta.label}
                  </Text>
                  <Text style={{ ...t.caption1, color: colors.textSecondary, marginTop: 2 }}>
                    {meta.description}
                  </Text>
                </View>
                <Switch
                  value={enabled}
                  onValueChange={(v) => void toggle(meta.type, v)}
                  trackColor={{ false: colors.border, true: meta.tint + '88' }}
                  thumbColor={enabled ? meta.tint : colors.textTertiary}
                  ios_backgroundColor={colors.bgElevated}
                />
              </View>
            )
          })}
          <Text
            style={{
              ...t.caption2,
              color: colors.textTertiary,
              marginTop: spacing.md,
              marginLeft: 8,
              lineHeight: 16,
            }}
          >
            Note : ces toggles agissent sur les pushs envoyés par ClosRM. Tu peux aussi
            couper toutes les notifs depuis Réglages iOS → ClosRM → Notifications.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
