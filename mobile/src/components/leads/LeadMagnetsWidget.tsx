import React, { useEffect, useState } from 'react'
import { View, Text, Pressable, ActivityIndicator } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { Ionicons } from '@expo/vector-icons'
import { api, API_BASE_URL } from '../../services/api'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'

type LeadMagnetPlatform = 'youtube' | 'tiktok' | 'instagram' | 'podcast' | 'blog' | 'pdf' | 'other'

interface LeadMagnet {
  id: string
  title: string
  platform: LeadMagnetPlatform
}

interface TrackedLinkInfo {
  short_code: string
  clicks_count: number
  last_clicked_at: string | null
  lead_magnet_id: string
  full_url?: string
}

const PLATFORM_ICON: Record<LeadMagnetPlatform, keyof typeof Ionicons.glyphMap> = {
  youtube: 'logo-youtube',
  tiktok: 'logo-tiktok',
  instagram: 'logo-instagram',
  podcast: 'headset',
  blog: 'document-text-outline',
  pdf: 'document-outline',
  other: 'link-outline',
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes}min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours}h`
  return `il y a ${Math.floor(hours / 24)}j`
}

export default function LeadMagnetsWidget({ leadId }: { leadId: string }) {
  const [magnets, setMagnets] = useState<LeadMagnet[]>([])
  const [tracks, setTracks] = useState<TrackedLinkInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [magnetsRes, clicksRes] = await Promise.all([
          api.get<{ lead_magnets: LeadMagnet[] }>('/api/lead-magnets'),
          api.get<{ tracked_links: TrackedLinkInfo[] }>(`/api/leads/${leadId}/clicks`),
        ])
        if (cancelled) return
        const lm = magnetsRes.lead_magnets ?? []
        const existing = clicksRes.tracked_links ?? []
        setMagnets(lm)

        const existingIds = new Set(existing.map((tk) => tk.lead_magnet_id))
        const missing = lm.filter((m) => !existingIds.has(m.id))
        const generated: TrackedLinkInfo[] = []
        for (const m of missing) {
          try {
            const res = await api.post<{ short_code: string; full_url: string }>(
              `/api/lead-magnets/${m.id}/track-for-lead`,
              { lead_id: leadId },
            )
            generated.push({
              short_code: res.short_code,
              full_url: res.full_url,
              clicks_count: 0,
              last_clicked_at: null,
              lead_magnet_id: m.id,
            })
          } catch {
            // skip
          }
        }

        if (!cancelled) {
          setTracks([...existing, ...generated])
          setLoading(false)
        }
      } catch {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [leadId])

  const handleCopy = async (magnetId: string) => {
    const track = tracks.find((tk) => tk.lead_magnet_id === magnetId)
    if (!track) return
    const url = track.full_url ?? `${API_BASE_URL}/c/${track.short_code}`
    await Clipboard.setStringAsync(url)
    setCopiedId(magnetId)
    setTimeout(() => setCopiedId(null), 1500)
  }

  if (loading) {
    return (
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg, alignItems: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  if (magnets.length === 0) return null

  const trackByMagnet = new Map(tracks.map((tk) => [tk.lead_magnet_id, tk]))

  return (
    <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
      <Text
        style={{
          ...t.footnote,
          color: colors.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: 8,
          fontSize: 12,
          fontWeight: '600',
        }}
      >
        Lead Magnets
      </Text>
      <View style={{ backgroundColor: colors.bgSecondary, borderRadius: radius.lg, overflow: 'hidden' }}>
        {magnets.map((m, idx) => {
          const tk = trackByMagnet.get(m.id)
          const label =
            tk && tk.clicks_count > 0
              ? `${tk.clicks_count} clic${tk.clicks_count > 1 ? 's' : ''}${
                  tk.last_clicked_at ? ` · dernier ${formatRelative(tk.last_clicked_at)}` : ''
                }`
              : tk
                ? 'lien généré, pas encore cliqué'
                : 'pas encore envoyé'
          const isCopied = copiedId === m.id
          return (
            <View
              key={m.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderBottomWidth: idx === magnets.length - 1 ? 0 : 0.33,
                borderBottomColor: colors.border,
              }}
            >
              <Ionicons name={PLATFORM_ICON[m.platform]} size={18} color={colors.textSecondary} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ ...t.body, color: colors.textPrimary }} numberOfLines={1}>
                  {m.title}
                </Text>
                <Text style={{ ...t.caption2, color: colors.textTertiary, marginTop: 2 }}>{label}</Text>
              </View>
              <Pressable onPress={() => void handleCopy(m.id)} hitSlop={8}>
                {({ pressed }) => (
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: radius.sm,
                      backgroundColor: isCopied ? '#22c55e22' : colors.primary + '22',
                      opacity: pressed ? 0.7 : 1,
                    }}
                  >
                    <Text
                      style={{
                        ...t.caption2,
                        fontWeight: '700',
                        color: isCopied ? '#22c55e' : colors.primary,
                      }}
                    >
                      {isCopied ? 'Copié !' : 'Copier'}
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>
          )
        })}
      </View>
    </View>
  )
}
