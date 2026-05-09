import React from 'react'
import { Pressable, View, Text, StyleSheet } from 'react-native'
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

const styles = StyleSheet.create({
  // Match exact des FilterChips :
  // - bg #1c1c1e
  // - paddingVertical 6, paddingHorizontal 12
  // - borderRadius 999
  // - texte subheadline 15pt 600 white
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#1c1c1e',
    gap: 10,
  },
})

/** Lead row = vrai chip pill, MÊME STYLE EXACT que FilterChips Tous/Closing/...
 *  Single line, padding tight, bg uniforme, texte white 15pt 600.
 *  Avatar 28 (mini, juste pour différencier visuellement). */
export function LeadRow({ lead, onPress }: LeadRowProps) {
  const fullName = `${lead.first_name} ${lead.last_name}`.trim() || '—'
  const amount = formatAmount(lead.deal_amount)
  const statusLabel = statusConfig[lead.status].label
  const statusColor = statusConfig[lead.status].color

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {/* Avatar mini */}
      <Avatar name={fullName} size={28} />

      {/* Nom — comme le label du chip */}
      <Text
        numberOfLines={1}
        style={{
          color: colors.textPrimary,
          fontSize: 15,
          fontWeight: '600',
          flexShrink: 1,
          letterSpacing: -0.24,
        }}
      >
        {fullName}
      </Text>

      {/* Status texte coloré (équivalent du dot signal sur FilterChips actif) */}
      <Text
        numberOfLines={1}
        style={{
          color: statusColor,
          fontSize: 13,
          fontWeight: '700',
        }}
      >
        {statusLabel}
      </Text>

      {/* Spacer flex pour pousser amount à droite */}
      <View style={{ flex: 1 }} />

      {amount ? (
        <Text
          style={{
            color: colors.primary,
            fontSize: 15,
            fontWeight: '700',
            letterSpacing: -0.24,
          }}
        >
          {amount}
        </Text>
      ) : null}
    </Pressable>
  )
}
