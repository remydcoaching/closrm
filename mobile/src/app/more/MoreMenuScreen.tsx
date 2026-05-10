import React from 'react'
import { View, Text, ScrollView, Pressable, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import type { MoreStackParamList } from '../../navigation/types'
import { Avatar, ListSection, ListRow, NavLarge } from '../../components/ui'
import { useAuth } from '../../hooks/useAuth'
import { signOut } from '../../services/auth'
import { useTheme } from '../../theme/ThemeProvider'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'

type Nav = NativeStackNavigationProp<MoreStackParamList, 'MoreMenu'>

function DotIcon({
  name,
  tint = colors.primary,
}: {
  name: keyof typeof Ionicons.glyphMap
  tint?: string
}) {
  return (
    <View
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: tint + '22',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={name} size={18} color={tint} />
    </View>
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
      <NavLarge title="Plus" />

      <ScrollView contentContainerStyle={{ paddingBottom: 100, gap: spacing.xxl }}>
        {/* Profile card */}
        <View style={{ paddingHorizontal: spacing.lg }}>
          <View
            style={{
              backgroundColor: colors.bgSecondary,
              borderRadius: radius.xl,
              padding: spacing.lg,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
            }}
          >
            <Avatar name={user?.email ?? '?'} size={56} />
            <View style={{ flex: 1 }}>
              <Text style={{ ...t.bodyEmphasis, color: colors.textPrimary }}>
                {user?.email ?? '—'}
              </Text>
              <Text style={{ ...t.subheadline, color: colors.textSecondary, marginTop: 2 }}>
                Workspace ClosRM
              </Text>
            </View>
          </View>
        </View>

        {/* Apparence — toggle thème style Apple Settings */}
        <View>
          <Text
            style={{
              ...t.footnote,
              color: colors.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              marginLeft: spacing.lg + spacing.lg,
              marginBottom: spacing.sm,
            }}
          >
            Apparence
          </Text>
          <View style={{ marginHorizontal: spacing.lg }}>
            <View
              style={{
                flexDirection: 'row',
                gap: 4,
                backgroundColor: colors.bgSecondary,
                borderRadius: radius.lg,
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
                      backgroundColor: active ? '#48484a' : 'transparent',
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
                        ...t.subheadline,
                        color: active ? colors.textPrimary : colors.textSecondary,
                        fontWeight: active ? '600' : '500',
                      }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
        </View>

        {/* Sections */}
        <ListSection>
          <ListRow
            leading={<DotIcon name="notifications" tint={colors.primary} />}
            title="Activité"
            subtitle="Historique des notifications"
            onPress={() => navigation.navigate('Notifications')}
          />
          <ListRow
            leading={<DotIcon name="notifications-circle" tint={colors.warning} />}
            title="Notifications push"
            subtitle="Choisir quoi recevoir"
            onPress={() => navigation.navigate('NotificationSettings')}
          />
          <ListRow
            leading={<DotIcon name="calendar" tint={colors.pink} />}
            title="Réseaux sociaux"
            subtitle="Calendrier de publication"
            onPress={() => navigation.navigate('SocialPosts')}
          />
          <ListRow
            leading={<DotIcon name="settings-outline" tint={colors.textSecondary} />}
            title="Réglages"
            subtitle="Depuis le web pour l'instant"
          />
          <ListRow
            leading={<DotIcon name="help-circle-outline" tint={colors.info} />}
            title="Aide"
            separator={false}
          />
        </ListSection>

        {/* Logout */}
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => ({
              backgroundColor: colors.bgSecondary,
              borderRadius: radius.xl,
              padding: spacing.lg,
              alignItems: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ ...t.body, color: colors.danger, fontWeight: '600' }}>
              Se déconnecter
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
