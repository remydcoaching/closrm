import React, { useMemo, useState } from 'react'
import { View, Text, ScrollView, RefreshControl, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { MessagesStackParamList } from '../../navigation/types'
import { useConversations } from '../../hooks/useConversations'
import { NavLarge, SearchField, Segmented } from '../../components/ui'
import { ConvRow } from '../../components/messages/ConvRow'
import { colors } from '../../theme/colors'
import { type as t, spacing } from '../../theme/tokens'

type Nav = NativeStackNavigationProp<MessagesStackParamList, 'Inbox'>

const SEGMENTS = ['Tous', 'Instagram', 'SMS', 'Email']

export function InboxScreen() {
  const navigation = useNavigation<Nav>()
  const { conversations, loading, refetch } = useConversations()
  const [segIdx, setSegIdx] = useState(0)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    let list = conversations
    if (segIdx >= 2) list = []
    if (search) {
      const s = search.toLowerCase()
      list = list.filter((c) => {
        const name = (c.participant_name || c.participant_username || '').toLowerCase()
        const last = (c.last_message_text || '').toLowerCase()
        return name.includes(s) || last.includes(s)
      })
    }
    return list
  }, [conversations, segIdx, search])

  const totalUnread = filtered.reduce((acc, c) => acc + (c.unread_count ?? 0), 0)

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <NavLarge
        title="Inbox"
        subtitle={`${totalUnread} non lu${totalUnread > 1 ? 's' : ''} · ${filtered.length} conversation${filtered.length > 1 ? 's' : ''}`}
      />

      <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
        <SearchField
          placeholder="Chercher dans les conversations…"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
        <Segmented
          items={SEGMENTS.map((s) => ({ label: s }))}
          activeIndex={segIdx}
          onChange={setSegIdx}
        />
      </View>

      {loading && conversations.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
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
          {filtered.length === 0 ? (
            <Text
              style={{
                ...t.subheadline,
                color: colors.textSecondary,
                textAlign: 'center',
                paddingVertical: 60,
              }}
            >
              Aucune conversation.
            </Text>
          ) : (
            filtered.map((c) => (
              <ConvRow
                key={c.id}
                conv={c}
                onPress={() =>
                  navigation.navigate('Conversation', {
                    conversationId: c.id,
                    leadId: c.lead_id ?? undefined,
                  })
                }
              />
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
