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
import { Avatar, StatusBadge, SourceBadge, Button, Card, Divider } from '../../components/ui'
import { colors } from '../../theme/colors'

type R = RouteProp<LeadsStackParamList, 'LeadDetail'>

const ctaLabel = (status: string): string => {
  switch (status) {
    case 'closing_planifie':
      return 'Rejoindre le closing'
    case 'setting_planifie':
      return 'Rejoindre le setting'
    case 'no_show_setting':
    case 'no_show_closing':
      return 'Reprogrammer le call'
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

function QuickAction({
  icon,
  label,
  onPress,
  color = colors.primary,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress?: () => void
  color?: string
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: colors.bgElevated,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 14,
        alignItems: 'center',
        gap: 6,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={22} color={color} />
      <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  )
}

function InfoRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string | null
  onPress?: () => void
}) {
  if (!value) return null
  const Wrapper = onPress ? Pressable : View
  return (
    <Wrapper
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
      }}
    >
      <Ionicons name={icon} size={16} color={colors.textSecondary} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{label}</Text>
        <Text style={{ color: colors.textPrimary, fontSize: 14 }}>{value}</Text>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} /> : null}
    </Wrapper>
  )
}

const formatAmount = (amount: number | null): string =>
  amount == null
    ? '—'
    : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount)

export function LeadDetailScreen() {
  const route = useRoute<R>()
  const navigation = useNavigation()
  const { lead, loading } = useLead(route.params.leadId)

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    )
  }

  if (!lead) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: colors.textSecondary }}>Lead introuvable.</Text>
        <View style={{ height: 12 }} />
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
      // Tente le scheme natif iOS, fallback web.
      const url = Platform.OS === 'ios'
        ? `instagram://user?username=${lead.instagram_handle}`
        : `https://instagram.com/${lead.instagram_handle}`
      Linking.openURL(url).catch(() => {
        Linking.openURL(`https://instagram.com/${lead.instagram_handle}`)
      })
    }
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      {/* Top bar : retour + menu */}
      <View
        style={{
          paddingHorizontal: 12,
          paddingBottom: 8,
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => ({
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.bgSecondary,
            borderWidth: 1,
            borderColor: colors.border,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <Pressable
          style={({ pressed }) => ({
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.bgSecondary,
            borderWidth: 1,
            borderColor: colors.border,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.textPrimary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, gap: 16 }}>
        {/* Hero */}
        <View style={{ alignItems: 'center', gap: 10 }}>
          <Avatar name={fullName} size={76} />
          <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700' }}>
            {fullName}
          </Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <StatusBadge status={lead.status} size="md" />
            <SourceBadge source={lead.source} size="md" />
          </View>
        </View>

        {/* KPI grid */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Card style={{ flex: 1, alignItems: 'center', padding: 12 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600' }}>DEAL</Text>
            <Text style={{ color: colors.primary, fontSize: 18, fontWeight: '700', marginTop: 4 }}>
              {formatAmount(lead.deal_amount)}
            </Text>
            {lead.deal_installments > 1 ? (
              <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                x{lead.deal_installments}
              </Text>
            ) : null}
          </Card>
          <Card style={{ flex: 1, alignItems: 'center', padding: 12 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600' }}>
              TENTATIVES
            </Text>
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 4 }}>
              {lead.call_attempts}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
              {lead.reached ? 'jointe' : 'pas jointe'}
            </Text>
          </Card>
          <Card style={{ flex: 1, alignItems: 'center', padding: 12 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600' }}>SCORE</Text>
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 4 }}>
              —
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 11 }}>à venir</Text>
          </Card>
        </View>

        {/* CTA principal */}
        <Button
          label={ctaLabel(lead.status)}
          fullWidth
          size="lg"
          onPress={() => {
            // TODO: Schedule sheet ou navigate vers Call
          }}
        />

        {/* Quick actions */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <QuickAction icon="call-outline" label="Appeler" onPress={callPhone} color={colors.info} />
          <QuickAction
            icon="logo-instagram"
            label="DM Insta"
            onPress={openInstagram}
            color={colors.pink}
          />
          <QuickAction icon="mail-outline" label="Email" onPress={sendEmail} color={colors.purple} />
          <QuickAction
            icon="calendar-outline"
            label="Reprogrammer"
            color={colors.warning}
          />
        </View>

        {/* Infos */}
        <Card>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 0.5,
              marginBottom: 4,
            }}
          >
            INFOS
          </Text>
          <InfoRow icon="call-outline" label="Téléphone" value={lead.phone || null} onPress={callPhone} />
          <Divider />
          <InfoRow icon="mail-outline" label="Email" value={lead.email} onPress={sendEmail} />
          <Divider />
          <InfoRow
            icon="logo-instagram"
            label="Instagram"
            value={lead.instagram_handle ? `@${lead.instagram_handle}` : null}
            onPress={openInstagram}
          />
        </Card>

        {/* Tags */}
        {lead.tags && lead.tags.length > 0 ? (
          <Card>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 0.5,
                marginBottom: 8,
              }}
            >
              TAGS
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {lead.tags.map((t) => (
                <View
                  key={t}
                  style={{
                    paddingVertical: 4,
                    paddingHorizontal: 10,
                    borderRadius: 999,
                    backgroundColor: colors.bgSecondary,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ color: colors.textPrimary, fontSize: 12 }}>{t}</Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        {/* Notes */}
        {lead.notes ? (
          <Card>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 0.5,
                marginBottom: 8,
              }}
            >
              NOTES
            </Text>
            <Text style={{ color: colors.textPrimary, fontSize: 14, lineHeight: 20 }}>
              {lead.notes}
            </Text>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}
