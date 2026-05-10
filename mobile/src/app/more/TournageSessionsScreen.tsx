import React, { useCallback, useEffect, useMemo, useState } from 'react'
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

type SessionStatus = 'draft' | 'ready' | 'in_progress' | 'completed' | 'archived'

interface SessionRow {
  id: string
  name: string | null
  scheduled_date: string | null
  status: SessionStatus
  brief_sent_at: string | null
  notes: string | null
  reels: { social_post_id: string; position: number }[] | null
}

interface SessionShotsStats {
  total: number
  done: number
  skipped: number
}

interface SessionEnriched extends SessionRow {
  reels_count: number
  stats: SessionShotsStats
}

const STATUS_META: Record<
  SessionStatus,
  { label: string; tint: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  draft: { label: 'Brouillon', tint: '#8e8e93', icon: 'document-outline' },
  ready: { label: 'Prêt', tint: '#3b82f6', icon: 'checkmark-circle-outline' },
  in_progress: { label: 'En cours', tint: '#f59e0b', icon: 'play-circle' },
  completed: { label: 'Terminé', tint: '#22c55e', icon: 'checkmark-done-circle' },
  archived: { label: 'Archivé', tint: '#6b7280', icon: 'archive' },
}

export function TournageSessionsScreen() {
  const navigation = useNavigation<Nav>()
  const [sessions, setSessions] = useState<SessionEnriched[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data: rows, error } = await supabase
      .from('tournage_sessions')
      .select(
        'id, name, scheduled_date, status, brief_sent_at, notes, reels:tournage_session_reels(social_post_id, position)'
      )
      .order('scheduled_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
    if (error) {
      setError(error.message)
      setSessions([])
      setLoading(false)
      return
    }
    const sessions = (rows ?? []) as unknown as SessionRow[]

    // Stats agrégées des shots par session.
    const reelIds = new Set<string>()
    sessions.forEach((s) => s.reels?.forEach((r) => reelIds.add(r.social_post_id)))
    const statsByReel: Record<string, SessionShotsStats> = {}
    if (reelIds.size > 0) {
      const { data: shots } = await supabase
        .from('reel_shots')
        .select('social_post_id, done, skipped')
        .in('social_post_id', Array.from(reelIds))
        .is('deleted_at', null)
      for (const row of (shots ?? []) as { social_post_id: string; done: boolean; skipped: boolean }[]) {
        const id = row.social_post_id
        if (!statsByReel[id]) statsByReel[id] = { total: 0, done: 0, skipped: 0 }
        statsByReel[id].total++
        if (row.done) statsByReel[id].done++
        if (row.skipped) statsByReel[id].skipped++
      }
    }

    const enriched: SessionEnriched[] = sessions.map((s) => {
      let total = 0,
        done = 0,
        skipped = 0
      s.reels?.forEach((r) => {
        const st = statsByReel[r.social_post_id]
        if (st) {
          total += st.total
          done += st.done
          skipped += st.skipped
        }
      })
      return {
        ...s,
        reels_count: s.reels?.length ?? 0,
        stats: { total, done, skipped },
      }
    })
    setSessions(enriched)
    setLoading(false)
  }, [])

  useEffect(() => {
    void fetch()
  }, [fetch])

  // Sépare en 2 groupes : actives (ready/in_progress/draft) vs archivées/terminées.
  const { active, archived } = useMemo(() => {
    const a: SessionEnriched[] = []
    const b: SessionEnriched[] = []
    for (const s of sessions) {
      if (s.status === 'archived' || s.status === 'completed') b.push(s)
      else a.push(s)
    }
    return { active: a, archived: b }
  }, [sessions])

  const openSession = (
    session: SessionEnriched,
    screen: 'ReelsBrief' | 'ReelsPrep' | 'ReelsJourJ'
  ) => {
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
        title="Tournage"
        subtitle={
          sessions.length > 0
            ? `${sessions.length} session${sessions.length > 1 ? 's' : ''}`
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
        <EmptyState onRefresh={fetch} loading={loading} />
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: 80,
            gap: spacing.lg,
          }}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={fetch} tintColor={colors.primary} />
          }
        >
          {active.length > 0 ? (
            <Section
              label={`Actives · ${active.length}`}
              sessions={active}
              onOpen={openSession}
            />
          ) : null}
          {archived.length > 0 ? (
            <Section
              label={`Terminées · ${archived.length}`}
              sessions={archived}
              onOpen={openSession}
              dimmed
            />
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

function Section({
  label,
  sessions,
  onOpen,
  dimmed,
}: {
  label: string
  sessions: SessionEnriched[]
  onOpen: (s: SessionEnriched, screen: 'ReelsBrief' | 'ReelsPrep' | 'ReelsJourJ') => void
  dimmed?: boolean
}) {
  return (
    <View style={{ gap: spacing.md }}>
      <Text
        style={{
          ...t.footnote,
          color: colors.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          fontWeight: '700',
          marginLeft: 4,
        }}
      >
        {label}
      </Text>
      <View style={{ gap: 12 }}>
        {sessions.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            onOpen={(screen) => onOpen(session, screen)}
            dimmed={dimmed}
          />
        ))}
      </View>
    </View>
  )
}

function SessionCard({
  session,
  onOpen,
  dimmed,
}: {
  session: SessionEnriched
  onOpen: (screen: 'ReelsBrief' | 'ReelsPrep' | 'ReelsJourJ') => void
  dimmed?: boolean
}) {
  const status = STATUS_META[session.status] ?? STATUS_META.draft
  const dateLabel = formatSessionDate(session.scheduled_date)
  const progress =
    session.stats.total > 0
      ? Math.round((session.stats.done / session.stats.total) * 100)
      : 0

  // CTA hero : choisi en fonction du status.
  const heroCta =
    session.status === 'in_progress'
      ? { label: 'Continuer', icon: 'play-circle' as const, screen: 'ReelsJourJ' as const }
      : session.status === 'ready'
        ? { label: 'Lancer Jour J', icon: 'play-circle' as const, screen: 'ReelsJourJ' as const }
        : { label: 'Préparer', icon: 'list-outline' as const, screen: 'ReelsPrep' as const }

  return (
    <View
      style={{
        backgroundColor: colors.bgSecondary,
        borderRadius: radius.xl,
        overflow: 'hidden',
        opacity: dimmed ? 0.7 : 1,
      }}
    >
      {/* Header band coloré par status */}
      <View
        style={{
          backgroundColor: status.tint + '14',
          paddingHorizontal: spacing.md,
          paddingVertical: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Ionicons name={status.icon} size={14} color={status.tint} />
        <Text style={{ ...t.caption1, color: status.tint, fontWeight: '700' }}>
          {status.label}
        </Text>
        <View style={{ flex: 1 }} />
        {session.brief_sent_at ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="paper-plane" size={11} color={colors.textTertiary} />
            <Text style={{ ...t.caption2, color: colors.textTertiary }}>Brief envoyé</Text>
          </View>
        ) : null}
      </View>

      {/* Body */}
      <View style={{ padding: spacing.md, gap: spacing.md }}>
        {/* Date + nom */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
          <DateBlock dateStr={session.scheduled_date} tint={status.tint} />
          <View style={{ flex: 1, paddingTop: 2 }}>
            <Text
              numberOfLines={1}
              style={{
                ...t.title3,
                color: colors.textPrimary,
                fontWeight: '700',
                letterSpacing: -0.3,
              }}
            >
              {session.name ?? 'Session sans nom'}
            </Text>
            <Text
              style={{
                ...t.subheadline,
                color: colors.textSecondary,
                marginTop: 2,
              }}
            >
              {dateLabel}
            </Text>
          </View>
        </View>

        {/* Stats reels + shots */}
        <View
          style={{
            flexDirection: 'row',
            gap: spacing.sm,
          }}
        >
          <StatPill
            icon="film-outline"
            value={String(session.reels_count)}
            label={session.reels_count > 1 ? 'reels' : 'reel'}
          />
          <StatPill
            icon="aperture-outline"
            value={String(session.stats.total)}
            label="shots"
          />
          {session.stats.done > 0 ? (
            <StatPill
              icon="checkmark-circle"
              value={`${session.stats.done}`}
              label={`/ ${session.stats.total}`}
              tint="#22c55e"
            />
          ) : null}
        </View>

        {/* Progress bar */}
        {session.stats.total > 0 ? (
          <View style={{ gap: 6 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={{ ...t.caption2, color: colors.textTertiary, fontWeight: '600' }}>
                Avancement
              </Text>
              <Text style={{ ...t.caption2, color: colors.textPrimary, fontWeight: '700' }}>
                {progress}%
              </Text>
            </View>
            <View
              style={{
                height: 6,
                borderRadius: 3,
                backgroundColor: colors.bgElevated,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${progress}%`,
                  height: 6,
                  backgroundColor: status.tint,
                  borderRadius: 3,
                }}
              />
            </View>
          </View>
        ) : null}

        {/* Notes */}
        {session.notes ? (
          <Text
            numberOfLines={2}
            style={{
              ...t.caption1,
              color: colors.textTertiary,
              lineHeight: 17,
              fontStyle: 'italic',
            }}
          >
            {session.notes}
          </Text>
        ) : null}

        {/* Hero CTA + actions secondaires */}
        <View style={{ gap: 8 }}>
          <Pressable
            onPress={() => onOpen(heroCta.screen)}
            disabled={session.reels_count === 0}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 13,
              borderRadius: radius.lg,
              backgroundColor: session.reels_count === 0 ? colors.bgElevated : status.tint,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Ionicons
              name={heroCta.icon}
              size={18}
              color={session.reels_count === 0 ? colors.textTertiary : '#000'}
            />
            <Text
              style={{
                ...t.bodyEmphasis,
                color: session.reels_count === 0 ? colors.textTertiary : '#000',
                fontWeight: '700',
              }}
            >
              {session.reels_count === 0 ? 'Aucun reel à tourner' : heroCta.label}
            </Text>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <SecondaryAction
              label="Brief"
              icon="document-text-outline"
              onPress={() => onOpen('ReelsBrief')}
              disabled={session.reels_count === 0}
            />
            <SecondaryAction
              label="Prep"
              icon="checkmark-done-outline"
              onPress={() => onOpen('ReelsPrep')}
              disabled={session.reels_count === 0}
              hideIfHero={heroCta.screen === 'ReelsPrep'}
            />
            <SecondaryAction
              label="Jour J"
              icon="play-circle-outline"
              onPress={() => onOpen('ReelsJourJ')}
              disabled={session.reels_count === 0}
              hideIfHero={heroCta.screen === 'ReelsJourJ'}
            />
          </View>
        </View>
      </View>
    </View>
  )
}

function DateBlock({ dateStr, tint }: { dateStr: string | null; tint: string }) {
  if (!dateStr) {
    return (
      <View
        style={{
          width: 56,
          height: 64,
          borderRadius: radius.md,
          backgroundColor: tint + '14',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: tint + '33',
        }}
      >
        <Ionicons name="calendar-outline" size={22} color={tint} />
      </View>
    )
  }
  const d = new Date(dateStr)
  const day = d.getDate()
  const month = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')
  const weekday = d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')
  return (
    <View
      style={{
        width: 56,
        height: 64,
        borderRadius: radius.md,
        backgroundColor: tint + '14',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: tint + '33',
        paddingVertical: 4,
      }}
    >
      <Text
        style={{
          ...t.caption2,
          color: tint,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {weekday}
      </Text>
      <Text
        style={{
          color: colors.textPrimary,
          fontSize: 22,
          fontWeight: '800',
          letterSpacing: -0.5,
          marginTop: -1,
        }}
      >
        {day}
      </Text>
      <Text
        style={{
          ...t.caption2,
          color: colors.textSecondary,
          textTransform: 'lowercase',
          fontWeight: '600',
        }}
      >
        {month}
      </Text>
    </View>
  )
}

function StatPill({
  icon,
  value,
  label,
  tint,
}: {
  icon: keyof typeof Ionicons.glyphMap
  value: string
  label: string
  tint?: string
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: radius.pill,
        backgroundColor: tint ? tint + '14' : colors.bgElevated,
        borderWidth: 1,
        borderColor: tint ? tint + '33' : colors.border,
      }}
    >
      <Ionicons name={icon} size={12} color={tint ?? colors.textSecondary} />
      <Text
        style={{
          ...t.caption1,
          color: tint ?? colors.textPrimary,
          fontWeight: '700',
        }}
      >
        {value}
      </Text>
      <Text style={{ ...t.caption1, color: colors.textTertiary }}>{label}</Text>
    </View>
  )
}

function SecondaryAction({
  label,
  icon,
  onPress,
  disabled,
  hideIfHero,
}: {
  label: string
  icon: keyof typeof Ionicons.glyphMap
  onPress: () => void
  disabled?: boolean
  hideIfHero?: boolean
}) {
  if (hideIfHero) {
    return <View style={{ flex: 1 }} />
  }
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
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={14} color={colors.textPrimary} />
      <Text style={{ ...t.caption1, color: colors.textPrimary, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  )
}

function EmptyState({ onRefresh, loading }: { onRefresh: () => void; loading: boolean }) {
  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
        gap: spacing.md,
      }}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: colors.bgSecondary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="videocam-outline" size={36} color={colors.textTertiary} />
      </View>
      <Text style={{ ...t.title3, color: colors.textPrimary, textAlign: 'center' }}>
        Pas de session
      </Text>
      <Text
        style={{
          ...t.subheadline,
          color: colors.textSecondary,
          textAlign: 'center',
          maxWidth: 280,
          lineHeight: 21,
        }}
      >
        Crée une session de tournage depuis le web pour grouper tes reels par
        journée de shooting.
      </Text>
    </ScrollView>
  )
}

function formatSessionDate(dateStr: string | null): string {
  if (!dateStr) return 'Sans date programmée'
  const d = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(d)
  target.setHours(0, 0, 0, 0)
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return "Aujourd'hui"
  if (diffDays === 1) return 'Demain'
  if (diffDays === -1) return 'Hier'
  if (diffDays > 1 && diffDays <= 7) return `Dans ${diffDays} jours`
  if (diffDays < -1 && diffDays >= -7) return `Il y a ${Math.abs(diffDays)} jours`
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}
