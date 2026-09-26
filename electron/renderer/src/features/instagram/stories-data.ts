// Shared loading for the Stories pages: fresh media from the coach's own
// Instagram archive (main process, window.closrm.instagram.storyArchive —
// stored CDN links expire after a few days) + what ClosRM collected per
// story (GET /api/instagram/story-views).
import { useCallback, useEffect, useState } from 'react'
import type { ArchivedStory } from '../../lib/electron-bridge'

export type { ArchivedStory }

const FAILURE: Record<string, string> = {
  not_connected: 'Connectez votre session Instagram (page Audience) pour afficher vos stories.',
  rate_limited: 'Instagram limite temporairement les requêtes de votre compte. Réessayez dans quelques heures.',
  checkpoint: 'Instagram demande une vérification : ouvrez Instagram, validez, puis reconnectez la session.',
  error: 'Impossible de charger vos stories pour le moment.',
}

export function useStoryArchive() {
  const bridge = typeof window !== 'undefined' ? window.closrm?.instagram : undefined
  const [stories, setStories] = useState<ArchivedStory[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (force = false) => {
      if (!bridge) {
        setError("Les stories s'affichent dans l'app ClosRM Desktop.")
        return
      }
      setError(null)
      const res = await bridge.storyArchive(force)
      if (res.ok) setStories(res.stories)
      else setError(FAILURE[res.reason] ?? res.message)
    },
    [bridge],
  )

  useEffect(() => {
    load()
  }, [load])

  return { stories, error, reload: () => load(true) }
}
