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
import { Avatar, StatusBadge } from '../../components/ui'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'
import { api } from '../../services/api'
import type { IgMessage } from '@shared/types'

type R = RouteProp<MessagesStackParamList, 'Conversation'>

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

const formatDayDivider = (d: Date): string => {
  const today = new Date()
  if (sameDay(d, today)) return "Aujourd'hui"
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (sameDay(d, yesterday)) return 'Hier'
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

const formatTime = (iso: string): string => {
  const d = new Date(iso)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

interface DayDividerItem {
  kind: 'day'
  label: string
  key: string
}
interface MessageItem {
  kind: 'msg'
  msg: IgMessage
  /** True si pas de message du même sender dans les 60s avant. */
  showSenderBoundary: boolean
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
  const [sendError, setSendError] = useState<string | null>(null)
  const listRef = useRef<FlatList>(null)

  const conv = conversations.find((c) => c.id === conversationId) ?? null

  const items = useMemo<Item[]>(() => {
    const out: Item[] = []
    let lastDay: Date | null = null
    let lastSender: string | null = null
    let lastTs = 0
    for (const m of messages) {
      const d = new Date(m.sent_at)
      if (!lastDay || !sameDay(d, lastDay)) {
        out.push({ kind: 'day', label: formatDayDivider(d), key: `d-${d.toISOString().slice(0, 10)}` })
        lastDay = d
        lastSender = null
      }
      const ts = d.getTime()
      const showBoundary = lastSender !== m.sender_type || ts - lastTs > 60000
      out.push({ kind: 'msg', msg: m, showSenderBoundary: showBoundary })
      lastSender = m.sender_type
      lastTs = ts
    }
    return out
  }, [messages])

  useEffect(() => {
    if (items.length === 0) return
    const t = setTimeout(() => {
      try {
        listRef.current?.scrollToEnd({ animated: true })
      } catch {
        /* swallow */
      }
    }, 50)
    return () => clearTimeout(t)
  }, [items.length])

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
      {/* Header style Apple Messages */}
      <View
        style={{
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        }}
      >
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{ padding: 4 }}>
          <Ionicons name="chevron-back" size={28} color={colors.primary} />
        </Pressable>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Avatar name={participantName} size={32} />
          <Text
            numberOfLines={1}
            style={{ ...t.caption1, color: colors.textPrimary, fontWeight: '600', marginTop: 2 }}
          >
            {participantName}
          </Text>
          {handle ? (
            <Text style={{ ...t.caption2, color: colors.textSecondary }}>@{handle}</Text>
          ) : null}
        </View>
        <Pressable hitSlop={12} style={{ padding: 4 }}>
          <Ionicons name="information-circle-outline" size={26} color={colors.primary} />
        </Pressable>
      </View>

      {/* Lead context strip */}
      {lead ? (
        <View
          style={{
            marginHorizontal: spacing.lg,
            marginBottom: spacing.sm,
            backgroundColor: colors.primary + '15',
            borderRadius: radius.lg,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
          }}
        >
          <StatusBadge status={lead.status} size="sm" />
          <Text style={{ ...t.subheadline, color: colors.textPrimary, flex: 1 }} numberOfLines={1}>
            {lead.first_name} {lead.last_name}
            {lead.deal_amount
              ? ` · ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(lead.deal_amount)}`
              : ''}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
        </View>
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
            contentContainerStyle={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.md,
            }}
            renderItem={({ item }) => {
              if (item.kind === 'day') {
                return (
                  <View style={{ alignItems: 'center', marginVertical: spacing.md }}>
                    <Text
                      style={{
                        ...t.caption2,
                        color: colors.textSecondary,
                        fontWeight: '600',
                      }}
                    >
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
                    marginTop: item.showSenderBoundary ? 8 : 1,
                  }}
                >
                  <View
                    style={{
                      maxWidth: '78%',
                      backgroundColor: isMine ? colors.primary : '#2c2c2e',
                      borderRadius: 18,
                      borderBottomRightRadius: isMine ? 4 : 18,
                      borderBottomLeftRadius: isMine ? 18 : 4,
                      paddingVertical: 7,
                      paddingHorizontal: 12,
                    }}
                  >
                    {item.msg.text ? (
                      <Text style={{ ...t.body, color: isMine ? '#000' : '#fff' }}>
                        {item.msg.text}
                      </Text>
                    ) : null}
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
              paddingHorizontal: spacing.md,
              paddingVertical: 6,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Ionicons name="alert-circle" size={14} color={colors.danger} />
            <Text style={{ ...t.caption1, color: colors.danger }}>{sendError}</Text>
          </View>
        ) : null}

        {/* Composer style iMessage */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: spacing.sm,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderTopWidth: 0.33,
            borderTopColor: colors.border,
            backgroundColor: colors.bgPrimary,
          }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: colors.bgSecondary,
              borderRadius: 22,
              paddingHorizontal: spacing.md,
              paddingVertical: 4,
              minHeight: 36,
              justifyContent: 'center',
            }}
          >
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="iMessage"
              placeholderTextColor={colors.textSecondary}
              multiline
              style={{
                ...t.body,
                color: colors.textPrimary,
                maxHeight: 120,
                paddingVertical: 6,
              }}
            />
          </View>
          <Pressable
            onPress={send}
            disabled={!draft.trim() || sending}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: draft.trim() ? colors.primary : colors.bgSecondary,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: sending ? 0.5 : 1,
            }}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Ionicons name="arrow-up" size={20} color={draft.trim() ? '#000' : colors.textSecondary} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
