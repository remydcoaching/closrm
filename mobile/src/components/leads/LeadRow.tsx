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
  /** Si true, rendu en card individuelle (bg secondary + radius + accent border). */
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

const formatRelative = (iso: string | null): string => {
  if (!iso) return ''
  const d = new Date(iso)
  const diffMin = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000))
  if (diffMin < 60) return `${diffMin}min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `${diffH}h`
  const diffD = Math.round(diffH / 24)
  if (diffD < 30) return `${diffD}j`
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

/** Lead row premium iOS — pattern Pipedrive Mobile :
 *  - bordure gauche 3pt couleur status (signal visuel instantané)
 *  - card bg secondary radius xl
 *  - 1ère ligne: avatar | name + status colored | amount
 *  - 2e ligne (dans le content): source · phone · activity time
 */
export function LeadRow({ lead, onPress, asCard = true }: LeadRowProps) {
  const fullName = `${lead.first_name} ${lead.last_name}`.trim() || '—'
  const amount = formatAmount(lead.deal_amount)
  const sourceLabel = lead.source.replace(/_/g, ' ')
  const statusLabel = statusConfig[lead.status].label
  const statusColor = statusConfig[lead.status].color
  const activity = formatRelative(
    lead.last_activity_at ?? lead.updated_at ?? lead.created_at,
  )

  const cardStyle = asCard
    ? {
        backgroundColor: colors.bgSecondary,
        borderRadius: radius.xl,
        borderLeftWidth: 3,
        borderLeftColor: statusColor,
      }
    : null

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingLeft: asCard ? spacing.md : spacing.lg,
        paddingRight: spacing.md,
        opacity: pressed ? 0.7 : 1,
        ...cardStyle,
      })}
    >
      {/* Avatar */}
      <View style={{ marginRight: spacing.md }}>
        <Avatar name={fullName} size={44} />
      </View>

      {/* Content middle — flex 1 */}
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

        {/* Status colored label */}
        <Text
          numberOfLines={1}
          style={{
            ...t.subheadline,
            color: statusColor,
            fontWeight: '600',
            marginTop: 2,
          }}
        >
          {statusLabel}
        </Text>

        {/* Metadata footnote */}
        <Text
          numberOfLines={1}
          style={{
            ...t.caption1,
            color: colors.textSecondary,
            marginTop: 2,
            textTransform: 'capitalize',
          }}
        >
          {sourceLabel}
          {lead.phone ? ` · ${lead.phone}` : ''}
          {activity ? ` · ${activity}` : ''}
        </Text>
      </View>

      {/* Right column — amount big */}
      {amount ? (
        <View style={{ alignItems: 'flex-end', marginLeft: spacing.sm, gap: 2 }}>
          <Text
            style={{
              ...t.title3,
              color: colors.primary,
              letterSpacing: -0.3,
            }}
          >
            {amount}
          </Text>
          {lead.deal_installments > 1 ? (
            <Text style={{ ...t.caption2, color: colors.textSecondary }}>
              ×{lead.deal_installments}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  )
}
