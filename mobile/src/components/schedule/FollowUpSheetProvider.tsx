import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, ActivityIndicator } from 'react-native'
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet'
import { Ionicons } from '@expo/vector-icons'
import type { Lead } from '@shared/types'
import { Avatar, StatusBadge, Button, Segmented } from '../ui'
import { colors } from '../../theme/colors'
import { api } from '../../services/api'

interface FollowUpParams {
  lead: Lead
}

interface FollowUpSheetContextValue {
  open: (params: FollowUpParams) => void
}

const FollowUpSheetContext = createContext<FollowUpSheetContextValue | null>(null)

export function useFollowUpSheet(): FollowUpSheetContextValue {
  const ctx = useContext(FollowUpSheetContext)
  if (!ctx) {
    if (__DEV__) console.warn('useFollowUpSheet appelé hors FollowUpSheetProvider')
    return { open: () => {} }
  }
  return ctx
}

const DELAYS = [
  { key: 1, label: '1j' },
  { key: 3, label: '3j' },
  { key: 7, label: '7j' },
  { key: 14, label: '14j' },
] as const

interface SheetState {
  lead: Lead
  delayIdx: number
  notes: string
  submitting: boolean
}

export function FollowUpSheetProvider({ children }: { children: React.ReactNode }) {
  const sheetRef = useRef<BottomSheet>(null)
  const [state, setState] = useState<SheetState | null>(null)

  const open = useCallback((params: FollowUpParams) => {
    setState({ lead: params.lead, delayIdx: 1, notes: '', submitting: false })
    sheetRef.current?.snapToIndex(0)
  }, [])

  const close = useCallback(() => {
    sheetRef.current?.close()
    setState(null)
  }, [])

  const submit = useCallback(async () => {
    if (!state) return
    setState((s) => (s ? { ...s, submitting: true } : s))
    try {
      const delayDays = DELAYS[state.delayIdx].key
      const scheduled = new Date()
      scheduled.setDate(scheduled.getDate() + delayDays)
      scheduled.setHours(9, 0, 0, 0)
      await api.post('/api/follow-ups', {
        lead_id: state.lead.id,
        reason: 'Message envoyé — relance à prévoir',
        scheduled_at: scheduled.toISOString(),
        channel: 'manuel',
        notes: state.notes || undefined,
      })
      close()
    } catch (e) {
      if (__DEV__) console.warn('follow-up submit error', e)
      setState((s) => (s ? { ...s, submitting: false } : s))
    }
  }, [state, close])

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.6} />
    ),
    [],
  )

  const value = useMemo<FollowUpSheetContextValue>(() => ({ open }), [open])

  return (
    <FollowUpSheetContext.Provider value={value}>
      {children}
      <BottomSheet
        ref={sheetRef}
        index={-1}
        enablePanDownToClose
        enableDynamicSizing={false}
        snapPoints={['55%']}
        backgroundStyle={{ backgroundColor: colors.sheet }}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
        backdropComponent={renderBackdrop}
        onChange={(idx) => {
          if (idx === -1) setState(null)
        }}
      >
        <BottomSheetView style={{ padding: 16, paddingBottom: 32, flex: 1 }}>
          {state ? (
            <FollowUpSheetContent
              state={state}
              onDelayChange={(i) => setState((s) => (s ? { ...s, delayIdx: i } : s))}
              onNotesChange={(v) => setState((s) => (s ? { ...s, notes: v } : s))}
              onSubmit={submit}
              onClose={close}
            />
          ) : null}
        </BottomSheetView>
      </BottomSheet>
    </FollowUpSheetContext.Provider>
  )
}

interface ContentProps {
  state: SheetState
  onDelayChange: (i: number) => void
  onNotesChange: (v: string) => void
  onSubmit: () => void
  onClose: () => void
}

function FollowUpSheetContent({ state, onDelayChange, onNotesChange, onSubmit, onClose }: ContentProps) {
  const fullName = `${state.lead.first_name} ${state.lead.last_name}`.trim() || '—'
  const delayDays = DELAYS[state.delayIdx].key

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>
          Planifier une relance
        </Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <Ionicons name="close" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

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

      <View>
        <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
          RELANCE DANS
        </Text>
        <Segmented
          items={DELAYS.map((d) => ({ label: d.label }))}
          activeIndex={state.delayIdx}
          onChange={onDelayChange}
        />
      </View>

      <View>
        <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
          NOTE (OPTIONNEL)
        </Text>
        <BottomSheetTextInput
          value={state.notes}
          onChangeText={onNotesChange}
          placeholder="Ex : message envoyé, en attente de réponse…"
          placeholderTextColor={colors.textTertiary}
          multiline
          style={{
            backgroundColor: colors.bgElevated,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            padding: 12,
            color: colors.textPrimary,
            fontSize: 14,
            minHeight: 60,
          }}
        />
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: colors.primary + '15',
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderWidth: 1,
          borderColor: colors.primary + '40',
        }}
      >
        <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600', flex: 1 }}>
          Relance le {new Date(Date.now() + delayDays * 86400000).toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })} à 9h00
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button label="Annuler" variant="outline" fullWidth size="md" onPress={onClose} />
        </View>
        <View style={{ flex: 2 }}>
          <Button
            label={state.submitting ? 'Création…' : 'Confirmer la relance'}
            fullWidth
            size="md"
            disabled={state.submitting}
            loading={state.submitting}
            onPress={onSubmit}
          />
        </View>
      </View>

      {state.submitting ? <ActivityIndicator color={colors.primary} /> : null}
    </View>
  )
}
