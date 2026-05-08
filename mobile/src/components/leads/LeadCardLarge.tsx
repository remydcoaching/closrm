import React from 'react'
import { Pressable, View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Lead } from '@shared/types'
import { Avatar } from '../ui/Avatar'
import { StatusBadge } from '../ui/StatusBadge'
import { Button } from '../ui/Button'
import { colors } from '../../theme/colors'
import { statusConfig } from '../../theme/status'

interface LeadCardLargeProps {
  lead: Lead
  /** Calculé côté parent — null si pas d'urgence à afficher. */
  urgency?: { label: string; color: string; pulsing?: boolean } | null
  ctaLabel?: string
  onPress?: () => void
  onCta?: () => void
}

const formatAmount = (n: number | null): string | null =>
  n == null
    ? null
    : new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }).format(n)

export function LeadCardLarge({ lead, urgency, ctaLabel, onPress, onCta }: LeadCardLargeProps) {
  const fullName = `${lead.first_name} ${lead.last_name}`.trim() || '—'
  const amount = formatAmount(lead.deal_amount)
  const accent = statusConfig[lead.status].color

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: colors.bgElevated,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        borderTopWidth: 4,
        borderTopColor: accent,
        padding: 14,
        gap: 10,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar name={fullName} size={44} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text
              numberOfLines={1}
              style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '700', flexShrink: 1 }}
            >
              {fullName}
            </Text>
            <StatusBadge status={lead.status} size="sm" />
          </View>
          {urgency ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                marginTop: 4,
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: urgency.color,
                }}
              />
              <Text style={{ color: urgency.color, fontSize: 11, fontWeight: '700' }}>
                {urgency.label}
              </Text>
            </View>
          ) : null}
        </View>
        {amount ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '700' }}>
              {amount}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 10 }}>
              {lead.deal_installments > 1 ? `x${lead.deal_installments}` : 'cash'}
            </Text>
          </View>
        ) : null}
      </View>

      {(ctaLabel || lead.call_attempts > 0) ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {lead.call_attempts > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="call-outline" size={12} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                {lead.call_attempts} tentative{lead.call_attempts > 1 ? 's' : ''}
              </Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          {ctaLabel ? (
            <Button label={ctaLabel} size="sm" variant="primary" onPress={onCta} />
          ) : null}
        </View>
      ) : null}
    </Pressable>
  )
}
