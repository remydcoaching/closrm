import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image,
  Linking,
  Dimensions,
} from 'react-native'
import { useVideoPlayer, VideoView } from 'expo-video'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import type { MoreStackParamList } from '../../navigation/types'
import { Button, NavLarge } from '../../components/ui'
import { api } from '../../services/api'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'
import {
  PLATFORM_ICONS,
  PLATFORM_LABELS,
  STATUS_LABELS,
  type SocialPostStatus,
  type SocialPostWithPublications,
} from '../../types/social'

type Nav = NativeStackNavigationProp<MoreStackParamList, 'SocialPostDetail'>
type Rt = RouteProp<MoreStackParamList, 'SocialPostDetail'>

const STATUS_TINT: Record<SocialPostStatus, string> = {
  draft: '#9ca3af',
  scheduled: '#3b82f6',
  publishing: '#f59e0b',
  published: '#22c55e',
  partial: '#f97316',
  failed: '#ef4444',
}

const formatDateTime = (iso: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })} · ${d.getHours().toString().padStart(2, '0')}h${d
    .getMinutes()
    .toString()
    .padStart(2, '0')}`
}

export function SocialPostDetailScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Rt>()
  const { postId } = route.params

  const [post, setPost] = useState<SocialPostWithPublications | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acting, setActing] = useState(false)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<{ data: SocialPostWithPublications }>(
        `/api/social/posts/${postId}`,
      )
      setPost(res.data ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement')
    } finally {
      setLoading(false)
    }
  }, [postId])

  useEffect(() => {
    void fetch()
  }, [fetch])

  const handleDelete = () => {
    Alert.alert('Supprimer ce post ?', 'Action irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          setActing(true)
          try {
            await api.delete(`/api/social/posts/${postId}`)
            navigation.goBack()
          } catch (e) {
            Alert.alert('Erreur', e instanceof Error ? e.message : 'Échec')
          } finally {
            setActing(false)
          }
        },
      },
    ])
  }

  const handleRetry = async () => {
    setActing(true)
    try {
      await api.post(`/api/social/posts/${postId}/retry`, {})
      await fetch()
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Échec')
    } finally {
      setActing(false)
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
      </View>

      <NavLarge title="Détail post" />

      {loading && !post ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
          <Text style={{ ...t.body, color: colors.danger, textAlign: 'center' }}>
            {error}
          </Text>
        </View>
      ) : post ? (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: 120,
            gap: spacing.lg,
          }}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={fetch} tintColor={colors.primary} />
          }
        >
          {/* Media preview — thumbnail / image / video poster avec play overlay */}
          <MediaPreview post={post} />

          {/* Status badge */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
            }}
          >
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: STATUS_TINT[post.status] + '22',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: STATUS_TINT[post.status],
                }}
              />
              <Text
                style={{
                  ...t.caption1,
                  color: STATUS_TINT[post.status],
                  fontWeight: '700',
                }}
              >
                {STATUS_LABELS[post.status]}
              </Text>
            </View>
          </View>

          {/* Title / hook */}
          {post.title || post.hook ? (
            <View>
              <Text
                style={{
                  ...t.caption2,
                  color: colors.textSecondary,
                  fontWeight: '700',
                  letterSpacing: 0.4,
                  marginBottom: 6,
                }}
              >
                TITRE
              </Text>
              <Text style={{ ...t.title3, color: colors.textPrimary }}>
                {post.title || post.hook}
              </Text>
            </View>
          ) : null}

          {/* Caption */}
          {post.caption ? (
            <View>
              <Text
                style={{
                  ...t.caption2,
                  color: colors.textSecondary,
                  fontWeight: '700',
                  letterSpacing: 0.4,
                  marginBottom: 6,
                }}
              >
                CAPTION
              </Text>
              <View
                style={{
                  backgroundColor: colors.bgSecondary,
                  borderRadius: radius.md,
                  padding: spacing.md,
                }}
              >
                <Text style={{ ...t.body, color: colors.textPrimary }}>
                  {post.caption}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Schedule info */}
          <View
            style={{
              backgroundColor: colors.bgSecondary,
              borderRadius: radius.md,
              padding: spacing.md,
              gap: spacing.sm,
            }}
          >
            <Row label="Programmé pour" value={formatDateTime(post.scheduled_at)} />
            {post.published_at ? (
              <Row label="Publié à" value={formatDateTime(post.published_at)} />
            ) : null}
            {post.plan_date ? (
              <Row label="Plan date" value={post.plan_date} />
            ) : null}
          </View>

          {/* Publications */}
          {post.publications.length > 0 ? (
            <View>
              <Text
                style={{
                  ...t.caption2,
                  color: colors.textSecondary,
                  fontWeight: '700',
                  letterSpacing: 0.4,
                  marginBottom: 6,
                }}
              >
                PLATEFORMES
              </Text>
              <View
                style={{
                  backgroundColor: colors.bgSecondary,
                  borderRadius: radius.md,
                  overflow: 'hidden',
                }}
              >
                {post.publications.map((pub, idx) => (
                  <View
                    key={pub.id}
                    style={{
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.md,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                      borderBottomWidth: idx < post.publications.length - 1 ? 0.33 : 0,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <Ionicons
                      name={PLATFORM_ICONS[pub.platform]}
                      size={20}
                      color={colors.textPrimary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...t.body, color: colors.textPrimary }}>
                        {PLATFORM_LABELS[pub.platform]}
                      </Text>
                      {pub.error_message ? (
                        <Text
                          numberOfLines={2}
                          style={{ ...t.caption2, color: colors.danger, marginTop: 2 }}
                        >
                          {pub.error_message}
                        </Text>
                      ) : null}
                    </View>
                    <Text
                      style={{
                        ...t.caption1,
                        color:
                          pub.status === 'published'
                            ? colors.primary
                            : pub.status === 'failed'
                            ? colors.danger
                            : colors.textSecondary,
                        fontWeight: '600',
                      }}
                    >
                      {pub.status}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Actions */}
          <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
            {post.status === 'failed' || post.status === 'partial' ? (
              <Button
                label="Réessayer la publication"
                fullWidth
                size="md"
                onPress={handleRetry}
                loading={acting}
                disabled={acting}
              />
            ) : null}
            <Button
              label="Supprimer"
              variant="danger"
              fullWidth
              size="md"
              onPress={handleDelete}
              disabled={acting}
            />
          </View>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ ...t.subheadline, color: colors.textSecondary }}>{label}</Text>
      <Text style={{ ...t.subheadline, color: colors.textPrimary, fontWeight: '600' }}>
        {value}
      </Text>
    </View>
  )
}

const SCREEN_W = Dimensions.get('window').width

const isHttp = (s: string | null | undefined): s is string =>
  !!s && (s.startsWith('http://') || s.startsWith('https://'))

const isR2Path = (s: string | null | undefined): s is string =>
  !!s && s.startsWith('workspaces/')

const isVideoLike = (post: SocialPostWithPublications): boolean => {
  const mt = post.media_type
  if (mt === 'VIDEO' || mt === 'SHORT' || mt === 'LONG_VIDEO') return true
  if (post.content_kind === 'reel') return true
  return false
}

// Détecte un final_url "playable inline" : direct MP4/MOV/WebM. YouTube,
// Vimeo, Drive ne le sont pas — ils sont opens en Safari.
const isDirectVideoUrl = (s: string | null | undefined): boolean => {
  if (!s) return false
  const lower = s.toLowerCase().split('?')[0]
  return lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm') || lower.endsWith('.m4v')
}

const isExternalPlayer = (s: string | null | undefined): boolean => {
  if (!s) return false
  return /youtube\.com|youtu\.be|vimeo\.com|drive\.google\.com/.test(s)
}

function MediaPreview({ post }: { post: SocialPostWithPublications }) {
  const [failed, setFailed] = useState(false)
  const [resolvedImg, setResolvedImg] = useState<string | null>(null)
  const [resolvedVideo, setResolvedVideo] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)

  const isVideo = isVideoLike(post)

  // Sources brutes :
  // - imgSrc = poster pour la preview (thumbnail_url > 1er media_url si pas vidéo)
  // - videoSrc = la vidéo elle-même (1er media_url si vidéo OU final_url si direct
  //   MP4/MOV)
  const rawImgSource = post.thumbnail_url || (!isVideo ? post.media_urls[0] : null) || null
  const rawVideoSource = isVideo
    ? post.media_urls.find((u) => isHttp(u) || isR2Path(u)) ||
      (isDirectVideoUrl(post.final_url) ? post.final_url : null)
    : null

  // Résolution async des paths R2 → URL signées via /api/storage/sign
  useEffect(() => {
    let cancelled = false
    setResolvedImg(null)
    setResolvedVideo(null)
    setFailed(false)

    const resolve = async (src: string | null): Promise<string | null> => {
      if (!src) return null
      if (isHttp(src)) return src
      if (isR2Path(src)) {
        const res = await api.get<{ url: string }>(
          `/api/storage/sign?path=${encodeURIComponent(src)}`,
        )
        return res.url
      }
      return null
    }

    if (!rawImgSource && !rawVideoSource) return

    setResolving(true)
    ;(async () => {
      try {
        const [img, vid] = await Promise.all([
          resolve(rawImgSource),
          resolve(rawVideoSource),
        ])
        if (cancelled) return
        setResolvedImg(img)
        setResolvedVideo(vid)
      } catch {
        if (!cancelled) setFailed(true)
      } finally {
        if (!cancelled) setResolving(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [rawImgSource, rawVideoSource])

  const externalUrl =
    isExternalPlayer(post.final_url) ? post.final_url : null

  const hasNothing = !rawImgSource && !rawVideoSource && !externalUrl

  if (hasNothing) {
    return (
      <View
        style={{
          height: 180,
          borderRadius: radius.lg,
          backgroundColor: colors.bgSecondary,
          borderWidth: 1,
          borderColor: colors.border,
          borderStyle: 'dashed',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <Ionicons name="image-outline" size={32} color={colors.textTertiary} />
        <Text style={{ ...t.caption1, color: colors.textTertiary }}>
          Aucun média
        </Text>
      </View>
    )
  }

  const previewW = SCREEN_W - 2 * spacing.lg
  // Aspect ratio adaptatif selon le format réel du contenu :
  // - reel / SHORT → 9:16 portrait (Instagram Reels, TikTok, YT Shorts)
  // - LONG_VIDEO → 16:9 landscape (YouTube long format)
  // - CAROUSEL → 4:5 (format Instagram natif portrait)
  // - sinon (IMAGE, VIDEO générique) → 1:1
  const previewH = (() => {
    const isShort =
      post.content_kind === 'reel' ||
      post.media_type === 'SHORT' ||
      post.media_type === 'VIDEO' // par défaut format vertical pour social
    if (isShort) return Math.min(Math.round(previewW * 16 / 9), Math.round(SCREEN_W * 1.4))
    if (post.media_type === 'LONG_VIDEO') return Math.round(previewW * 9 / 16)
    if (post.media_type === 'CAROUSEL') return Math.round(previewW * 5 / 4)
    return previewW // 1:1
  })()

  // Décide du mode de rendu :
  // - INLINE_VIDEO : on a une URL vidéo directe (R2 signée OU MP4 direct)
  //   → VideoView natif iOS avec play/scrub/fullscreen
  // - EXTERNAL : YouTube/Vimeo/Drive → tap ouvre Safari (rien à faire d'autre,
  //   ces players ne marchent que dans leur webview maison)
  // - IMAGE : poster ou photo classique
  const renderMode: 'inline-video' | 'external' | 'image' | 'placeholder' = (() => {
    if (resolvedVideo) return 'inline-video'
    if (isVideo && externalUrl) return 'external'
    if (resolvedImg) return 'image'
    return 'placeholder'
  })()

  return (
    <View
      style={{
        width: '100%',
        height: previewH,
        borderRadius: radius.lg,
        overflow: 'hidden',
        backgroundColor: '#000',
      }}
    >
      {renderMode === 'inline-video' && resolvedVideo ? (
        <InlineVideo uri={resolvedVideo} />
      ) : renderMode === 'image' && resolvedImg ? (
        <Pressable
          onPress={() => Linking.openURL(resolvedImg)}
          style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.85 : 1 })}
        >
          <Image
            source={{ uri: resolvedImg }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            onError={() => setFailed(true)}
          />
        </Pressable>
      ) : renderMode === 'external' && externalUrl ? (
        <Pressable
          onPress={() => Linking.openURL(externalUrl)}
          style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.85 : 1 })}
        >
          {resolvedImg ? (
            <Image
              source={{ uri: resolvedImg }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          ) : (
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.bgSecondary,
              }}
            />
          )}
          {/* Play overlay — externe uniquement */}
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            pointerEvents="none"
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: 'rgba(0,0,0,0.55)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="play" size={28} color="#fff" style={{ marginLeft: 3 }} />
            </View>
          </View>
        </Pressable>
      ) : resolving ? (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.bgSecondary,
          }}
        >
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.bgSecondary,
            gap: 8,
          }}
        >
          <Ionicons
            name={isVideo ? 'videocam-outline' : 'image-outline'}
            size={36}
            color={colors.textTertiary}
          />
          <Text style={{ ...t.caption1, color: colors.textTertiary, paddingHorizontal: 16, textAlign: 'center' }}>
            {failed ? 'Impossible de charger le média' : 'Aperçu indisponible'}
          </Text>
        </View>
      )}

        {/* Badge type média en haut-droite */}
        {post.media_type ? (
          <View
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 6,
              backgroundColor: 'rgba(0,0,0,0.65)',
            }}
          >
            <Text
              style={{
                ...t.caption2,
                color: '#fff',
                fontWeight: '700',
                letterSpacing: 0.4,
              }}
            >
              {post.media_type}
            </Text>
          </View>
        ) : null}

        {/* Compteur si carrousel */}
        {post.media_urls.length > 1 ? (
          <View
            style={{
              position: 'absolute',
              top: 10,
              left: 10,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 6,
              backgroundColor: 'rgba(0,0,0,0.65)',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Ionicons name="copy-outline" size={11} color="#fff" />
            <Text style={{ ...t.caption2, color: '#fff', fontWeight: '700' }}>
              {post.media_urls.length}
            </Text>
          </View>
        ) : null}
    </View>
  )
}

// Lecteur vidéo inline natif iOS — controls Apple standard, fullscreen,
// scrub, mute. Pas d'autoplay (poids data + dérangeant en liste).
function InlineVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false
    p.muted = false
  })
  return (
    <VideoView
      player={player}
      style={{ width: '100%', height: '100%' }}
      // contain : pas de crop, letterbox si l'aspect du conteneur diffère
      // de la vidéo réelle. Mieux pour vidéo qu'un cover qui zoomerait
      // dans le centre et coupe le haut/bas (ou les côtés).
      contentFit="contain"
      allowsFullscreen
      allowsPictureInPicture
      nativeControls
    />
  )
}
