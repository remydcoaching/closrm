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
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import type { LeadsStackParamList } from '../../navigation/types'
import { useLead } from '../../hooks/useLead'
import {
  Avatar,
  StatusBadge,
  SourceBadge,
  Button,
  ListSection,
  ListRow,
} from '../../components/ui'
import { useScheduleSheet } from '../../components/schedule/ScheduleSheetProvider'
import { colors } from '../../theme/colors'
import { type as t, spacing } from '../../theme/tokens'

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

/** Action ronde style Apple Contacts (Call/Message/Mail/Video). */
function ContactAction({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress?: () => void
  disabled?: boolean
}) {
  return (
    <View style={{ alignItems: 'center', gap: 6, flex: 1 }}>
      <Pressable
        onPress={disabled ? undefined : onPress}
        style={({ pressed }) => ({
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.bgSecondary,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        })}
      >
        <Ionicons name={icon} size={22} color={colors.primary} />
      </Pressable>
      <Text style={{ ...t.caption1, color: colors.primary }}>{label}</Text>
    </View>
  )
}

const formatAmount = (n: number | null): string =>
  n == null
    ? '—'
    : new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }).format(n)

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
      {/* Top bar — minimaliste style Apple Contacts */}
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
        {/* Hero — avatar XL + nom + badges */}
        <View style={{ alignItems: 'center', paddingTop: spacing.md, gap: spacing.md }}>
          <Avatar name={fullName} size={100} />
          <Text style={{ ...t.title1, color: colors.textPrimary, textAlign: 'center' }}>
            {fullName}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' }}>
            <StatusBadge status={lead.status} size="md" />
            <SourceBadge source={lead.source} size="md" />
          </View>
        </View>

        {/* Quick actions — 4 boutons ronds style Apple Contacts */}
        <View
          style={{
            flexDirection: 'row',
            paddingHorizontal: spacing.xxl,
            paddingVertical: spacing.xl,
            gap: spacing.lg,
          }}
        >
          <ContactAction
            icon="call"
            label="Appeler"
            onPress={callPhone}
            disabled={!lead.phone}
          />
          <ContactAction
            icon="logo-instagram"
            label="DM"
            onPress={openInstagram}
            disabled={!lead.instagram_handle}
          />
          <ContactAction
            icon="mail"
            label="Email"
            onPress={sendEmail}
            disabled={!lead.email}
          />
          <ContactAction
            icon="calendar"
            label="Planifier"
            onPress={() => scheduleSheet.open({ lead })}
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

        {/* Section Deal — visible si deal */}
        {lead.deal_amount ? (
          <View style={{ marginBottom: spacing.xxl }}>
            <ListSection header="Deal">
              <ListRow
                title="Montant"
                trailing={
                  <Text style={{ ...t.bodyEmphasis, color: colors.primary }}>
                    {formatAmount(lead.deal_amount)}
                  </Text>
                }
                showChevron={false}
                separator={lead.deal_installments > 1}
              />
              {lead.deal_installments > 1 ? (
                <ListRow
                  title="Mensualités"
                  trailing={
                    <Text style={{ ...t.body, color: colors.textSecondary }}>
                      ×{lead.deal_installments}
                    </Text>
                  }
                  showChevron={false}
                  separator={false}
                />
              ) : null}
            </ListSection>
          </View>
        ) : null}

        {/* Section Contact */}
        <View style={{ marginBottom: spacing.xxl }}>
          <ListSection header="Contact">
            {lead.phone ? (
              <ListRow
                leading={<DotIcon name="call" />}
                title={lead.phone}
                subtitle="téléphone"
                onPress={callPhone}
                separator={!!lead.email || !!lead.instagram_handle}
              />
            ) : null}
            {lead.email ? (
              <ListRow
                leading={<DotIcon name="mail" />}
                title={lead.email}
                subtitle="email"
                onPress={sendEmail}
                separator={!!lead.instagram_handle}
              />
            ) : null}
            {lead.instagram_handle ? (
              <ListRow
                leading={<DotIcon name="logo-instagram" tint={colors.pink} />}
                title={`@${lead.instagram_handle}`}
                subtitle="instagram"
                onPress={openInstagram}
                separator={false}
              />
            ) : null}
          </ListSection>
        </View>

        {/* Section Pipeline */}
        <View style={{ marginBottom: spacing.xxl }}>
          <ListSection header="Pipeline">
            <ListRow
              title="Statut"
              trailing={<StatusBadge status={lead.status} size="sm" />}
              showChevron={false}
            />
            <ListRow
              title="Source"
              trailing={<SourceBadge source={lead.source} size="sm" />}
              showChevron={false}
            />
            <ListRow
              title="Tentatives"
              trailing={
                <Text style={{ ...t.body, color: colors.textSecondary }}>
                  {lead.call_attempts} {lead.reached ? '· joint' : ''}
                </Text>
              }
              showChevron={false}
              separator={false}
            />
          </ListSection>
        </View>

        {/* Section Tags */}
        {lead.tags && lead.tags.length > 0 ? (
          <View style={{ marginBottom: spacing.xxl, paddingHorizontal: spacing.lg }}>
            <Text
              style={{
                ...t.footnote,
                color: colors.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
                marginBottom: spacing.sm,
              }}
            >
              Tags
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {lead.tags.map((tag) => (
                <View
                  key={tag}
                  style={{
                    paddingVertical: 5,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    backgroundColor: colors.bgSecondary,
                  }}
                >
                  <Text style={{ ...t.subheadline, color: colors.textPrimary }}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Notes */}
        {lead.notes ? (
          <View style={{ marginBottom: spacing.xxl }}>
            <ListSection header="Notes">
              <View style={{ padding: spacing.lg }}>
                <Text style={{ ...t.body, color: colors.textPrimary }}>{lead.notes}</Text>
              </View>
            </ListSection>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

/** Petit cercle 32pt avec icône colorée — leading des ListRow contact. */
function DotIcon({
  name,
  tint = colors.primary,
}: {
  name: keyof typeof Ionicons.glyphMap
  tint?: string
}) {
  return (
    <View
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: tint + '22',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={name} size={16} color={tint} />
    </View>
  )
}
