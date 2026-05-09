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
  if (diffMin < 1) return 'maintenant'
  if (diffMin < 60) return `${diffMin}min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `${diffH}h`
  const diffD = Math.round(diffH / 24)
  if (diffD < 7) return `${diffD}j`
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

/** ConvRow chip — pill tint pink (Instagram), unread dot accent. */
export function ConvRow({ conv, onPress }: ConvRowProps) {
  const name = conv.participant_name || conv.participant_username || '—'
  const unread = (conv.unread_count ?? 0) > 0
  const accent = colors.pink

  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 999,
            backgroundColor: unread ? accent + '14' : '#1c1c1e',
            borderWidth: 1,
            borderColor: unread ? accent + '30' : '#1c1c1e',
            opacity: pressed ? 0.7 : 1,
          }}
        >
          <View style={{ marginRight: 10 }}>
            <Avatar name={name} size={36} />
            {/* badge canal IG */}
            <View
              style={{
                position: 'absolute',
                bottom: -2,
                right: -2,
                width: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor: accent,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: unread ? '#1c1c1e' : '#1c1c1e',
              }}
            >
              <Ionicons name="logo-instagram" size={9} color="#fff" />
            </View>
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{
                color: colors.textPrimary,
                fontSize: 15,
                fontWeight: unread ? '700' : '600',
                letterSpacing: -0.24,
              }}
            >
              {name}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                color: unread ? colors.textPrimary : colors.textSecondary,
                fontSize: 13,
                fontWeight: unread ? '500' : '400',
                marginTop: 2,
              }}
            >
              {conv.last_message_text || '—'}
            </Text>
          </View>

          <View style={{ alignItems: 'flex-end', gap: 4, marginLeft: 8 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '500' }}>
              {formatRelative(conv.last_message_at)}
            </Text>
            {unread ? (
              <View
                style={{
                  minWidth: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: accent,
                  paddingHorizontal: 5,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}
                >
                  {conv.unread_count}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      )}
    </Pressable>
  )
}
