import React from 'react'
import { View, Text, ScrollView, Pressable, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import type { MoreStackParamList } from '../../navigation/types'
import { Avatar, Card, Divider } from '../../components/ui'
import { useAuth } from '../../hooks/useAuth'
import { signOut } from '../../services/auth'
import { colors } from '../../theme/colors'
import { useTheme } from '../../theme/ThemeProvider'

type Nav = NativeStackNavigationProp<MoreStackParamList, 'MoreMenu'>

interface RowProps {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  hint?: string
  iconColor?: string
  onPress?: () => void
}

function Row({ icon, label, hint, iconColor = colors.textSecondary, onPress }: RowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        backgroundColor: pressed ? colors.bgSecondary : 'transparent',
      })}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: iconColor + '22',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '500' }}>
          {label}
        </Text>
        {hint ? <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{hint}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
    </Pressable>
  )
}

export function MoreMenuScreen() {
  const navigation = useNavigation<Nav>()
  const { user } = useAuth()
  const { mode, setMode } = useTheme()

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Tu veux vraiment te déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnexion',
        style: 'destructive',
        onPress: async () => {
          await signOut()
        },
      },
    ])
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* Profile card */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar name={user?.email ?? '?'} size={52} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>
                {user?.email ?? '—'}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                Workspace ClosRM
              </Text>
            </View>
          </View>
        </Card>

        {/* Apparence — toggle thème */}
        <Card>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 12,
              fontWeight: '700',
              letterSpacing: 0.5,
              marginBottom: 10,
            }}
          >
            APPARENCE
          </Text>
          <View
            style={{
              flexDirection: 'row',
              gap: 6,
              backgroundColor: colors.bgSecondary,
              borderRadius: 10,
              padding: 4,
            }}
          >
            {(['auto', 'light', 'dark'] as const).map((m) => {
              const active = mode === m
              const label = m === 'auto' ? 'Auto' : m === 'light' ? 'Clair' : 'Sombre'
              const icon = m === 'auto' ? 'phone-portrait-outline' : m === 'light' ? 'sunny' : 'moon'
              return (
                <Pressable
                  key={m}
                  onPress={() => void setMode(m)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 8,
                    backgroundColor: active ? colors.bgElevated : 'transparent',
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Ionicons
                    name={icon as keyof typeof Ionicons.glyphMap}
                    size={14}
                    color={active ? colors.primary : colors.textSecondary}
                  />
                  <Text
                    style={{
                      color: active ? colors.textPrimary : colors.textSecondary,
                      fontSize: 13,
                      fontWeight: '600',
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </Card>

        {/* Sections */}
        <Card>
          <Row
            icon="notifications"
            label="Notifications"
            iconColor={colors.primary}
            onPress={() => navigation.navigate('Notifications')}
          />
          <Divider />
          <Row icon="settings-outline" label="Réglages" hint="Depuis le web pour l'instant" />
          <Divider />
          <Row icon="help-circle-outline" label="Aide" />
        </Card>

        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => ({
            backgroundColor: colors.bgElevated,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.danger + '55',
            padding: 14,
            alignItems: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ color: colors.danger, fontSize: 14, fontWeight: '600' }}>
            Se déconnecter
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}
