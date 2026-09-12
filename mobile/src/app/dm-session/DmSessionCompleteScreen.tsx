import React from 'react'
import { View, Text, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { FollowUpsStackParamList } from '../../navigation/types'
import { useDmSession } from '../../hooks/useDmSession'
import { NavLarge } from '../../components/ui'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'

type Nav = NativeStackNavigationProp<FollowUpsStackParamList, 'DmSessionComplete'>
type R = RouteProp<FollowUpsStackParamList, 'DmSessionComplete'>

export function DmSessionCompleteScreen() {
  const navigation = useNavigation<Nav>()
  const { params } = useRoute<R>()
  const { session } = useDmSession(params.sessionId)

  const relaunched = session?.items.filter((i) => i.outcome === 'relaunched').length ?? 0
  const replied = session?.items.filter((i) => i.outcome === 'replied').length ?? 0
  const archived = session?.items.filter((i) => i.outcome === 'archived').length ?? 0
  const total = session?.items.length ?? 0
  const done = relaunched + replied + archived

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <NavLarge title="Session terminée" />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
        <Text style={{ ...t.title2, color: colors.textPrimary, textAlign: 'center' }}>
          {done} / {total} profils traités
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, width: '100%' }}>
          <View style={{ flex: 1, backgroundColor: colors.bgSecondary, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center' }}>
            <Text style={{ ...t.title2, color: '#38A169', fontWeight: '800' }}>{relaunched}</Text>
            <Text style={{ ...t.footnote, color: colors.textSecondary }}>Relancés</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: colors.bgSecondary, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center' }}>
            <Text style={{ ...t.title2, color: colors.textPrimary, fontWeight: '800' }}>{replied}</Text>
            <Text style={{ ...t.footnote, color: colors.textSecondary }}>Ont répondu</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: colors.bgSecondary, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center' }}>
            <Text style={{ ...t.title2, color: colors.textPrimary, fontWeight: '800' }}>{archived}</Text>
            <Text style={{ ...t.footnote, color: colors.textSecondary }}>Archivés</Text>
          </View>
        </View>
        <Pressable
          onPress={() => navigation.popToTop()}
          style={{ marginTop: spacing.xl, backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.xl }}
        >
          <Text style={{ ...t.subheadline, color: '#fff', fontWeight: '700' }}>Retour aux relances</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}
