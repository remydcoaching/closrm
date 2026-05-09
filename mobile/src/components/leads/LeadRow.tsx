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
    paddingVertical: 16,
    paddingLeft: 14,
    paddingRight: 16,
  },
  card: {
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.xl,
  },
  avatarWrap: {
    marginRight: 14,
  },
  middle: {
    flex: 1,
    minWidth: 0,
  },
  amountWrap: {
    alignItems: 'flex-end',
    marginLeft: 12,
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
          // Border gauche 4pt accent + ombre pour décoller la card du fond
          borderLeftWidth: 4,
          borderLeftColor: statusColor,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
          elevation: 2,
        },
      ]}
      android_ripple={{ color: '#ffffff10' }}
    >
      <View style={styles.avatarWrap}>
        <Avatar name={fullName} size={48} />
      </View>

      <View style={styles.middle}>
        <Text
          numberOfLines={1}
          style={{
            color: colors.textPrimary,
            fontSize: 17,
            fontWeight: '600',
            letterSpacing: -0.3,
          }}
        >
          {fullName}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            color: statusColor,
            fontSize: 14,
            fontWeight: '700',
            marginTop: 3,
            letterSpacing: -0.1,
          }}
        >
          {statusLabel}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            color: colors.textSecondary,
            fontSize: 13,
            fontWeight: '400',
            marginTop: 3,
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
          <Text
            style={{
              color: colors.primary,
              fontSize: 20,
              fontWeight: '800',
              letterSpacing: -0.5,
            }}
          >
            {amount}
          </Text>
          {lead.deal_installments > 1 ? (
            <Text style={{ ...t.caption2, color: colors.textSecondary, marginTop: 3 }}>
              ×{lead.deal_installments}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  )
}
