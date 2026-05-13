import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Pressable,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Button } from '../../components/ui'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'
import { signIn } from '../../services/auth'

const errorMessage = (e: unknown): string => {
  if (e instanceof Error) {
    if (/Invalid login credentials/i.test(e.message)) return 'Email ou mot de passe incorrect.'
    if (/Email not confirmed/i.test(e.message))
      return 'Email pas encore confirmé. Vérifie ta boîte mail.'
    if (/network/i.test(e.message)) return 'Problème de connexion réseau.'
    return e.message
  }
  return 'Erreur inconnue.'
}

export function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async () => {
    setError(null)
    if (!email.includes('@')) return setError('Email invalide.')
    if (password.length < 6) return setError('Mot de passe trop court.')
    setLoading(true)
    try {
      await signIn(email.trim().toLowerCase(), password)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: spacing.xxl,
            paddingVertical: spacing.xxxxl,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo + brand */}
          <View style={{ alignItems: 'center', marginBottom: spacing.xxxxl }}>
            <View
              style={{
                width: 84,
                height: 84,
                borderRadius: 22,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: spacing.lg,
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.4,
                shadowRadius: 20,
                elevation: 8,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 40, fontWeight: '800', letterSpacing: -1 }}>
                C
              </Text>
            </View>
            <Text style={{ ...t.title1, color: colors.textPrimary, letterSpacing: -0.5 }}>
              ClosRM
            </Text>
            <Text style={{ ...t.subheadline, color: colors.textSecondary, marginTop: 4 }}>
              Connecte-toi à ton workspace
            </Text>
          </View>

          {/* Form */}
          <View style={{ gap: spacing.md, marginBottom: spacing.lg }}>
            <View
              style={{
                backgroundColor: colors.bgSecondary,
                borderRadius: radius.xl,
                paddingHorizontal: spacing.lg,
                paddingVertical: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
              }}
            >
              <Ionicons name="mail-outline" size={18} color={colors.textSecondary} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="Email"
                placeholderTextColor={colors.textSecondary}
                style={{ ...t.body, color: colors.textPrimary, flex: 1 }}
              />
            </View>

            <View
              style={{
                backgroundColor: colors.bgSecondary,
                borderRadius: radius.xl,
                paddingHorizontal: spacing.lg,
                paddingVertical: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
              }}
            >
              <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Mot de passe"
                placeholderTextColor={colors.textSecondary}
                style={{ ...t.body, color: colors.textPrimary, flex: 1 }}
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={18}
                  color={colors.textSecondary}
                />
              </Pressable>
            </View>
          </View>

          {error ? (
            <View
              style={{
                marginBottom: spacing.lg,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                borderRadius: radius.md,
                backgroundColor: colors.danger + '22',
                flexDirection: 'row',
                gap: spacing.sm,
                alignItems: 'flex-start',
              }}
            >
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text style={{ ...t.subheadline, color: colors.danger, flex: 1 }}>{error}</Text>
            </View>
          ) : null}

          <Button
            label={loading ? 'Connexion…' : 'Se connecter'}
            onPress={onSubmit}
            loading={loading}
            fullWidth
            size="lg"
          />

          <Pressable
            onPress={() => Linking.openURL('https://closrm.fr/register')}
            style={{ marginTop: spacing.xxl, alignItems: 'center' }}
            hitSlop={12}
          >
            <Text style={{ ...t.subheadline, color: colors.textSecondary }}>
              Pas encore de compte ?{' '}
              <Text style={{ color: colors.primary, fontWeight: '600' }}>
                Inscris-toi sur closrm.fr
              </Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
