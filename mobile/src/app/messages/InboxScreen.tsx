import React, { useMemo, useState } from 'react'
import { View, Text, FlatList, RefreshControl, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { MessagesStackParamList } from '../../navigation/types'
import { useConversations } from '../../hooks/useConversations'
import { ConvRow } from '../../components/messages/ConvRow'
import { NavLarge, SearchField, Segmented, Divider } from '../../components/ui'
import { colors } from '../../theme/colors'

type Nav = NativeStackNavigationProp<MessagesStackParamList, 'Inbox'>

const SEGMENTS = ['Tous', 'Instagram', 'SMS', 'Email']

export function InboxScreen() {
  const navigation = useNavigation<Nav>()
  const { conversations, loading, refetch } = useConversations()
  const [segIdx, setSegIdx] = useState(0)
  const [search, setSearch] = useState('')

  // V1 : seulement Instagram dispo. SMS/Email à venir → on filtre côté client.
  const filtered = useMemo(() => {
    let list = conversations
    if (segIdx === 1) {
      // Instagram only — toutes les conversations actuelles SONT Instagram.
      // Pas de filtre additionnel pour l'instant.
    } else if (segIdx === 2 || segIdx === 3) {
      // SMS / Email pas encore implémentés, liste vide.
      list = []
    }
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

  const unreadList = filtered.filter((c) => (c.unread_count ?? 0) > 0)
  const readList = filtered.filter((c) => (c.unread_count ?? 0) === 0)

  const totalUnread = unreadList.reduce((acc, c) => acc + (c.unread_count ?? 0), 0)

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <NavLarge
        title="Inbox"
        subtitle={`${totalUnread} non lu${totalUnread > 1 ? 's' : ''} · ${filtered.length} conversations`}
      />

      <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
        <SearchField
          placeholder="Chercher dans les conversations…"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
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
        <FlatList
          data={[
            ...(unreadList.length > 0 ? [{ kind: 'header' as const, label: 'NON LUS' }] : []),
            ...unreadList.map((c) => ({ kind: 'conv' as const, conv: c })),
            ...(readList.length > 0 ? [{ kind: 'header' as const, label: 'PRÉCÉDEMMENT' }] : []),
            ...readList.map((c) => ({ kind: 'conv' as const, conv: c })),
          ]}
          keyExtractor={(item, i) =>
            item.kind === 'header' ? `h-${item.label}-${i}` : item.conv.id
          }
          contentContainerStyle={{ paddingBottom: 80 }}
          ItemSeparatorComponent={Divider}
          renderItem={({ item }) => {
            if (item.kind === 'header') {
              return (
                <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 }}>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 11,
                      fontWeight: '700',
                      letterSpacing: 0.5,
                    }}
                  >
                    {item.label}
                  </Text>
                </View>
              )
            }
            return (
              <ConvRow
                conv={item.conv}
                onPress={() =>
                  navigation.navigate('Conversation', {
                    conversationId: item.conv.id,
                    leadId: item.conv.lead_id ?? undefined,
                  })
                }
              />
            )
          }}
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
                Aucune conversation.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}
