import React from 'react'
import { View, Text, ScrollView, Pressable, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import type { MoreStackParamList } from '../../navigation/types'
import { Avatar, ListSection, ListRow, NavLarge } from '../../components/ui'
import { useAuth } from '../../hooks/useAuth'
import { signOut } from '../../services/auth'
import { useTheme } from '../../theme/ThemeProvider'
import { colors, getAvatarColor } from '../../theme/colors'
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
        width: 30,
        height: 30,
        borderRadius: 7,
        backgroundColor: tint,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={name} size={17} color="#fff" />
    </View>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      style={{
        ...t.footnote,
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginLeft: spacing.lg + 8,
        marginBottom: spacing.sm,
        fontSize: 12,
        fontWeight: '600',
      }}
    >
      {children}
    </Text>
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

  const email = user?.email ?? ''
  const avatarName = email || 'ClosRM'
  const avatarHue = getAvatarColor(avatarName)
  // Affiche la partie avant @ comme nom (ex: pr.rebmann@gmail.com → pr.rebmann)
  const displayName = email.split('@')[0] || 'Mon compte'

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <NavLarge title="Plus" />

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Hero profil — gradient teinté avatar, avec gros avatar centré
            comme la fiche lead. Plus premium qu'une row simple. */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.xxl }}>
          <LinearGradient
            colors={[avatarHue + '40', avatarHue + '15', colors.bgSecondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 22,
              padding: spacing.lg,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              borderWidth: 1,
              borderColor: avatarHue + '30',
            }}
          >
            <Avatar name={avatarName} size={64} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={{
                  color: colors.textPrimary,
                  fontSize: 18,
                  fontWeight: '700',
                  letterSpacing: -0.3,
                }}
              >
                {displayName}
              </Text>
              <Text
                numberOfLines={1}
                style={{ ...t.subheadline, color: colors.textSecondary, marginTop: 2 }}
              >
                {email}
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 8,
                  alignSelf: 'flex-start',
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 999,
                  backgroundColor: colors.bgPrimary + '88',
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: colors.primary,
                  }}
                />
                <Text
                  style={{
                    ...t.caption2,
                    color: colors.textSecondary,
                    fontWeight: '600',
                  }}
                >
                  Workspace ClosRM
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Apparence — segmented natif iOS Settings style */}
        <SectionLabel>Apparence</SectionLabel>
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.xxl }}>
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
              const icon =
                m === 'auto'
                  ? 'phone-portrait-outline'
                  : m === 'light'
                  ? 'sunny'
                  : 'moon'
              return (
                <Pressable key={m} onPress={() => void setMode(m)} style={{ flex: 1 }}>
                  {({ pressed }) => (
                    <View
                      style={{
                        paddingVertical: 10,
                        borderRadius: 8,
                        backgroundColor: active ? colors.bgElevated : 'transparent',
                        alignItems: 'center',
                        flexDirection: 'row',
                        justifyContent: 'center',
                        gap: 6,
                        opacity: pressed ? 0.7 : 1,
                        borderWidth: active ? 0.5 : 0,
                        borderColor: colors.border,
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
                    </View>
                  )}
                </Pressable>
              )
            })}
          </View>
        </View>

        {/* Section CONTENU — actions liées au business */}
        <SectionLabel>Contenu</SectionLabel>
        <View style={{ marginBottom: spacing.xxl }}>
          <ListSection>
            <ListRow
              leading={<DotIcon name="image" tint="#ec4899" />}
              title="Réseaux sociaux"
              subtitle="Calendrier de publication"
              onPress={() => navigation.navigate('SocialPosts')}
            />
            <ListRow
              leading={<DotIcon name="videocam" tint="#FF0000" />}
              title="Plan de tournage"
              subtitle="Reels — préparation et jour J"
              onPress={() => navigation.navigate('ReelsJourJ', { reelIds: null })}
              separator={false}
            />
          </ListSection>
        </View>

        {/* Section NOTIFICATIONS */}
        <SectionLabel>Notifications</SectionLabel>
        <View style={{ marginBottom: spacing.xxl }}>
          <ListSection>
            <ListRow
              leading={<DotIcon name="time-outline" tint="#3b82f6" />}
              title="Activité"
              subtitle="Historique des notifications"
              onPress={() => navigation.navigate('Notifications')}
            />
            <ListRow
              leading={<DotIcon name="notifications" tint={colors.primary} />}
              title="Préférences push"
              subtitle="Choisir quoi recevoir sur l'iPhone"
              onPress={() => navigation.navigate('NotificationSettings')}
              separator={false}
            />
          </ListSection>
        </View>

        {/* Section COMPTE */}
        <SectionLabel>Compte</SectionLabel>
        <View style={{ marginBottom: spacing.xxl }}>
          <ListSection>
            <ListRow
              leading={<DotIcon name="settings-sharp" tint="#8e8e93" />}
              title="Réglages"
              subtitle="Depuis le web pour l'instant"
            />
            <ListRow
              leading={<DotIcon name="help-circle" tint="#06b6d4" />}
              title="Aide"
              subtitle="Documentation & support"
              separator={false}
            />
          </ListSection>
        </View>

        {/* Logout — bouton danger discret en bas */}
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Pressable onPress={handleLogout}>
            {({ pressed }) => (
              <View
                style={{
                  backgroundColor: colors.bgSecondary,
                  borderRadius: radius.xl,
                  paddingVertical: spacing.md,
                  alignItems: 'center',
                  opacity: pressed ? 0.7 : 1,
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Ionicons name="log-out-outline" size={18} color={colors.danger} />
                <Text style={{ ...t.body, color: colors.danger, fontWeight: '600' }}>
                  Se déconnecter
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Footer build info */}
        <Text
          style={{
            ...t.caption2,
            color: colors.textTertiary,
            textAlign: 'center',
            marginTop: spacing.lg,
          }}
        >
          ClosRM mobile · v1.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}
