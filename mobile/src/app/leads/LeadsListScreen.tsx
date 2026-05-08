import React, { useMemo, useState } from 'react'
import { View, Text, FlatList, RefreshControl, ActivityIndicator, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { LeadsStackParamList } from '../../navigation/types'
import { useLeads } from '../../hooks/useLeads'
import { useAuth } from '../../hooks/useAuth'
import { useDebounce } from '../../hooks/useDebounce'
import { LeadCard } from '../../components/leads/LeadCard'
import { LeadCardLarge } from '../../components/leads/LeadCardLarge'
import { NavLarge, SearchField, Segmented, FilterChips, FAB, NavIcon } from '../../components/ui'
import { colors } from '../../theme/colors'
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

// Ordre des statuts pour la vue groupée — du plus chaud au plus froid.
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

// Statuts considérés "chauds" → ouverts par défaut dans la vue groupée.
const HOT_STATUSES = new Set<LeadStatus>([
  'closing_planifie',
  'setting_planifie',
  'no_show_closing',
])

interface ScoredLead {
  lead: Lead
  score: number
  urgency: { label: string; color: string } | null
  ctaLabel: string | null
}

const HOURS = (n: number) => n * 60 * 60 * 1000
const MS_PER_DAY = HOURS(24)

// Heuristique de score "à traiter".
// Critères :
//  - Closing planifié dans <2h → top priorité (score 100+)
//  - No-show récent (<3j) → urgence 80
//  - Setting planifié soon → 70
//  - Lead nouveau récent → 50
//  - Deal amount élevé → bonus
//  - Sinon ignoré (score 0).
function scoreLead(lead: Lead): ScoredLead {
  const now = Date.now()
  const lastActivity = new Date(lead.last_activity_at ?? lead.updated_at ?? lead.created_at).getTime()
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
      urgency = { label: 'No-show closing — reprogrammer', color: colors.orange }
      ctaLabel = 'Reprogrammer'
      break
    case 'no_show_setting':
      score = 75 + amountBonus
      urgency = { label: 'No-show setting', color: colors.warning }
      ctaLabel = 'Reprogrammer'
      break
    case 'nouveau':
      // Frais → 50, dégrade avec l'âge
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

export function LeadsListScreen() {
  const navigation = useNavigation<Nav>()
  const { user } = useAuth()

  const [viewMode, setViewMode] = useState<ViewMode>('flat')
  const [segIdx, setSegIdx] = useState(0)
  const [statusIdx, setStatusIdx] = useState(0)
  const [search, setSearch] = useState('')
  // Sections collapsées : map status → bool
  const [collapsed, setCollapsed] = useState<Partial<Record<LeadStatus, boolean>>>(() => {
    const init: Partial<Record<LeadStatus, boolean>> = {}
    for (const s of GROUP_ORDER) if (!HOT_STATUSES.has(s)) init[s] = true
    return init
  })

  const segment = SEGMENTS[segIdx].key
  const status = STATUS_FILTERS[statusIdx].key

  // En vue grouped/priority on ignore le filtre "STATUS_FILTERS" — il n'a
  // pas de sens (la vue regroupe déjà par statut, ou trie par urgence).
  const effectiveStatus = viewMode === 'flat' ? status : 'tous'

  // Debounce search 300ms : sans ça chaque keystroke spam une nouvelle
  // requête Supabase + résoudre les abonnements realtime → UX laggy.
  const debouncedSearch = useDebounce(search, 300)

  const { leads, loading, refetch } = useLeads({
    segment,
    status: effectiveStatus,
    search: debouncedSearch,
    myUserId: user?.id,
  })

  const counts = leads.length

  // Données pour la vue groupée
  const groupedItems = useMemo(() => {
    const byStatus = new Map<LeadStatus, Lead[]>()
    for (const l of leads) {
      const arr = byStatus.get(l.status) ?? []
      arr.push(l)
      byStatus.set(l.status, arr)
    }
    type Item =
      | { kind: 'header'; status: LeadStatus; count: number; isCollapsed: boolean }
      | { kind: 'lead'; lead: Lead }
    const out: Item[] = []
    for (const s of GROUP_ORDER) {
      const arr = byStatus.get(s)
      if (!arr || arr.length === 0) continue
      const isCollapsed = !!collapsed[s]
      out.push({ kind: 'header', status: s, count: arr.length, isCollapsed })
      if (!isCollapsed) {
        for (const l of arr) out.push({ kind: 'lead', lead: l })
      }
    }
    return out
  }, [leads, collapsed])

  // Données pour la vue priority
  const priorityItems = useMemo(() => {
    return leads
      .map(scoreLead)
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
  }, [leads])

  const renderViewSwitcher = () => (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {(['flat', 'grouped', 'priority'] as const).map((mode) => {
        const active = viewMode === mode
        const icon: keyof typeof Ionicons.glyphMap =
          mode === 'flat' ? 'list' : mode === 'grouped' ? 'layers-outline' : 'flash'
        return (
          <Pressable
            key={mode}
            onPress={() => setViewMode(mode)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? colors.primary + '22' : colors.bgSecondary,
              borderWidth: 1,
              borderColor: active ? colors.primary : colors.border,
            }}
          >
            <Ionicons name={icon} size={16} color={active ? colors.primary : colors.textSecondary} />
          </Pressable>
        )
      })}
    </View>
  )

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <NavLarge title="Leads" subtitle={`${counts} ${counts > 1 ? 'leads' : 'lead'}`} />
        </View>
        <View style={{ paddingRight: 16, paddingBottom: 12 }}>{renderViewSwitcher()}</View>
      </View>

      <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
        <SearchField
          placeholder="Rechercher un lead, un tag…"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
        <Segmented
          items={SEGMENTS.map((s) => ({ label: s.label }))}
          activeIndex={segIdx}
          onChange={setSegIdx}
        />
      </View>

      {viewMode === 'flat' ? (
        <View style={{ marginBottom: 10 }}>
          <FilterChips
            items={STATUS_FILTERS.map((f) => ({ label: f.label }))}
            activeIndex={statusIdx}
            onChange={setStatusIdx}
          />
        </View>
      ) : viewMode === 'priority' ? (
        <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
            ✨ Tri intelligent : urgence × valeur × fraîcheur
          </Text>
        </View>
      ) : null}

      {loading && leads.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : viewMode === 'flat' ? (
        <FlatList
          data={leads}
          keyExtractor={(l) => l.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          /* Wrap manuel : on positionne le 1er row avec borderRadius top
             et le dernier avec borderRadius bottom → effet 'section card'
             iOS-native (style Settings/Mail). Plus de recycling FlatList
             si liste très longue, mais OK pour <500 leads. */
          CellRendererComponent={({ children, index, style, ...rest }) => {
            const isFirst = index === 0
            const isLast = index === leads.length - 1
            return (
              <View
                {...rest}
                style={[
                  style,
                  {
                    backgroundColor: colors.bgElevated,
                    borderTopLeftRadius: isFirst ? 14 : 0,
                    borderTopRightRadius: isFirst ? 14 : 0,
                    borderBottomLeftRadius: isLast ? 14 : 0,
                    borderBottomRightRadius: isLast ? 14 : 0,
                    overflow: 'hidden',
                    borderTopWidth: isFirst ? 1 : 0,
                    borderBottomWidth: isLast ? 1 : 0,
                    borderLeftWidth: 1,
                    borderRightWidth: 1,
                    borderColor: colors.border,
                    ...(isFirst
                      ? {
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.5,
                          shadowRadius: 8,
                          elevation: 3,
                        }
                      : null),
                  },
                ]}
              >
                {children}
              </View>
            )
          }}
          renderItem={({ item, index }) => (
            <LeadCard
              lead={item}
              isInSection
              isLast={index === leads.length - 1}
              onPress={() => navigation.navigate('LeadDetail', { leadId: item.id })}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refetch} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 15 }}>
                Aucun lead pour l'instant.
              </Text>
            </View>
          }
        />
      ) : viewMode === 'grouped' ? (
        <FlatList
          data={groupedItems}
          keyExtractor={(it, i) =>
            it.kind === 'header' ? `h-${it.status}` : `l-${it.lead.id}-${i}`
          }
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          renderItem={({ item }) => {
            if (item.kind === 'header') {
              const cfg = statusConfig[item.status]
              return (
                <Pressable
                  onPress={() => setCollapsed((c) => ({ ...c, [item.status]: !c[item.status] }))}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingVertical: 14,
                    marginTop: 8,
                  }}
                >
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: cfg.color }} />
                  <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '700', flex: 1 }}>
                    {cfg.label}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '600' }}>{item.count}</Text>
                  <Ionicons
                    name={item.isCollapsed ? 'chevron-down' : 'chevron-up'}
                    size={16}
                    color={colors.textSecondary}
                  />
                </Pressable>
              )
            }
            const accent = statusConfig[item.lead.status].color
            return (
              <View style={{ marginBottom: 12, marginLeft: 4 }}>
                <Pressable
                  onPress={() => navigation.navigate('LeadDetail', { leadId: item.lead.id })}
                  style={({ pressed }) => ({
                    backgroundColor: colors.bgElevated,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderLeftWidth: 4,
                    borderLeftColor: accent,
                    padding: 12,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <LeadCardInner lead={item.lead} />
                </Pressable>
              </View>
            )
          }}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refetch} tintColor={colors.primary} />
          }
        />
      ) : (
        <FlatList
          data={priorityItems}
          keyExtractor={(s) => s.lead.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 14 }}
          renderItem={({ item }) => (
            <LeadCardLarge
              lead={item.lead}
              urgency={item.urgency}
              ctaLabel={item.ctaLabel ?? undefined}
              onPress={() => navigation.navigate('LeadDetail', { leadId: item.lead.id })}
              onCta={() => navigation.navigate('LeadDetail', { leadId: item.lead.id })}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refetch} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                Rien à traiter pour l'instant.
              </Text>
            </View>
          }
        />
      )}

      <FAB onPress={() => {/* TODO: open create lead modal */}} />
    </SafeAreaView>
  )
}

// Mini card sans la bordure pour la vue grouped (la wrap externe a déjà la bordure)
function LeadCardInner({ lead }: { lead: Lead }) {
  const fullName = `${lead.first_name} ${lead.last_name}`.trim() || '—'
  const amount = lead.deal_amount
    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(lead.deal_amount)
    : null
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>
          {fullName}
        </Text>
        {lead.phone ? (
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{lead.phone}</Text>
        ) : null}
      </View>
      {amount ? (
        <Text style={{ color: colors.primary, fontSize: 15, fontWeight: '700' }}>{amount}</Text>
      ) : null}
    </View>
  )
}
