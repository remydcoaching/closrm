import React from 'react'
import { View, Text, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { CallWithLead } from '../../hooks/useCalls'
import { Avatar } from '../ui/Avatar'
import { colors } from '../../theme/colors'

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

/** CallSlot — chip pill match style LeadRow : pill tint colored par type
 *  call (purple closing, blue setting), dot status, gutter heure à gauche. */
export function CallSlot({ call, onPress, isNext }: CallSlotProps) {
  const color = typeColor(call.type)
  const isDone = call.outcome !== 'pending'
  const lead = call.lead
  const fullName = lead ? `${lead.first_name} ${lead.last_name}`.trim() || '—' : '—'
  const amount = lead ? formatAmount(lead.deal_amount) : null
  const liveMin = isNext ? minutesUntil(call.scheduled_at) : 0
  const showLive = isNext && !isDone && liveMin >= 0 && liveMin <= 60

  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            opacity: isDone ? 0.5 : pressed ? 0.7 : 1,
          }}
        >
          {/* Gutter heure */}
          <View style={{ width: 56, alignItems: 'flex-end', marginRight: 10 }}>
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: 17,
                fontWeight: '700',
                letterSpacing: -0.4,
              }}
            >
              {formatTime(call.scheduled_at)}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '500' }}>
              {call.duration_seconds ? `${Math.round(call.duration_seconds / 60)} min` : '—'}
            </Text>
          </View>

          {/* Chip pill */}
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 999,
              backgroundColor: color + '14',
              borderWidth: 1,
              borderColor: color + '30',
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

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                marginLeft: 10,
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: color,
                }}
              />
              <Text
                numberOfLines={1}
                style={{
                  color,
                  fontSize: 13,
                  fontWeight: '700',
                  letterSpacing: -0.1,
                }}
              >
                {showLive ? `Live · ${liveMin}min` : typeLabel(call.type)}
              </Text>
            </View>

            <View style={{ flex: 1 }} />

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
            ) : null}

            {showLive ? (
              <View
                style={{
                  marginLeft: 8,
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="rocket" size={14} color="#000" />
              </View>
            ) : null}
          </View>
        </View>
      )}
    </Pressable>
  )
}
