import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import { api } from '../../services/api'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'

interface InitialLead {
  id: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  email: string | null
  tags: string[] | null
}

interface Props {
  initial: InitialLead | null
  onClose: () => void
  onSaved: () => void
}

/**
 * Sheet pour modifier les champs basiques d'un lead : prénom, nom, téléphone,
 * email, tags. PATCH /api/leads/[id].
 */
export function LeadEditSheet({ initial, onClose, onSaved }: Props) {
  const sheetRef = useRef<BottomSheet>(null)
  const open = initial != null

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [tags, setTags] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!initial) return
    setFirstName(initial.first_name ?? '')
    setLastName(initial.last_name ?? '')
    setPhone(initial.phone ?? '')
    setEmail(initial.email ?? '')
    setTags((initial.tags ?? []).join(', '))
  }, [initial])

  useEffect(() => {
    if (open) sheetRef.current?.snapToIndex(0)
    else sheetRef.current?.close()
  }, [open])

  const renderBackdrop = useMemo(
    () =>
      // eslint-disable-next-line react/display-name
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.5} />
      ),
    []
  )

  const save = async () => {
    if (!initial) return
    if (!firstName.trim()) {
      Alert.alert('Prénom requis', 'Au minimum un prénom.')
      return
    }
    setSaving(true)
    try {
      const tagList = tags
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      await api.patch(`/api/leads/${initial.id}`, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        tags: tagList,
      })
      onSaved()
      onClose()
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Échec sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={['80%']}
      enableDynamicSizing={false}
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.sheet }}
      handleIndicatorStyle={{ backgroundColor: colors.textTertiary }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
    >
      <BottomSheetView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              borderBottomWidth: 0.33,
              borderBottomColor: colors.border,
            }}
          >
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={{ ...t.body, color: colors.textSecondary }}>Annuler</Text>
            </Pressable>
            <Text style={{ ...t.bodyEmphasis, color: colors.textPrimary }}>Modifier lead</Text>
            <Pressable onPress={save} disabled={saving} hitSlop={10}>
              <Text
                style={{
                  ...t.body,
                  color: saving ? colors.textTertiary : colors.primary,
                  fontWeight: '700',
                }}
              >
                {saving ? '…' : 'OK'}
              </Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{
              padding: spacing.lg,
              gap: spacing.lg,
              paddingBottom: 60,
            }}
            keyboardShouldPersistTaps="handled"
          >
            <Field
              label="Prénom"
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Alex"
              autoCapitalize="words"
            />
            <Field
              label="Nom"
              value={lastName}
              onChangeText={setLastName}
              placeholder="Dupont"
              autoCapitalize="words"
            />
            <Field
              label="Téléphone"
              value={phone}
              onChangeText={setPhone}
              placeholder="+33 6 12 34 56 78"
              keyboardType="phone-pad"
            />
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="alex@exemple.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Field
              label="Tags (séparés par virgules)"
              value={tags}
              onChangeText={setTags}
              placeholder="chaud, VIP, referral"
              autoCapitalize="none"
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </BottomSheetView>
    </BottomSheet>
  )
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
}: {
  label: string
  value: string
  onChangeText: (v: string) => void
  placeholder?: string
  keyboardType?: 'default' | 'email-address' | 'phone-pad'
  autoCapitalize?: 'none' | 'words'
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text
        style={{
          ...t.footnote,
          color: colors.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          fontWeight: '600',
          marginLeft: 4,
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
        style={{
          ...t.body,
          color: colors.textPrimary,
          backgroundColor: colors.bgSecondary,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: 12,
        }}
      />
    </View>
  )
}
