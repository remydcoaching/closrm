import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, Pressable, TextInput, Linking, Platform, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as Clipboard from 'expo-clipboard'
import type { FollowUpsStackParamList } from '../../navigation/types'
import { useDmSession, type DmSessionItem, type DmSessionItemOutcome } from '../../hooks/useDmSession'
import { useDelaySheet } from '../../components/dm-session/DelaySheetProvider'
import LeadJourneyBlock from '../../components/leads/LeadJourneyBlock'
import { NavLarge, Avatar } from '../../components/ui'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'

type Nav = NativeStackNavigationProp<FollowUpsStackParamList, 'DmSessionLead'>
type R = RouteProp<FollowUpsStackParamList, 'DmSessionLead'>

const CATEGORY_LABEL: Record<string, string> = {
  relance_en_retard: 'Relance en retard',
  engagement_instagram: 'Engagement Instagram récent',
  jamais_recontacte: 'Ancien lead',
  premier_message: 'Jamais contacté',
}

function openInstagram(handle: string | null) {
  if (!handle) return
  const url = Platform.OS === 'ios' ? `instagram://user?username=${handle}` : `https://instagram.com/${handle}`
  Linking.openURL(url).catch(() => {
    Linking.openURL(`https://instagram.com/${handle}`)
  })
}

function LeadScreenBody({
  item,
  sessionId,
  position,
  total,
  doneCount,
  submitOutcome,
}: {
  item: DmSessionItem
  sessionId: string
  position: number
  total: number
  doneCount: number
  submitOutcome: ReturnType<typeof useDmSession>['submitOutcome']
}) {
  const delaySheet = useDelaySheet()
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState(false)
  const [submitting, setSubmitting] = useState<DmSessionItemOutcome | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const lead = item.lead
  const template = item.template
  const fullName = `${lead.first_name} ${lead.last_name}`.trim() || 'Lead'

  async function handleCopy() {
    if (!template) return
    await Clipboard.setStringAsync(template.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function runSubmit(outcome: DmSessionItemOutcome, opts?: { delayDays?: number }) {
    setSubmitError(null)
    setSubmitting(outcome)
    try {
      await submitOutcome(item.id, outcome, { note: note || undefined, ...opts })
      setNote('')
    } catch {
      setSubmitError("Impossible d'enregistrer l'action. Réessaie.")
    } finally {
      setSubmitting(null)
    }
  }

  function handleRelaunched() {
    // Le sheet propose toutes les étapes de relance du process (ex: "Relance"
    // vs "Reprise après une longue absence") — celle déduite par
    // resolve-step.ts (next_step_id) est pré-sélectionnée, mais le setter
    // peut basculer manuellement sur une autre s'il juge que c'est le bon
    // moment de passer en nurturing plus tôt que prévu.
    delaySheet.open({
      leadName: fullName,
      relanceStepOptions: template?.relance_step_options ?? [],
      suggestedStepId: template?.next_step_id ?? null,
      onConfirm: (delayDays) => runSubmit('relaunched', { delayDays }),
    })
  }

  function handleTransition() {
    // Une transition nommée ("repondu" -> étape suivante) représente le
    // signal "le prospect a répondu" : ClosRM ne lit pas Instagram, c'est
    // le setter qui le déclare. Réutilise exactement la même action que le
    // bouton "Prospect a répondu" de la fiche lead (outcome 'replied') —
    // marque la conversation active et annule les relances en attente,
    // plutôt que d'avancer bêtement à l'étape suivante dans l'ordre.
    runSubmit('replied')
  }

  const hasTransitions = (template?.transitions.length ?? 0) > 0

  return (
    <>
      <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
          <Text style={{ ...t.footnote, color: colors.textSecondary, fontWeight: '600' }}>
            Profil {position} / {total}
          </Text>
          <Text style={{ ...t.footnote, color: colors.textSecondary }}>{doneCount} traités</Text>
        </View>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' }}>
          <View
            style={{
              height: '100%',
              width: `${total > 0 ? (doneCount / total) * 100 : 0}%`,
              backgroundColor: colors.primary,
            }}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.lg, paddingBottom: 220 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Avatar name={fullName} size={52} />
          <View style={{ flex: 1 }}>
            <Text style={{ ...t.title3, color: colors.textPrimary, fontWeight: '700' }}>{fullName}</Text>
            {lead.instagram_handle && (
              <Text style={{ ...t.footnote, color: colors.textSecondary }}>@{lead.instagram_handle}</Text>
            )}
            <View
              style={{
                alignSelf: 'flex-start',
                marginTop: 4,
                paddingVertical: 3,
                paddingHorizontal: 8,
                borderRadius: 20,
                backgroundColor: colors.bgSecondary,
              }}
            >
              <Text style={{ ...t.caption1, color: colors.textSecondary, fontWeight: '600' }}>
                {CATEGORY_LABEL[item.category] ?? item.category}
              </Text>
            </View>
          </View>
        </View>

        <LeadJourneyBlock leadId={lead.id} />

        {template ? (
          <View
            style={{
              backgroundColor: colors.bgSecondary,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              padding: spacing.md,
            }}
          >
            <Text
              style={{
                ...t.caption1,
                color: colors.textSecondary,
                fontWeight: '700',
                textTransform: 'uppercase',
                marginBottom: spacing.xs,
              }}
            >
              {template.label}
            </Text>
            <Text style={{ ...t.subheadline, color: colors.textPrimary, lineHeight: 22 }}>{template.text}</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <Pressable
                onPress={handleCopy}
                style={{
                  flex: 1,
                  backgroundColor: copied ? '#38A16922' : colors.bgPrimary,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: copied ? '#38A169' : colors.border,
                  paddingVertical: spacing.sm,
                  alignItems: 'center',
                }}
              >
                <Text style={{ ...t.footnote, color: copied ? '#38A169' : colors.textPrimary, fontWeight: '700' }}>
                  {copied ? '✓ Copié' : 'Copier'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => openInstagram(lead.instagram_handle)}
                disabled={!lead.instagram_handle}
                style={{
                  flex: 1,
                  backgroundColor: colors.bgPrimary,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingVertical: spacing.sm,
                  alignItems: 'center',
                  opacity: lead.instagram_handle ? 1 : 0.4,
                }}
              >
                <Text style={{ ...t.footnote, color: colors.textPrimary, fontWeight: '700' }}>Ouvrir Instagram</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View
            style={{
              backgroundColor: colors.bgSecondary,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              padding: spacing.md,
            }}
          >
            <Text style={{ ...t.footnote, color: colors.textSecondary }}>
              Aucun message à afficher pour ce profil — process introuvable ou désactivé.
            </Text>
          </View>
        )}

        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Note (optionnel)"
          placeholderTextColor={colors.textTertiary}
          multiline
          style={{
            backgroundColor: colors.bgSecondary,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.sm,
            color: colors.textPrimary,
            minHeight: 56,
          }}
        />

        {submitError && (
          <Text style={{ ...t.footnote, color: colors.danger, textAlign: 'center' }}>{submitError}</Text>
        )}
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: spacing.lg,
          backgroundColor: colors.bgPrimary,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          gap: spacing.sm,
        }}
      >
        {hasTransitions && (
          <View style={{ gap: spacing.xs }}>
            <Text style={{ ...t.caption1, color: colors.textSecondary, fontWeight: '600' }}>
              Si le prospect a réagi :
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {template!.transitions.map((tr) => (
                <Pressable
                  key={tr.outcome_label}
                  onPress={() => handleTransition()}
                  disabled={submitting !== null}
                  style={{
                    paddingVertical: spacing.xs,
                    paddingHorizontal: spacing.md,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.bgSecondary,
                  }}
                >
                  <Text style={{ ...t.footnote, color: colors.textPrimary, fontWeight: '600' }}>
                    {tr.outcome_label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Pressable
            onPress={handleRelaunched}
            disabled={submitting !== null}
            style={{
              flex: 1,
              backgroundColor: '#38A169',
              borderRadius: radius.md,
              paddingVertical: spacing.sm,
              alignItems: 'center',
              opacity: submitting !== null ? 0.6 : 1,
            }}
          >
            {submitting === 'relaunched' ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={{ ...t.footnote, color: '#fff', fontWeight: '700' }}>Relancé</Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => runSubmit('archived')}
            disabled={submitting !== null}
            style={{
              flex: 1,
              backgroundColor: colors.bgSecondary,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              paddingVertical: spacing.sm,
              alignItems: 'center',
              opacity: submitting !== null ? 0.6 : 1,
            }}
          >
            {submitting === 'archived' ? (
              <ActivityIndicator color={colors.textPrimary} size="small" />
            ) : (
              <Text style={{ ...t.footnote, color: colors.textPrimary, fontWeight: '700' }}>À archiver</Text>
            )}
          </Pressable>
        </View>
        <Pressable
          onPress={() => runSubmit('skipped')}
          disabled={submitting !== null}
          style={{ paddingVertical: spacing.sm, alignItems: 'center' }}
        >
          <Text style={{ ...t.footnote, color: colors.textSecondary }}>Passer pour l&apos;instant</Text>
        </Pressable>
      </View>
    </>
  )
}

// Naviguer pendant le render (dans le corps de DmSessionLeadScreen) casse
// React Navigation — on isole la redirection dans un effet.
function DmSessionRedirectToComplete({ sessionId }: { sessionId: string }) {
  const navigation = useNavigation<Nav>()

  useEffect(() => {
    navigation.replace('DmSessionComplete', { sessionId })
  }, [navigation, sessionId])

  return null
}

export function DmSessionLeadScreen() {
  const navigation = useNavigation<Nav>()
  const { params } = useRoute<R>()
  const { session, currentItem, loading, error, submitOutcome, refetch, abandon } = useDmSession(params.sessionId)
  const [abandoning, setAbandoning] = useState(false)

  function confirmAbandon() {
    Alert.alert(
      'Arrêter la session ?',
      'Les profils déjà traités restent enregistrés. Les profils restants ne seront pas relancés.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Arrêter',
          style: 'destructive',
          onPress: async () => {
            setAbandoning(true)
            try {
              await abandon()
              navigation.replace('FollowUpsList')
            } catch {
              setAbandoning(false)
            }
          },
        },
      ]
    )
  }

  const stopButton = (
    <Pressable onPress={confirmAbandon} disabled={abandoning} hitSlop={8}>
      {abandoning ? (
        <ActivityIndicator color={colors.danger} size="small" />
      ) : (
        <Text style={{ ...t.subheadline, color: colors.danger, fontWeight: '600' }}>Arrêter</Text>
      )}
    </Pressable>
  )

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
        <NavLarge title="Session DM" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  if (error || !session) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
        <NavLarge title="Session DM" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md }}>
          <Text style={{ ...t.subheadline, color: colors.textPrimary, textAlign: 'center' }}>
            Impossible de charger cette session.
          </Text>
          <Pressable
            onPress={() => refetch()}
            style={{
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.lg,
              borderRadius: radius.md,
              backgroundColor: colors.primary,
            }}
          >
            <Text style={{ ...t.footnote, color: '#fff', fontWeight: '700' }}>Réessayer</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  if (!currentItem) {
    return <DmSessionRedirectToComplete sessionId={session.id} />
  }

  const doneCount = session.items.filter((i) => i.outcome !== null).length
  const position = session.items.findIndex((i) => i.id === currentItem.id) + 1

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <NavLarge title="Session DM" rightSlot={stopButton} />
      <LeadScreenBody
        key={currentItem.id}
        item={currentItem}
        sessionId={session.id}
        position={position}
        total={session.items.length}
        doneCount={doneCount}
        submitOutcome={submitOutcome}
      />
    </SafeAreaView>
  )
}
