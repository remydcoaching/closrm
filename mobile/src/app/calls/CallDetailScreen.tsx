import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import type { CallsStackParamList } from '../../navigation/types'
import { useCall } from '../../hooks/useCall'
import { Avatar, Button, ListSection, ListRow } from '../../components/ui'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'
import { api } from '../../services/api'

type R = RouteProp<CallsStackParamList, 'CallDetail'>

const formatDateLong = (iso: string) => {
  const d = new Date(iso)
  return `${d.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })} · ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
}

const minutesUntil = (iso: string): number =>
  Math.round((new Date(iso).getTime() - Date.now()) / 60000)

const objectivesByType = (type: string): string[] => {
  if (type === 'closing') {
    return [
      'Closer le deal',
      'Répondre aux objections',
      'Valider le mode de paiement',
    ]
  }
  return ['Qualifier le lead', "Présenter l'offre", 'Planifier le closing']
}

export function CallDetailScreen() {
  const route = useRoute<R>()
  const navigation = useNavigation()
  const { call, loading } = useCall(route.params.callId)

  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  useEffect(() => {
    if (call) setNotes(call.notes ?? '')
  }, [call])

  useEffect(() => {
    if (!call) return
    if (notes === (call.notes ?? '')) return
    const t = setTimeout(async () => {
      setSavingNotes(true)
      try {
        await api.patch(`/api/calls/${call.id}`, { notes })
      } catch {
        /* swallow V1 */
      } finally {
        setSavingNotes(false)
      }
    }, 1200)
    return () => clearTimeout(t)
  }, [notes, call])

  if (loading) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.bgPrimary, justifyContent: 'center' }}
      >
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    )
  }

  if (!call) {
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
        <Text style={{ ...t.subheadline, color: colors.textSecondary }}>Call introuvable.</Text>
        <Button label="Retour" variant="outline" onPress={() => navigation.goBack()} />
      </SafeAreaView>
    )
  }

  const lead = call.lead
  const fullName = lead ? `${lead.first_name} ${lead.last_name}`.trim() || '—' : '—'
  const liveMin = minutesUntil(call.scheduled_at)
  const isUpcoming = liveMin >= 0 && liveMin <= 60
  const typeLabel = call.type === 'closing' ? 'Closing' : 'Setting'
  const typeColor = call.type === 'closing' ? colors.purple : colors.info

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <View
        style={{
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          flexDirection: 'row',
          justifyContent: 'space-between',
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
        {/* Hero countdown */}
        <View style={{ alignItems: 'center', paddingTop: spacing.md, gap: spacing.md }}>
          {isUpcoming ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: colors.primary + '26',
                paddingVertical: 5,
                paddingHorizontal: 12,
                borderRadius: 999,
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
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                }}
              >
                {typeLabel} · DANS {liveMin} MIN
              </Text>
            </View>
          ) : (
            <Text
              style={{
                ...t.caption2,
                color: typeColor,
                fontWeight: '700',
                letterSpacing: 0.6,
                textTransform: 'uppercase',
              }}
            >
              {typeLabel}
            </Text>
          )}
          <Avatar name={fullName} size={88} />
          <Text
            style={{ ...t.title1, color: colors.textPrimary, textAlign: 'center' }}
          >
            {fullName}
          </Text>
          <Text style={{ ...t.subheadline, color: colors.textSecondary }}>
            {formatDateLong(call.scheduled_at)}
            {call.duration_seconds ? ` · ${Math.round(call.duration_seconds / 60)} min` : ''}
          </Text>
        </View>

        {/* CTAs */}
        <View
          style={{
            flexDirection: 'row',
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.xl,
            gap: spacing.md,
          }}
        >
          <View style={{ flex: 3 }}>
            <Button
              label="Rejoindre Zoom"
              size="lg"
              fullWidth
              iconLeft={<Ionicons name="videocam" size={18} color="#fff" />}
              onPress={() => Linking.openURL('https://zoom.us')}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label=""
              size="lg"
              fullWidth
              variant="outline"
              iconLeft={<Ionicons name="call" size={18} color={colors.textPrimary} />}
            />
          </View>
        </View>

        {/* Contexte */}
        {lead ? (
          <View style={{ marginBottom: spacing.xxl }}>
            <ListSection header="Contexte">
              <ListRow
                title="Statut"
                trailing={
                  <Text style={{ ...t.body, color: colors.textSecondary }}>
                    {lead.status.replace(/_/g, ' ')}
                  </Text>
                }
                showChevron={false}
              />
              {lead.deal_amount ? (
                <ListRow
                  title="Deal"
                  trailing={
                    <Text style={{ ...t.bodyEmphasis, color: colors.primary }}>
                      {new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: 'EUR',
                        maximumFractionDigits: 0,
                      }).format(lead.deal_amount)}
                    </Text>
                  }
                  showChevron={false}
                />
              ) : null}
              <ListRow
                title="Tentatives"
                trailing={
                  <Text style={{ ...t.body, color: colors.textSecondary }}>
                    {call.attempt_number}
                  </Text>
                }
                showChevron={false}
                separator={false}
              />
            </ListSection>
          </View>
        ) : null}

        {/* Objectif */}
        <View style={{ marginBottom: spacing.xxl }}>
          <ListSection header="Objectif du call">
            {objectivesByType(call.type).map((o, i, arr) => (
              <ListRow
                key={o}
                leading={
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: typeColor + '22',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="checkmark" size={14} color={typeColor} />
                  </View>
                }
                title={o}
                showChevron={false}
                separator={i < arr.length - 1}
                separatorInset={52}
              />
            ))}
          </ListSection>
        </View>

        {/* Notes */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.xxl }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <Text
              style={{
                ...t.footnote,
                color: colors.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
              }}
            >
              Notes pré-call
            </Text>
            {savingNotes ? (
              <Text style={{ ...t.caption2, color: colors.textSecondary }}>Sauvegarde…</Text>
            ) : null}
          </View>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Tape tes notes ici…"
            placeholderTextColor={colors.textSecondary}
            style={{
              ...t.body,
              backgroundColor: colors.bgSecondary,
              borderRadius: radius.lg,
              padding: spacing.md,
              minHeight: 120,
              color: colors.textPrimary,
              textAlignVertical: 'top',
            }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
