import React, { useMemo, useState } from 'react'
import { View, Text, ScrollView, RefreshControl, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { CallsStackParamList } from '../../navigation/types'
import { useCalls } from '../../hooks/useCalls'
import { CallSlot } from '../../components/calls/CallSlot'
import { DayStrip } from '../../components/calls/DayStrip'
import { NavLarge } from '../../components/ui'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'

type Nav = NativeStackNavigationProp<CallsStackParamList, 'CallsDay'>

const formatAmount = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

export function CallsDayScreen() {
  const navigation = useNavigation<Nav>()
  const [date, setDate] = useState<Date>(() => new Date())
  const { calls, loading, refetch } = useCalls(date)

  const { plannedCount, doneCount, closedAmount, nextCallId } = useMemo(() => {
    let planned = 0
    let done = 0
    let closed = 0
    let nextId: string | null = null
    let nextTs = Number.POSITIVE_INFINITY
    const now = Date.now()
    for (const c of calls) {
      if (c.outcome === 'pending') {
        planned++
        const ts = new Date(c.scheduled_at).getTime()
        if (ts >= now && ts < nextTs) {
          nextTs = ts
          nextId = c.id
        }
      } else if (c.outcome === 'done') {
        done++
        if (c.type === 'closing' && c.lead?.deal_amount) closed += c.lead.deal_amount
      }
    }
    return { plannedCount: planned, doneCount: done, closedAmount: closed, nextCallId: nextId }
  }, [calls])

  const isToday =
    date.getFullYear() === new Date().getFullYear() &&
    date.getMonth() === new Date().getMonth() &&
    date.getDate() === new Date().getDate()

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <NavLarge
        title="Calls"
        subtitle={
          isToday
            ? "Aujourd'hui"
            : date.toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })
        }
      />

      <View style={{ marginBottom: spacing.lg }}>
        <DayStrip selectedDate={date} onSelect={setDate} />
      </View>

      {/* KPI summary inline grouped */}
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: spacing.lg,
          marginBottom: spacing.xl,
          gap: spacing.md,
        }}
      >
        <SmallKpi label="Planifiés" value={String(plannedCount)} tint={colors.info} />
        <SmallKpi label="Faits" value={String(doneCount)} tint={colors.purple} />
        <SmallKpi
          label="Closed"
          value={closedAmount > 0 ? formatAmount(closedAmount) : '—'}
          tint={colors.primary}
        />
      </View>

      {loading && calls.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: 100,
            gap: spacing.md,
          }}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refetch} tintColor={colors.primary} />
          }
        >
          {calls.length === 0 ? (
            <Text
              style={{
                ...t.subheadline,
                color: colors.textSecondary,
                textAlign: 'center',
                paddingVertical: 60,
              }}
            >
              Aucun call ce jour-là.
            </Text>
          ) : (
            <>
              {calls.map((c) => (
                <CallSlot
                  key={c.id}
                  call={c}
                  isNext={c.id === nextCallId}
                  onPress={() => navigation.navigate('CallDetail', { callId: c.id })}
                />
              ))}
              {/* Divider 'FIN DE JOURNÉE' style Apple Calendar */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  marginTop: spacing.xl,
                }}
              >
                <View style={{ flex: 1, height: 0.33, backgroundColor: colors.border }} />
                <Text
                  style={{
                    ...t.caption2,
                    color: colors.textSecondary,
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                  }}
                >
                  Fin de journée
                </Text>
                <View style={{ flex: 1, height: 0.33, backgroundColor: colors.border }} />
              </View>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

function SmallKpi({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bgSecondary,
        borderRadius: radius.lg,
        padding: spacing.md,
        gap: 4,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: tint }} />
        <Text
          style={{
            ...t.caption2,
            color: colors.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            fontWeight: '600',
          }}
        >
          {label}
        </Text>
      </View>
      <Text style={{ ...t.title3, color: colors.textPrimary }}>{value}</Text>
    </View>
  )
}
