import React from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import type { LeadsStackParamList } from '../../navigation/types'
import { useLead } from '../../hooks/useLead'
import { Avatar, Button } from '../../components/ui'
import { useScheduleSheet } from '../../components/schedule/ScheduleSheetProvider'
import { colors } from '../../theme/colors'
import { type as t, spacing } from '../../theme/tokens'
import { statusConfig, sourceConfig } from '../../theme/status'

type R = RouteProp<LeadsStackParamList, 'LeadDetail'>

const ctaLabel = (status: string): string => {
  switch (status) {
    case 'closing_planifie':
      return 'Rejoindre le closing'
    case 'setting_planifie':
      return 'Rejoindre le setting'
    case 'no_show_setting':
    case 'no_show_closing':
      return 'Reprogrammer'
    case 'nouveau':
    case 'scripte':
      return 'Planifier un setting'
    case 'clos':
      return 'Voir le deal'
    case 'dead':
      return 'Réactiver le lead'
    default:
      return 'Planifier un appel'
  }
}

const formatAmount = (n: number | null): string =>
  n == null
    ? '—'
    : new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }).format(n)

/** Chip pill — élément réutilisable dans le détail (pour status, source,
 *  tags, infos) avec la même langue visuelle que les leads list. */
function Chip({
  icon,
  label,
  color,
  onPress,
  filled,
}: {
  icon?: keyof typeof Ionicons.glyphMap
  label: string
  color: string
  onPress?: () => void
  filled?: boolean
}) {
  const Container = onPress ? Pressable : View
  return (
    <Container
      onPress={onPress}
      style={({ pressed }: { pressed?: boolean }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: filled ? color : color + '14',
        borderWidth: 1,
        borderColor: color + (filled ? '00' : '30'),
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {icon ? (
        <Ionicons name={icon} size={13} color={filled ? '#000' : color} />
      ) : (
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: filled ? '#000' : color,
          }}
        />
      )}
      <Text
        style={{
          color: filled ? '#000' : color,
          fontSize: 13,
          fontWeight: '700',
          letterSpacing: -0.1,
        }}
      >
        {label}
      </Text>
    </Container>
  )
}

/** Action ronde Apple Contacts (Call/DM/Email/Planifier). */
function ContactAction({
  icon,
  label,
  onPress,
  disabled,
  tint = colors.primary,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress?: () => void
  disabled?: boolean
  tint?: string
}) {
  return (
    <View style={{ alignItems: 'center', gap: 6, flex: 1 }}>
      <Pressable
        onPress={disabled ? undefined : onPress}
        style={({ pressed }) => ({
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: tint + '22',
          borderWidth: 1,
          borderColor: tint + '40',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        })}
      >
        <Ionicons name={icon} size={22} color={tint} />
      </Pressable>
      <Text style={{ ...t.caption1, color: tint, fontWeight: '600' }}>{label}</Text>
    </View>
  )
}

/** Info row chip pour téléphone/email/instagram — avec icone leading + valeur. */
function InfoChip({
  icon,
  label,
  value,
  tint,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
  tint: string
  onPress?: () => void
}) {
  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 999,
            backgroundColor: tint + '14',
            borderWidth: 1,
            borderColor: tint + '30',
            opacity: pressed ? 0.7 : 1,
            gap: 12,
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: tint + '33',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={icon} size={16} color={tint} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {label}
            </Text>
            <Text
              numberOfLines={1}
              style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '600', marginTop: 1 }}
            >
              {value}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        </View>
      )}
    </Pressable>
  )
}

export function LeadDetailScreen() {
  const route = useRoute<R>()
  const navigation = useNavigation()
  const { lead, loading } = useLead(route.params.leadId)
  const scheduleSheet = useScheduleSheet()

  if (loading) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.bgPrimary, justifyContent: 'center' }}
      >
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    )
  }
  if (!lead) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: colors.bgPrimary,
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.md,
        }}
      >
        <Text style={{ ...t.subheadline, color: colors.textSecondary }}>Lead introuvable.</Text>
        <Button label="Retour" variant="outline" onPress={() => navigation.goBack()} />
      </SafeAreaView>
    )
  }

  const fullName = `${lead.first_name} ${lead.last_name}`.trim() || '—'
  const statusColor = statusConfig[lead.status].color
  const statusLabel = statusConfig[lead.status].label
  const sourceColor = sourceConfig[lead.source].color
  const sourceLabel = sourceConfig[lead.source].label

  const callPhone = () => {
    if (lead.phone) Linking.openURL(`tel:${lead.phone}`)
  }
  const sendEmail = () => {
    if (lead.email) Linking.openURL(`mailto:${lead.email}`)
  }
  const openInstagram = () => {
    if (lead.instagram_handle) {
      const url =
        Platform.OS === 'ios'
          ? `instagram://user?username=${lead.instagram_handle}`
          : `https://instagram.com/${lead.instagram_handle}`
      Linking.openURL(url).catch(() => {
        Linking.openURL(`https://instagram.com/${lead.instagram_handle}`)
      })
    }
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      {/* Top bar */}
      <View
        style={{
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{ padding: 4 }}>
          <Ionicons name="chevron-back" size={28} color={colors.primary} />
        </Pressable>
        <Pressable hitSlop={12} style={{ padding: 4 }}>
          <Text style={{ ...t.body, color: colors.primary }}>Modifier</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Hero — gradient bg + avatar XL + nom + 2 chips status/source */}
        <LinearGradient
          colors={[statusColor + '22', 'transparent']}
          style={{ alignItems: 'center', paddingTop: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md }}
        >
          <Avatar name={fullName} size={104} />
          <Text style={{ ...t.title1, color: colors.textPrimary, textAlign: 'center', letterSpacing: -0.5 }}>
            {fullName}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' }}>
            <Chip label={statusLabel} color={statusColor} />
            <Chip label={sourceLabel} color={sourceColor} />
          </View>
        </LinearGradient>

        {/* Quick actions ronds */}
        <View
          style={{
            flexDirection: 'row',
            paddingHorizontal: spacing.xxl,
            paddingBottom: spacing.xl,
            gap: spacing.lg,
          }}
        >
          <ContactAction icon="call" label="Appeler" onPress={callPhone} disabled={!lead.phone} />
          <ContactAction
            icon="logo-instagram"
            label="DM"
            onPress={openInstagram}
            disabled={!lead.instagram_handle}
            tint={colors.pink}
          />
          <ContactAction icon="mail" label="Email" onPress={sendEmail} disabled={!lead.email} tint={colors.purple} />
          <ContactAction
            icon="calendar"
            label="Planifier"
            onPress={() => scheduleSheet.open({ lead })}
            tint={colors.warning}
          />
        </View>

        {/* CTA principal */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.xl }}>
          <Button
            label={ctaLabel(lead.status)}
            fullWidth
            size="lg"
            onPress={() => scheduleSheet.open({ lead })}
          />
        </View>

        {/* Deal featured (si deal exists) — gradient card avec amount XL */}
        {lead.deal_amount ? (
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.xl }}>
            <LinearGradient
              colors={[colors.primary + '40', colors.primary + '15', '#1c1c1e']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1.2 }}
              style={{
                borderRadius: 22,
                borderWidth: 1,
                borderColor: colors.primary + '50',
                padding: 20,
              }}
            >
              <Text
                style={{
                  ...t.footnote,
                  color: colors.primary,
                  fontWeight: '800',
                  textTransform: 'uppercase',
                  letterSpacing: 1.2,
                }}
              >
                Deal
              </Text>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: 40,
                  fontWeight: '800',
                  letterSpacing: -1,
                  marginTop: 4,
                }}
              >
                {formatAmount(lead.deal_amount)}
              </Text>
              {lead.deal_installments > 1 ? (
                <Text style={{ ...t.subheadline, color: colors.textSecondary, marginTop: 4 }}>
                  {lead.deal_installments} mensualités
                </Text>
              ) : (
                <Text style={{ ...t.subheadline, color: colors.textSecondary, marginTop: 4 }}>
                  Comptant
                </Text>
              )}
            </LinearGradient>
          </View>
        ) : null}

        {/* Section CONTACT — chips */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.xl, gap: 10 }}>
          <Text
            style={{
              ...t.footnote,
              color: colors.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginLeft: 8,
              marginBottom: 4,
            }}
          >
            Contact
          </Text>
          {lead.phone ? (
            <InfoChip
              icon="call"
              label="Téléphone"
              value={lead.phone}
              tint={colors.primary}
              onPress={callPhone}
            />
          ) : null}
          {lead.email ? (
            <InfoChip
              icon="mail"
              label="Email"
              value={lead.email}
              tint={colors.purple}
              onPress={sendEmail}
            />
          ) : null}
          {lead.instagram_handle ? (
            <InfoChip
              icon="logo-instagram"
              label="Instagram"
              value={`@${lead.instagram_handle}`}
              tint={colors.pink}
              onPress={openInstagram}
            />
          ) : null}
        </View>

        {/* Section PIPELINE — chips inline */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.xl, gap: 10 }}>
          <Text
            style={{
              ...t.footnote,
              color: colors.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginLeft: 8,
              marginBottom: 4,
            }}
          >
            Pipeline
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip label={statusLabel} color={statusColor} />
            <Chip label={sourceLabel} color={sourceColor} />
            <Chip
              label={`${lead.call_attempts} tentative${lead.call_attempts > 1 ? 's' : ''}`}
              color={colors.cyan}
              icon="call-outline"
            />
            {lead.reached ? (
              <Chip label="Joint" color={colors.primary} icon="checkmark-circle" />
            ) : null}
          </View>
        </View>

        {/* Section TAGS */}
        {lead.tags && lead.tags.length > 0 ? (
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.xl, gap: 10 }}>
            <Text
              style={{
                ...t.footnote,
                color: colors.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginLeft: 8,
                marginBottom: 4,
              }}
            >
              Tags
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {lead.tags.map((tag) => (
                <Chip key={tag} label={tag} color={colors.textSecondary} />
              ))}
            </View>
          </View>
        ) : null}

        {/* Section NOTES */}
        {lead.notes ? (
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.xl }}>
            <Text
              style={{
                ...t.footnote,
                color: colors.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginLeft: 8,
                marginBottom: 8,
              }}
            >
              Notes
            </Text>
            <View
              style={{
                backgroundColor: '#1c1c1e',
                borderRadius: 18,
                padding: spacing.lg,
              }}
            >
              <Text style={{ ...t.body, color: colors.textPrimary, lineHeight: 22 }}>
                {lead.notes}
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}
