import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetView,
} from '@gorhom/bottom-sheet'
import { Ionicons } from '@expo/vector-icons'
import type { Lead, Call } from '@shared/types'
import { Avatar, StatusBadge, Button, Segmented } from '../ui'
import { colors } from '../../theme/colors'
import { supabase } from '../../services/supabase'
import { api } from '../../services/api'

interface ScheduleParams {
  lead: Lead
}

interface ScheduleSheetContextValue {
  open: (params: ScheduleParams) => void
}

const ScheduleSheetContext = createContext<ScheduleSheetContextValue | null>(null)

export function useScheduleSheet(): ScheduleSheetContextValue {
  const ctx = useContext(ScheduleSheetContext)
  if (!ctx) {
    // Si on est appelé hors du provider, fail noisy en dev (dev-only).
    if (__DEV__) console.warn('useScheduleSheet appelé hors ScheduleSheetProvider')
    return { open: () => {} }
  }
  return ctx
}

const TYPES = [
  { key: 'setting', label: 'Setting', color: colors.info },
  { key: 'closing', label: 'Closing', color: colors.purple },
  { key: 'follow_up', label: 'Follow-up', color: colors.orange },
] as const

const HOURS_RANGE = Array.from({ length: 12 }, (_, i) => 8 + i) // 08-19
const MINUTES_RANGE = [0, 15, 30, 45]
const DAYS_AHEAD = 7

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

const isoDay = (d: Date) => d.toISOString().slice(0, 10)
const dayShort = (d: Date) =>
  d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '').toUpperCase()

interface SheetState {
  lead: Lead
  typeIdx: 0 | 1 | 2
  selectedDate: Date
  hour: number
  minute: number
  submitting: boolean
}

export function ScheduleSheetProvider({ children }: { children: React.ReactNode }) {
  const sheetRef = useRef<BottomSheet>(null)
  const [state, setState] = useState<SheetState | null>(null)
  const [conflicts, setConflicts] = useState<Set<string>>(new Set())
  const [conflictsByDate, setConflictsByDate] = useState<Record<string, number>>({})

  const open = useCallback((params: ScheduleParams) => {
    const now = new Date()
    setState({
      lead: params.lead,
      typeIdx: params.lead.status === 'closing_planifie' ? 1 : 0,
      selectedDate: now,
      hour: Math.min(19, Math.max(8, now.getHours() + 1)),
      minute: 0,
      submitting: false,
    })
    sheetRef.current?.snapToIndex(0)
  }, [])

  const close = useCallback(() => {
    sheetRef.current?.close()
    setState(null)
    setConflicts(new Set())
    setConflictsByDate({})
  }, [])

  // Fetch des calls pour les 7 prochains jours dès qu'on ouvre la sheet,
  // pour détecter les conflits de créneaux + count par jour.
  const fetchConflicts = useCallback(async () => {
    if (!state) return
    const from = new Date()
    from.setHours(0, 0, 0, 0)
    const to = new Date(from)
    to.setDate(from.getDate() + DAYS_AHEAD)
    const { data } = await supabase
      .from('calls')
      .select('scheduled_at, duration_seconds, outcome')
      .gte('scheduled_at', from.toISOString())
      .lt('scheduled_at', to.toISOString())
    const taken = new Set<string>()
    const counts: Record<string, number> = {}
    for (const c of (data ?? []) as Pick<Call, 'scheduled_at' | 'duration_seconds' | 'outcome'>[]) {
      if (c.outcome === 'cancelled') continue
      const d = new Date(c.scheduled_at)
      const key = `${isoDay(d)}-${d.getHours()}:${d.getMinutes()}`
      taken.add(key)
      const dk = isoDay(d)
      counts[dk] = (counts[dk] ?? 0) + 1
    }
    setConflicts(taken)
    setConflictsByDate(counts)
  }, [state])

  React.useEffect(() => {
    if (state) void fetchConflicts()
  }, [state, fetchConflicts])

  const days = useMemo(() => {
    const out: Date[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      out.push(d)
    }
    return out
  }, [])

  const isCurrentSlotTaken = useMemo(() => {
    if (!state) return false
    return conflicts.has(`${isoDay(state.selectedDate)}-${state.hour}:${state.minute}`)
  }, [state, conflicts])

  // Bloque la planification dans le passé (cf bug équivalent côté web
  // social — l'UI laissait choisir une date passée puis le backend
  // acceptait sans broncher).
  const isInPast = useMemo(() => {
    if (!state) return false
    const scheduled = new Date(state.selectedDate)
    scheduled.setHours(state.hour, state.minute, 0, 0)
    return scheduled.getTime() < Date.now()
  }, [state])

  const submit = useCallback(async () => {
    if (!state) return
    if (isCurrentSlotTaken) return
    if (isInPast) return
    setState((s) => (s ? { ...s, submitting: true } : s))
    try {
      const scheduled = new Date(state.selectedDate)
      scheduled.setHours(state.hour, state.minute, 0, 0)
      const type = TYPES[state.typeIdx].key
      // Le backend v1 n'a pas le type "follow_up" pour les calls — on map sur "setting".
      const callType = type === 'follow_up' ? 'setting' : type
      await api.post('/api/calls', {
        lead_id: state.lead.id,
        type: callType,
        scheduled_at: scheduled.toISOString(),
      })
      close()
    } catch (e) {
      // toast (à brancher plus tard) — pour l'instant on log
      if (__DEV__) console.warn('schedule submit error', e)
      setState((s) => (s ? { ...s, submitting: false } : s))
    }
  }, [state, isCurrentSlotTaken, close])

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.6} />
    ),
    [],
  )

  const value = useMemo<ScheduleSheetContextValue>(() => ({ open }), [open])

  return (
    <ScheduleSheetContext.Provider value={value}>
      {children}
      <BottomSheet
        ref={sheetRef}
        snapPoints={['85%']}
        index={-1}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: colors.sheet }}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
        backdropComponent={renderBackdrop}
        onChange={(idx) => {
          if (idx === -1) {
            setState(null)
            setConflicts(new Set())
            setConflictsByDate({})
          }
        }}
      >
        <BottomSheetView style={{ flex: 1, padding: 16 }}>
          {state ? (
            <ScheduleSheetContent
              state={state}
              days={days}
              conflicts={conflicts}
              conflictsByDate={conflictsByDate}
              isTaken={isCurrentSlotTaken}
              isInPast={isInPast}
              onTypeChange={(i) =>
                setState((s) => (s ? { ...s, typeIdx: i as 0 | 1 | 2 } : s))
              }
              onDayChange={(d) => setState((s) => (s ? { ...s, selectedDate: d } : s))}
              onHourChange={(h) => setState((s) => (s ? { ...s, hour: h } : s))}
              onMinuteChange={(m) => setState((s) => (s ? { ...s, minute: m } : s))}
              onSubmit={submit}
              onClose={close}
            />
          ) : null}
        </BottomSheetView>
      </BottomSheet>
    </ScheduleSheetContext.Provider>
  )
}

interface ContentProps {
  state: SheetState
  days: Date[]
  conflicts: Set<string>
  conflictsByDate: Record<string, number>
  isTaken: boolean
  isInPast: boolean
  onTypeChange: (i: number) => void
  onDayChange: (d: Date) => void
  onHourChange: (h: number) => void
  onMinuteChange: (m: number) => void
  onSubmit: () => void
  onClose: () => void
}

function ScheduleSheetContent({
  state,
  days,
  conflicts,
  conflictsByDate,
  isTaken,
  isInPast,
  onTypeChange,
  onDayChange,
  onHourChange,
  onMinuteChange,
  onSubmit,
  onClose,
}: ContentProps) {
  const fullName = `${state.lead.first_name} ${state.lead.last_name}`.trim() || '—'

  return (
    // BottomSheetScrollView : version qui coopère avec le pan-down du sheet.
    // Sans ça, scroller dans la sheet déclencherait parfois la fermeture.
    <BottomSheetScrollView contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>
          Planifier un call
        </Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <Ionicons name="close" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Lead chip */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: colors.bgElevated,
          borderRadius: 12,
          padding: 10,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Avatar name={fullName} size={36} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600' }}>{fullName}</Text>
          <View style={{ flexDirection: 'row', marginTop: 4 }}>
            <StatusBadge status={state.lead.status} size="sm" />
          </View>
        </View>
      </View>

      {/* Type */}
      <View>
        <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
          TYPE DE CALL
        </Text>
        <Segmented
          items={TYPES.map((t) => ({ label: t.label }))}
          activeIndex={state.typeIdx}
          onChange={onTypeChange}
        />
      </View>

      {/* Day picker */}
      <View>
        <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
          JOUR
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6 }}
        >
          {days.map((d) => {
            const selected = sameDay(d, state.selectedDate)
            const today = sameDay(d, new Date())
            const dk = isoDay(d)
            const cnt = conflictsByDate[dk] ?? 0
            return (
              <Pressable
                key={dk}
                onPress={() => onDayChange(d)}
                style={{
                  width: 56,
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
                    color: selected ? '#fff' : colors.textSecondary,
                    fontSize: 10,
                    fontWeight: '700',
                  }}
                >
                  {dayShort(d)}
                </Text>
                <Text
                  style={{
                    color: selected ? '#fff' : today ? colors.primary : colors.textPrimary,
                    fontSize: 16,
                    fontWeight: '700',
                    marginTop: 2,
                  }}
                >
                  {d.getDate()}
                </Text>
                {cnt > 0 ? (
                  <Text
                    style={{
                      color: selected ? '#fff' : colors.textSecondary,
                      fontSize: 9,
                      marginTop: 1,
                    }}
                  >
                    {cnt} call{cnt > 1 ? 's' : ''}
                  </Text>
                ) : (
                  <View style={{ height: 11 }} />
                )}
              </Pressable>
            )
          })}
        </ScrollView>
      </View>

      {/* Time picker */}
      <View>
        <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
          HEURE
        </Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {/* Hours */}
          <View style={{ flex: 2 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 10, marginBottom: 4 }}>HEURES</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 4 }}
            >
              {HOURS_RANGE.map((h) => {
                const selected = h === state.hour
                return (
                  <Pressable
                    key={h}
                    onPress={() => onHourChange(h)}
                    style={{
                      minWidth: 38,
                      paddingVertical: 8,
                      paddingHorizontal: 10,
                      borderRadius: 10,
                      backgroundColor: selected ? colors.primary : colors.bgElevated,
                      borderWidth: 1,
                      borderColor: selected ? colors.primary : colors.border,
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        color: selected ? '#fff' : colors.textPrimary,
                        fontSize: 13,
                        fontWeight: '600',
                      }}
                    >
                      {h.toString().padStart(2, '0')}h
                    </Text>
                  </Pressable>
                )
              })}
            </ScrollView>
          </View>
          {/* Minutes */}
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 10, marginBottom: 4 }}>MIN</Text>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {MINUTES_RANGE.map((m) => {
                const selected = m === state.minute
                return (
                  <Pressable
                    key={m}
                    onPress={() => onMinuteChange(m)}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      borderRadius: 10,
                      backgroundColor: selected ? colors.primary : colors.bgElevated,
                      borderWidth: 1,
                      borderColor: selected ? colors.primary : colors.border,
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        color: selected ? '#fff' : colors.textPrimary,
                        fontSize: 13,
                        fontWeight: '600',
                      }}
                    >
                      {m.toString().padStart(2, '0')}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
        </View>
      </View>

      {/* Conflict / Past status */}
      {(() => {
        const isError = isTaken || isInPast
        const message = isInPast
          ? `Date passée — choisis une heure future`
          : isTaken
          ? `Conflit · un autre call est déjà à ${state.hour}h${state.minute.toString().padStart(2, '0')}`
          : `Libre · ${state.hour}h${state.minute.toString().padStart(2, '0')}`
        return (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: isError ? colors.danger + '22' : colors.primary + '15',
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderWidth: 1,
              borderColor: isError ? colors.danger + '55' : colors.primary + '40',
            }}
          >
            <Ionicons
              name={isError ? 'alert-circle' : 'checkmark-circle'}
              size={16}
              color={isError ? colors.danger : colors.primary}
            />
            <Text
              style={{
                color: isError ? colors.danger : colors.primary,
                fontSize: 12,
                fontWeight: '600',
                flex: 1,
              }}
            >
              {message}
            </Text>
          </View>
        )
      })()}

      {/* CTAs */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button label="Annuler" variant="outline" fullWidth size="md" onPress={onClose} />
        </View>
        <View style={{ flex: 2 }}>
          <Button
            label={
              state.submitting
                ? 'Création…'
                : `Planifier · ${state.hour}h${state.minute.toString().padStart(2, '0')}`
            }
            fullWidth
            size="md"
            disabled={isTaken || isInPast || state.submitting}
            loading={state.submitting}
            onPress={onSubmit}
          />
        </View>
      </View>

      {state.submitting ? <ActivityIndicator color={colors.primary} /> : null}
    </BottomSheetScrollView>
  )
}
