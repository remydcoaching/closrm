import React from 'react'
import { Pressable, View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Lead } from '@shared/types'
import { Avatar } from '../ui/Avatar'
import { StatusBadge } from '../ui/StatusBadge'
import { colors } from '../../theme/colors'

interface LeadCardProps {
  lead: Lead
  onPress?: () => void
}

const formatAmount = (amount: number | null): string | null => {
  if (amount == null) return null
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function LeadCard({ lead, onPress }: LeadCardProps) {
  const fullName = `${lead.first_name} ${lead.last_name}`.trim() || '—'
  const amount = formatAmount(lead.deal_amount)
  const sourceLabel = lead.source.replace(/_/g, ' ')
  const subtitle = lead.phone ? `${sourceLabel} · ${lead.phone}` : sourceLabel

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: pressed ? colors.bgSecondary : colors.bgElevated,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        // Shadow iOS pour décoller la card du fond noir profond
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 3,
      })}
    >
      {/* Avatar : taille fixe explicite */}
      <View style={{ width: 48, height: 48 }}>
        <Avatar name={fullName} size={48} />
      </View>

      {/* Bloc central : flex 1 + minWidth 0 → permet de shrink correctement
          et de pas pousser le bloc droit hors de la rangée. */}
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{
              color: colors.textPrimary,
              fontSize: 17,
              fontWeight: '700',
              flexShrink: 1,
              minWidth: 0,
            }}
          >
            {fullName}
          </Text>
          <StatusBadge status={lead.status} size="sm" />
        </View>
        <Text
          numberOfLines={1}
          style={{
            color: colors.textSecondary,
            fontSize: 14,
            fontWeight: '500',
            textTransform: 'capitalize',
          }}
        >
          {subtitle}
        </Text>
      </View>

      {/* Bloc droit : amount + chevron, alignés au centre vertical */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {amount ? (
          <Text style={{ color: colors.primary, fontSize: 17, fontWeight: '800' }}>{amount}</Text>
        ) : null}
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      </View>
    </Pressable>
  )
}
