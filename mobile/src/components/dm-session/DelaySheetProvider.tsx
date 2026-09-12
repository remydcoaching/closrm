import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'

interface DelaySheetParams {
  leadName: string
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

const DELAY_OPTIONS = [2, 3, 7, 14, 30]

export function DelaySheetProvider({ children }: { children: React.ReactNode }) {
  const sheetRef = useRef<BottomSheet>(null)
  const [state, setState] = useState<DelaySheetParams | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const open = useCallback((params: DelaySheetParams) => {
    setState(params)
    sheetRef.current?.expand()
  }, [])

  const value = useMemo<DelaySheetContextValue>(() => ({ open }), [open])

  const handleSelect = useCallback(async (days: number) => {
    if (!state || submitting) return
    setSubmitting(true)
    try {
      await state.onConfirm(days)
      sheetRef.current?.close()
    } finally {
      setSubmitting(false)
    }
  }, [state, submitting])

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.6} />
    ),
    []
  )

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
          if (idx === -1) setState(null)
        }}
      >
        <BottomSheetView style={{ padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md }}>
          <Text style={{ ...t.subheadline, color: colors.textPrimary, fontWeight: '700' }}>
            Prochaine relance
          </Text>
          <Text style={{ ...t.footnote, color: colors.textSecondary }}>
            Quand faut-il recontacter {state?.leadName ?? 'ce lead'} ?
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {DELAY_OPTIONS.map((days) => (
              <Pressable
                key={days}
                onPress={() => handleSelect(days)}
                disabled={submitting}
                style={({ pressed }) => ({
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.md,
                  backgroundColor: colors.bgPrimary,
                  borderWidth: 1,
                  borderColor: colors.border,
                  opacity: submitting ? 0.5 : pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ ...t.footnote, color: colors.textPrimary, fontWeight: '700' }}>{days}j</Text>
              </Pressable>
            ))}
          </View>
        </BottomSheetView>
      </BottomSheet>
    </DelaySheetContext.Provider>
  )
}
