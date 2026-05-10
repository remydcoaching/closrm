import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import type { MoreStackParamList } from '../../navigation/types'
import { supabase } from '../../services/supabase'
import { NavLarge } from '../../components/ui'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'

type Nav = NativeStackNavigationProp<MoreStackParamList, 'TournageSessions'>

interface SessionRow {
  id: string
  name: string | null
  scheduled_date: string | null
  notes: string | null
  reels: { social_post_id: string; position: number }[] | null
}

interface SessionWithStats extends SessionRow {
  reels_count: number
}

export function TournageSessionsScreen() {
  const navigation = useNavigation<Nav>()
  const [sessions, setSessions] = useState<SessionWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('tournage_sessions')
      .select(
        'id, name, scheduled_date, notes, reels:tournage_session_reels(social_post_id, position)'
      )
      .order('scheduled_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
    if (error) {
      setError(error.message)
      setSessions([])
    } else {
      const rows = (data ?? []) as unknown as SessionRow[]
      setSessions(
        rows.map((s) => ({
          ...s,
          reels_count: s.reels?.length ?? 0,
        }))
      )
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void fetch()
  }, [fetch])

  const openSession = (session: SessionWithStats, screen: 'ReelsBrief' | 'ReelsPrep' | 'ReelsJourJ') => {
    const reelIds =
      session.reels && session.reels.length > 0
        ? [...session.reels].sort((a, b) => a.position - b.position).map((r) => r.social_post_id)
        : null
    navigation.navigate(screen, { reelIds })
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

      <NavLarge
        title="Sessions"
        subtitle={
          sessions.length > 0
            ? `${sessions.length} session${sessions.length > 1 ? 's' : ''} de tournage`
            : 'Aucune session'
        }
      />

      {loading && sessions.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
          <Text style={{ ...t.body, color: colors.danger, textAlign: 'center' }}>{error}</Text>
        </View>
      ) : sessions.length === 0 ? (
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing.xl,
          }}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={fetch} tintColor={colors.primary} />
          }
        >
          <Ionicons name="videocam-outline" size={48} color={colors.textTertiary} />
          <Text
            style={{
              ...t.headline,
              color: colors.textPrimary,
              marginTop: spacing.md,
              textAlign: 'center',
            }}
          >
            Pas de session
          </Text>
          <Text
            style={{
              ...t.subheadline,
              color: colors.textSecondary,
              marginTop: 4,
              textAlign: 'center',
            }}
          >
            Crée une session de tournage depuis le web pour grouper tes reels.
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 80, gap: spacing.md }}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={fetch} tintColor={colors.primary} />
          }
        >
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              onOpen={(screen) => openSession(session, screen)}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

function SessionCard({
  session,
  onOpen,
}: {
  session: SessionWithStats
  onOpen: (screen: 'ReelsBrief' | 'ReelsPrep' | 'ReelsJourJ') => void
}) {
  const dateLabel = session.scheduled_date
    ? new Date(session.scheduled_date).toLocaleDateString('fr-FR', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
      })
    : 'Sans date'

  return (
    <View
      style={{
        backgroundColor: colors.bgSecondary,
        borderRadius: radius.xl,
        padding: spacing.md,
        gap: spacing.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: '#FF000022',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="videocam" size={18} color="#FF0000" />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={{ ...t.bodyEmphasis, color: colors.textPrimary }}
          >
            {session.name ?? 'Session sans nom'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <Text style={{ ...t.caption1, color: colors.textSecondary, fontWeight: '600' }}>
              {dateLabel}
            </Text>
            <Text style={{ ...t.caption1, color: colors.textTertiary }}>·</Text>
            <Text style={{ ...t.caption1, color: colors.textSecondary }}>
              {session.reels_count} reel{session.reels_count > 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      </View>

      {session.notes ? (
        <Text
          numberOfLines={2}
          style={{ ...t.caption1, color: colors.textTertiary, lineHeight: 17 }}
        >
          {session.notes}
        </Text>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 6 }}>
        <ActionPill
          label="Brief"
          icon="document-text-outline"
          onPress={() => onOpen('ReelsBrief')}
          disabled={session.reels_count === 0}
        />
        <ActionPill
          label="Prep"
          icon="checkmark-done-outline"
          onPress={() => onOpen('ReelsPrep')}
          disabled={session.reels_count === 0}
        />
        <ActionPill
          label="Jour J"
          icon="play-circle-outline"
          onPress={() => onOpen('ReelsJourJ')}
          tint={colors.primary}
          disabled={session.reels_count === 0}
        />
      </View>
    </View>
  )
}

function ActionPill({
  label,
  icon,
  onPress,
  tint,
  disabled,
}: {
  label: string
  icon: keyof typeof Ionicons.glyphMap
  onPress: () => void
  tint?: string
  disabled?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 9,
        paddingHorizontal: 8,
        borderRadius: radius.md,
        backgroundColor: tint ? tint : 'transparent',
        borderWidth: tint ? 0 : 1,
        borderColor: colors.border,
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <Ionicons
        name={icon}
        size={14}
        color={tint ? '#000' : colors.textPrimary}
      />
      <Text
        style={{
          ...t.caption1,
          color: tint ? '#000' : colors.textPrimary,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}
