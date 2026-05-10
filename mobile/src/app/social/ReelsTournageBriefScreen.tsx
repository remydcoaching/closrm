import React, { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Share,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import type { MoreStackParamList } from '../../navigation/types'
import { api } from '../../services/api'
import { Segmented, NavLarge } from '../../components/ui'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'
import type { ReelShot } from '../../types/reel-shots'
import type { SocialPost } from '../../types/social'

type Nav = NativeStackNavigationProp<MoreStackParamList, 'ReelsBrief'>
type Rt = RouteProp<MoreStackParamList, 'ReelsBrief'>

const placeIcon = (loc: string | null): string => {
  if (!loc) return '📍'
  const l = loc.toLowerCase()
  if (l.includes('poulie') || l.includes('câble')) return '🏋️'
  if (l.includes('banc')) return '🛏️'
  if (l.includes('sol')) return '🟫'
  if (l.includes('miroir')) return '🪞'
  if (l.includes('plage') || l.includes('extér') || l.includes('dehors')) return '🌳'
  return '📍'
}

const fmtTime = (iso: string): string => {
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2, '0')}h${d.getMinutes().toString().padStart(2, '0')}`
}

export function ReelsTournageBriefScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Rt>()
  const reelIds = route.params?.reelIds ?? null

  const [reels, setReels] = useState<Pick<SocialPost, 'id' | 'title' | 'hook'>[]>([])
  const [shots, setShots] = useState<ReelShot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'chrono' | 'reel'>('chrono')

  const fetch = async () => {
    setLoading(true)
    setError(null)
    try {
      const reelsRes = await api.get<{ data: Pick<SocialPost, 'id' | 'title' | 'hook'>[] }>(
        '/api/social/posts?content_kind=reel&slim=true&per_page=100',
      )
      const allReels = reelsRes.data ?? []
      const filtered = reelIds && reelIds.length > 0
        ? allReels.filter((r) => reelIds.includes(r.id))
        : allReels
      setReels(filtered)

      let url = '/api/reel-shots'
      if (filtered.length > 0) url += `?social_post_ids=${filtered.map((r) => r.id).join(',')}`
      const shotsRes = await api.get<{ data: ReelShot[] }>(url)
      setShots((shotsRes.data ?? []).filter((s) => s.done))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reelIds?.join(',')])

  // Code court R1-P1, R2-P3, etc.
  const codeMap = useMemo(() => {
    const m: Record<string, string> = {}
    reels.forEach((reel, ri) => {
      const reelShots = shots
        .filter((s) => s.social_post_id === reel.id)
        .sort((a, b) => a.position - b.position)
      reelShots.forEach((s) => {
        m[s.id] = `R${ri + 1}-P${s.position + 1}`
      })
    })
    return m
  }, [reels, shots])

  // Tri chrono par updated_at
  const chrono = useMemo(
    () => [...shots].sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()),
    [shots],
  )

  // Groupage par reel
  const byReel = useMemo(() => {
    const groups: Record<string, ReelShot[]> = {}
    shots.forEach((s) => {
      if (!groups[s.social_post_id]) groups[s.social_post_id] = []
      groups[s.social_post_id].push(s)
    })
    Object.values(groups).forEach((arr) => arr.sort((a, b) => a.position - b.position))
    return groups
  }, [shots])

  const handleShare = async () => {
    // Génère un texte plain pour le monteur (whatsapp/email/etc)
    const lines: string[] = ['📄 BRIEF MONTEUR\n']
    reels.forEach((reel, ri) => {
      const reelShots = byReel[reel.id] ?? []
      if (reelShots.length === 0) return
      lines.push(`\n=== R${ri + 1} : ${reel.title || '(sans titre)'} ===`)
      if (reel.hook) lines.push(`🪝 ${reel.hook}`)
      reelShots.forEach((s) => {
        lines.push(`\nR${ri + 1}-P${s.position + 1} · ${placeIcon(s.location)} ${s.location ?? ''}`)
        lines.push(`« ${s.text} »`)
        if (s.shot_note) lines.push(`🎥 ${s.shot_note}`)
      })
    })
    try {
      await Share.share({ message: lines.join('\n'), title: 'Brief monteur reels' })
    } catch {
      // user cancelled — ignore
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
        <View style={{ flex: 1 }} />
        {shots.length > 0 ? (
          <Pressable onPress={handleShare} hitSlop={8} style={{ padding: 4 }}>
            <Ionicons name="share-outline" size={24} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>

      <NavLarge
        title="Brief monteur"
        subtitle={
          shots.length === 0
            ? 'Aucune phrase tournée'
            : `${reels.length} reel${reels.length > 1 ? 's' : ''} · ${shots.length} phrase${shots.length > 1 ? 's' : ''} tournée${shots.length > 1 ? 's' : ''}`
        }
      />

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
          <Text style={{ ...t.body, color: colors.danger, textAlign: 'center' }}>{error}</Text>
        </View>
      ) : shots.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.sm }}>
          <Text style={{ fontSize: 48 }}>📭</Text>
          <Text style={{ ...t.bodyEmphasis, color: colors.textPrimary, textAlign: 'center' }}>
            Aucune phrase tournée
          </Text>
          <Text style={{ ...t.subheadline, color: colors.textSecondary, textAlign: 'center' }}>
            Le brief s'active dès qu'au moins une phrase est marquée « ✓ Tournée » sur le Jour J.
          </Text>
        </View>
      ) : (
        <>
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
            <Segmented
              items={[{ label: 'Chronologique' }, { label: 'Par reel' }]}
              activeIndex={view === 'chrono' ? 0 : 1}
              onChange={(i) => setView(i === 0 ? 'chrono' : 'reel')}
            />
          </View>
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              paddingBottom: 40,
              gap: spacing.md,
            }}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={fetch} tintColor={colors.primary} />}
          >
            {view === 'chrono'
              ? chrono.map((s) => (
                  <ChronoCard
                    key={s.id}
                    code={codeMap[s.id] ?? '—'}
                    shot={s}
                    reelTitle={(() => {
                      const r = reels.find((r) => r.id === s.social_post_id)
                      return r?.title || r?.hook || '—'
                    })()}
                  />
                ))
              : reels.map((reel, ri) => {
                  const reelShots = byReel[reel.id] ?? []
                  if (reelShots.length === 0) return null
                  return (
                    <View key={reel.id} style={{ gap: spacing.sm }}>
                      <View
                        style={{
                          backgroundColor: colors.bgSecondary,
                          borderRadius: radius.md,
                          padding: spacing.md,
                          borderLeftWidth: 3,
                          borderLeftColor: colors.primary,
                        }}
                      >
                        <Text style={{ ...t.bodyEmphasis, color: colors.textPrimary }}>
                          R{ri + 1} · {reel.title || reel.hook || '(sans titre)'}
                        </Text>
                        {reel.hook ? (
                          <Text style={{ ...t.subheadline, color: colors.textSecondary, marginTop: 4 }}>
                            🪝 {reel.hook}
                          </Text>
                        ) : null}
                      </View>
                      {reelShots.map((s) => (
                        <ChronoCard
                          key={s.id}
                          code={codeMap[s.id] ?? '—'}
                          shot={s}
                          reelTitle={null}
                        />
                      ))}
                    </View>
                  )
                })}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  )
}

function ChronoCard({
  code,
  shot,
  reelTitle,
}: {
  code: string
  shot: ReelShot
  reelTitle: string | null
}) {
  return (
    <View
      style={{
        backgroundColor: colors.bgSecondary,
        borderRadius: radius.md,
        padding: spacing.md,
        gap: 6,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text
          style={{
            ...t.caption2,
            color: colors.primary,
            fontWeight: '700',
            letterSpacing: 0.4,
          }}
        >
          {code}
        </Text>
        <Text style={{ ...t.caption2, color: colors.textTertiary }}>
          {fmtTime(shot.updated_at)}
        </Text>
        <View style={{ flex: 1 }} />
        <Text style={{ ...t.caption1, color: colors.textSecondary }}>
          {placeIcon(shot.location)} {shot.location ?? '—'}
        </Text>
      </View>
      {reelTitle ? (
        <Text style={{ ...t.caption1, color: colors.textTertiary }} numberOfLines={1}>
          {reelTitle}
        </Text>
      ) : null}
      <Text style={{ ...t.body, color: colors.textPrimary }}>« {shot.text} »</Text>
      {shot.shot_note ? (
        <View
          style={{
            marginTop: 4,
            backgroundColor: colors.warning + '15',
            borderWidth: 1,
            borderColor: colors.warning + '40',
            borderRadius: radius.sm,
            padding: 8,
          }}
        >
          <Text style={{ ...t.caption1, color: colors.warning }}>🎥 {shot.shot_note}</Text>
        </View>
      ) : null}
    </View>
  )
}
