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
import {
  REMINDER_OPTIONS,
  getReminderMinutes,
  setReminderMinutes,
  scheduleAgendaReminders,
  cancelAllAgendaReminders,
  type ReminderMinutes,
} from '../../services/agenda-reminders'
import { supabase } from '../../services/supabase'

interface Pref {
  type: string
  enabled: boolean
}

export function NotificationSettingsScreen() {
  const navigation = useNavigation()
  const [prefs, setPrefs] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reminderMins, setReminderMins] = useState<ReminderMinutes[]>([])

  useEffect(() => {
    void getReminderMinutes().then(setReminderMins)
  }, [])

  // Toggle d'une lead-time → met à jour SecureStore + relance le scheduler
  // local pour que le changement soit immédiatement visible (sinon il faut
  // attendre le prochain refresh d'agenda).
  const toggleReminder = async (min: ReminderMinutes) => {
    const next = reminderMins.includes(min)
      ? reminderMins.filter((m) => m !== min)
      : [...reminderMins, min].sort((a, b) => a - b)
    setReminderMins(next)
    await setReminderMinutes(next)
    // Reschedule immédiat
    try {
      await cancelAllAgendaReminders()
      const now = new Date()
      const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      const [bookingsRes, callsRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('id, title, scheduled_at, status, call_id, lead:leads(first_name, last_name)')
          .gte('scheduled_at', now.toISOString())
          .lte('scheduled_at', horizon.toISOString())
          .neq('status', 'cancelled'),
        supabase
          .from('calls')
          .select('id, scheduled_at, type, outcome, lead:leads(first_name, last_name)')
          .gte('scheduled_at', now.toISOString())
          .lte('scheduled_at', horizon.toISOString())
          .eq('outcome', 'pending'),
      ])
      type B = {
        id: string
        title: string
        scheduled_at: string
        call_id: string | null
        lead: { first_name: string | null; last_name: string | null } | null
      }
      type C = {
        id: string
        scheduled_at: string
        type: 'setting' | 'closing'
        lead: { first_name: string | null; last_name: string | null } | null
      }
      const events = [
        ...((bookingsRes.data ?? []) as unknown as B[])
          .filter((b) => !b.call_id)
          .map((b) => ({
            id: `booking:${b.id}`,
            scheduledAt: new Date(b.scheduled_at),
            title: b.title || 'RDV',
            body: new Date(b.scheduled_at).toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            }),
          })),
        ...((callsRes.data ?? []) as unknown as C[]).map((c) => ({
          id: `call:${c.id}`,
          scheduledAt: new Date(c.scheduled_at),
          title: `${c.type === 'closing' ? 'Closing' : 'Setting'} · ${
            c.lead
              ? `${c.lead.first_name ?? ''} ${c.lead.last_name ?? ''}`.trim() || 'Appel'
              : 'Appel'
          }`,
          body: new Date(c.scheduled_at).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          data: { entity_type: 'call' as const, entity_id: c.id },
        })),
      ]
      await scheduleAgendaReminders(events)
    } catch (e) {
      // Best-effort, ne bloque pas la UI
      if (__DEV__) console.warn('[reminders] reschedule failed:', e)
    }
  }

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
          {/* ── Rappels d'événement (notifs locales scheduled) ──────── */}
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
            Rappels d&apos;événement
          </Text>
          <View
            style={{
              backgroundColor: colors.bgSecondary,
              borderRadius: radius.md,
              padding: spacing.md,
              gap: spacing.sm,
            }}
          >
            <Text style={{ ...t.bodyEmphasis, color: colors.textPrimary }}>
              M&apos;alerter avant chaque RDV
            </Text>
            <Text style={{ ...t.caption1, color: colors.textSecondary }}>
              Notification locale envoyée X minutes avant chaque appel ou RDV
              du jour. Sélectionne un ou plusieurs délais.
            </Text>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
                marginTop: spacing.sm,
              }}
            >
              {REMINDER_OPTIONS.map((min) => {
                const active = reminderMins.includes(min)
                return (
                  <Pressable
                    key={min}
                    onPress={() => void toggleReminder(min)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: radius.pill,
                      backgroundColor: active ? colors.primary : 'transparent',
                      borderWidth: 1,
                      borderColor: active ? colors.primary : colors.border,
                    }}
                  >
                    <Text
                      style={{
                        ...t.subheadline,
                        color: active ? '#000' : colors.textPrimary,
                        fontWeight: '600',
                      }}
                    >
                      {min < 60 ? `${min} min` : `${min / 60} h`}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
            {reminderMins.length === 0 ? (
              <Text style={{ ...t.caption2, color: colors.textTertiary, marginTop: 4 }}>
                Aucun rappel actif. Les notifs serveur (H-1) restent
                indépendantes.
              </Text>
            ) : null}
          </View>

          <Text
            style={{
              ...t.footnote,
              color: colors.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginLeft: 8,
              marginBottom: 4,
              marginTop: spacing.lg,
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
