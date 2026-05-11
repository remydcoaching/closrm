import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import { Ionicons } from '@expo/vector-icons'
import { api } from '../../services/api'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'

const COLOR_PRESETS = [
  { name: 'Gris', hex: '#6b7280' },
  { name: 'Bleu', hex: '#3b82f6' },
  { name: 'Violet', hex: '#a855f7' },
  { name: 'Rouge', hex: '#ef4444' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Vert', hex: '#22c55e' },
  { name: 'Cyan', hex: '#06b6d4' },
] as const

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120, 180]

interface InitialBooking {
  id?: string
  title?: string
  scheduled_at?: string // ISO
  duration_minutes?: number
  color?: string | null
  notes?: string | null
  is_personal?: boolean
  calendar_id?: string | null
}

interface CalendarRow {
  id: string
  name: string
  color: string
  duration_minutes: number
  purpose: string | null
}

interface Props {
  mode: 'create' | 'edit'
  initial: InitialBooking | null
  /** Date par défaut quand mode=create. */
  defaultDate?: Date
  onClose: () => void
  onSaved: () => void
}

/**
 * Sheet pour créer ou modifier un booking. Champs : titre, date, heure,
 * durée (presets), couleur (presets). Personnel par défaut.
 */
export function BookingFormSheet({ mode, initial, defaultDate, onClose, onSaved }: Props) {
  const sheetRef = useRef<BottomSheet>(null)
  const open = initial != null

  const [title, setTitle] = useState('')
  const [scheduled, setScheduled] = useState<Date>(() => defaultDate ?? new Date())
  const [duration, setDuration] = useState<number>(30)
  const [color, setColor] = useState<string>('#6b7280')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  // Sélection calendrier — perso par défaut, ou un des booking_calendars du workspace.
  const [calendars, setCalendars] = useState<CalendarRow[]>([])
  const [calendarId, setCalendarId] = useState<string | null>(null)

  // Fetch des calendriers à l'ouverture (1 fois).
  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      try {
        const res = await api.get<{ data: CalendarRow[] }>('/api/booking-calendars')
        if (!cancelled) setCalendars(res.data ?? [])
      } catch {
        if (!cancelled) setCalendars([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  // Init depuis `initial` quand on ouvre.
  useEffect(() => {
    if (!initial) return
    setTitle(initial.title ?? '')
    setScheduled(initial.scheduled_at ? new Date(initial.scheduled_at) : defaultDate ?? new Date())
    setDuration(initial.duration_minutes ?? 30)
    setColor(initial.color ?? '#6b7280')
    setNotes(initial.notes ?? '')
    setCalendarId(initial.calendar_id ?? null)
  }, [initial, defaultDate])

  useEffect(() => {
    if (open) sheetRef.current?.snapToIndex(0)
    else sheetRef.current?.close()
  }, [open])

  const renderBackdrop = useMemo(
    () =>
      // eslint-disable-next-line react/display-name
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.5} />
      ),
    []
  )

  const adjustMinutes = (delta: number) => {
    const next = new Date(scheduled)
    next.setMinutes(next.getMinutes() + delta)
    setScheduled(next)
  }

  const adjustDay = (delta: number) => {
    const next = new Date(scheduled)
    next.setDate(next.getDate() + delta)
    setScheduled(next)
  }

  const save = async () => {
    if (!title.trim()) {
      Alert.alert('Titre requis', 'Donne un titre à ton RDV.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        scheduled_at: scheduled.toISOString(),
        duration_minutes: duration,
        color,
        notes: notes.trim() || null,
      }
      if (mode === 'create') {
        const isPerso = !calendarId
        await api.post('/api/bookings', {
          ...payload,
          is_personal: isPerso,
          calendar_id: calendarId,
        })
      } else if (initial?.id) {
        await api.patch(`/api/bookings/${initial.id}`, payload)
      }
      onSaved()
      onClose()
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Échec sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={['85%']}
      enableDynamicSizing={false}
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.sheet }}
      handleIndicatorStyle={{ backgroundColor: colors.textTertiary }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
    >
      <BottomSheetView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              borderBottomWidth: 0.33,
              borderBottomColor: colors.border,
            }}
          >
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={{ ...t.body, color: colors.textSecondary }}>Annuler</Text>
            </Pressable>
            <Text style={{ ...t.bodyEmphasis, color: colors.textPrimary }}>
              {mode === 'create' ? 'Nouveau RDV' : 'Modifier RDV'}
            </Text>
            <Pressable onPress={save} disabled={saving} hitSlop={10}>
              <Text
                style={{
                  ...t.body,
                  color: saving ? colors.textTertiary : colors.primary,
                  fontWeight: '700',
                }}
              >
                {saving ? '…' : 'OK'}
              </Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{
              padding: spacing.lg,
              gap: spacing.lg,
              paddingBottom: 60,
            }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Calendrier — perso ou un des booking_calendars (mode create) */}
            {mode === 'create' && calendars.length > 0 ? (
              <View style={{ gap: 6 }}>
                <SectionLabel>Calendrier</SectionLabel>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <CalendarChip
                    active={calendarId === null}
                    color="#6b7280"
                    label="Perso"
                    onPress={() => {
                      setCalendarId(null)
                    }}
                  />
                  {calendars.map((c) => (
                    <CalendarChip
                      key={c.id}
                      active={calendarId === c.id}
                      color={c.color}
                      label={c.name}
                      onPress={() => {
                        setCalendarId(c.id)
                        // Auto-applique la couleur du calendrier sélectionné.
                        setColor(c.color)
                        // Duration suggérée du calendrier.
                        setDuration(c.duration_minutes)
                      }}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {/* Titre */}
            <View style={{ gap: 6 }}>
              <SectionLabel>Titre</SectionLabel>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Ex: Coaching avec Alex"
                placeholderTextColor={colors.textTertiary}
                style={{
                  ...t.body,
                  color: colors.textPrimary,
                  backgroundColor: colors.bgSecondary,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.md,
                  paddingVertical: 12,
                }}
              />
            </View>

            {/* Date */}
            <View style={{ gap: 6 }}>
              <SectionLabel>Jour</SectionLabel>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.bgSecondary,
                  borderRadius: radius.md,
                  padding: 6,
                }}
              >
                <StepperButton icon="chevron-back" onPress={() => adjustDay(-1)} />
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ ...t.bodyEmphasis, color: colors.textPrimary }}>
                    {scheduled.toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      day: '2-digit',
                      month: 'long',
                    })}
                  </Text>
                </View>
                <StepperButton icon="chevron-forward" onPress={() => adjustDay(1)} />
              </View>
            </View>

            {/* Heure */}
            <View style={{ gap: 6 }}>
              <SectionLabel>Heure</SectionLabel>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.bgSecondary,
                  borderRadius: radius.md,
                  padding: 6,
                }}
              >
                <StepperButton icon="remove" onPress={() => adjustMinutes(-15)} />
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text
                    style={{
                      ...t.title3,
                      color: colors.textPrimary,
                    }}
                  >
                    {scheduled.toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                <StepperButton icon="add" onPress={() => adjustMinutes(15)} />
              </View>
            </View>

            {/* Durée */}
            <View style={{ gap: 6 }}>
              <SectionLabel>Durée</SectionLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {DURATION_PRESETS.map((m) => {
                  const active = duration === m
                  return (
                    <Pressable
                      key={m}
                      onPress={() => setDuration(m)}
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
                        {m < 60 ? `${m}min` : `${m / 60}h${m % 60 ? (m % 60) : ''}`}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>

            {/* Couleur */}
            <View style={{ gap: 6 }}>
              <SectionLabel>Couleur</SectionLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {COLOR_PRESETS.map((c) => {
                  const active = color === c.hex
                  return (
                    <Pressable
                      key={c.hex}
                      onPress={() => setColor(c.hex)}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: c.hex,
                        borderWidth: active ? 3 : 0,
                        borderColor: '#fff',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {active ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
                    </Pressable>
                  )
                })}
              </View>
            </View>

            {/* Notes */}
            <View style={{ gap: 6 }}>
              <SectionLabel>Notes (optionnel)</SectionLabel>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Détails du RDV..."
                placeholderTextColor={colors.textTertiary}
                multiline
                style={{
                  ...t.body,
                  color: colors.textPrimary,
                  backgroundColor: colors.bgSecondary,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.md,
                  paddingVertical: 12,
                  minHeight: 80,
                  textAlignVertical: 'top',
                }}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </BottomSheetView>
    </BottomSheet>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      style={{
        ...t.footnote,
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        fontWeight: '600',
        marginLeft: 4,
      }}
    >
      {children}
    </Text>
  )
}

function CalendarChip({
  active,
  color,
  label,
  onPress,
}: {
  active: boolean
  color: string
  label: string
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: radius.pill,
        backgroundColor: active ? color + '22' : 'transparent',
        borderWidth: 1,
        borderColor: active ? color : colors.border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text
        style={{
          ...t.subheadline,
          color: active ? colors.textPrimary : colors.textSecondary,
          fontWeight: active ? '700' : '600',
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}

function StepperButton({
  icon,
  onPress,
}: {
  icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: radius.md,
        backgroundColor: colors.bgElevated,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name={icon} size={18} color={colors.textPrimary} />
    </Pressable>
  )
}
