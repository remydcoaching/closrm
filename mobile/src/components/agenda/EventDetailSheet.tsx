import React, { useEffect, useMemo, useRef } from 'react'
import { View, Text, Pressable } from 'react-native'
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import { Ionicons } from '@expo/vector-icons'
import type { AgendaItem } from '../../types/agenda'
import { Avatar } from '../ui/Avatar'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'

interface Props {
  item: AgendaItem | null
  onClose: () => void
  onOpenLead?: (leadId: string) => void
  onOpenCall?: (callId: string) => void
}

function colorForItem(item: AgendaItem): string {
  if (item.color) return item.color
  switch (item.kind) {
    case 'closing':
      return colors.purple
    case 'setting':
      return colors.info
    case 'personal':
      return '#6b7280'
    default:
      return colors.primary
  }
}

function labelForKind(item: AgendaItem): string {
  if (item.kind === 'closing') return 'Closing'
  if (item.kind === 'setting') return 'Setting'
  if (item.kind === 'personal') return 'Perso'
  return 'Booking'
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
}

function formatDuration(min: number): string {
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

function formatAmount(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n)
}

export function EventDetailSheet({ item, onClose, onOpenLead, onOpenCall }: Props) {
  const sheetRef = useRef<BottomSheet>(null)
  const open = item != null

  useEffect(() => {
    if (open) sheetRef.current?.snapToIndex(0)
    else sheetRef.current?.close()
  }, [open])

  const renderBackdrop = useMemo(
    () =>
      // eslint-disable-next-line react/display-name
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.5}
        />
      ),
    []
  )

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={['55%']}
      enableDynamicSizing={false}
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.sheet }}
      handleIndicatorStyle={{ backgroundColor: colors.textTertiary }}
    >
      <BottomSheetView style={{ flex: 1, padding: spacing.lg }}>
        {item ? (
          <Content
            item={item}
            onOpenLead={onOpenLead}
            onOpenCall={onOpenCall}
            onClose={onClose}
          />
        ) : null}
      </BottomSheetView>
    </BottomSheet>
  )
}

function Content({
  item,
  onOpenLead,
  onOpenCall,
  onClose,
}: {
  item: AgendaItem
  onOpenLead?: (leadId: string) => void
  onOpenCall?: (callId: string) => void
  onClose: () => void
}) {
  const color = colorForItem(item)
  const isDone = item.outcome === 'done'
  const isNoShow = item.outcome === 'no_show'

  return (
    <View style={{ gap: spacing.md }}>
      {/* Header : type chip + titre */}
      <View style={{ gap: 6 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            alignSelf: 'flex-start',
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: radius.pill,
            backgroundColor: color + '22',
            borderWidth: 1,
            borderColor: color + '55',
          }}
        >
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
          <Text style={{ ...t.caption1, color, fontWeight: '700' }}>
            {labelForKind(item)}
          </Text>
        </View>
        <Text
          style={{
            ...t.title2,
            color: colors.textPrimary,
            marginTop: 2,
          }}
        >
          {item.title}
        </Text>
      </View>

      {/* Date + heure + durée */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          padding: spacing.md,
          backgroundColor: colors.bgSecondary,
          borderRadius: radius.lg,
        }}
      >
        <Ionicons name="time-outline" size={22} color={color} />
        <View style={{ flex: 1 }}>
          <Text style={{ ...t.bodyEmphasis, color: colors.textPrimary }}>
            {formatTime(item.scheduled_at)} · {formatDuration(item.duration_minutes)}
          </Text>
          <Text style={{ ...t.caption1, color: colors.textSecondary, marginTop: 2 }}>
            {formatDate(item.scheduled_at)}
          </Text>
        </View>
      </View>

      {/* Lead block (si présent) */}
      {item.lead_name ? (
        <Pressable
          onPress={() => {
            if (item.lead_id && onOpenLead) {
              onClose()
              setTimeout(() => onOpenLead(item.lead_id!), 200)
            }
          }}
          disabled={!item.lead_id}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            padding: spacing.md,
            backgroundColor: colors.bgSecondary,
            borderRadius: radius.lg,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Avatar name={item.lead_name} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={{ ...t.caption2, color: colors.textTertiary, fontWeight: '600' }}>
              LEAD
            </Text>
            <Text style={{ ...t.bodyEmphasis, color: colors.textPrimary }}>
              {item.lead_name}
            </Text>
          </View>
          {item.amount ? (
            <Text
              style={{
                color: colors.primary,
                fontSize: 17,
                fontWeight: '800',
                letterSpacing: -0.3,
              }}
            >
              {formatAmount(item.amount)}
            </Text>
          ) : null}
          {item.lead_id ? (
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          ) : null}
        </Pressable>
      ) : null}

      {/* Lieu */}
      {item.location_name ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            padding: spacing.md,
            backgroundColor: colors.bgSecondary,
            borderRadius: radius.lg,
          }}
        >
          <Ionicons name="location-outline" size={22} color={color} />
          <Text style={{ ...t.body, color: colors.textPrimary, flex: 1 }}>
            {item.location_name}
          </Text>
        </View>
      ) : null}

      {/* Statut outcome */}
      {isDone || isNoShow ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            padding: spacing.md,
            backgroundColor: isNoShow
              ? colors.warning + '14'
              : colors.primary + '14',
            borderRadius: radius.lg,
          }}
        >
          <Ionicons
            name={isNoShow ? 'alert-circle' : 'checkmark-circle'}
            size={20}
            color={isNoShow ? colors.warning : colors.primary}
          />
          <Text
            style={{
              ...t.bodyEmphasis,
              color: isNoShow ? colors.warning : colors.primary,
            }}
          >
            {isNoShow ? 'Absent' : 'Effectué'}
          </Text>
        </View>
      ) : null}

      {/* CTA principale */}
      {item.source === 'call' && item.call_id ? (
        <Pressable
          onPress={() => {
            onClose()
            setTimeout(() => onOpenCall?.(item.call_id!), 200)
          }}
          style={({ pressed }) => ({
            paddingVertical: 14,
            backgroundColor: color,
            borderRadius: radius.lg,
            alignItems: 'center',
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text
            style={{
              ...t.bodyEmphasis,
              color: '#000',
              fontWeight: '700',
            }}
          >
            Ouvrir l&apos;appel
          </Text>
        </Pressable>
      ) : item.source === 'booking' && item.lead_id ? (
        <Pressable
          onPress={() => {
            onClose()
            setTimeout(() => onOpenLead?.(item.lead_id!), 200)
          }}
          style={({ pressed }) => ({
            paddingVertical: 14,
            backgroundColor: color,
            borderRadius: radius.lg,
            alignItems: 'center',
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text
            style={{
              ...t.bodyEmphasis,
              color: '#000',
              fontWeight: '700',
            }}
          >
            Voir la fiche lead
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}
