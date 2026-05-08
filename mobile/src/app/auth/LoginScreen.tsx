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
import { signIn } from '../../services/auth'

const errorMessage = (e: unknown): string => {
  if (e instanceof Error) {
    // Messages Supabase fréquents → traduction propre.
    if (/Invalid login credentials/i.test(e.message))
      return 'Email ou mot de passe incorrect.'
    if (/Email not confirmed/i.test(e.message))
      return 'Email pas encore confirmé. Vérifie ta boîte mail.'
    if (/network/i.test(e.message))
      return 'Problème de connexion. Vérifie ta connexion internet.'
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
      // RootNavigator écoute onAuthStateChange → bascule auto sur Main.
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
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo / titre */}
          <View style={{ alignItems: 'center', marginBottom: 40 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800' }}>C</Text>
            </View>
            <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700' }}>
              ClosRM
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
              Connecte-toi à ton workspace
            </Text>
          </View>

          {/* Email */}
          <View style={{ gap: 8, marginBottom: 14 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
              Email
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="ton@email.com"
              placeholderTextColor={colors.textSecondary}
              style={{
                backgroundColor: colors.bgSecondary,
                borderWidth: 1,
                borderColor: colors.border,
                color: colors.textPrimary,
                fontSize: 15,
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 12,
              }}
            />
          </View>

          {/* Password */}
          <View style={{ gap: 8, marginBottom: 6 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
              Mot de passe
            </Text>
            <View style={{ position: 'relative' }}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="••••••••"
                placeholderTextColor={colors.textSecondary}
                style={{
                  backgroundColor: colors.bgSecondary,
                  borderWidth: 1,
                  borderColor: colors.border,
                  color: colors.textPrimary,
                  fontSize: 15,
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  paddingRight: 44,
                }}
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                style={{ position: 'absolute', right: 12, top: 12, padding: 4 }}
              >
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
                marginTop: 14,
                padding: 12,
                borderRadius: 10,
                backgroundColor: colors.danger + '22',
                borderWidth: 1,
                borderColor: colors.danger + '55',
                flexDirection: 'row',
                gap: 8,
                alignItems: 'flex-start',
              }}
            >
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Text style={{ color: colors.danger, fontSize: 13, flex: 1 }}>{error}</Text>
            </View>
          ) : null}

          <View style={{ marginTop: 24 }}>
            <Button
              label={loading ? 'Connexion…' : 'Se connecter'}
              onPress={onSubmit}
              loading={loading}
              fullWidth
              size="lg"
            />
          </View>

          <Pressable
            onPress={() => Linking.openURL('https://closrm.fr/register')}
            style={{ marginTop: 24, alignItems: 'center' }}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
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
