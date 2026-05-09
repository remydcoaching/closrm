import React, { useMemo, useState } from 'react'
import { View, Text, ScrollView, RefreshControl, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { MessagesStackParamList } from '../../navigation/types'
import { useConversations } from '../../hooks/useConversations'
import {
  NavLarge,
  SearchField,
  Segmented,
  ListSection,
  ListRow,
  Avatar,
} from '../../components/ui'
import { colors } from '../../theme/colors'
import { type as t, spacing } from '../../theme/tokens'
import type { IgConversation } from '@shared/types'

type Nav = NativeStackNavigationProp<MessagesStackParamList, 'Inbox'>

const SEGMENTS = ['Tous', 'Instagram', 'SMS', 'Email']

const formatRelative = (iso: string | null): string => {
  if (!iso) return ''
  const d = new Date(iso)
  const diffMin = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000))
  if (diffMin < 1) return "à l'instant"
  if (diffMin < 60) return `${diffMin}min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `${diffH}h`
  const diffD = Math.round(diffH / 24)
  if (diffD < 7) return `${diffD}j`
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

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

  const unreadList = filtered.filter((c) => (c.unread_count ?? 0) > 0)
  const readList = filtered.filter((c) => (c.unread_count ?? 0) === 0)
  const totalUnread = unreadList.reduce((acc, c) => acc + (c.unread_count ?? 0), 0)

  const renderRow = (conv: IgConversation, isLast: boolean) => {
    const name = conv.participant_name || conv.participant_username || '—'
    const unread = (conv.unread_count ?? 0) > 0
    return (
      <ListRow
        key={conv.id}
        leading={
          <View>
            <Avatar name={name} size={44} />
            {/* badge canal Instagram en bas-droite avatar */}
            <View
              style={{
                position: 'absolute',
                bottom: -2,
                right: -2,
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: colors.pink,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: colors.bgSecondary,
              }}
            >
              <Ionicons name="logo-instagram" size={9} color="#fff" />
            </View>
            {unread ? (
              <View
                style={{
                  position: 'absolute',
                  top: -2,
                  left: -2,
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: colors.primary,
                  borderWidth: 2,
                  borderColor: colors.bgSecondary,
                }}
              />
            ) : null}
          </View>
        }
        title={name}
        titleAccessory={
          unread ? null : null /* timestamp goes in trailing instead */
        }
        subtitle={conv.last_message_text || '—'}
        trailing={
          <Text style={{ ...t.caption1, color: colors.textSecondary }}>
            {formatRelative(conv.last_message_at)}
          </Text>
        }
        showChevron={false}
        separator={!isLast}
        onPress={() =>
          navigation.navigate('Conversation', {
            conversationId: conv.id,
            leadId: conv.lead_id ?? undefined,
          })
        }
      />
    )
  }

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
          contentContainerStyle={{ paddingBottom: 100, gap: spacing.xxl }}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refetch} tintColor={colors.primary} />
          }
        >
          {unreadList.length > 0 ? (
            <ListSection header="Non lus">
              {unreadList.map((c, i) => renderRow(c, i === unreadList.length - 1))}
            </ListSection>
          ) : null}
          {readList.length > 0 ? (
            <ListSection header={unreadList.length > 0 ? 'Précédemment' : ''}>
              {readList.map((c, i) => renderRow(c, i === readList.length - 1))}
            </ListSection>
          ) : null}
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
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
