import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, RefreshControl, ScrollView, ActivityIndicator, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import type { AgendaStackParamList } from '../../navigation/types'
import { useAgenda } from '../../hooks/useAgenda'
import { AgendaTimeline } from '../../components/agenda/AgendaTimeline'
import { AgendaList } from '../../components/agenda/AgendaList'
import { DayStrip } from '../../components/calls/DayStrip'
import { NavLarge, Segmented } from '../../components/ui'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'
import { supabase } from '../../services/supabase'

const STRIP_BEFORE = 3
const STRIP_AFTER = 14
const isoDay = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

type Nav = NativeStackNavigationProp<AgendaStackParamList, 'AgendaDay'>

const formatAmount = (n: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n)

export function AgendaDayScreen() {
  const navigation = useNavigation<Nav>()
  const [date, setDate] = useState<Date>(() => new Date())
  const { items, loading, refetch } = useAgenda(date)
  const [countsByDate, setCountsByDate] = useState<Record<string, number>>({})
  // Vue : liste par défaut (plus lisible mobile, surtout sur jours chargés).
  // Persiste le choix de l'utilisateur entre les jours.
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list')

  // Counts pour le DayStrip : somme bookings + calls par jour, sur la fenêtre.
  useEffect(() => {
    let cancelled = false
    const fetchCounts = async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const from = new Date(today)
      from.setDate(today.getDate() - STRIP_BEFORE)
      const to = new Date(today)
      to.setDate(today.getDate() + STRIP_AFTER + 1)
      const [callsRes, bookingsRes] = await Promise.all([
        supabase
          .from('calls')
          .select('scheduled_at, outcome')
          .gte('scheduled_at', from.toISOString())
          .lt('scheduled_at', to.toISOString()),
        supabase
          .from('bookings')
          .select('scheduled_at, status, call_id')
          .gte('scheduled_at', from.toISOString())
          .lt('scheduled_at', to.toISOString()),
      ])
      if (cancelled) return
      const counts: Record<string, number> = {}
      for (const c of (callsRes.data ?? []) as {
        scheduled_at: string
        outcome: string
      }[]) {
        if (c.outcome === 'cancelled') continue
        const k = isoDay(new Date(c.scheduled_at))
        counts[k] = (counts[k] ?? 0) + 1
      }
      for (const b of (bookingsRes.data ?? []) as {
        scheduled_at: string
        status: string
        call_id: string | null
      }[]) {
        if (b.status === 'cancelled' || b.call_id) continue
        const k = isoDay(new Date(b.scheduled_at))
        counts[k] = (counts[k] ?? 0) + 1
      }
      setCountsByDate(counts)
    }
    void fetchCounts()
    const channel = supabase
      .channel('agenda-strip-counts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calls' },
        () => void fetchCounts()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => void fetchCounts()
      )
      .subscribe()
    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [])

  const stats = useMemo(() => {
    let upcoming = 0
    let done = 0
    let amount = 0
    const now = Date.now()
    for (const it of items) {
      const ts = new Date(it.scheduled_at).getTime()
      if (it.outcome === 'done') {
        done++
        if (it.kind === 'closing' && it.amount) amount += it.amount
      } else if (ts >= now) {
        upcoming++
      }
    }
    return { upcoming, done, amount }
  }, [items])

  const isToday =
    date.getFullYear() === new Date().getFullYear() &&
    date.getMonth() === new Date().getMonth() &&
    date.getDate() === new Date().getDate()

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <NavLarge
        title="Agenda"
        subtitle={
          isToday
            ? `Aujourd'hui · ${items.length} item${items.length > 1 ? 's' : ''}`
            : date.toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })
        }
        rightSlot={
          !isToday ? (
            <Pressable
              onPress={() => setDate(new Date())}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                backgroundColor: colors.bgSecondary,
                borderRadius: radius.pill,
              }}
            >
              <Text style={{ ...t.footnote, color: colors.primary, fontWeight: '600' }}>
                Aujourd&apos;hui
              </Text>
            </Pressable>
          ) : undefined
        }
      />

      <View style={{ marginBottom: spacing.md }}>
        <DayStrip
          selectedDate={date}
          onSelect={setDate}
          range={{ before: STRIP_BEFORE, after: STRIP_AFTER }}
          countsByDate={countsByDate}
        />
      </View>

      {/* KPI inline grouped */}
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: spacing.lg,
          marginBottom: spacing.md,
          gap: spacing.md,
        }}
      >
        <SmallKpi label="À venir" value={String(stats.upcoming)} tint={colors.info} />
        <SmallKpi label="Faits" value={String(stats.done)} tint={colors.purple} />
        <SmallKpi
          label="Closed"
          value={stats.amount > 0 ? formatAmount(stats.amount) : '—'}
          tint={colors.primary}
        />
      </View>

      {/* Toggle Liste / Timeline */}
      {items.length > 0 ? (
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <Segmented
            items={[
              { label: 'Liste', count: items.length },
              { label: 'Timeline' },
            ]}
            activeIndex={viewMode === 'list' ? 0 : 1}
            onChange={(i) => setViewMode(i === 0 ? 'list' : 'timeline')}
          />
        </View>
      ) : null}

      {loading && items.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: spacing.xl,
          }}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refetch} tintColor={colors.primary} />
          }
        >
          <Ionicons name="calendar-outline" size={48} color={colors.textTertiary} />
          <Text
            style={{
              ...t.headline,
              color: colors.textPrimary,
              marginTop: spacing.lg,
              textAlign: 'center',
            }}
          >
            Aucun événement
          </Text>
          <Text
            style={{
              ...t.subheadline,
              color: colors.textSecondary,
              marginTop: 4,
              textAlign: 'center',
            }}
          >
            {isToday ? 'Profite de ta journée libre.' : 'Pas de RDV ce jour-là.'}
          </Text>
        </ScrollView>
      ) : viewMode === 'list' ? (
        <AgendaList
          items={items}
          date={date}
          loading={loading}
          onRefresh={refetch}
          onPressItem={(it) => {
            if (it.source === 'call' && it.call_id) {
              navigation.navigate('CallDetail', { callId: it.call_id })
            } else if (it.source === 'booking' && it.lead_id) {
              navigation.navigate('LeadDetail', { leadId: it.lead_id })
            }
          }}
        />
      ) : (
        <AgendaTimeline
          items={items}
          date={date}
          onPressItem={(it) => {
            if (it.source === 'call' && it.call_id) {
              navigation.navigate('CallDetail', { callId: it.call_id })
            } else if (it.source === 'booking' && it.lead_id) {
              navigation.navigate('LeadDetail', { leadId: it.lead_id })
            }
          }}
        />
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
