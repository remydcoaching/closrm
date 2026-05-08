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
