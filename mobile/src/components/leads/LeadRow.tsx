import React from 'react'
import { Pressable, View, Text, StyleSheet } from 'react-native'
import type { Lead } from '@shared/types'
import { Avatar } from '../ui/Avatar'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'
import { statusConfig } from '../../theme/status'

interface LeadRowProps {
  lead: Lead
  onPress?: () => void
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

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
  card: {
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.xl,
  },
  avatarWrap: {
    marginRight: spacing.md,
  },
  middle: {
    flex: 1,
    minWidth: 0,
  },
  amountWrap: {
    alignItems: 'flex-end',
    marginLeft: spacing.sm,
  },
})

/** Lead row pattern Pipedrive Mobile — flexDirection 'row' garanti via
 *  StyleSheet (pas de spread de fonction qui casse parfois le layout). */
export function LeadRow({ lead, onPress, asCard = true }: LeadRowProps) {
  const fullName = `${lead.first_name} ${lead.last_name}`.trim() || '—'
  const amount = formatAmount(lead.deal_amount)
  const sourceLabel = lead.source.replace(/_/g, ' ')
  const statusLabel = statusConfig[lead.status].label
  const statusColor = statusConfig[lead.status].color
  const activity = formatRelative(
    lead.last_activity_at ?? lead.updated_at ?? lead.created_at,
  )

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.row,
        asCard && styles.card,
        asCard && {
          borderLeftWidth: 3,
          borderLeftColor: statusColor,
        },
      ]}
      android_ripple={{ color: '#ffffff10' }}
    >
      <View style={styles.avatarWrap}>
        <Avatar name={fullName} size={44} />
      </View>

      <View style={styles.middle}>
        <Text
          numberOfLines={1}
          style={{ ...t.bodyEmphasis, color: colors.textPrimary }}
        >
          {fullName}
        </Text>
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

      {amount ? (
        <View style={styles.amountWrap}>
          <Text style={{ ...t.title3, color: colors.primary, letterSpacing: -0.3 }}>
            {amount}
          </Text>
          {lead.deal_installments > 1 ? (
            <Text style={{ ...t.caption2, color: colors.textSecondary, marginTop: 2 }}>
              ×{lead.deal_installments}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  )
}
