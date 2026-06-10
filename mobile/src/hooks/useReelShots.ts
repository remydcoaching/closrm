import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'
import type { ReelShot, ShotInfo } from '../types/reel-shots'
import type { SocialPost } from '../types/social'

interface UseReelShotsResult {
  shots: ReelShot[]
  reels: Pick<SocialPost, 'id' | 'title' | 'hook'>[]
  byPlace: Record<string, ShotInfo[]>
  places: string[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  patchShot: (id: string, patch: Partial<Pick<ReelShot, 'done' | 'skipped' | 'location' | 'shot_note'>>) => Promise<void>
}

export function useReelShots(reelIds?: string[] | null): UseReelShotsResult {
  const [shots, setShots] = useState<ReelShot[]>([])
  const [reels, setReels] = useState<Pick<SocialPost, 'id' | 'title' | 'hook'>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reelIdsKey = reelIds ? reelIds.join(',') : ''

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // 1. Liste des reels : quand on a une liste d'IDs (session de tournage),
      // on fetch par IDs pour éviter la pagination + le filtre `content_kind=reel`
      // qui rate des reels au-delà des 100 premiers ou avec un content_kind différent.
      const url = reelIds && reelIds.length > 0
        ? `/api/social/posts?ids=${reelIds.join(',')}&slim=true&per_page=500`
        : '/api/social/posts?content_kind=reel&slim=true&per_page=100'
      const reelsRes = await api.get<{ data: Pick<SocialPost, 'id' | 'title' | 'hook'>[] }>(url)
      const fetchedReels = reelsRes.data ?? []
      setReels(fetchedReels)

      // 2. Shots pour les reels visibles. Si la liste est vide, on n'envoie PAS
      // de filtre social_post_ids : sans paramètre l'API renvoie tous les shots
      // du workspace, ce qu'on ne veut surtout pas quand une session est ciblée.
      if (fetchedReels.length === 0) {
        setShots([])
      } else {
        const shotsUrl = `/api/reel-shots?social_post_ids=${fetchedReels.map((r) => r.id).join(',')}`
        const shotsRes = await api.get<{ data: ReelShot[] }>(shotsUrl)
        setShots(shotsRes.data ?? [])
      }
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

  // Groupage par lieu — on garde les shots `done` dans la liste pour que
  // marquer une phrase ne fasse pas disparaître le lieu (et donc sauter
  // brutalement vers un autre lieu pendant le tournage). Le `done` est
  // exposé via ShotInfo et l'écran affiche la phrase barrée + un bouton
  // "Annuler" à la place de "Tournée".
  const byPlace = useMemo(() => {
    const r: Record<string, ShotInfo[]> = {}
    const byReel = new Map<string, ReelShot[]>()
    shots.forEach((s) => {
      if (!byReel.has(s.social_post_id)) byReel.set(s.social_post_id, [])
      byReel.get(s.social_post_id)!.push(s)
    })
    byReel.forEach((arr) => arr.sort((a, b) => a.position - b.position))

    shots.forEach((s) => {
      if (!s.text || !s.location) return
      const arr = byReel.get(s.social_post_id) ?? []
      const idx = arr.findIndex((x) => x.id === s.id)
      const reel = reels.find((re) => re.id === s.social_post_id)
      const reelTitle = reel?.title || reel?.hook || '(sans titre)'
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
        done: s.done,
      })
    })
    return r
  }, [shots, reels])

  // Lieux ordonnés par nombre TOTAL de shots (stable : le tri ne change pas
  // quand on marque des phrases done, sinon le lieu courant pourrait sauter
  // de position en pleine session de tournage). Tiebreak: nom du lieu pour
  // un ordre alphabétique déterministe.
  const places = useMemo(
    () =>
      Object.keys(byPlace).sort((a, b) => {
        const diff = byPlace[b].length - byPlace[a].length
        if (diff !== 0) return diff
        return a.localeCompare(b)
      }),
    [byPlace],
  )

  return { shots, reels, byPlace, places, loading, error, refetch: fetch, patchShot }
}
