import React, { useState, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Linking,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Alert,
  Animated,
  ActionSheetIOS,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import type { LeadsStackParamList } from '../../navigation/types'
import { useLead } from '../../hooks/useLead'
import { useLeadNotes, type LeadNote } from '../../hooks/useLeadNotes'
import { Avatar, Button } from '../../components/ui'
import { useScheduleSheet } from '../../components/schedule/ScheduleSheetProvider'
import { api } from '../../services/api'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'
import { statusConfig, sourceConfig } from '../../theme/status'
import type { LeadStatus } from '@shared/types'

const STATUS_ORDER: LeadStatus[] = [
  'nouveau',
  'scripte',
  'setting_planifie',
  'no_show_setting',
  'closing_planifie',
  'no_show_closing',
  'clos',
  'dead',
]

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

/** Chip pill — réutilisable. Bug fix : View ne supporte pas la fn style,
 *  on passe par un static style et un Pressable optional wrapper. */
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
  const chipStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: filled ? color : color + '14',
    borderWidth: 1,
    borderColor: filled ? color : color + '30',
  }
  const inner = (
    <>
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
    </>
  )
  // Note RN : un style fonction `({pressed}) => [...]` sur Pressable casse
  // parfois le flexDirection du chipStyle au premier render → la chip rend
  // verticale (icône au-dessus du label). On wrap le layout dans une View
  // interne, Pressable ne porte plus que l'opacité.
  if (onPress) {
    return (
      <Pressable onPress={onPress}>
        {({ pressed }) => (
          <View style={{ ...chipStyle, opacity: pressed ? 0.7 : 1 }}>{inner}</View>
        )}
      </Pressable>
    )
  }
  return <View style={chipStyle}>{inner}</View>
}

/** Action ronde Apple Contacts (Call/DM/Email/Planifier). */
function ContactAction({
  icon,
  label,
  onPress,
  onLongPress,
  disabled,
  tint = colors.primary,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress?: () => void
  onLongPress?: () => void
  disabled?: boolean
  tint?: string
}) {
  return (
    <View style={{ alignItems: 'center', gap: 6, flex: 1 }}>
      <Pressable
        onPress={disabled ? undefined : onPress}
        onLongPress={disabled ? undefined : onLongPress}
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
  onLongPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
  tint: string
  onPress?: () => void
  onLongPress?: () => void
}) {
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress}>
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
  const { lead, loading, refetch, mutate } = useLead(route.params.leadId)
  const leadNotes = useLeadNotes(route.params.leadId)
  const scheduleSheet = useScheduleSheet()
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [notesModalOpen, setNotesModalOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<LeadNote | null>(null)
  const [attemptsPickerOpen, setAttemptsPickerOpen] = useState(false)
  const [nameModalOpen, setNameModalOpen] = useState(false)
  const [callTrackingOpen, setCallTrackingOpen] = useState(false)

  const toastOpacity = useRef(new Animated.Value(0)).current
  const [toastMessage, setToastMessage] = useState('')
  const showCopyToast = (msg: string = 'Copié') => {
    setToastMessage(msg)
    toastOpacity.setValue(1)
    Animated.timing(toastOpacity, {
      toValue: 0,
      duration: 400,
      delay: 1800,
      useNativeDriver: true,
    }).start()
  }

  const updateName = async (firstName: string, lastName: string) => {
    if (!lead) return
    setNameModalOpen(false)
    mutate({ first_name: firstName, last_name: lastName })
    try {
      await api.patch(`/api/leads/${lead.id}`, { first_name: firstName, last_name: lastName })
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Échec mise à jour')
      void refetch()
    }
  }

  const updateCallAttempts = async (count: number) => {
    if (!lead) return
    setAttemptsPickerOpen(false)
    mutate({ call_attempts: count })
    try {
      await api.patch(`/api/leads/${lead.id}`, { call_attempts: count })
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Échec mise à jour')
      void refetch()
    }
  }

  const toggleReached = async () => {
    if (!lead) return
    const newVal = !lead.reached
    mutate({ reached: newVal })
    try {
      await api.patch(`/api/leads/${lead.id}`, { reached: newVal })
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Échec mise à jour')
      void refetch()
    }
  }

  const archiveLead = () => {
    Alert.alert('Archiver ce lead ?', 'Le lead sera marqué comme dead.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Archiver',
        style: 'destructive',
        onPress: async () => {
          if (!lead) return
          mutate({ status: 'dead' as LeadStatus })
          try {
            await api.patch(`/api/leads/${lead.id}`, { status: 'dead' })
          } catch (e) {
            Alert.alert('Erreur', e instanceof Error ? e.message : 'Échec')
            void refetch()
          }
        },
      },
    ])
  }

  const deleteLead = () => {
    Alert.alert('Supprimer ce lead ?', 'Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          if (!lead) return
          try {
            await api.delete(`/api/leads/${lead.id}`)
            navigation.goBack()
          } catch (e) {
            Alert.alert('Erreur', e instanceof Error ? e.message : 'Échec suppression')
          }
        },
      },
    ])
  }

  const updateStatus = async (newStatus: LeadStatus) => {
    if (!lead || newStatus === lead.status) {
      setStatusModalOpen(false)
      return
    }
    // Optimistic : ferme la modal + update local instantanément. L'API
    // confirme en arrière-plan (~1-2s), realtime fait un refetch propre
    // au passage. Si erreur, on revert via refetch().
    setStatusModalOpen(false)
    mutate({ status: newStatus })
    try {
      await api.patch(`/api/leads/${lead.id}`, { status: newStatus })
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Échec mise à jour')
      void refetch()
    }
  }

  const submitNote = async (content: string) => {
    setNotesModalOpen(false)
    if (editingNote) {
      const id = editingNote.id
      setEditingNote(null)
      await leadNotes.updateNote(id, content)
    } else {
      await leadNotes.addNote(content)
    }
  }

  const handleDeleteNote = (note: LeadNote) => {
    Alert.alert('Supprimer cette note ?', 'Action irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => void leadNotes.removeNote(note.id),
      },
    ])
  }

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
    if (!lead.phone) return
    Linking.openURL(`tel:${lead.phone}`).then(() => {
      setTimeout(() => setCallTrackingOpen(true), 1500)
    })
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
    <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        bounces={true}
        alwaysBounceVertical={true}
        overScrollMode="always"
        showsVerticalScrollIndicator={false}
        decelerationRate="normal"
      >
        {/* Bande colorée invisible au-dessus du hero : quand le user
            over-scroll vers le haut, il voit cette couleur au lieu du noir. */}
        <View style={{ backgroundColor: statusColor + '40', marginTop: -500, paddingTop: 500 }} />
        <LinearGradient
          colors={[statusColor + '40', statusColor + '15', 'transparent']}
          style={{
            alignItems: 'center',
            paddingTop: 110,
            paddingBottom: spacing.xl,
            gap: spacing.md,
          }}
        >
          <Avatar name={fullName} size={104} />
          <Pressable onLongPress={() => setNameModalOpen(true)}>
            <Text
              style={{
                ...t.title1,
                color: colors.textPrimary,
                textAlign: 'center',
                letterSpacing: -0.5,
              }}
            >
              {fullName}
            </Text>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' }}>
            <Chip label={statusLabel} color={statusColor} onPress={() => setStatusModalOpen(true)} icon="swap-vertical" />
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
            icon="chatbubble"
            label="Message"
            onPress={() => {
              if (!lead.phone) return
              if (Platform.OS === 'ios') {
                ActionSheetIOS.showActionSheetWithOptions(
                  {
                    options: ['SMS', 'WhatsApp', 'Annuler'],
                    cancelButtonIndex: 2,
                  },
                  (idx) => {
                    if (idx === 0) Linking.openURL(`sms:${lead.phone}`)
                    if (idx === 1) {
                      const cleaned = lead.phone!.replace(/[^0-9]/g, '')
                      Linking.openURL(`whatsapp://send?phone=${cleaned}`).catch(() =>
                        Alert.alert('WhatsApp non installé')
                      )
                    }
                  },
                )
              } else {
                Alert.alert('Envoyer un message', '', [
                  { text: 'SMS', onPress: () => Linking.openURL(`sms:${lead.phone}`) },
                  {
                    text: 'WhatsApp',
                    onPress: () => {
                      const cleaned = lead.phone!.replace(/[^0-9]/g, '')
                      Linking.openURL(`whatsapp://send?phone=${cleaned}`).catch(() =>
                        Alert.alert('WhatsApp non installé')
                      )
                    },
                  },
                  { text: 'Annuler', style: 'cancel' },
                ])
              }
            }}
            disabled={!lead.phone}
            tint={colors.cyan}
          />
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
              onLongPress={() => {
                if (lead.phone) {
                  void Clipboard.setStringAsync(lead.phone)
                  showCopyToast('Numéro copié')
                }
              }}
            />
          ) : null}
          {lead.email ? (
            <InfoChip
              icon="mail"
              label="Email"
              value={lead.email}
              tint={colors.purple}
              onPress={sendEmail}
              onLongPress={() => {
                if (lead.email) {
                  void Clipboard.setStringAsync(lead.email)
                  showCopyToast('Email copié')
                }
              }}
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

        {/* Section ACTIVITÉ — tentatives + joint, cliquables */}
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
            Activité
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip
              label={`${lead.call_attempts} tentative${lead.call_attempts > 1 ? 's' : ''}`}
              color={colors.cyan}
              icon="call-outline"
              onPress={() => setAttemptsPickerOpen(true)}
            />
            {lead.reached ? (
              <Chip label="Joint" color={colors.primary} icon="checkmark-circle" filled onPress={toggleReached} />
            ) : (
              <Chip label="Non joint" color={colors.danger} icon="close-circle" onPress={toggleReached} />
            )}
          </View>
        </View>

        {/* Section TAGS — chips colorés cyan plus présents */}
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
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {lead.tags.map((tag) => (
                <Chip key={tag} label={tag} color={colors.cyan} icon="pricetag" />
              ))}
            </View>
          </View>
        ) : null}

        {/* Section NOTES — multi-notes timeline (sync avec le widget web).
            Card "+ Ajouter une note" en haut, puis liste chronologique. */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.xl, gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text
              style={{
                ...t.footnote,
                color: colors.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginLeft: 8,
              }}
            >
              Notes {leadNotes.notes.length > 0 ? `(${leadNotes.notes.length})` : ''}
            </Text>
          </View>

          {/* CTA add note */}
          <Pressable
            onPress={() => {
              setEditingNote(null)
              setNotesModalOpen(true)
            }}
          >
            {({ pressed }) => (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  backgroundColor: colors.warning + '14',
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.warning + '30',
                  paddingHorizontal: spacing.md,
                  paddingVertical: 12,
                  opacity: pressed ? 0.7 : 1,
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: colors.warning + '33',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="add" size={18} color={colors.warning} />
                </View>
                <Text style={{ ...t.body, color: colors.warning, fontWeight: '600' }}>
                  Ajouter une note
                </Text>
              </View>
            )}
          </Pressable>

          {leadNotes.loading && leadNotes.notes.length === 0 ? (
            <View style={{ paddingVertical: spacing.md }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : leadNotes.notes.length === 0 ? (
            <Text
              style={{
                ...t.caption1,
                color: colors.textTertiary,
                fontStyle: 'italic',
                textAlign: 'center',
                paddingVertical: spacing.md,
              }}
            >
              Aucune note pour ce lead.
            </Text>
          ) : (
            // Container "post-it" jaune — toutes les notes empilées dans
            // une carte tinted warning pour un look stylo + papier.
            <View
              style={{
                backgroundColor: colors.warning + '10',
                borderRadius: 18,
                borderWidth: 1,
                borderColor: colors.warning + '30',
                overflow: 'hidden',
              }}
            >
              {leadNotes.notes.map((note, idx) => (
                <NoteRow
                  key={note.id}
                  note={note}
                  separator={idx < leadNotes.notes.length - 1}
                  onEdit={() => {
                    setEditingNote(note)
                    setNotesModalOpen(true)
                  }}
                  onDelete={() => handleDeleteNote(note)}
                />
              ))}
            </View>
          )}
        </View>

        {/* Archiver / Supprimer — discrets en bas */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.xl, gap: 12 }}>
          <Pressable onPress={archiveLead}>
            {({ pressed }) => (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingVertical: 12,
                  opacity: pressed ? 0.5 : 1,
                }}
              >
                <Ionicons name="archive-outline" size={16} color={colors.textTertiary} />
                <Text style={{ ...t.footnote, color: colors.textTertiary }}>Archiver ce lead</Text>
              </View>
            )}
          </Pressable>
          <Pressable onPress={deleteLead}>
            {({ pressed }) => (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingVertical: 12,
                  opacity: pressed ? 0.5 : 1,
                }}
              >
                <Ionicons name="trash-outline" size={16} color={colors.danger + '80'} />
                <Text style={{ ...t.footnote, color: colors.danger + '80' }}>Supprimer définitivement</Text>
              </View>
            )}
          </Pressable>
        </View>
      </ScrollView>

      {/* Toast "Copié" */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: 100,
          alignSelf: 'center',
          backgroundColor: colors.bgSecondary,
          borderRadius: 999,
          paddingHorizontal: 20,
          paddingVertical: 10,
          borderWidth: 1,
          borderColor: colors.border,
          opacity: toastOpacity,
        }}
      >
        <Text style={{ ...t.footnote, color: colors.textPrimary, fontWeight: '600' }}>
          {toastMessage}
        </Text>
      </Animated.View>

      {/* Top bar absolute par-dessus le gradient — accessibles toujours. */}
      <SafeAreaView
        edges={['top']}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
        }}
        pointerEvents="box-none"
      >
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
          <View style={{ width: 28 }} />
        </View>
      </SafeAreaView>

      <StatusEditorModal
        visible={statusModalOpen}
        currentStatus={lead.status}
        onPick={(s) => void updateStatus(s)}
        onClose={() => setStatusModalOpen(false)}
      />
      <NotesEditorModal
        visible={notesModalOpen}
        initialNotes={editingNote?.content ?? ''}
        title={editingNote ? 'Modifier la note' : 'Nouvelle note'}
        onSave={(n) => void submitNote(n)}
        onClose={() => {
          setNotesModalOpen(false)
          setEditingNote(null)
        }}
      />
      <AttemptsPickerModal
        visible={attemptsPickerOpen}
        current={lead.call_attempts}
        onPick={(n) => void updateCallAttempts(n)}
        onClose={() => setAttemptsPickerOpen(false)}
      />
      <NameEditorModal
        visible={nameModalOpen}
        firstName={lead.first_name}
        lastName={lead.last_name}
        onSave={(f, l) => void updateName(f, l)}
        onClose={() => setNameModalOpen(false)}
      />
      <CallTrackingModal
        visible={callTrackingOpen}
        leadName={fullName}
        currentAttempts={lead.call_attempts}
        currentReached={lead.reached}
        onConfirm={async (reached) => {
          setCallTrackingOpen(false)
          const newAttempts = lead.call_attempts + 1
          mutate({ call_attempts: newAttempts, reached })
          try {
            await api.patch(`/api/leads/${lead.id}`, {
              call_attempts: newAttempts,
              reached,
            })
            await leadNotes.addNote(
              `📞 Appel le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} — ${reached ? 'Joint' : 'Non joint'}`,
            )
          } catch (e) {
            Alert.alert('Erreur', e instanceof Error ? e.message : 'Échec')
            void refetch()
          }
        }}
        onDismiss={() => setCallTrackingOpen(false)}
      />
    </View>
  )
}

function StatusEditorModal({
  visible,
  currentStatus,
  onPick,
  onClose,
}: {
  visible: boolean
  currentStatus: LeadStatus
  onPick: (s: LeadStatus) => void
  onClose: () => void
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.sheet,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            paddingBottom: spacing.xxxl,
            gap: spacing.sm,
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.border,
              marginBottom: 4,
            }}
          />
          <Text style={{ ...t.title3, color: colors.textPrimary, marginBottom: 4 }}>
            Changer le statut
          </Text>
          {STATUS_ORDER.map((s) => {
            const cfg = statusConfig[s]
            const selected = s === currentStatus
            return (
              <Pressable key={s} onPress={() => onPick(s)}>
                {({ pressed }) => (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingHorizontal: spacing.md,
                      paddingVertical: 14,
                      borderRadius: radius.md,
                      backgroundColor: selected ? cfg.color + '22' : colors.bgSecondary,
                      borderWidth: 1,
                      borderColor: selected ? cfg.color : 'transparent',
                      opacity: pressed ? 0.6 : 1,
                    }}
                  >
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: cfg.color,
                      }}
                    />
                    <Text
                      style={{
                        ...t.body,
                        color: selected ? cfg.color : colors.textPrimary,
                        fontWeight: selected ? '700' : '500',
                        flex: 1,
                      }}
                    >
                      {cfg.label}
                    </Text>
                    {selected ? (
                      <Ionicons name="checkmark" size={20} color={cfg.color} />
                    ) : null}
                  </View>
                )}
              </Pressable>
            )
          })}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function AttemptsPickerModal({
  visible,
  current,
  onPick,
  onClose,
}: {
  visible: boolean
  current: number
  onPick: (n: number) => void
  onClose: () => void
}) {
  const options = [0, 1, 2, 3, 4, 5]
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.sheet,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            paddingBottom: spacing.xxxl,
            gap: spacing.sm,
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.border,
              marginBottom: 4,
            }}
          />
          <Text style={{ ...t.title3, color: colors.textPrimary, marginBottom: 4 }}>
            Tentatives d'appel
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'space-between' }}>
            {options.map((n) => {
              const selected = n === current
              return (
                <Pressable key={n} onPress={() => onPick(n)} style={{ flex: 1 }}>
                  {({ pressed }) => (
                    <View
                      style={{
                        height: 52,
                        borderRadius: 16,
                        backgroundColor: selected ? colors.cyan : colors.bgSecondary,
                        borderWidth: 1,
                        borderColor: selected ? colors.cyan : colors.border,
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: pressed ? 0.6 : 1,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 20,
                          fontWeight: '700',
                          color: selected ? '#000' : colors.textPrimary,
                        }}
                      >
                        {n}
                      </Text>
                    </View>
                  )}
                </Pressable>
              )
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function NameEditorModal({
  visible,
  firstName,
  lastName,
  onSave,
  onClose,
}: {
  visible: boolean
  firstName: string
  lastName: string
  onSave: (first: string, last: string) => void
  onClose: () => void
}) {
  const [first, setFirst] = useState(firstName)
  const [last, setLast] = useState(lastName)

  React.useEffect(() => {
    if (visible) {
      setFirst(firstName)
      setLast(lastName)
    }
  }, [visible, firstName, lastName])

  const dirty = first !== firstName || last !== lastName

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}
      >
        <Pressable onPress={onClose} style={{ flex: 1 }} />
        <View
          style={{
            backgroundColor: colors.sheet,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            paddingBottom: spacing.xxxl,
            gap: spacing.md,
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.border,
            }}
          />
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Pressable onPress={onClose}>
              <Text style={{ ...t.body, color: colors.textSecondary }}>Annuler</Text>
            </Pressable>
            <Text style={{ ...t.bodyEmphasis, color: colors.textPrimary }}>Modifier le nom</Text>
            <Pressable onPress={() => onSave(first.trim(), last.trim())} disabled={!dirty}>
              <Text
                style={{
                  ...t.body,
                  color: dirty ? colors.primary : colors.textTertiary,
                  fontWeight: '700',
                }}
              >
                Enregistrer
              </Text>
            </Pressable>
          </View>
          <View style={{ gap: 16 }}>
            <View style={{ gap: 6 }}>
              <Text style={{ ...t.caption1, color: colors.textSecondary, fontWeight: '600', marginLeft: 4 }}>Prénom</Text>
              <TextInput
                value={first}
                onChangeText={setFirst}
                placeholder="Prénom"
                placeholderTextColor={colors.textTertiary}
                autoFocus
                style={{
                  backgroundColor: colors.bgSecondary,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  color: colors.textPrimary,
                  fontSize: 16,
                }}
              />
            </View>
            <View style={{ gap: 6 }}>
              <Text style={{ ...t.caption1, color: colors.textSecondary, fontWeight: '600', marginLeft: 4 }}>Nom</Text>
              <TextInput
                value={last}
                onChangeText={setLast}
                placeholder="Nom"
                placeholderTextColor={colors.textTertiary}
                style={{
                  backgroundColor: colors.bgSecondary,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  color: colors.textPrimary,
                  fontSize: 16,
                }}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

function NotesEditorModal({
  visible,
  initialNotes,
  title = 'Note du lead',
  onSave,
  onClose,
}: {
  visible: boolean
  initialNotes: string
  title?: string
  onSave: (n: string) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(initialNotes)

  React.useEffect(() => {
    if (visible) setDraft(initialNotes)
  }, [visible, initialNotes])

  const dirty = draft !== initialNotes

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}
      >
        <Pressable onPress={onClose} style={{ flex: 1 }} />
        <View
          style={{
            backgroundColor: colors.sheet,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            paddingBottom: spacing.xxxl,
            gap: spacing.md,
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.border,
            }}
          />
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Pressable onPress={onClose}>
              <Text style={{ ...t.body, color: colors.textSecondary }}>Annuler</Text>
            </Pressable>
            <Text style={{ ...t.bodyEmphasis, color: colors.textPrimary }}>{title}</Text>
            <Pressable onPress={() => onSave(draft)} disabled={!dirty}>
              <Text
                style={{
                  ...t.body,
                  color: dirty ? colors.primary : colors.textTertiary,
                  fontWeight: '700',
                }}
              >
                Enregistrer
              </Text>
            </Pressable>
          </View>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Tape ce que tu veux retenir sur ce lead…"
            placeholderTextColor={colors.textTertiary}
            multiline
            autoFocus
            textAlignVertical="top"
            style={{
              minHeight: 180,
              maxHeight: 360,
              backgroundColor: colors.bgSecondary,
              borderRadius: radius.md,
              padding: spacing.md,
              color: colors.textPrimary,
              fontSize: 15,
              lineHeight: 22,
            }}
          />
          <Text style={{ ...t.caption2, color: colors.textTertiary, textAlign: 'right' }}>
            {draft.length}/2000
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

function CallTrackingModal({
  visible,
  leadName,
  currentAttempts,
  currentReached,
  onConfirm,
  onDismiss,
}: {
  visible: boolean
  leadName: string
  currentAttempts: number
  currentReached: boolean
  onConfirm: (reached: boolean) => void
  onDismiss: () => void
}) {
  const [step, setStep] = useState<'ask' | 'reached'>('ask')

  React.useEffect(() => {
    if (visible) setStep('ask')
  }, [visible])

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.65)',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: spacing.xl,
        }}
      >
        <View
          style={{
            backgroundColor: colors.sheet,
            borderRadius: 24,
            padding: spacing.xl,
            width: '100%',
            maxWidth: 340,
            gap: spacing.lg,
          }}
        >
          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: colors.primary + '22',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="call" size={26} color={colors.primary} />
            </View>
            <Text style={{ ...t.title3, color: colors.textPrimary, textAlign: 'center' }}>
              {step === 'ask' ? 'Enregistrer l\'appel ?' : 'As-tu joint le lead ?'}
            </Text>
            <Text style={{ ...t.subheadline, color: colors.textSecondary, textAlign: 'center' }}>
              {step === 'ask'
                ? `Appel vers ${leadName} — tentative n°${currentAttempts + 1}`
                : `Cet appel sera logué dans l'activité de ${leadName}.`}
            </Text>
          </View>

          {step === 'ask' ? (
            <View style={{ gap: 10 }}>
              <Pressable onPress={() => setStep('reached')}>
                {({ pressed }) => (
                  <View
                    style={{
                      backgroundColor: colors.primary,
                      borderRadius: radius.md,
                      paddingVertical: 14,
                      alignItems: 'center',
                      opacity: pressed ? 0.8 : 1,
                    }}
                  >
                    <Text style={{ ...t.bodyEmphasis, color: '#fff' }}>Oui, enregistrer</Text>
                  </View>
                )}
              </Pressable>
              <Pressable onPress={onDismiss}>
                {({ pressed }) => (
                  <View
                    style={{
                      backgroundColor: colors.bgSecondary,
                      borderRadius: radius.md,
                      paddingVertical: 14,
                      alignItems: 'center',
                      opacity: pressed ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ ...t.body, color: colors.textSecondary }}>Non, annuler</Text>
                  </View>
                )}
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <Pressable onPress={() => onConfirm(true)}>
                {({ pressed }) => (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      backgroundColor: colors.primary + '22',
                      borderWidth: 1,
                      borderColor: colors.primary,
                      borderRadius: radius.md,
                      paddingVertical: 14,
                      opacity: pressed ? 0.7 : 1,
                    }}
                  >
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    <Text style={{ ...t.bodyEmphasis, color: colors.primary }}>Joint</Text>
                  </View>
                )}
              </Pressable>
              <Pressable onPress={() => onConfirm(false)}>
                {({ pressed }) => (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      backgroundColor: colors.danger + '14',
                      borderWidth: 1,
                      borderColor: colors.danger + '40',
                      borderRadius: radius.md,
                      paddingVertical: 14,
                      opacity: pressed ? 0.7 : 1,
                    }}
                  >
                    <Ionicons name="close-circle" size={20} color={colors.danger} />
                    <Text style={{ ...t.bodyEmphasis, color: colors.danger }}>Non joint</Text>
                  </View>
                )}
              </Pressable>
              <Pressable onPress={onDismiss}>
                {({ pressed }) => (
                  <View
                    style={{
                      paddingVertical: 10,
                      alignItems: 'center',
                      opacity: pressed ? 0.5 : 1,
                    }}
                  >
                    <Text style={{ ...t.footnote, color: colors.textTertiary }}>Annuler</Text>
                  </View>
                )}
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  )
}

function formatNoteDate(iso: string): string {
  const d = new Date(iso)
  const now = Date.now()
  const diffMin = Math.round((now - d.getTime()) / 60000)
  if (diffMin < 1) return "à l'instant"
  if (diffMin < 60) return `il y a ${diffMin}min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `il y a ${diffH}h`
  const diffD = Math.round(diffH / 24)
  if (diffD < 7) return `il y a ${diffD}j`
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

// Normalise les notes des imports Meta Ads / GHL qui ont souvent
// 3-5 sauts de ligne consécutifs après chaque section emoji →
// on cap à max 1 ligne vide pour éviter les colonnes blanches.
function cleanNoteContent(s: string): string {
  return s.replace(/\n{3,}/g, '\n\n').trim()
}

const NOTE_COLLAPSE_LINES = 6

function NoteRow({
  note,
  separator,
  onEdit,
  onDelete,
}: {
  note: LeadNote
  separator: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const edited = note.updated_at && note.updated_at !== note.created_at
  const cleaned = cleanNoteContent(note.content)
  const lineCount = cleaned.split('\n').length
  const tooLong = lineCount > NOTE_COLLAPSE_LINES || cleaned.length > 280
  const [expanded, setExpanded] = useState(false)

  return (
    <Pressable onPress={onEdit}>
      {({ pressed }) => (
        <View
          style={{
            paddingHorizontal: spacing.md,
            paddingVertical: 14,
            borderBottomWidth: separator ? 1 : 0,
            borderBottomColor: colors.warning + '25',
            gap: 8,
            opacity: pressed ? 0.7 : 1,
          }}
        >
          <Text
            style={{
              ...t.body,
              color: colors.textPrimary,
              lineHeight: 21,
            }}
            numberOfLines={tooLong && !expanded ? NOTE_COLLAPSE_LINES : undefined}
          >
            {cleaned}
          </Text>

          {tooLong ? (
            <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={6}>
              <Text style={{ ...t.caption1, color: colors.warning, fontWeight: '700' }}>
                {expanded ? 'Voir moins' : 'Voir plus'}
              </Text>
            </Pressable>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 }}>
            <Text style={{ ...t.caption2, color: colors.warning, fontWeight: '600' }}>
              {formatNoteDate(note.created_at)}
              {edited ? ' · modifiée' : ''}
            </Text>
            <View style={{ flex: 1 }} />
            <Pressable onPress={onDelete} hitSlop={8} style={{ padding: 4 }}>
              <Ionicons name="trash-outline" size={14} color={colors.danger} />
            </Pressable>
          </View>
        </View>
      )}
    </Pressable>
  )
}
