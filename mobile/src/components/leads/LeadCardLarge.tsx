import React from 'react'
import { Pressable, View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Lead } from '@shared/types'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'

interface LeadCardLargeProps {
  lead: Lead
  urgency?: { label: string; color: string } | null
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

/** Card large pour la vue priority — design featured avec urgency badge
 *  prominent, CTA dédié. */
export function LeadCardLarge({ lead, urgency, ctaLabel, onPress, onCta }: LeadCardLargeProps) {
  const fullName = `${lead.first_name} ${lead.last_name}`.trim() || '—'
  const amount = formatAmount(lead.deal_amount)

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: colors.bgSecondary,
        borderRadius: radius.xl,
        padding: spacing.lg,
        gap: spacing.md,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {urgency ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            alignSelf: 'flex-start',
            backgroundColor: urgency.color + '26',
            paddingVertical: 4,
            paddingHorizontal: 10,
            borderRadius: 999,
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
          <Text
            style={{
              ...t.caption2,
              color: urgency.color,
              fontWeight: '700',
              letterSpacing: 0.4,
              textTransform: 'uppercase',
            }}
          >
            {urgency.label}
          </Text>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Avatar name={fullName} size={48} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{ ...t.title3, color: colors.textPrimary }}
          >
            {fullName}
          </Text>
          {lead.call_attempts > 0 || lead.phone ? (
            <Text style={{ ...t.subheadline, color: colors.textSecondary, marginTop: 2 }}>
              {lead.phone ?? '—'}
              {lead.call_attempts > 0 ? ` · ${lead.call_attempts} appel${lead.call_attempts > 1 ? 's' : ''}` : ''}
            </Text>
          ) : null}
        </View>
        {amount ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ ...t.title3, color: colors.primary }}>{amount}</Text>
            {lead.deal_installments > 1 ? (
              <Text style={{ ...t.caption1, color: colors.textSecondary }}>
                ×{lead.deal_installments}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {ctaLabel ? (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <Button label={ctaLabel} size="sm" variant="primary" onPress={onCta} />
        </View>
      ) : null}
    </Pressable>
  )
}
