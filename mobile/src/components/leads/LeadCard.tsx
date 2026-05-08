import React from 'react'
import { Pressable, View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Lead } from '@shared/types'
import { Avatar } from '../ui/Avatar'
import { StatusBadge } from '../ui/StatusBadge'
import { SourceBadge } from '../ui/SourceBadge'
import { colors } from '../../theme/colors'

interface LeadCardProps {
  lead: Lead
  onPress?: () => void
  variant?: 'dense' | 'large'
}

const formatRelative = (iso: string | null): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  // clamp à 0 : si la date est dans le futur (clock skew, timezone mal
  // gérée côté serveur), on affiche "à l'instant" au lieu d'un truc bizarre.
  const diffMin = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000))
  if (diffMin < 1) return "à l'instant"
  if (diffMin < 60) return `il y a ${diffMin} min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `il y a ${diffH}h`
  const diffD = Math.round(diffH / 24)
  if (diffD < 30) return `il y a ${diffD}j`
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

const formatAmount = (amount: number | null): string | null => {
  if (amount == null) return null
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function LeadCard({ lead, onPress, variant = 'dense' }: LeadCardProps) {
  const fullName = `${lead.first_name} ${lead.last_name}`.trim() || '—'
  const amount = formatAmount(lead.deal_amount)
  const lastActivity = lead.last_activity_at ?? lead.updated_at ?? lead.created_at

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: colors.bgElevated,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        padding: variant === 'large' ? 16 : 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Avatar name={fullName} size={variant === 'large' ? 52 : 44} />

      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Text
            numberOfLines={1}
            style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '600', flexShrink: 1 }}
          >
            {fullName}
          </Text>
          <StatusBadge status={lead.status} size="sm" />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <SourceBadge source={lead.source} size="sm" />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
              {formatRelative(lastActivity)}
            </Text>
          </View>
          {lead.call_attempts > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="call-outline" size={13} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                {lead.call_attempts}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {amount ? (
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '700' }}>{amount}</Text>
          {lead.deal_installments > 1 ? (
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              x{lead.deal_installments}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  )
}
