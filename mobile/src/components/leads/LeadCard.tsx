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
  variant?: 'dense' | 'large'
  /** Si true, applique un divider bottom pour usage en list-row.
   *  Default false (card individuelle). */
  isInSection?: boolean
  isLast?: boolean
}

const formatAmount = (amount: number | null): string | null => {
  if (amount == null) return null
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function LeadCard({ lead, onPress, isInSection, isLast }: LeadCardProps) {
  const fullName = `${lead.first_name} ${lead.last_name}`.trim() || '—'
  const amount = formatAmount(lead.deal_amount)
  // Subtitle = source en clair + phone si pas de deal, ou phone si deal
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
        // Si dans une section, divider bottom (sauf last)
        borderBottomWidth: isInSection && !isLast ? 0.5 : 0,
        borderBottomColor: colors.border,
        // Coins arrondis seulement si standalone
        ...(isInSection
          ? {}
          : {
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
            }),
      })}
    >
      <Avatar name={fullName} size={48} />

      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text
            numberOfLines={1}
            style={{
              color: colors.textPrimary,
              fontSize: 17,
              fontWeight: '600',
              flexShrink: 1,
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
            textTransform: 'capitalize',
          }}
        >
          {subtitle}
        </Text>
      </View>

      <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: 6 }}>
        {amount ? (
          <Text style={{ color: colors.primary, fontSize: 17, fontWeight: '700' }}>{amount}</Text>
        ) : null}
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      </View>
    </Pressable>
  )
}
