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

/** Lead row chip premium — bg avec tint subtil status (sauf nouveau gris),
 *  avatar 30, padding aéré, amount/activity à droite. */
export function LeadRow({ lead, onPress }: LeadRowProps) {
  const fullName = `${lead.first_name} ${lead.last_name}`.trim() || '—'
  const amount = formatAmount(lead.deal_amount)
  const statusLabel = statusConfig[lead.status].label
  const statusColor = statusConfig[lead.status].color
  const activity = formatRelative(
    lead.last_activity_at ?? lead.updated_at ?? lead.created_at,
  )
  // Tint bg : nouveau = neutre, autres = couleur status à 8% alpha sur
  // bg #1c1c1e → mix subtil qui fait ressortir les leads non-nouveaux.
  const isNeutral = lead.status === 'nouveau'
  const chipBg = isNeutral ? '#1c1c1e' : statusColor + '14' // 8% alpha hex

  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 999,
            backgroundColor: chipBg,
            opacity: pressed ? 0.7 : 1,
          }}
        >
          <View style={{ marginRight: 10 }}>
            <Avatar name={fullName} size={32} />
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

          {/* Right side : amount si deal, sinon activity time */}
          {amount ? (
            <Text
              style={{
                color: colors.primary,
                fontSize: 15,
                fontWeight: '800',
                letterSpacing: -0.24,
                marginLeft: 8,
              }}
            >
              {amount}
            </Text>
          ) : activity ? (
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 13,
                fontWeight: '500',
                marginLeft: 8,
              }}
            >
              {activity}
            </Text>
          ) : null}
        </View>
      )}
    </Pressable>
  )
}
