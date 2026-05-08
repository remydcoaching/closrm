import React, { useMemo, useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import type { MessagesStackParamList } from '../../navigation/types'
import { useMessages } from '../../hooks/useMessages'
import { useLead } from '../../hooks/useLead'
import { useConversations } from '../../hooks/useConversations'
import { Avatar, NavIcon, StatusBadge } from '../../components/ui'
import { colors } from '../../theme/colors'
import { api } from '../../services/api'
import type { IgMessage } from '@shared/types'

type R = RouteProp<MessagesStackParamList, 'Conversation'>

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

const formatDayDivider = (d: Date): string => {
  const today = new Date()
  if (sameDay(d, today)) return "Aujourd'hui"
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (sameDay(d, yesterday)) return 'Hier'
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

interface DayDividerItem {
  kind: 'day'
  label: string
  key: string
}
interface MessageItem {
  kind: 'msg'
  msg: IgMessage
}
type Item = DayDividerItem | MessageItem

export function ConversationScreen() {
  const route = useRoute<R>()
  const navigation = useNavigation()
  const { conversationId, leadId } = route.params
  const { messages, loading } = useMessages(conversationId)
  const { conversations } = useConversations()
  const { lead } = useLead(leadId ?? null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<FlatList>(null)

  const conv = conversations.find((c) => c.id === conversationId) ?? null

  const items = useMemo<Item[]>(() => {
    const out: Item[] = []
    let lastDay: Date | null = null
    for (const m of messages) {
      const d = new Date(m.sent_at)
      if (!lastDay || !sameDay(d, lastDay)) {
        out.push({ kind: 'day', label: formatDayDivider(d), key: `d-${d.toISOString().slice(0, 10)}` })
        lastDay = d
      }
      out.push({ kind: 'msg', msg: m })
    }
    return out
  }, [messages])

  // Scroll en bas quand un nouveau message arrive
  useEffect(() => {
    if (items.length === 0) return
    const t = setTimeout(() => {
      // try/catch : sur certaines versions RN, scrollToEnd lève
      // si la FlatList n'a pas encore mesuré ses items.
      try {
        listRef.current?.scrollToEnd({ animated: true })
      } catch {
        /* swallow — scroll best-effort */
      }
    }, 50)
    return () => clearTimeout(t)
  }, [items.length])

  const [sendError, setSendError] = useState<string | null>(null)

  const send = async () => {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    setSendError(null)
    try {
      await api.post('/api/instagram/messages', {
        conversation_id: conversationId,
        text,
      })
      // On clear le draft UNIQUEMENT après succès — sinon en cas d'erreur
      // réseau le message est perdu et l'utilisateur doit retaper.
      setDraft('')
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Erreur envoi')
    } finally {
      setSending(false)
    }
  }

  const participantName = conv?.participant_name || conv?.participant_username || '—'
  const handle = conv?.participant_username

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 12,
          paddingBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <NavIcon onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </NavIcon>
        <Avatar name={participantName} size={36} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
            {participantName}
          </Text>
          {handle ? (
            <Text style={{ color: colors.textSecondary, fontSize: 11 }}>@{handle}</Text>
          ) : null}
        </View>
        <NavIcon>
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.textPrimary} />
        </NavIcon>
      </View>

      {/* Lead context strip */}
      {lead ? (
        <Pressable
          onPress={() => {
            // TODO: navigate to LeadDetail (cross-tab nav)
          }}
          style={{
            marginHorizontal: 16,
            marginBottom: 8,
            backgroundColor: colors.primary + '15',
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.primary + '40',
            paddingVertical: 8,
            paddingHorizontal: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <StatusBadge status={lead.status} size="sm" />
          <Text style={{ color: colors.textPrimary, fontSize: 13, flex: 1 }}>
            {lead.first_name} {lead.last_name}
            {lead.deal_amount
              ? ` · ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(lead.deal_amount)}`
              : ''}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
        </Pressable>
      ) : null}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        style={{ flex: 1 }}
      >
        {loading && messages.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={items}
            keyExtractor={(it) => (it.kind === 'day' ? it.key : it.msg.id)}
            contentContainerStyle={{ padding: 16, gap: 6 }}
            renderItem={({ item }) => {
              if (item.kind === 'day') {
                return (
                  <View style={{ alignItems: 'center', marginVertical: 10 }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600' }}>
                      {item.label}
                    </Text>
                  </View>
                )
              }
              const isMine = item.msg.sender_type === 'user'
              return (
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: isMine ? 'flex-end' : 'flex-start',
                  }}
                >
                  <View
                    style={{
                      maxWidth: '78%',
                      backgroundColor: isMine ? colors.primary : '#262629',
                      borderRadius: 18,
                      borderBottomRightRadius: isMine ? 4 : 18,
                      borderBottomLeftRadius: isMine ? 18 : 4,
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                    }}
                  >
                    {item.msg.text ? (
                      <Text style={{ color: '#fff', fontSize: 14 }}>{item.msg.text}</Text>
                    ) : null}
                    <Text style={{ color: '#ffffff90', fontSize: 9, marginTop: 2, alignSelf: 'flex-end' }}>
                      {new Date(item.msg.sent_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              )
            }}
          />
        )}

        {sendError ? (
          <View
            style={{
              backgroundColor: colors.danger + '22',
              paddingHorizontal: 12,
              paddingVertical: 6,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Ionicons name="alert-circle" size={14} color={colors.danger} />
            <Text style={{ color: colors.danger, fontSize: 12 }}>{sendError}</Text>
          </View>
        ) : null}

        {/* Composer */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.bgPrimary,
          }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: colors.bgSecondary,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: 14,
              paddingVertical: 4,
            }}
          >
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Message…"
              placeholderTextColor={colors.textSecondary}
              multiline
              style={{
                color: colors.textPrimary,
                fontSize: 14,
                minHeight: 36,
                maxHeight: 120,
                paddingTop: Platform.OS === 'ios' ? 8 : 4,
                paddingBottom: Platform.OS === 'ios' ? 8 : 4,
              }}
            />
          </View>
          <Pressable
            onPress={send}
            disabled={!draft.trim() || sending}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: draft.trim() ? colors.primary : colors.border,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: sending ? 0.5 : 1,
            }}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={16} color="#fff" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
