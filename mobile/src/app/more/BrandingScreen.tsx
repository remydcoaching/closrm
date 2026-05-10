import React, { useState } from 'react'
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { NavLarge } from '../../components/ui'
import { useWorkspaceBranding } from '../../hooks/useWorkspaceBranding'
import { useTheme } from '../../theme/ThemeProvider'
import { ACCENT_PRESETS, isValidHex, colors, darkenHex, setAccentColor } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'

/**
 * Picker de couleur d'accent — synchronisé avec workspace.accent_color (web).
 * Live preview : applique la couleur immédiatement sur le singleton + force
 * un remount via setMode (toggle no-op qui re-rend l'arbre).
 */
export function BrandingScreen() {
  const navigation = useNavigation()
  const { setMode, mode } = useTheme()
  const { accentColor, loading, save } = useWorkspaceBranding()
  const [saving, setSaving] = useState(false)
  const [previewHex, setPreviewHex] = useState<string | null>(null)

  const currentHex = previewHex ?? accentColor ?? '#00C853'

  // Preview live : modifie le singleton + remount l'arbre.
  const previewColor = (hex: string) => {
    if (!isValidHex(hex)) return
    setPreviewHex(hex)
    setAccentColor({ dark: hex, light: darkenHex(hex, 15) })
    // Re-applique le mode pour forcer le remount (key change dans App.tsx).
    void setMode(mode)
  }

  const persist = async (hex: string) => {
    if (!isValidHex(hex)) return
    setSaving(true)
    try {
      await save(hex)
      setPreviewHex(null)
      // Remount pour appliquer partout
      void setMode(mode)
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Échec sauvegarde')
    } finally {
      setSaving(false)
    }
  }

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

      <NavLarge title="Apparence" subtitle="Couleur d'accent du workspace" />

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
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
                const active = currentHex.toLowerCase() === preset.hex.toLowerCase()
                return (
                  <Pressable
                    key={preset.hex}
                    onPress={() => previewColor(preset.hex)}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: preset.hex,
                      borderWidth: active ? 3 : 0,
                      borderColor: '#fff',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {active ? (
                      <Ionicons name="checkmark" size={20} color="#fff" />
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
              }}
            >
              Synchronisé avec le web. Le changement s&apos;applique immédiatement.
            </Text>
          </View>

          {previewHex ? (
            <Pressable
              onPress={() => void persist(previewHex)}
              disabled={saving}
              style={{
                paddingVertical: 14,
                backgroundColor: colors.primary,
                borderRadius: radius.lg,
                alignItems: 'center',
                opacity: saving ? 0.6 : 1,
              }}
            >
              <Text style={{ ...t.bodyEmphasis, color: '#000', fontWeight: '700' }}>
                {saving ? 'Sauvegarde…' : 'Enregistrer'}
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
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
            Couleur principale de ton workspace
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
