import React from 'react'
import { View, Text, ScrollView, RefreshControl, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { usePulseKpis } from '../../hooks/usePulseKpis'
import { useTeamLeaderboard, type TeamMember } from '../../hooks/useTeamLeaderboard'
import { Avatar, ListSection, ListRow } from '../../components/ui'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'

const fmtEur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MEDAL = ['🥇', '🥈', '🥉', '·'] as const

export function PulseScreen() {
  const { kpis, loading, refetch } = usePulseKpis()
  const { members } = useTeamLeaderboard()

  if (loading && !kpis) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.bgPrimary, justifyContent: 'center' }}
      >
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    )
  }
  if (!kpis) return null

  const todayDayIdx = (new Date().getDay() + 6) % 7
  const monthName = new Date().toLocaleDateString('fr-FR', { month: 'long' })
  const dateStr = new Date()
    .toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
    .toUpperCase()

  const maxFunnel = Math.max(kpis.funnel.leads, 1)
  const maxWeekly = Math.max(...kpis.weeklyActivity, 1)

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refetch} tintColor={colors.primary} />
        }
      >
        {/* Eyebrow + title */}
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg }}>
          <Text
            style={{
              ...t.footnote,
              color: colors.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            {dateStr} · TEMPS RÉEL
          </Text>
          <Text style={{ ...t.largeTitle, color: colors.textPrimary, marginTop: 2 }}>Pulse</Text>
        </View>

        {/* Hero Revenue — Apple Fitness style : numéro XXL au-dessus de
            tout, éventuellement accent gradient subtle. */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.xxxl }}>
          <Text
            style={{
              ...t.footnote,
              color: colors.primary,
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: 1.2,
              marginBottom: spacing.sm,
            }}
          >
            Revenue · {monthName}
          </Text>
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 64,
              lineHeight: 68,
              fontWeight: '800',
              letterSpacing: -2,
            }}
          >
            {fmtEur(kpis.revenueMonth)}
          </Text>
          <Text
            style={{
              ...t.callout,
              color: colors.textSecondary,
              marginTop: spacing.sm,
            }}
          >
            {kpis.funnel.deals} deal{kpis.funnel.deals > 1 ? 's' : ''} · panier moyen{' '}
            <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>
              {fmtEur(kpis.avgBasket)}
            </Text>
          </Text>
        </View>

        {/* KPI Grid — 2x2 cards iOS-grouped */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.md,
            marginBottom: spacing.xxxl,
          }}
        >
          <KpiTile
            label="Calls faits"
            value={`${kpis.callsDone}`}
            detail={`sur ${kpis.callsPlanned} prévus`}
            tint={colors.info}
          />
          <KpiTile
            label="Taux show"
            value={`${kpis.showRate}%`}
            detail="ce mois"
            tint={colors.purple}
          />
          <KpiTile
            label="Closing rate"
            value={`${kpis.closingRate}%`}
            detail={`${kpis.funnel.deals} deals`}
            tint={colors.warning}
          />
          <KpiTile
            label="Panier moyen"
            value={fmtEur(kpis.avgBasket)}
            detail="par deal"
            tint={colors.pink}
          />
        </View>

        {/* Funnel 30j */}
        <View style={{ marginBottom: spacing.xxxl }}>
          <ListSection header="Funnel · 30 jours">
            <View style={{ padding: spacing.lg, gap: spacing.md }}>
              <FunnelBar label="Leads entrants" value={kpis.funnel.leads} max={maxFunnel} tint={colors.cyan} />
              <FunnelBar label="Setting validé" value={kpis.funnel.settingDone} max={maxFunnel} tint={colors.info} />
              <FunnelBar label="Closing réalisé" value={kpis.funnel.closingDone} max={maxFunnel} tint={colors.purple} />
              <FunnelBar label="Deals fermés" value={kpis.funnel.deals} max={maxFunnel} tint={colors.primary} />
            </View>
          </ListSection>
        </View>

        {/* Team leaderboard */}
        {members.length > 0 ? (
          <View style={{ marginBottom: spacing.xxxl }}>
            <ListSection header="Team · cette semaine">
              {members.slice(0, 4).map((m, i) => (
                <TeamRow
                  key={m.user_id}
                  member={m}
                  rank={i}
                  isLast={i === Math.min(3, members.length - 1)}
                />
              ))}
            </ListSection>
          </View>
        ) : null}

        {/* Activity heatmap 7j */}
        <View style={{ marginBottom: spacing.xxxl }}>
          <ListSection header="Activité · 7 jours">
            <View style={{ padding: spacing.lg }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-end',
                  height: 100,
                  gap: spacing.sm,
                }}
              >
                {kpis.weeklyActivity.map((v, i) => {
                  const isToday = i === todayDayIdx
                  const h = Math.max(6, (v / maxWeekly) * 80)
                  return (
                    <View key={i} style={{ flex: 1, alignItems: 'center', gap: spacing.xs }}>
                      <Text
                        style={{
                          ...t.caption2,
                          color: isToday ? colors.primary : colors.textSecondary,
                        }}
                      >
                        {v || ''}
                      </Text>
                      <View
                        style={{
                          width: '100%',
                          height: h,
                          borderRadius: 4,
                          backgroundColor: isToday ? colors.primary : '#3a3a3c',
                        }}
                      />
                      <Text
                        style={{
                          ...t.caption1,
                          color: isToday ? colors.primary : colors.textSecondary,
                          fontWeight: isToday ? '700' : '500',
                        }}
                      >
                        {DAY_LABELS[i]}
                      </Text>
                    </View>
                  )
                })}
              </View>
              <Text
                style={{
                  ...t.footnote,
                  color: colors.textSecondary,
                  textAlign: 'center',
                  marginTop: spacing.md,
                }}
              >
                {kpis.weeklyActivity.reduce((a, b) => a + b, 0)} leads cette semaine
              </Text>
            </View>
          </ListSection>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

/** Tile KPI — half-width card avec accent bar gauche. */
function KpiTile({
  label,
  value,
  detail,
  tint,
}: {
  label: string
  value: string | number
  detail?: string
  tint: string
}) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: '45%',
        backgroundColor: colors.bgSecondary,
        borderRadius: radius.xl,
        padding: spacing.lg,
        gap: 6,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tint }} />
        <Text
          style={{
            ...t.caption1,
            color: colors.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            fontWeight: '600',
          }}
        >
          {label}
        </Text>
      </View>
      <Text style={{ ...t.title2, color: colors.textPrimary }}>{value}</Text>
      {detail ? (
        <Text style={{ ...t.footnote, color: colors.textSecondary }}>{detail}</Text>
      ) : null}
    </View>
  )
}

function FunnelBar({
  label,
  value,
  max,
  tint,
}: {
  label: string
  value: number
  max: number
  tint: string
}) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ ...t.subheadline, color: colors.textPrimary, fontWeight: '500' }}>
          {label}
        </Text>
        <Text style={{ ...t.subheadline, color: colors.textSecondary }}>
          {value}{' '}
          <Text style={{ color: tint, fontWeight: '700' }}>{percent}%</Text>
        </Text>
      </View>
      <View
        style={{
          height: 8,
          backgroundColor: '#2c2c2e',
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        <LinearGradient
          colors={[tint, tint + 'CC']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: `${percent}%`, height: '100%' }}
        />
      </View>
    </View>
  )
}

function TeamRow({
  member,
  rank,
  isLast,
}: {
  member: TeamMember
  rank: number
  isLast: boolean
}) {
  return (
    <ListRow
      leading={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 18 }}>{MEDAL[rank]}</Text>
          <Avatar name={member.full_name} size={36} />
        </View>
      }
      title={member.full_name}
      subtitle={member.role}
      trailing={
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ ...t.bodyEmphasis, color: colors.primary }}>
            {member.revenue > 0 ? fmtEur(member.revenue) : '—'}
          </Text>
          <Text style={{ ...t.caption2, color: colors.textSecondary }}>
            {member.deals_count} deal{member.deals_count > 1 ? 's' : ''}
          </Text>
        </View>
      }
      showChevron={false}
      separator={!isLast}
    />
  )
}
