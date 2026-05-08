import React from 'react'
import { Pressable, View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { IgConversation } from '@shared/types'
import { Avatar } from '../ui/Avatar'
import { colors } from '../../theme/colors'

interface ConvRowProps {
  conv: IgConversation
  onPress?: () => void
}

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

export function ConvRow({ conv, onPress }: ConvRowProps) {
  const name = conv.participant_name || conv.participant_username || '—'
  const handle = conv.participant_username ? `@${conv.participant_username}` : null
  const unread = (conv.unread_count ?? 0) > 0

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: 14,
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: pressed ? colors.bgElevated : 'transparent',
      })}
    >
      <View>
        <Avatar name={name} size={48} />
        {/* Badge canal Instagram */}
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
            borderColor: colors.bgPrimary,
          }}
        >
          <Ionicons name="logo-instagram" size={10} color="#fff" />
        </View>
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text
            numberOfLines={1}
            style={{
              color: colors.textPrimary,
              fontSize: 17,
              fontWeight: unread ? '700' : '600',
              flex: 1,
            }}
          >
            {name}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            {formatRelative(conv.last_message_at)}
          </Text>
        </View>
        <Text
          numberOfLines={2}
          style={{
            color: unread ? colors.textPrimary : colors.textSecondary,
            fontSize: 14,
            fontWeight: unread ? '600' : '400',
            lineHeight: 19,
          }}
        >
          {conv.last_message_text || '—'}
        </Text>
        {handle ? (
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{handle}</Text>
        ) : null}
      </View>

      {unread ? (
        <View style={{ alignSelf: 'center' }}>
          <View
            style={{
              minWidth: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: colors.primary,
              paddingHorizontal: 6,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
              {conv.unread_count}
            </Text>
          </View>
        </View>
      ) : null}
    </Pressable>
  )
}
