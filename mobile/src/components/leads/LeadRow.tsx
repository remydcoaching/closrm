import React from 'react'
import { Pressable, View, Text, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import type { Lead } from '@shared/types'
import { Avatar } from '../ui/Avatar'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'
import { statusConfig } from '../../theme/status'

interface LeadRowProps {
  lead: Lead
  onPress?: () => void
  /** Si true, rendu en card individuelle avec glass effect. */
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

// Full pill — match exactement le style des FilterChips au-dessus de la liste.
const CARD_RADIUS = 999

const styles = StyleSheet.create({
  container: {
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
  },
  shadowContainer: {
    borderRadius: CARD_RADIUS,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    // Padding gauche +4 pour compenser la courbe pill et donner de l'air
    // à l'avatar dans la forme arrondie.
    paddingLeft: 18,
    paddingRight: 20,
  },
  // Inner top highlight — fine ligne blanche très transparente qui simule
  // le bord lumineux du verre Apple (iOS Liquid Glass / Vibrancy).
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#ffffff10',
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

/** Lead row — pattern Pipedrive + glass Apple subtle.
 *  - Linear gradient subtile top→bottom (effet lift)
 *  - Top highlight 1px blanc 6% (simule bord lumineux verre iOS)
 *  - Border gauche 4pt couleur status
 *  - Shadow noire 10pt pour décoller du fond
 */
export function LeadRow({ lead, onPress, asCard = true }: LeadRowProps) {
  const fullName = `${lead.first_name} ${lead.last_name}`.trim() || '—'
  const amount = formatAmount(lead.deal_amount)
  const sourceLabel = lead.source.replace(/_/g, ' ')
  const statusLabel = statusConfig[lead.status].label
  const statusColor = statusConfig[lead.status].color
  const activity = formatRelative(
    lead.last_activity_at ?? lead.updated_at ?? lead.created_at,
  )

  if (!asCard) {
    // Mode list-row simple (pas de card)
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.row,
          { backgroundColor: pressed ? '#ffffff10' : 'transparent' },
        ]}
      >
        <RowContent
          fullName={fullName}
          statusLabel={statusLabel}
          statusColor={statusColor}
          sourceLabel={sourceLabel}
          phone={lead.phone}
          activity={activity}
          amount={amount}
          installments={lead.deal_installments}
        />
      </Pressable>
    )
  }

  return (
    <View style={styles.shadowContainer}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.container,
          {
            opacity: pressed ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.99 : 1 }],
          },
        ]}
      >
        {/* Glass gradient bg — top plus clair (#2c2c2e) → bottom plus
            sombre (#1c1c1e). Donne l'illusion d'une surface vitrée. */}
        <LinearGradient
          colors={['#2a2a2c', '#1c1c1e']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[
            styles.row,
            {
              borderLeftWidth: 4,
              borderLeftColor: statusColor,
            },
          ]}
        >
          {/* Highlight top 1px — bord lumineux du verre */}
          <View style={styles.topHighlight} />

          <RowContent
            fullName={fullName}
            statusLabel={statusLabel}
            statusColor={statusColor}
            sourceLabel={sourceLabel}
            phone={lead.phone}
            activity={activity}
            amount={amount}
            installments={lead.deal_installments}
          />
        </LinearGradient>
      </Pressable>
    </View>
  )
}

function RowContent({
  fullName,
  statusLabel,
  statusColor,
  sourceLabel,
  phone,
  activity,
  amount,
  installments,
}: {
  fullName: string
  statusLabel: string
  statusColor: string
  sourceLabel: string
  phone: string | null
  activity: string
  amount: string | null
  installments: number
}) {
  return (
    <>
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
          {phone ? ` · ${phone}` : ''}
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
          {installments > 1 ? (
            <Text style={{ ...t.caption2, color: colors.textSecondary, marginTop: 3 }}>
              ×{installments}
            </Text>
          ) : null}
        </View>
      ) : null}
    </>
  )
}
