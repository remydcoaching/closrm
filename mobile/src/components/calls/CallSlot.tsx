import React from 'react'
import { View, Text, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { CallWithLead } from '../../hooks/useCalls'
import { Avatar } from '../ui/Avatar'
import { colors } from '../../theme/colors'

interface CallSlotProps {
  call: CallWithLead
  onPress?: () => void
  /** Si true : badge "LIVE DANS X MIN" avec dot pulsant.
   *  Calculé côté écran parent (1 seul "next call" par liste). */
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
  switch (type) {
    case 'closing':
      return 'CLOSING'
    case 'setting':
      return 'SETTING'
    default:
      return type.toUpperCase()
  }
}

const formatTime = (iso: string): string => {
  const d = new Date(iso)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

const minutesUntil = (iso: string): number => Math.round((new Date(iso).getTime() - Date.now()) / 60000)

const formatAmount = (n: number | null) =>
  n == null
    ? null
    : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

export function CallSlot({ call, onPress, isNext }: CallSlotProps) {
  const color = typeColor(call.type)
  const isDone = call.outcome === 'done' || call.outcome === 'no_show' || call.outcome === 'cancelled'
  const lead = call.lead
  const fullName = lead ? `${lead.first_name} ${lead.last_name}`.trim() || '—' : '—'
  const amount = lead ? formatAmount(lead.deal_amount) : null
  const liveMin = isNext ? minutesUntil(call.scheduled_at) : 0

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: 8,
        opacity: isDone ? 0.55 : pressed ? 0.7 : 1,
      })}
    >
      {/* Gutter heure */}
      <View style={{ width: 64, alignItems: 'flex-end', paddingTop: 14 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '700' }}>
          {formatTime(call.scheduled_at)}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
          {call.duration_seconds ? `${Math.round(call.duration_seconds / 60)} min` : '—'}
        </Text>
      </View>

      {/* Card */}
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bgElevated,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          borderLeftWidth: 4,
          borderLeftColor: color,
          padding: 14,
          gap: 8,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Text
            style={{
              color,
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 0.6,
            }}
          >
            {typeLabel(call.type)}
          </Text>
          {isNext && liveMin >= 0 && liveMin <= 60 ? (
            <View
              style={{
                backgroundColor: colors.primary + '22',
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 6,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
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
              <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>
                LIVE DANS {liveMin} MIN
              </Text>
            </View>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar name={fullName} size={40} />
          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={1}
              style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}
            >
              {fullName}
            </Text>
            {call.notes ? (
              <Text
                numberOfLines={1}
                style={{ color: colors.textSecondary, fontSize: 13 }}
              >
                {call.notes}
              </Text>
            ) : null}
          </View>
          {amount ? (
            <Text style={{ color: colors.primary, fontSize: 15, fontWeight: '700' }}>{amount}</Text>
          ) : null}
        </View>

        {/* Bouton 'Préparer' si le call est imminent (cf spec 7.3).
            On affiche le bouton uniquement pour le call qui est marqué isNext
            ET qui n'est pas déjà parti — sinon ce serait du bruit visuel. */}
        {isNext && !isDone ? (
          <Pressable
            onPress={(e) => {
              // L'event ne doit pas remonter au Pressable parent (qui ouvre
              // le détail) — l'utilisateur veut juste 'préparer' côté détail
              // mais on laisse le tap agir comme open detail (même action V1).
              e.stopPropagation?.()
              onPress?.()
            }}
            style={({ pressed }) => ({
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: colors.primary + '22',
              borderWidth: 1,
              borderColor: colors.primary + '55',
              borderRadius: 8,
              paddingVertical: 6,
              paddingHorizontal: 12,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons name="rocket-outline" size={14} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>
              Préparer
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  )
}
