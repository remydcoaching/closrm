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
import { Avatar, Button, Card, NavIcon } from '../../components/ui'
import { colors } from '../../theme/colors'
import { api } from '../../services/api'

type R = RouteProp<CallsStackParamList, 'CallDetail'>

const formatDateLong = (iso: string) => {
  const d = new Date(iso)
  return `${d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
}

const minutesUntil = (iso: string): number => Math.round((new Date(iso).getTime() - Date.now()) / 60000)

// Templates d'objectifs statiques (pas d'IA en V1, cf spec).
const objectivesByType = (type: string): string[] => {
  if (type === 'closing') {
    return [
      'Closer le deal',
      'Répondre aux objections',
      'Valider le mode de paiement',
    ]
  }
  return [
    'Qualifier le lead',
    "Présenter l'offre",
    'Planifier le closing',
  ]
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

  // Auto-save notes 1.2s après dernière frappe.
  useEffect(() => {
    if (!call) return
    if (notes === (call.notes ?? '')) return
    const t = setTimeout(async () => {
      setSavingNotes(true)
      try {
        await api.patch(`/api/calls/${call.id}`, { notes })
      } catch {
        // erreur silencieuse — le user retentera (toast à brancher plus tard)
      } finally {
        setSavingNotes(false)
      }
    }, 1200)
    return () => clearTimeout(t)
  }, [notes, call])

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    )
  }

  if (!call) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.textSecondary }}>Call introuvable.</Text>
        <View style={{ height: 12 }} />
        <Button label="Retour" variant="outline" onPress={() => navigation.goBack()} />
      </SafeAreaView>
    )
  }

  const lead = call.lead
  const fullName = lead ? `${lead.first_name} ${lead.last_name}`.trim() || '—' : '—'
  const liveMin = minutesUntil(call.scheduled_at)
  const isUpcoming = liveMin >= 0 && liveMin <= 60
  const typeLabel = call.type === 'closing' ? 'CLOSING' : 'SETTING'
  const typeColor = call.type === 'closing' ? colors.purple : colors.info

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <View
        style={{
          paddingHorizontal: 12,
          paddingBottom: 8,
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}
      >
        <NavIcon onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </NavIcon>
        <NavIcon>
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.textPrimary} />
        </NavIcon>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, gap: 16 }}>
        {/* Hero countdown */}
        <View style={{ alignItems: 'center', gap: 10 }}>
          {isUpcoming ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: colors.primary + '22',
                paddingVertical: 4,
                paddingHorizontal: 10,
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
              <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>
                {typeLabel} · DANS {liveMin} MIN
              </Text>
            </View>
          ) : (
            <Text style={{ color: typeColor, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>
              {typeLabel}
            </Text>
          )}
          <Avatar name={fullName} size={72} />
          <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700' }}>
            {fullName}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
            {formatDateLong(call.scheduled_at)}
            {call.duration_seconds ? ` · ${Math.round(call.duration_seconds / 60)} min` : ''}
          </Text>
        </View>

        {/* CTA principaux : Zoom + Phone */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 3 }}>
            <Button
              label="Rejoindre Zoom"
              size="lg"
              fullWidth
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

        {/* Contexte clé */}
        <Card borderColor={colors.primary} borderPosition="left">
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 0.5,
              marginBottom: 6,
            }}
          >
            CONTEXTE
          </Text>
          {lead ? (
            <View style={{ gap: 4 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 13 }}>
                · Statut : {lead.status}
              </Text>
              {lead.deal_amount ? (
                <Text style={{ color: colors.textPrimary, fontSize: 13 }}>
                  · Deal : {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(lead.deal_amount)}
                </Text>
              ) : null}
              <Text style={{ color: colors.textPrimary, fontSize: 13 }}>
                · Tentatives : {call.attempt_number}
              </Text>
            </View>
          ) : (
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Pas de lead associé.</Text>
          )}
        </Card>

        {/* Objectifs */}
        <Card borderColor={colors.purple} borderPosition="left">
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 0.5,
              marginBottom: 6,
            }}
          >
            OBJECTIF
          </Text>
          {objectivesByType(call.type).map((o) => (
            <Text key={o} style={{ color: colors.textPrimary, fontSize: 13, marginVertical: 1 }}>
              · {o}
            </Text>
          ))}
        </Card>

        {/* Notes pré-call */}
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 0.5,
              }}
            >
              NOTES PRÉ-CALL
            </Text>
            {savingNotes ? (
              <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Sauvegarde…</Text>
            ) : null}
          </View>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Tape tes notes ici…"
            placeholderTextColor={colors.textSecondary}
            style={{
              backgroundColor: colors.bgElevated,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              borderStyle: 'dashed',
              padding: 12,
              minHeight: 100,
              color: colors.textPrimary,
              fontSize: 14,
              textAlignVertical: 'top',
            }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
