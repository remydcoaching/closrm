import React, { useMemo, useState } from 'react'
import { View, Text, FlatList, RefreshControl, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { LeadsStackParamList } from '../../navigation/types'
import { useLeads } from '../../hooks/useLeads'
import { useAuth } from '../../hooks/useAuth'
import { LeadCard } from '../../components/leads/LeadCard'
import { NavLarge, SearchField, Segmented, FilterChips, FAB } from '../../components/ui'
import { colors } from '../../theme/colors'

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

export function LeadsListScreen() {
  const navigation = useNavigation<Nav>()
  const { user } = useAuth()
  const [segIdx, setSegIdx] = useState(0)
  const [statusIdx, setStatusIdx] = useState(0)
  const [search, setSearch] = useState('')

  const segment = SEGMENTS[segIdx].key
  const status = STATUS_FILTERS[statusIdx].key

  const { leads, loading, refetch } = useLeads({
    segment,
    status,
    search,
    myUserId: user?.id,
  })

  const counts = useMemo(() => leads.length, [leads.length])

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <NavLarge title="Leads" subtitle={`${counts} ${counts > 1 ? 'leads' : 'lead'}`} />

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

      <View style={{ marginBottom: 10 }}>
        <FilterChips
          items={STATUS_FILTERS.map((f) => ({ label: f.label }))}
          activeIndex={statusIdx}
          onChange={setStatusIdx}
        />
      </View>

      {loading && leads.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={leads}
          keyExtractor={(l) => l.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 8 }}
          renderItem={({ item }) => (
            <LeadCard
              lead={item}
              onPress={() => navigation.navigate('LeadDetail', { leadId: item.id })}
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
                Aucun lead pour l'instant.
              </Text>
            </View>
          }
        />
      )}

      <FAB onPress={() => {/* TODO: open create lead modal */}} />
    </SafeAreaView>
  )
}
