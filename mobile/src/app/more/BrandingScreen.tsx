import React from 'react'
import { View, Text, ScrollView, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { NavLarge } from '../../components/ui'
import { useTheme } from '../../theme/ThemeProvider'
import { ACCENT_PRESETS, colors, darkColors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'

/**
 * Picker de couleur d'accent — local au mobile uniquement (zéro lien web).
 * Persiste dans SecureStore via ThemeProvider.setAccent. Live preview
 * automatique via le remount sur changement de la `key` (theme + accent).
 */
export function BrandingScreen() {
  const navigation = useNavigation()
  const { accent, setAccent } = useTheme()
  const currentHex = (accent ?? darkColors.primary).toLowerCase()

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        }}
      >
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{ padding: 4 }}>
          <Ionicons name="chevron-back" size={28} color={colors.primary} />
        </Pressable>
      </View>

      <NavLarge title="Apparence" subtitle="Couleur principale de l'app" />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: 60,
          gap: spacing.lg,
        }}
      >
        <Preview hex={currentHex} />

        <View>
          <Text
            style={{
              ...t.footnote,
              color: colors.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginLeft: 8,
              marginBottom: spacing.sm,
              fontWeight: '600',
            }}
          >
            Couleur
          </Text>
          <View
            style={{
              backgroundColor: colors.bgSecondary,
              borderRadius: radius.lg,
              padding: spacing.md,
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            {ACCENT_PRESETS.map((preset) => {
              const active = currentHex === preset.hex.toLowerCase()
              return (
                <Pressable
                  key={preset.hex}
                  onPress={() => void setAccent(preset.hex)}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    backgroundColor: preset.hex,
                    borderWidth: active ? 3 : 0,
                    borderColor: '#fff',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {active ? (
                    <Ionicons name="checkmark" size={22} color="#fff" />
                  ) : null}
                </Pressable>
              )
            })}
          </View>
          <Text
            style={{
              ...t.caption2,
              color: colors.textTertiary,
              marginTop: spacing.sm,
              marginLeft: 8,
              lineHeight: 16,
            }}
          >
            Stockée localement sur cet iPhone uniquement. N&apos;affecte pas
            les autres appareils ni la version web.
          </Text>
        </View>

        {accent ? (
          <Pressable
            onPress={() => void setAccent(null)}
            style={({ pressed }) => ({
              paddingVertical: 12,
              borderRadius: radius.lg,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ ...t.subheadline, color: colors.textSecondary, fontWeight: '600' }}>
              Réinitialiser au vert ClosRM
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

function Preview({ hex }: { hex: string }) {
  return (
    <View
      style={{
        backgroundColor: colors.bgSecondary,
        borderRadius: radius.xl,
        padding: spacing.lg,
        gap: spacing.md,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: hex,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="checkmark" size={26} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ ...t.title3, color: colors.textPrimary }}>{hex.toUpperCase()}</Text>
          <Text style={{ ...t.subheadline, color: colors.textSecondary, marginTop: 2 }}>
            Couleur principale de l&apos;app
          </Text>
        </View>
      </View>
      <View
        style={{
          paddingVertical: 12,
          backgroundColor: hex,
          borderRadius: radius.md,
          alignItems: 'center',
        }}
      >
        <Text style={{ ...t.bodyEmphasis, color: '#000', fontWeight: '700' }}>
          Bouton principal
        </Text>
      </View>
    </View>
  )
}
