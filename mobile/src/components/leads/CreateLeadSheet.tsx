import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'
import { View, Text, TextInput, Pressable, Alert } from 'react-native'
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet'
import { Ionicons } from '@expo/vector-icons'
import type { LeadSource } from '@shared/types'
import { Avatar } from '../ui'
import { colors, getAvatarColor } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'
import { api } from '../../services/api'

interface CreateLeadSheetContextValue {
  open: (onCreated?: () => void) => void
}

const CreateLeadSheetContext = createContext<CreateLeadSheetContextValue | null>(null)

export function useCreateLeadSheet(): CreateLeadSheetContextValue {
  const ctx = useContext(CreateLeadSheetContext)
  if (!ctx) {
    if (__DEV__) console.warn('useCreateLeadSheet hors provider')
    return { open: () => {} }
  }
  return ctx
}

interface SourceMeta {
  key: LeadSource
  label: string
  icon: keyof typeof Ionicons.glyphMap
  tint: string
}

const SOURCES: SourceMeta[] = [
  { key: 'manuel', label: 'Manuel', icon: 'create-outline', tint: '#8e8e93' },
  { key: 'instagram_ads', label: 'Instagram', icon: 'logo-instagram', tint: '#ec4899' },
  { key: 'facebook_ads', label: 'Facebook', icon: 'logo-facebook', tint: '#3b82f6' },
  { key: 'formulaire', label: 'Formulaire', icon: 'document-text-outline', tint: '#06b6d4' },
]

/** Row d'input dans une grouped list iOS Settings. Hairline en bas
 *  géré par la grouped View parent (gap 0 + hairlines). */
function InputRow({
  icon,
  iconTint,
  placeholder,
  value,
  onChangeText,
  keyboardType,
  autoCapitalize = 'sentences',
  separator = true,
}: {
  icon: keyof typeof Ionicons.glyphMap
  iconTint: string
  placeholder: string
  value: string
  onChangeText: (s: string) => void
  keyboardType?: 'default' | 'email-address' | 'phone-pad'
  autoCapitalize?: 'none' | 'sentences' | 'words'
  separator?: boolean
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        gap: 12,
        borderBottomWidth: separator ? 0.33 : 0,
        borderBottomColor: colors.border,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 7,
          backgroundColor: iconTint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={16} color="#fff" />
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        style={{
          flex: 1,
          ...t.body,
          color: colors.textPrimary,
          paddingVertical: 4,
        }}
      />
    </View>
  )
}

interface ProviderProps {
  children: React.ReactNode
}

export function CreateLeadSheetProvider({ children }: ProviderProps) {
  const sheetRef = useRef<BottomSheet>(null)
  const onCreatedRef = useRef<(() => void) | undefined>(undefined)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [sourceIdx, setSourceIdx] = useState(0)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setFirstName('')
    setLastName('')
    setPhone('')
    setEmail('')
    setSourceIdx(0)
    setNotes('')
    setSubmitting(false)
  }

  const openSheet = useCallback((onCreated?: () => void) => {
    onCreatedRef.current = onCreated
    reset()
    sheetRef.current?.snapToIndex(0)
  }, [])

  const close = useCallback(() => {
    sheetRef.current?.close()
  }, [])

  const submit = async () => {
    const fn = firstName.trim()
    const ln = lastName.trim()
    const ph = phone.trim()
    const em = email.trim()
    if (!fn && !ln && !ph && !em) {
      Alert.alert('Lead vide', 'Renseigne au moins un nom, un téléphone ou un email.')
      return
    }
    setSubmitting(true)
    try {
      await api.post('/api/leads', {
        first_name: fn,
        last_name: ln,
        phone: ph,
        email: em || undefined,
        source: SOURCES[sourceIdx].key,
        notes: notes.trim() || undefined,
      })
      onCreatedRef.current?.()
      close()
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Erreur création lead')
    } finally {
      setSubmitting(false)
    }
  }

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.6} />
    ),
    [],
  )

  const value = useMemo<CreateLeadSheetContextValue>(() => ({ open: openSheet }), [openSheet])

  // Avatar live preview du nom en cours de saisie (style Contacts)
  const previewName = `${firstName} ${lastName}`.trim() || 'Nouveau lead'
  const previewHue = getAvatarColor(previewName)

  return (
    <CreateLeadSheetContext.Provider value={value}>
      {children}
      <BottomSheet
        ref={sheetRef}
        snapPoints={['85%']}
        index={-1}
        enablePanDownToClose
        enableDynamicSizing={false}
        backgroundStyle={{ backgroundColor: colors.sheet }}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
        backdropComponent={renderBackdrop}
        onChange={(idx) => {
          if (idx === -1) reset()
        }}
      >
        <BottomSheetScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: 80,
            gap: spacing.lg,
          }}
        >
          {/* Header avec preview avatar live */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
            }}
          >
            <Avatar name={previewName} size={56} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: 22,
                  fontWeight: '700',
                  letterSpacing: -0.4,
                }}
                numberOfLines={1}
              >
                {previewName}
              </Text>
              <Text style={{ ...t.subheadline, color: colors.textSecondary, marginTop: 2 }}>
                Nouveau lead
              </Text>
            </View>
            <Pressable onPress={close} hitSlop={8} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={26} color={colors.textTertiary} />
            </Pressable>
          </View>

          {/* Section IDENTITÉ — grouped list iOS Settings */}
          <View>
            <Text
              style={{
                ...t.footnote,
                color: colors.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginLeft: 8,
                marginBottom: 6,
                fontSize: 12,
                fontWeight: '600',
              }}
            >
              Identité
            </Text>
            <View
              style={{
                backgroundColor: colors.bgSecondary,
                borderRadius: radius.lg,
                overflow: 'hidden',
              }}
            >
              <InputRow
                icon="person-outline"
                iconTint="#8e8e93"
                placeholder="Prénom"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
              />
              <InputRow
                icon="person-outline"
                iconTint="#8e8e93"
                placeholder="Nom"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                separator={false}
              />
            </View>
          </View>

          {/* Section CONTACT */}
          <View>
            <Text
              style={{
                ...t.footnote,
                color: colors.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginLeft: 8,
                marginBottom: 6,
                fontSize: 12,
                fontWeight: '600',
              }}
            >
              Contact
            </Text>
            <View
              style={{
                backgroundColor: colors.bgSecondary,
                borderRadius: radius.lg,
                overflow: 'hidden',
              }}
            >
              <InputRow
                icon="call"
                iconTint="#22c55e"
                placeholder="Téléphone"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
              <InputRow
                icon="mail"
                iconTint="#a855f7"
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                separator={false}
              />
            </View>
          </View>

          {/* Source — pills 2×2 avec icônes */}
          <View>
            <Text
              style={{
                ...t.footnote,
                color: colors.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginLeft: 8,
                marginBottom: 6,
                fontSize: 12,
                fontWeight: '600',
              }}
            >
              Source du lead
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {SOURCES.map((s, i) => {
                const active = sourceIdx === i
                return (
                  <Pressable
                    key={s.key}
                    onPress={() => setSourceIdx(i)}
                    style={{ width: '48%' }}
                  >
                    {({ pressed }) => (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                          paddingHorizontal: 14,
                          paddingVertical: 12,
                          borderRadius: radius.md,
                          backgroundColor: active ? s.tint + '22' : colors.bgSecondary,
                          borderWidth: 1,
                          borderColor: active ? s.tint + '88' : 'transparent',
                          opacity: pressed ? 0.7 : 1,
                        }}
                      >
                        <Ionicons
                          name={s.icon}
                          size={18}
                          color={active ? s.tint : colors.textSecondary}
                        />
                        <Text
                          style={{
                            ...t.subheadline,
                            color: active ? s.tint : colors.textPrimary,
                            fontWeight: active ? '700' : '500',
                          }}
                        >
                          {s.label}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                )
              })}
            </View>
          </View>

          {/* Notes — textarea séparé */}
          <View>
            <Text
              style={{
                ...t.footnote,
                color: colors.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginLeft: 8,
                marginBottom: 6,
                fontSize: 12,
                fontWeight: '600',
              }}
            >
              Notes (optionnel)
            </Text>
            <View
              style={{
                backgroundColor: colors.bgSecondary,
                borderRadius: radius.lg,
                paddingHorizontal: 14,
                paddingVertical: 10,
                minHeight: 80,
              }}
            >
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Contexte initial, source précise, etc."
                placeholderTextColor={colors.textTertiary}
                multiline
                textAlignVertical="top"
                style={{
                  ...t.body,
                  color: colors.textPrimary,
                  minHeight: 60,
                }}
              />
            </View>
          </View>

          {/* CTA principal — gros bouton primary */}
          <Pressable onPress={submit} disabled={submitting} style={{ marginTop: spacing.sm }}>
            {({ pressed }) => (
              <View
                style={{
                  paddingVertical: 16,
                  borderRadius: radius.lg,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: pressed || submitting ? 0.85 : 1,
                  shadowColor: colors.primary,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.3,
                  shadowRadius: 12,
                }}
              >
                {!submitting ? (
                  <Ionicons name="add-circle" size={20} color="#000" />
                ) : null}
                <Text
                  style={{
                    color: '#000',
                    fontSize: 17,
                    fontWeight: '700',
                    letterSpacing: -0.2,
                  }}
                >
                  {submitting ? 'Création…' : 'Créer le lead'}
                </Text>
              </View>
            )}
          </Pressable>
          <Pressable onPress={close} disabled={submitting}>
            {({ pressed }) => (
              <View
                style={{
                  paddingVertical: 12,
                  alignItems: 'center',
                  opacity: pressed ? 0.5 : 1,
                }}
              >
                <Text style={{ ...t.body, color: colors.textSecondary }}>
                  Annuler
                </Text>
              </View>
            )}
          </Pressable>
        </BottomSheetScrollView>
      </BottomSheet>
    </CreateLeadSheetContext.Provider>
  )
}
