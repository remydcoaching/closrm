import React, { useMemo, useState } from 'react'
import { View, Text, FlatList, RefreshControl, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { CallsStackParamList } from '../../navigation/types'
import { useCalls } from '../../hooks/useCalls'
import { CallSlot } from '../../components/calls/CallSlot'
import { DayStrip } from '../../components/calls/DayStrip'
import { NavLarge, KpiCard } from '../../components/ui'
import { colors } from '../../theme/colors'

type Nav = NativeStackNavigationProp<CallsStackParamList, 'CallsDay'>

const formatAmount = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

export function CallsDayScreen() {
  const navigation = useNavigation<Nav>()
  const [date, setDate] = useState<Date>(() => new Date())
  const { calls, loading, refetch } = useCalls(date)

  // KPIs du jour
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
        if (c.type === 'closing' && c.lead?.deal_amount) {
          closed += c.lead.deal_amount
        }
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
            : date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
        }
      />

      <View style={{ marginBottom: 14 }}>
        <DayStrip selectedDate={date} onSelect={setDate} />
      </View>

      <View style={{ paddingHorizontal: 16, flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        <KpiCard label="Planifiés" value={plannedCount} borderColor={colors.info} />
        <KpiCard label="Faits" value={doneCount} borderColor={colors.purple} />
        <KpiCard
          label="Closed"
          value={closedAmount > 0 ? formatAmount(closedAmount) : '—'}
          borderColor={colors.primary}
        />
      </View>

      {loading && calls.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={calls}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 10 }}
          renderItem={({ item }) => (
            <CallSlot
              call={item}
              isNext={item.id === nextCallId}
              onPress={() => navigation.navigate('CallDetail', { callId: item.id })}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={refetch}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                Aucun call ce jour-là.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}
