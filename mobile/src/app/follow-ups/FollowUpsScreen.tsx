import React, { useState } from 'react'
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { FollowUpsStackParamList } from '../../navigation/types'
import { useFollowUps, type FollowUpTab, type FollowUpWithLead } from '../../hooks/useFollowUps'
import { NavLarge, FilterChips, Avatar } from '../../components/ui'
import { colors, getAvatarColor } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'
import { supabase } from '../../services/supabase'
import { useFollowUpSheet } from '../../components/schedule/FollowUpSheetProvider'

type Nav = NativeStackNavigationProp<FollowUpsStackParamList, 'FollowUpsList'>

const TABS: { key: FollowUpTab; label: string }[] = [
  { key: 'today', label: "Aujourd'hui" },
  { key: 'overdue', label: 'En retard' },
  { key: 'upcoming', label: 'À venir' },
  { key: 'done', label: 'Terminés' },
]

function formatScheduled(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) +
    ' · ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function FollowUpRow({
  item,
  overdue,
  onPress,
  onMarkDone,
}: {
  item: FollowUpWithLead
  overdue: boolean
  onPress: () => void
  onMarkDone: () => void
}) {
  const name = `${item.lead?.first_name ?? ''} ${item.lead?.last_name ?? ''}`.trim() || 'Lead'
  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            paddingHorizontal: spacing.lg,
            paddingVertical: 12,
            backgroundColor: pressed ? colors.bgSecondary : 'transparent',
          }}
        >
          <Avatar name={name} size={40} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ ...t.body, color: colors.textPrimary, fontWeight: '600' }} numberOfLines={1}>
              {name}
            </Text>
            <Text style={{ ...t.footnote, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
              {item.reason}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
              {overdue && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444' }} />}
              <Text style={{ ...t.caption2, color: overdue ? '#ef4444' : colors.textTertiary, fontWeight: overdue ? '700' : '400' }}>
                {formatScheduled(item.scheduled_at)}
              </Text>
            </View>
          </View>
          {item.status === 'en_attente' && (
            <Pressable onPress={onMarkDone} hitSlop={8} style={{ padding: 6 }}>
              <Ionicons name="checkmark-circle-outline" size={26} color={colors.primary} />
            </Pressable>
          )}
        </View>
      )}
    </Pressable>
  )
}

export function FollowUpsScreen() {
  const navigation = useNavigation<Nav>()
  const [tabIdx, setTabIdx] = useState(0)
  const tab = TABS[tabIdx].key
  const { followUps, loading, refetch } = useFollowUps(tab)
  const followUpSheet = useFollowUpSheet()

  const markDone = async (item: FollowUpWithLead) => {
    await supabase.from('follow_ups').update({ status: 'fait' }).eq('id', item.id)
    void refetch()
    if (item.lead) followUpSheet.open({ lead: item.lead })
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <NavLarge title="Relances" />
      <View style={{ marginBottom: spacing.sm }}>
        <FilterChips
          items={TABS.map((tb) => ({ label: tb.label }))}
          activeIndex={tabIdx}
          onChange={setTabIdx}
        />
      </View>

      {loading && followUps.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : followUps.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl }}>
          <Ionicons name="checkmark-done-circle-outline" size={40} color={colors.textTertiary} />
          <Text style={{ ...t.body, color: colors.textSecondary, marginTop: spacing.md, textAlign: 'center' }}>
            Aucune relance {tab === 'today' ? "aujourd'hui" : tab === 'overdue' ? 'en retard' : tab === 'upcoming' ? 'à venir' : 'terminée'}
          </Text>
        </View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {followUps.map((fu) => (
            <FollowUpRow
              key={fu.id}
              item={fu}
              overdue={tab === 'overdue'}
              onPress={() => navigation.navigate('LeadDetail', { leadId: fu.lead_id })}
              onMarkDone={() => void markDone(fu)}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
