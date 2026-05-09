import React from 'react'
import { View, Text, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { CallWithLead } from '../../hooks/useCalls'
import { Avatar } from '../ui/Avatar'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'

interface CallSlotProps {
  call: CallWithLead
  onPress?: () => void
  isNext?: boolean
}

const typeColor = (type: string): string => {
  switch (type) {
    case 'closing':
      return colors.purple
    case 'setting':
      return colors.info
    default:
      return colors.cyan
  }
}

const typeLabel = (type: string): string => {
  if (type === 'closing') return 'Closing'
  if (type === 'setting') return 'Setting'
  return type
}

const formatTime = (iso: string): string => {
  const d = new Date(iso)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

const minutesUntil = (iso: string): number =>
  Math.round((new Date(iso).getTime() - Date.now()) / 60000)

const formatAmount = (n: number | null) =>
  n == null
    ? null
    : new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }).format(n)

/** CallSlot — gutter heure à gauche + card sectionnée à droite.
 *  Pattern proche d'Apple Calendar : heure visible avant la card.
 */
export function CallSlot({ call, onPress, isNext }: CallSlotProps) {
  const color = typeColor(call.type)
  const isDone = call.outcome !== 'pending'
  const lead = call.lead
  const fullName = lead ? `${lead.first_name} ${lead.last_name}`.trim() || '—' : '—'
  const amount = lead ? formatAmount(lead.deal_amount) : null
  const liveMin = isNext ? minutesUntil(call.scheduled_at) : 0

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: spacing.md,
        opacity: isDone ? 0.5 : pressed ? 0.7 : 1,
      })}
    >
      {/* Gutter heure */}
      <View style={{ width: 56, alignItems: 'flex-end', paddingTop: 14 }}>
        <Text style={{ ...t.bodyEmphasis, color: colors.textPrimary }}>
          {formatTime(call.scheduled_at)}
        </Text>
        <Text style={{ ...t.caption1, color: colors.textSecondary }}>
          {call.duration_seconds ? `${Math.round(call.duration_seconds / 60)} min` : '—'}
        </Text>
      </View>

      {/* Card */}
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bgSecondary,
          borderRadius: radius.xl,
          borderLeftWidth: 3,
          borderLeftColor: color,
          padding: spacing.md,
          gap: spacing.sm,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            flexWrap: 'wrap',
          }}
        >
          <Text
            style={{
              ...t.caption2,
              color,
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: 0.6,
            }}
          >
            {typeLabel(call.type)}
          </Text>
          {isNext && liveMin >= 0 && liveMin <= 60 ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: colors.primary + '26',
                borderRadius: 999,
                paddingHorizontal: 8,
                paddingVertical: 2,
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: colors.primary,
                }}
              />
              <Text
                style={{
                  ...t.caption2,
                  color: colors.primary,
                  fontWeight: '700',
                  letterSpacing: 0.4,
                }}
              >
                LIVE DANS {liveMin} MIN
              </Text>
            </View>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Avatar name={fullName} size={40} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{ ...t.bodyEmphasis, color: colors.textPrimary }}
            >
              {fullName}
            </Text>
            {call.notes ? (
              <Text
                numberOfLines={1}
                style={{ ...t.subheadline, color: colors.textSecondary, marginTop: 2 }}
              >
                {call.notes}
              </Text>
            ) : null}
          </View>
          {amount ? (
            <Text style={{ ...t.bodyEmphasis, color: colors.primary }}>{amount}</Text>
          ) : null}
        </View>

        {isNext && !isDone ? (
          <Pressable
            onPress={onPress}
            style={({ pressed }) => ({
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: colors.primary,
              borderRadius: radius.md,
              paddingVertical: 6,
              paddingHorizontal: 12,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Ionicons name="rocket" size={13} color="#000" />
            <Text style={{ ...t.subheadline, color: '#000', fontWeight: '700' }}>Préparer</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  )
}
