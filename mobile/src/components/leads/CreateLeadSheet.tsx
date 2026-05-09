import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert } from 'react-native'
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet'
import { Ionicons } from '@expo/vector-icons'
import type { LeadSource } from '@shared/types'
import { Button, Segmented } from '../ui'
import { colors } from '../../theme/colors'
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

const SOURCES: { key: LeadSource; label: string }[] = [
  { key: 'manuel', label: 'Manuel' },
  { key: 'instagram_ads', label: 'Insta' },
  { key: 'facebook_ads', label: 'FB' },
  { key: 'formulaire', label: 'Form' },
]

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize = 'sentences',
  multiline,
}: {
  label: string
  value: string
  onChangeText: (s: string) => void
  placeholder?: string
  keyboardType?: 'default' | 'email-address' | 'phone-pad'
  autoCapitalize?: 'none' | 'sentences' | 'words'
  multiline?: boolean
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: 13,
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        multiline={multiline}
        style={{
          ...t.body,
          color: colors.textPrimary,
          backgroundColor: '#2c2c2e',
          borderRadius: radius.lg,
          paddingHorizontal: 14,
          paddingVertical: 12,
          minHeight: multiline ? 80 : 0,
          textAlignVertical: multiline ? 'top' : 'center',
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
  const [open, setOpen] = useState(false)
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
    setOpen(true)
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

  return (
    <CreateLeadSheetContext.Provider value={value}>
      {children}
      <BottomSheet
        ref={sheetRef}
        snapPoints={['80%']}
        index={-1}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: '#1c1c1e' }}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
        backdropComponent={renderBackdrop}
        onChange={(idx) => {
          if (idx === -1) {
            setOpen(false)
            reset()
          }
        }}
      >
        <BottomSheetScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60, gap: spacing.lg }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: 22,
                fontWeight: '700',
                letterSpacing: -0.4,
              }}
            >
              Nouveau lead
            </Text>
            <Pressable onPress={close} hitSlop={8}>
              <Ionicons name="close-circle" size={28} color={colors.textTertiary} />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Field
                label="Prénom"
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Pierre"
                autoCapitalize="words"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Nom"
                value={lastName}
                onChangeText={setLastName}
                placeholder="Rebmann"
                autoCapitalize="words"
              />
            </View>
          </View>

          <Field
            label="Téléphone"
            value={phone}
            onChangeText={setPhone}
            placeholder="06 33 60 49 59"
            keyboardType="phone-pad"
          />

          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="pierre@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <View style={{ gap: 6 }}>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 13,
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: 0.4,
              }}
            >
              Source
            </Text>
            <Segmented
              items={SOURCES.map((s) => ({ label: s.label }))}
              activeIndex={sourceIdx}
              onChange={setSourceIdx}
            />
          </View>

          <Field
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Contexte initial du lead…"
            multiline
          />

          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Button label="Annuler" variant="outline" fullWidth size="md" onPress={close} />
            </View>
            <View style={{ flex: 2 }}>
              <Button
                label={submitting ? 'Création…' : 'Créer le lead'}
                fullWidth
                size="md"
                loading={submitting}
                disabled={submitting}
                onPress={submit}
              />
            </View>
          </View>
          {submitting ? <ActivityIndicator color={colors.primary} /> : null}
        </BottomSheetScrollView>
      </BottomSheet>
    </CreateLeadSheetContext.Provider>
  )
}
