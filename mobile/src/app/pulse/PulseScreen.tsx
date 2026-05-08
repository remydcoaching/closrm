import React from 'react'
import { View, Text, ScrollView, RefreshControl, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { usePulseKpis } from '../../hooks/usePulseKpis'
import { useTeamLeaderboard, type TeamMember } from '../../hooks/useTeamLeaderboard'
import { Card, KpiCard, Avatar } from '../../components/ui'
import { colors } from '../../theme/colors'

const fmtEur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

export function PulseScreen() {
  const { kpis, loading, refetch } = usePulseKpis()
  const { members } = useTeamLeaderboard()

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

        {/* Hero Revenue avec gradient (cf spec 7.9 'gradient vert'). */}
        <LinearGradient
          colors={[colors.primary + '40', colors.primary + '10', colors.bgElevated]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.primary + '50',
            padding: 20,
            overflow: 'hidden',
          }}
        >
          <Text
            style={{
              color: colors.primary,
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 0.6,
            }}
          >
            REVENUE · {monthName.toUpperCase()}
          </Text>
          <Text style={{ color: colors.textPrimary, fontSize: 38, fontWeight: '800', marginTop: 6, letterSpacing: -0.5 }}>
            {fmtEur(kpis.revenueMonth)}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 6 }}>
            {kpis.funnel.deals} deal{kpis.funnel.deals > 1 ? 's' : ''} · panier moyen{' '}
            {fmtEur(kpis.avgBasket)}
          </Text>
        </LinearGradient>

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

        {/* Team leaderboard (semaine) — médaille or/argent/bronze */}
        {members.length > 0 ? (
          <Card>
            <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 12 }}>
              TEAM · CETTE SEMAINE
            </Text>
            {members.slice(0, 4).map((m, i) => (
              <TeamRow key={m.user_id} member={m} rank={i} last={i === Math.min(3, members.length - 1)} />
            ))}
          </Card>
        ) : null}

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

const MEDAL_BG = ['#fbbf24', '#cbd5e1', '#a16207', '#52525b'] as const
const MEDAL_ICON = ['🥇', '🥈', '🥉', '·'] as const

function TeamRow({ member, rank, last }: { member: TeamMember; rank: number; last: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: MEDAL_BG[rank] + '33',
          borderWidth: 1,
          borderColor: MEDAL_BG[rank] + '77',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 14 }}>{MEDAL_ICON[rank]}</Text>
      </View>
      <Avatar name={member.full_name} size={36} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
          {member.full_name}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 11, textTransform: 'capitalize' }}>
          {member.role}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '700' }}>
          {member.revenue > 0
            ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(member.revenue)
            : '—'}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
          {member.deals_count} deal{member.deals_count > 1 ? 's' : ''}
        </Text>
      </View>
    </View>
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
