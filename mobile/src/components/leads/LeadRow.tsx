import React from 'react'
import { Pressable, View, Text } from 'react-native'
import type { Lead } from '@shared/types'
import { Avatar } from '../ui/Avatar'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'
import { statusConfig } from '../../theme/status'

interface LeadRowProps {
  lead: Lead
  onPress?: () => void
  /** Si true, hairline separator au bottom (intra-section). */
  separator?: boolean
  /** Si true, rendu en card individuelle (bg secondary + radius). */
  asCard?: boolean
}

const formatAmount = (n: number | null): string | null =>
  n == null
    ? null
    : new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }).format(n)

/** Lead row inline iOS-native — un seul Pressable flex-row avec 3
 *  colonnes (avatar | content flex 1 | trailing). Pas d'abstraction
 *  ListRow pour garantir le layout visuel. */
export function LeadRow({ lead, onPress, separator, asCard }: LeadRowProps) {
  const fullName = `${lead.first_name} ${lead.last_name}`.trim() || '—'
  const amount = formatAmount(lead.deal_amount)
  const sourceLabel = lead.source.replace(/_/g, ' ')
  const statusLabel = statusConfig[lead.status].label
  const statusColor = statusConfig[lead.status].color

  return (
    <View>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: asCard ? 14 : 12,
          paddingLeft: spacing.lg,
          paddingRight: spacing.md,
          backgroundColor: asCard
            ? pressed
              ? '#2c2c2e'
              : colors.bgSecondary
            : pressed
            ? '#ffffff10'
            : 'transparent',
          borderRadius: asCard ? radius.xl : 0,
          minHeight: 60,
        })}
      >
        {/* Col 1 — Avatar avec dot status overlay */}
        <View style={{ width: 40, height: 40, marginRight: spacing.md }}>
          <Avatar name={fullName} size={40} />
          <View
            style={{
              position: 'absolute',
              right: -2,
              bottom: -2,
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: statusColor,
              borderWidth: 2.5,
              borderColor: colors.bgSecondary,
            }}
          />
        </View>

        {/* Col 2 — Content flex 1 */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{
              ...t.bodyEmphasis,
              color: colors.textPrimary,
            }}
          >
            {fullName}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              ...t.subheadline,
              color: colors.textSecondary,
              marginTop: 2,
              textTransform: 'capitalize',
            }}
          >
            {statusLabel} · {sourceLabel}
            {lead.phone ? ` · ${lead.phone}` : ''}
          </Text>
        </View>

        {/* Col 3 — Amount à droite (si deal) */}
        {amount ? (
          <Text
            style={{
              ...t.bodyEmphasis,
              color: colors.primary,
              marginLeft: spacing.sm,
            }}
          >
            {amount}
          </Text>
        ) : null}
      </Pressable>

      {separator ? (
        <View
          style={{
            height: 0.33,
            backgroundColor: colors.border,
            marginLeft: 68, // 16 padding + 40 avatar + 12 gap
          }}
        />
      ) : null}
    </View>
  )
}
