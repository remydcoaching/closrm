import React from 'react'
import { View, Text, ScrollView, RefreshControl, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { usePulseKpis } from '../../hooks/usePulseKpis'
import { Card, KpiCard } from '../../components/ui'
import { colors } from '../../theme/colors'

const fmtEur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

export function PulseScreen() {
  const { kpis, loading, refetch } = usePulseKpis()

  const todayDayIdx = (new Date().getDay() + 6) % 7
  const monthName = new Date().toLocaleDateString('fr-FR', { month: 'long' })

  if (loading && !kpis) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    )
  }

  if (!kpis) return null

  const maxFunnel = Math.max(kpis.funnel.leads, 1)
  const maxWeekly = Math.max(...kpis.weeklyActivity, 1)

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 80, gap: 16 }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refetch} tintColor={colors.primary} />
        }
      >
        {/* Header */}
        <View>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 0.5,
            }}
          >
            {new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()} · TEMPS RÉEL
          </Text>
          <Text style={{ color: colors.textPrimary, fontSize: 28, fontWeight: '700', marginTop: 4 }}>
            Pulse
          </Text>
        </View>

        {/* Hero Revenue */}
        <Card
          borderColor={colors.primary}
          borderPosition="top"
          borderWidthAccent={3}
          style={{ backgroundColor: colors.primary + '10', padding: 18 }}
        >
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 0.5,
            }}
          >
            REVENUE · {monthName.toUpperCase()}
          </Text>
          <Text style={{ color: colors.textPrimary, fontSize: 36, fontWeight: '700', marginTop: 4 }}>
            {fmtEur(kpis.revenueMonth)}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
            {kpis.funnel.deals} deal{kpis.funnel.deals > 1 ? 's' : ''} · panier moyen{' '}
            {fmtEur(kpis.avgBasket)}
          </Text>
        </Card>

        {/* Mini KPI grid */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <KpiCard
            label="Calls faits"
            value={kpis.callsDone}
            detail={`sur ${kpis.callsPlanned} prévus`}
            borderColor={colors.info}
          />
          <KpiCard
            label="Taux show"
            value={`${kpis.showRate}%`}
            detail="ce mois"
            borderColor={colors.purple}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <KpiCard
            label="Closing rate"
            value={`${kpis.closingRate}%`}
            detail={`${kpis.funnel.deals} deal${kpis.funnel.deals > 1 ? 's' : ''}`}
            borderColor={colors.warning}
          />
          <KpiCard
            label="Panier moyen"
            value={fmtEur(kpis.avgBasket)}
            detail="par deal"
            borderColor={colors.pink}
          />
        </View>

        {/* Funnel 30j */}
        <Card>
          <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 12 }}>
            FUNNEL · 30 JOURS
          </Text>
          <FunnelBar label="Leads entrants" value={kpis.funnel.leads} max={maxFunnel} color={colors.cyan} />
          <FunnelBar label="Setting validé" value={kpis.funnel.settingDone} max={maxFunnel} color={colors.info} />
          <FunnelBar label="Closing réalisé" value={kpis.funnel.closingDone} max={maxFunnel} color={colors.purple} />
          <FunnelBar label="Deals fermés" value={kpis.funnel.deals} max={maxFunnel} color={colors.primary} />
        </Card>

        {/* Activity heatmap 7j */}
        <Card>
          <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 12 }}>
            ACTIVITÉ · 7 JOURS
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 80, gap: 6 }}>
            {kpis.weeklyActivity.map((v, i) => {
              const isToday = i === todayDayIdx
              const h = Math.max(4, (v / maxWeekly) * 70)
              return (
                <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 10 }}>{v || ''}</Text>
                  <View
                    style={{
                      width: '70%',
                      height: h,
                      borderRadius: 4,
                      backgroundColor: isToday ? colors.primary : colors.border,
                    }}
                  />
                  <Text
                    style={{
                      color: isToday ? colors.primary : colors.textSecondary,
                      fontSize: 11,
                      fontWeight: isToday ? '700' : '400',
                    }}
                  >
                    {DAY_LABELS[i]}
                  </Text>
                </View>
              )
            })}
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 8, textAlign: 'center' }}>
            Total semaine : {kpis.weeklyActivity.reduce((a, b) => a + b, 0)} leads
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  )
}

function FunnelBar({
  label,
  value,
  max,
  color,
}: {
  label: string
  value: number
  max: number
  color: string
}) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '500' }}>{label}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
          {value} <Text style={{ color: color, fontWeight: '700' }}>{percent}%</Text>
        </Text>
      </View>
      <View style={{ height: 8, backgroundColor: colors.bgSecondary, borderRadius: 4, overflow: 'hidden' }}>
        <View
          style={{
            width: `${percent}%`,
            height: '100%',
            backgroundColor: color,
            borderRadius: 4,
          }}
        />
      </View>
    </View>
  )
}
