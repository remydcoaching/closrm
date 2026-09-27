import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, ActivityIndicator } from 'react-native'
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'
import type { DmSessionRelanceStepOption } from '../../hooks/useDmSession'

interface DelaySheetParams {
  leadName: string
  /** Étapes de relance possibles du process (ex: "Relance" J+3, "Reprise
   *  après une longue absence" J+30) — le setter choisit laquelle programmer.
   *  Vide si aucun process actif : on retombe sur un simple choix de délai. */
  relanceStepOptions: DmSessionRelanceStepOption[]
  /** id de l'étape déduite automatiquement par le process (next_step_id) —
   *  pré-sélectionnée par défaut, mais le setter peut choisir une autre
   *  option de relanceStepOptions à la place. */
  suggestedStepId: string | null
  onConfirm: (delayDays: number) => void | Promise<void>
}

interface DelaySheetContextValue {
  open: (params: DelaySheetParams) => void
}

const DelaySheetContext = createContext<DelaySheetContextValue | null>(null)

export function useDelaySheet(): DelaySheetContextValue {
  const ctx = useContext(DelaySheetContext)
  if (!ctx) {
    if (__DEV__) console.warn('useDelaySheet appelé hors DelaySheetProvider')
    return { open: () => {} }
  }
  return ctx
}

const FALLBACK_DELAY_OPTIONS = [2, 3, 7, 14, 30]
// Choix rapides proposés autour du délai par défaut de l'étape choisie, pour
// ajuster sans devoir taper un nombre.
const ADJUSTABLE_DELAY_OPTIONS = [1, 2, 3, 7, 14, 30, 60]

export function DelaySheetProvider({ children }: { children: React.ReactNode }) {
  const sheetRef = useRef<BottomSheet>(null)
  const [state, setState] = useState<DelaySheetParams | null>(null)
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)
  const [selectedDelay, setSelectedDelay] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const open = useCallback((params: DelaySheetParams) => {
    setState(params)
    const initialStepId = params.suggestedStepId ?? params.relanceStepOptions[0]?.step_id ?? null
    setSelectedStepId(initialStepId)
    const initialStep = params.relanceStepOptions.find((s) => s.step_id === initialStepId)
    setSelectedDelay(initialStep?.delay_days ?? null)
    sheetRef.current?.expand()
  }, [])

  const value = useMemo<DelaySheetContextValue>(() => ({ open }), [open])

  const handleConfirm = useCallback(
    async (days: number) => {
      if (!state || submitting) return
      setSubmitting(true)
      try {
        await state.onConfirm(days)
        sheetRef.current?.close()
      } finally {
        setSubmitting(false)
      }
    },
    [state, submitting]
  )

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.6} />
    ),
    []
  )

  const stepOptions = state?.relanceStepOptions ?? []
  const hasStepChoice = stepOptions.length > 0
  const delayOptions = hasStepChoice ? ADJUSTABLE_DELAY_OPTIONS : FALLBACK_DELAY_OPTIONS

  function handleSelectStep(stepId: string) {
    setSelectedStepId(stepId)
    const step = stepOptions.find((s) => s.step_id === stepId)
    setSelectedDelay(step?.delay_days ?? null)
  }

  return (
    <DelaySheetContext.Provider value={value}>
      {children}
      <BottomSheet
        ref={sheetRef}
        index={-1}
        enablePanDownToClose
        enableDynamicSizing
        backgroundStyle={{ backgroundColor: colors.bgSecondary }}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
        backdropComponent={renderBackdrop}
        onChange={(idx) => {
          if (idx === -1) {
            setState(null)
            setSelectedStepId(null)
            setSelectedDelay(null)
          }
        }}
      >
        <BottomSheetView style={{ padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.lg }}>
          <Text style={{ ...t.footnote, color: colors.textSecondary, fontWeight: '600' }}>
            Prochaine étape pour {state?.leadName ?? 'ce lead'}
          </Text>

          {hasStepChoice ? (
            <View style={{ gap: spacing.sm }}>
              {stepOptions.map((step) => {
                const active = selectedStepId === step.step_id
                return (
                  <Pressable
                    key={step.step_id}
                    onPress={() => handleSelectStep(step.step_id)}
                    disabled={submitting}
                    style={({ pressed }) => ({
                      paddingVertical: spacing.md,
                      paddingHorizontal: spacing.md,
                      borderRadius: radius.md,
                      backgroundColor: active ? colors.primary + '1A' : colors.bgPrimary,
                      borderWidth: active ? 2 : 1,
                      borderColor: active ? colors.primary : colors.border,
                      opacity: submitting ? 0.5 : pressed ? 0.8 : 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    })}
                  >
                    <Text
                      style={{
                        ...t.subheadline,
                        color: active ? colors.primary : colors.textPrimary,
                        fontWeight: '700',
                      }}
                    >
                      {step.title}
                    </Text>
                    {step.delay_days != null && (
                      <Text
                        style={{
                          ...t.caption1,
                          color: active ? colors.primary : colors.textSecondary,
                          fontWeight: '600',
                        }}
                      >
                        {step.step_id === state?.suggestedStepId ? 'Conseillé · ' : ''}
                        {step.delay_days}j par défaut
                      </Text>
                    )}
                  </Pressable>
                )
              })}
            </View>
          ) : (
            <Text style={{ ...t.title3, color: colors.textPrimary, fontWeight: '700' }}>Relance</Text>
          )}

          <View>
            <Text style={{ ...t.caption1, color: colors.textSecondary, fontWeight: '600', marginBottom: spacing.sm }}>
              Dans combien de temps ?
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {delayOptions.map((days) => {
                const active = selectedDelay === days
                return (
                  <Pressable
                    key={days}
                    onPress={() => setSelectedDelay(days)}
                    disabled={submitting}
                    style={({ pressed }) => ({
                      paddingVertical: spacing.sm,
                      paddingHorizontal: spacing.md,
                      borderRadius: radius.pill,
                      backgroundColor: active ? colors.primary : colors.bgPrimary,
                      borderWidth: 1,
                      borderColor: active ? colors.primary : colors.border,
                      opacity: submitting ? 0.5 : pressed ? 0.7 : 1,
                    })}
                  >
                    <Text
                      style={{
                        ...t.footnote,
                        color: active ? '#fff' : colors.textPrimary,
                        fontWeight: '700',
                      }}
                    >
                      {days}j
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>

          <Pressable
            onPress={() => selectedDelay && handleConfirm(selectedDelay)}
            disabled={submitting || !selectedDelay}
            style={{
              backgroundColor: colors.primary,
              borderRadius: radius.lg,
              paddingVertical: spacing.md,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: spacing.sm,
              opacity: submitting || !selectedDelay ? 0.5 : 1,
            }}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={{ ...t.subheadline, color: '#fff', fontWeight: '700' }}>
                {selectedDelay ? `Confirmer — dans ${selectedDelay}j` : 'Choisis un délai'}
              </Text>
            )}
          </Pressable>
        </BottomSheetView>
      </BottomSheet>
    </DelaySheetContext.Provider>
  )
}
