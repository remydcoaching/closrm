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
import { api } from '../../services/api'
import { NavLarge } from '../../components/ui'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'

type Nav = NativeStackNavigationProp<MoreStackParamList, 'TournageSessions'>

interface SessionRow {
  id: string
  name: string | null
  scheduled_date: string | null
  status: 'draft' | 'ready' | 'in_progress' | 'completed' | 'archived'
  reels_count: number
  stats: { total: number; done: number; skipped: number }
  reels?: Array<{ social_post_id: string; position: number }>
}

const STATUS_META: Record<SessionRow['status'], { label: string; tint: string }> = {
  draft: { label: 'Brouillon', tint: '#888' },
  ready: { label: 'Prête', tint: '#5b9bf5' },
  in_progress: { label: 'En cours', tint: '#d69e2e' },
  completed: { label: 'Terminée', tint: '#22c55e' },
  archived: { label: 'Archivée', tint: '#555' },
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })
}

export function TournageSessionsScreen() {
  const navigation = useNavigation<Nav>()
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<{ data: SessionRow[] }>('/api/tournage-sessions')
      setSessions(res.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function openSession(s: SessionRow, view: 'prep' | 'jour-j') {
    const reelIds = (s.reels ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((r) => r.social_post_id)
    const params = { reelIds: reelIds.length > 0 ? reelIds : null, sessionId: s.id }
    if (view === 'prep') navigation.navigate('ReelsPrep', params)
    else navigation.navigate('ReelsJourJ', params)
  }

  const visible = showArchived ? sessions : sessions.filter((s) => s.status !== 'archived')

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
        <View style={{ flex: 1 }} />
      </View>

      <NavLarge title="Sessions de tournage" subtitle="Groupe les reels que tu films ensemble" />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.sm,
        }}
      >
        <Pressable onPress={() => setShowArchived((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View
            style={{
              width: 18,
              height: 18,
              borderRadius: 4,
              borderWidth: 1.5,
              borderColor: showArchived ? colors.primary : colors.border,
              backgroundColor: showArchived ? colors.primary : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {showArchived ? <Ionicons name="checkmark" size={12} color="#000" /> : null}
          </View>
          <Text style={{ ...t.subheadline, color: colors.textSecondary }}>Afficher archivées</Text>
        </Pressable>
      </View>

      {loading && sessions.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
          <Text style={{ ...t.body, color: colors.danger, textAlign: 'center' }}>{error}</Text>
          <Pressable
            onPress={() => void load()}
            style={{
              marginTop: spacing.md,
              paddingHorizontal: spacing.lg,
              paddingVertical: 10,
              backgroundColor: colors.bgSecondary,
              borderRadius: radius.md,
            }}
          >
            <Text style={{ ...t.subheadline, color: colors.textPrimary }}>Réessayer</Text>
          </Pressable>
        </View>
      ) : visible.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.sm }}>
          <Text style={{ fontSize: 48 }}>📭</Text>
          <Text style={{ ...t.body, color: colors.textSecondary, textAlign: 'center' }}>
            Aucune session pour l&apos;instant.
          </Text>
          <Text style={{ ...t.subheadline, color: colors.textTertiary, textAlign: 'center' }}>
            Crée une session depuis le web pour grouper les reels d&apos;une journée de tournage.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 40, gap: spacing.md }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
        >
          {visible.map((s) => (
            <SessionCard key={s.id} session={s} onOpen={(v) => openSession(s, v)} />
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
  session: SessionRow
  onOpen: (view: 'prep' | 'jour-j') => void
}) {
  const total = session.stats.total
  const done = session.stats.done
  const pct = total > 0 ? (done / total) * 100 : 0
  // Statut dérivé depuis les stats — sinon tout reste "Brouillon" même quand
  // tu as 37/78 phrases tournées.
  const derivedStatus: SessionRow['status'] =
    session.status === 'archived' ? 'archived'
    : total > 0 && done === total ? 'completed'
    : done > 0 ? 'in_progress'
    : session.reels_count > 0 ? 'ready'
    : 'draft'
  const meta = STATUS_META[derivedStatus]
  const dateLabel = formatDate(session.scheduled_date)

  return (
    <View
      style={{
        backgroundColor: colors.bgSecondary,
        borderRadius: radius.lg,
        padding: spacing.md,
        gap: spacing.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 4,
            backgroundColor: meta.tint + '22',
          }}
        >
          <Text style={{ fontSize: 9, fontWeight: '700', color: meta.tint, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {meta.label}
          </Text>
        </View>
        {dateLabel ? (
          <Text style={{ ...t.caption1, color: colors.textTertiary }}>{dateLabel}</Text>
        ) : null}
      </View>
      <Text style={{ ...t.bodyEmphasis, color: colors.textPrimary }}>
        {session.name?.trim() || 'Session sans nom'}
      </Text>
      <Text style={{ ...t.caption1, color: colors.textTertiary }}>
        {session.reels_count} reel{session.reels_count > 1 ? 's' : ''}
        {total > 0
          ? ` · ${done}/${total} phrase${total > 1 ? 's' : ''} tournée${done > 1 ? 's' : ''}`
          : ''}
        {session.stats.skipped > 0
          ? ` · ${session.stats.skipped} reportée${session.stats.skipped > 1 ? 's' : ''}`
          : ''}
      </Text>

      {total > 0 ? (
        <View style={{ height: 4, backgroundColor: colors.bgPrimary, borderRadius: 999, overflow: 'hidden' }}>
          <View style={{ width: `${pct}%`, height: '100%', backgroundColor: '#22c55e' }} />
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: 4 }}>
        <Pressable onPress={() => onOpen('prep')} style={{ flex: 1 }}>
          {({ pressed }) => (
            <View
              style={{
                paddingVertical: 10,
                backgroundColor: colors.primary,
                borderRadius: radius.md,
                alignItems: 'center',
                opacity: pressed ? 0.7 : 1,
              }}
            >
              <Text style={{ ...t.subheadline, color: '#000', fontWeight: '700' }}>📋 Prep</Text>
            </View>
          )}
        </Pressable>
        <Pressable onPress={() => onOpen('jour-j')} style={{ flex: 1 }}>
          {({ pressed }) => (
            <View
              style={{
                paddingVertical: 10,
                borderWidth: 1,
                borderColor: colors.primary,
                borderRadius: radius.md,
                alignItems: 'center',
                opacity: pressed ? 0.6 : 1,
              }}
            >
              <Text style={{ ...t.subheadline, color: colors.primary, fontWeight: '700' }}>🎬 Jour J</Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  )
}
