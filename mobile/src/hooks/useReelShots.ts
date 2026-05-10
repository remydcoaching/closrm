import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'
import type { ReelShot, ShotInfo } from '../types/reel-shots'
import type { SocialPost } from '../types/social'

interface UseReelShotsResult {
  shots: ReelShot[]
  reels: Pick<SocialPost, 'id' | 'title'>[]
  byPlace: Record<string, ShotInfo[]>
  places: string[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  patchShot: (id: string, patch: Partial<Pick<ReelShot, 'done' | 'skipped' | 'location' | 'shot_note'>>) => Promise<void>
}

export function useReelShots(reelIds?: string[] | null): UseReelShotsResult {
  const [shots, setShots] = useState<ReelShot[]>([])
  const [reels, setReels] = useState<Pick<SocialPost, 'id' | 'title'>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reelIdsKey = reelIds ? reelIds.join(',') : ''

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // 1. Liste des reels (pour titre + filtrage)
      const reelsRes = await api.get<{ data: Pick<SocialPost, 'id' | 'title'>[] }>(
        '/api/social/posts?content_kind=reel&slim=true&per_page=100',
      )
      const allReels = reelsRes.data ?? []
      const filtered = reelIds && reelIds.length > 0
        ? allReels.filter((r) => reelIds.includes(r.id))
        : allReels
      setReels(filtered)

      // 2. Shots pour les reels visibles
      let url = '/api/reel-shots'
      if (filtered.length > 0) {
        url += `?social_post_ids=${filtered.map((r) => r.id).join(',')}`
      }
      const shotsRes = await api.get<{ data: ReelShot[] }>(url)
      setShots(shotsRes.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement reel-shots')
      setShots([])
      setReels([])
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reelIdsKey])

  useEffect(() => {
    void fetch()
  }, [fetch])

  // Optimistic update + persist via PATCH
  const patchShot = useCallback(
    async (id: string, patch: Partial<Pick<ReelShot, 'done' | 'skipped' | 'location' | 'shot_note'>>) => {
      setShots((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
      try {
        await api.patch(`/api/reel-shots/${id}`, patch)
      } catch {
        void fetch() // rollback via refetch si l'API a échoué
      }
    },
    [fetch],
  )

  // Groupage par lieu — uniquement les shots non terminés ET avec un lieu
  const byPlace = useMemo(() => {
    const r: Record<string, ShotInfo[]> = {}
    const byReel = new Map<string, ReelShot[]>()
    shots.forEach((s) => {
      if (!byReel.has(s.social_post_id)) byReel.set(s.social_post_id, [])
      byReel.get(s.social_post_id)!.push(s)
    })
    byReel.forEach((arr) => arr.sort((a, b) => a.position - b.position))

    shots.forEach((s) => {
      if (!s.text || s.done || !s.location) return
      const arr = byReel.get(s.social_post_id) ?? []
      const idx = arr.findIndex((x) => x.id === s.id)
      const reelTitle = reels.find((re) => re.id === s.social_post_id)?.title ?? '(sans titre)'
      if (!r[s.location]) r[s.location] = []
      r[s.location].push({
        id: s.id,
        reelId: s.social_post_id,
        reelTitle,
        text: s.text,
        shotNote: s.shot_note,
        position: idx + 1,
        total: arr.length,
        prevText: idx > 0 ? arr[idx - 1].text : null,
        nextText: idx < arr.length - 1 ? arr[idx + 1].text : null,
        skipped: s.skipped,
      })
    })
    return r
  }, [shots, reels])

  // Lieux ordonnés par nombre de shots actifs (le plus rempli en premier)
  const places = useMemo(
    () =>
      Object.keys(byPlace).sort((a, b) => {
        const aActive = byPlace[a].filter((s) => !s.skipped).length
        const bActive = byPlace[b].filter((s) => !s.skipped).length
        return bActive - aActive
      }),
    [byPlace],
  )

  return { shots, reels, byPlace, places, loading, error, refetch: fetch, patchShot }
}
