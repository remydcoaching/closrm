import React from 'react'
import { Pressable, View, Text, StyleSheet } from 'react-native'
import type { Lead } from '@shared/types'
import { Avatar } from '../ui/Avatar'
import { colors } from '../../theme/colors'
import { type as t } from '../../theme/tokens'
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
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 18,
    borderRadius: 999,
    // Bg uniforme = match exact des FilterChips (Closing/Setting/...) du haut.
    backgroundColor: '#1c1c1e',
  },
  middle: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
  },
  amountWrap: {
    alignItems: 'flex-end',
    marginLeft: 10,
  },
})

/** Lead row pill — exact même style visuel que les FilterChips au-dessus :
 *  bg uniforme #1c1c1e, pas de gradient, pas de glass, juste le contour pill.
 *  Différenciation par : dot couleur sur avatar + texte status coloré.
 */
export function LeadRow({ lead, onPress }: LeadRowProps) {
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
      style={({ pressed }) => [
        styles.pill,
        {
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      {/* Avatar + dot status overlay (signal couleur instantané) */}
      <View>
        <Avatar name={fullName} size={44} />
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
            borderColor: '#1c1c1e',
          }}
        />
      </View>

      <View style={styles.middle}>
        {/* L1 : Nom blanc + status texte coloré inline */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            minWidth: 0,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              color: colors.textPrimary,
              fontSize: 16,
              fontWeight: '600',
              letterSpacing: -0.3,
              flexShrink: 1,
            }}
          >
            {fullName}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              color: statusColor,
              fontSize: 12,
              fontWeight: '700',
              letterSpacing: -0.1,
            }}
          >
            {statusLabel}
          </Text>
        </View>
        {/* L2 : metadata footnote */}
        <Text
          numberOfLines={1}
          style={{
            color: colors.textSecondary,
            fontSize: 12,
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
              fontSize: 17,
              fontWeight: '700',
              letterSpacing: -0.4,
            }}
          >
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
