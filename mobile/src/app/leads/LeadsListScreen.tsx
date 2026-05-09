import React, { useMemo, useState } from 'react'
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { LeadsStackParamList } from '../../navigation/types'
import { useLeads } from '../../hooks/useLeads'
import { useAuth } from '../../hooks/useAuth'
import { useDebounce } from '../../hooks/useDebounce'
import { LeadCardLarge } from '../../components/leads/LeadCardLarge'
import { LeadRow } from '../../components/leads/LeadRow'
import { NavLarge, SearchField, Segmented, FilterChips, FAB } from '../../components/ui'
import { colors } from '../../theme/colors'
import { type as t, spacing } from '../../theme/tokens'
import { statusConfig } from '../../theme/status'
import type { Lead, LeadStatus } from '@shared/types'

type Nav = NativeStackNavigationProp<LeadsStackParamList, 'LeadsList'>

const SEGMENTS = [
  { key: 'actifs', label: 'Actifs' },
  { key: 'mes_leads', label: 'Mes leads' },
  { key: 'archives', label: 'Archivés' },
] as const

const STATUS_FILTERS = [
  { key: 'tous', label: 'Tous' },
  { key: 'closing_planifie', label: 'Closing' },
  { key: 'setting_planifie', label: 'Setting' },
  { key: 'nouveau', label: 'Nouveaux' },
  { key: 'no_show_setting', label: 'No-show' },
  { key: 'clos', label: 'Closés' },
] as const

type ViewMode = 'flat' | 'grouped' | 'priority'

const GROUP_ORDER: LeadStatus[] = [
  'closing_planifie',
  'setting_planifie',
  'no_show_closing',
  'no_show_setting',
  'scripte',
  'nouveau',
  'clos',
  'dead',
]

interface ScoredLead {
  lead: Lead
  score: number
  urgency: { label: string; color: string } | null
  ctaLabel: string | null
}

const HOURS = (n: number) => n * 60 * 60 * 1000
const MS_PER_DAY = HOURS(24)

function scoreLead(lead: Lead): ScoredLead {
  const now = Date.now()
  const lastActivity = new Date(
    lead.last_activity_at ?? lead.updated_at ?? lead.created_at,
  ).getTime()
  const ageMs = now - lastActivity
  const amountBonus = lead.deal_amount ? Math.min(20, lead.deal_amount / 500) : 0
  let score = 0
  let urgency: ScoredLead['urgency'] = null
  let ctaLabel: string | null = null

  switch (lead.status) {
    case 'closing_planifie':
      score = 100 + amountBonus
      urgency = { label: 'Closing imminent', color: colors.primary }
      ctaLabel = 'Rejoindre'
      break
    case 'setting_planifie':
      score = 80 + amountBonus
      urgency = { label: 'Setting prévu', color: colors.info }
      ctaLabel = 'Préparer'
      break
    case 'no_show_closing':
      score = 90 + amountBonus
      urgency = { label: 'No-show — reprogrammer', color: colors.orange }
      ctaLabel = 'Reprogrammer'
      break
    case 'no_show_setting':
      score = 75 + amountBonus
      urgency = { label: 'No-show', color: colors.warning }
      ctaLabel = 'Reprogrammer'
      break
    case 'nouveau':
      score = Math.max(0, 50 - Math.floor(ageMs / MS_PER_DAY) * 5) + amountBonus
      urgency = ageMs < HOURS(24) ? { label: 'Nouveau lead', color: colors.cyan } : null
      ctaLabel = 'Contacter'
      break
    case 'scripte':
      score = 40 + amountBonus
      ctaLabel = 'Planifier setting'
      break
    default:
      score = 0
  }
  return { lead, score, urgency, ctaLabel }
}

const formatAmount = (n: number | null): string | null =>
  n == null
    ? null
    : new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }).format(n)

export function LeadsListScreen() {
  const navigation = useNavigation<Nav>()
  const { user } = useAuth()

  const [viewMode, setViewMode] = useState<ViewMode>('flat')
  const [segIdx, setSegIdx] = useState(0)
  const [statusIdx, setStatusIdx] = useState(0)
  const [search, setSearch] = useState('')

  const segment = SEGMENTS[segIdx].key
  const status = STATUS_FILTERS[statusIdx].key
  const effectiveStatus = viewMode === 'flat' ? status : 'tous'
  const debouncedSearch = useDebounce(search, 300)

  const { leads, loading, refetch } = useLeads({
    segment,
    status: effectiveStatus,
    search: debouncedSearch,
    myUserId: user?.id,
  })

  const counts = leads.length

  const groupedSections = useMemo(() => {
    const byStatus = new Map<LeadStatus, Lead[]>()
    for (const l of leads) {
      const arr = byStatus.get(l.status) ?? []
      arr.push(l)
      byStatus.set(l.status, arr)
    }
    return GROUP_ORDER.flatMap((s) => {
      const arr = byStatus.get(s)
      if (!arr || arr.length === 0) return []
      return [{ status: s, leads: arr }]
    })
  }, [leads])

  const priorityItems = useMemo(
    () => leads.map(scoreLead).filter((s) => s.score > 0).sort((a, b) => b.score - a.score),
    [leads],
  )

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <NavLarge
        title="Leads"
        subtitle={`${counts} lead${counts > 1 ? 's' : ''}`}
        rightSlot={<ViewSwitcher mode={viewMode} onChange={setViewMode} />}
      />

      <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
        <SearchField
          placeholder="Rechercher un lead, un tag…"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
        <Segmented
          items={SEGMENTS.map((s) => ({ label: s.label }))}
          activeIndex={segIdx}
          onChange={setSegIdx}
        />
      </View>

      {viewMode === 'flat' ? (
        <View style={{ marginBottom: spacing.md }}>
          <FilterChips
            items={STATUS_FILTERS.map((f) => ({ label: f.label }))}
            activeIndex={statusIdx}
            onChange={setStatusIdx}
          />
        </View>
      ) : null}

      {loading && leads.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : viewMode === 'flat' ? (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: 100,
            gap: 10,
          }}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refetch} tintColor={colors.primary} />
          }
        >
          {leads.length === 0 ? (
            <EmptyState text="Aucun lead pour l'instant." />
          ) : (
            leads.map((l) => (
              <LeadRow
                key={l.id}
                lead={l}
                asCard
                onPress={() => navigation.navigate('LeadDetail', { leadId: l.id })}
              />
            ))
          )}
        </ScrollView>
      ) : viewMode === 'grouped' ? (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: 100,
            gap: spacing.xxl,
          }}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refetch} tintColor={colors.primary} />
          }
        >
          {groupedSections.map(({ status: s, leads: arr }) => (
            <View key={s} style={{ gap: spacing.sm }}>
              <Text
                style={{
                  ...t.footnote,
                  color: colors.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginLeft: spacing.xs,
                  marginBottom: 4,
                }}
              >
                {statusConfig[s].label} · {arr.length}
              </Text>
              {arr.map((l) => (
                <LeadRow
                  key={l.id}
                  lead={l}
                  asCard
                  onPress={() => navigation.navigate('LeadDetail', { leadId: l.id })}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 100, gap: spacing.md }}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refetch} tintColor={colors.primary} />
          }
        >
          <Text
            style={{
              ...t.footnote,
              color: colors.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              marginBottom: spacing.xs,
            }}
          >
            Tri intelligent · urgence × valeur × fraîcheur
          </Text>
          {priorityItems.length === 0 ? (
            <EmptyState text="Rien à traiter pour l'instant." />
          ) : (
            priorityItems.map((item) => (
              <LeadCardLarge
                key={item.lead.id}
                lead={item.lead}
                urgency={item.urgency}
                ctaLabel={item.ctaLabel ?? undefined}
                onPress={() => navigation.navigate('LeadDetail', { leadId: item.lead.id })}
                onCta={() => navigation.navigate('LeadDetail', { leadId: item.lead.id })}
              />
            ))
          )}
        </ScrollView>
      )}

      <FAB onPress={() => {/* TODO: create lead modal */}} />
    </SafeAreaView>
  )
}

function ViewSwitcher({
  mode,
  onChange,
}: {
  mode: ViewMode
  onChange: (m: ViewMode) => void
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.bgSecondary,
        borderRadius: 8,
        padding: 2,
      }}
    >
      {(['flat', 'grouped', 'priority'] as const).map((m) => {
        const active = mode === m
        const icon: keyof typeof Ionicons.glyphMap =
          m === 'flat' ? 'list' : m === 'grouped' ? 'layers-outline' : 'flash'
        return (
          <Pressable
            key={m}
            onPress={() => onChange(m)}
            style={{
              width: 32,
              height: 28,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? colors.bgElevated : 'transparent',
              borderRadius: 6,
            }}
          >
            <Ionicons
              name={icon}
              size={14}
              color={active ? colors.primary : colors.textSecondary}
            />
          </Pressable>
        )
      })}
    </View>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 80,
        paddingHorizontal: 32,
      }}
    >
      <Text style={{ ...t.subheadline, color: colors.textSecondary, textAlign: 'center' }}>
        {text}
      </Text>
    </View>
  )
}
