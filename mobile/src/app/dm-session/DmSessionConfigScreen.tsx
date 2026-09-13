import React, { useState } from 'react'
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { FollowUpsStackParamList } from '../../navigation/types'
import { useStartDmSession } from '../../hooks/useDmSession'
import { NavLarge } from '../../components/ui'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'

type Nav = NativeStackNavigationProp<FollowUpsStackParamList, 'DmSessionConfig'>

const COUNT_OPTIONS = [10, 20, 30, 45]
const THRESHOLD_OPTIONS = [14, 30, 60, 90]

export function DmSessionConfigScreen() {
  const navigation = useNavigation<Nav>()
  const startSession = useStartDmSession()
  const [targetCount, setTargetCount] = useState(30)
  const [staleThresholdDays, setStaleThresholdDays] = useState(30)
  const [relanceEnRetard, setRelanceEnRetard] = useState(true)
  const [premierContact, setPremierContact] = useState(true)
  const [jamaisRecontacte, setJamaisRecontacte] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleStart() {
    setError(null)
    setStarting(true)
    try {
      const data = await startSession({
        targetCount,
        staleThresholdDays,
        relanceEnRetard,
        premierContact,
        jamaisRecontacte,
      })
      navigation.replace('DmSessionLead', { sessionId: data.id })
    } catch {
      setError("Impossible de démarrer la session. Vérifie ta connexion et réessaie.")
    } finally {
      setStarting(false)
    }
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <NavLarge title="Nouvelle session" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <View>
          <Text style={{ ...t.footnote, color: colors.textSecondary, marginBottom: spacing.sm }}>
            Types de leads à travailler
          </Text>
          <View style={{ gap: spacing.sm }}>
            <CategoryCheckbox label="Relance du jour" checked disabled />
            <CategoryCheckbox
              label="Relance en retard"
              checked={relanceEnRetard}
              onPress={() => setRelanceEnRetard((v) => !v)}
            />
            <CategoryCheckbox
              label="Premier contact"
              checked={premierContact}
              onPress={() => setPremierContact((v) => !v)}
            />
            <CategoryCheckbox
              label="Reprise après une longue absence"
              checked={jamaisRecontacte}
              onPress={() => setJamaisRecontacte((v) => !v)}
            />
          </View>
        </View>

        <View>
          <Text style={{ ...t.footnote, color: colors.textSecondary, marginBottom: spacing.sm }}>
            Nombre de profils
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {COUNT_OPTIONS.map((count) => (
              <Pressable
                key={count}
                onPress={() => setTargetCount(count)}
                style={{
                  flex: 1,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.md,
                  alignItems: 'center',
                  backgroundColor: targetCount === count ? colors.primary : colors.bgSecondary,
                  borderWidth: 1,
                  borderColor: targetCount === count ? colors.primary : colors.border,
                }}
              >
                <Text style={{ ...t.subheadline, color: colors.textPrimary, fontWeight: '700' }}>{count}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View>
          <Text style={{ ...t.footnote, color: colors.textSecondary, marginBottom: spacing.sm }}>
            Seuil &quot;ancien lead&quot;
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {THRESHOLD_OPTIONS.map((days) => (
              <Pressable
                key={days}
                onPress={() => setStaleThresholdDays(days)}
                style={{
                  flex: 1,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.md,
                  alignItems: 'center',
                  backgroundColor: staleThresholdDays === days ? colors.primary : colors.bgSecondary,
                  borderWidth: 1,
                  borderColor: staleThresholdDays === days ? colors.primary : colors.border,
                }}
              >
                <Text style={{ ...t.subheadline, color: colors.textPrimary, fontWeight: '700' }}>{days}j</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {error && (
          <Text style={{ ...t.footnote, color: colors.danger, textAlign: 'center' }}>{error}</Text>
        )}

        <Pressable
          onPress={handleStart}
          disabled={starting}
          style={{
            backgroundColor: colors.primary,
            borderRadius: radius.lg,
            paddingVertical: spacing.md,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: spacing.sm,
            opacity: starting ? 0.6 : 1,
          }}
        >
          {starting && <ActivityIndicator color="#fff" size="small" />}
          <Text style={{ ...t.subheadline, color: '#fff', fontWeight: '700' }}>
            {starting ? 'Démarrage…' : 'Démarrer la session'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

function CategoryCheckbox({
  label,
  checked,
  onPress,
  disabled,
}: {
  label: string
  checked: boolean
  onPress?: () => void
  disabled?: boolean
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radius.md,
        backgroundColor: colors.bgSecondary,
        borderWidth: 1,
        borderColor: checked ? colors.primary : colors.border,
        opacity: disabled ? 0.7 : 1,
      }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: radius.sm,
          borderWidth: 1.5,
          borderColor: checked ? colors.primary : colors.border,
          backgroundColor: checked ? colors.primary : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>✓</Text>}
      </View>
      <Text style={{ ...t.subheadline, color: colors.textPrimary, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  )
}
