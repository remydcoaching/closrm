import React from 'react'
import { Pressable, View, Text } from 'react-native'
import type { Lead } from '@shared/types'
import { Avatar } from '../ui/Avatar'
import { colors } from '../../theme/colors'
import { statusConfig } from '../../theme/status'

interface LeadRowProps {
  lead: Lead
  onPress?: () => void
}

const formatAmount = (n: number | null): string | null =>
  n == null
    ? null
    : new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }).format(n)

/** Lead row chip — flex row figé via View externe (pas Pressable) pour
 *  garantir le layout. Pressable wrappe seulement pour la pressed state. */
export function LeadRow({ lead, onPress }: LeadRowProps) {
  const fullName = `${lead.first_name} ${lead.last_name}`.trim() || '—'
  const amount = formatAmount(lead.deal_amount)
  const statusLabel = statusConfig[lead.status].label
  const statusColor = statusConfig[lead.status].color

  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderRadius: 999,
            backgroundColor: '#1c1c1e',
            opacity: pressed ? 0.7 : 1,
          }}
        >
          <View style={{ marginRight: 10 }}>
            <Avatar name={fullName} size={28} />
          </View>

          <Text
            numberOfLines={1}
            style={{
              color: colors.textPrimary,
              fontSize: 15,
              fontWeight: '600',
              letterSpacing: -0.24,
              flexShrink: 1,
            }}
          >
            {fullName}
          </Text>

          <Text
            numberOfLines={1}
            style={{
              color: statusColor,
              fontSize: 13,
              fontWeight: '700',
              marginLeft: 8,
            }}
          >
            {statusLabel}
          </Text>

          <View style={{ flex: 1 }} />

          {amount ? (
            <Text
              style={{
                color: colors.primary,
                fontSize: 15,
                fontWeight: '700',
                letterSpacing: -0.24,
                marginLeft: 8,
              }}
            >
              {amount}
            </Text>
          ) : null}
        </View>
      )}
    </Pressable>
  )
}
