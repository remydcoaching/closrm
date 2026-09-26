// "Vos stories à la une" (reference: Insyder Audience) — top 5 across all
// collections, the collections as circles, and the top 5 of the selected
// one. Media and collections come from the coach's own Instagram session
// (main process, cached 6 h, few spaced requests); identified viewers come
// from what ClosRM collected while each story was live (Instagram only
// lists viewers for ~48 h after posting — older highlights show counts only).
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api-client'
import { useStoryCollector } from '../../lib/story-collector'
import { LoadingState, EmptyState } from '../../design-system/States'
import type { ArchivedStory, HighlightCollection } from '../../lib/electron-bridge'
import { StoryCard } from './StoriesPage'
import './stories.css'

const FAILURE: Record<string, string> = {
  not_connected: 'Connectez votre session Instagram pour afficher vos stories à la une.',
  rate_limited: 'Instagram limite temporairement les requêtes de votre compte — réessayez plus tard.',
  checkpoint: 'Instagram demande une vérification : ouvrez Instagram, validez, puis reconnectez la session.',
  error: 'Stories à la une indisponibles pour le moment.',
}

const rankValue = (s: ArchivedStory) => s.likeCount ?? s.viewerCount ?? 0

export function HighlightsSection() {
  const navigate = useNavigate()
  const bridge = typeof window !== 'undefined' ? window.closrm?.instagram : undefined
  const [collections, setCollections] = useState<HighlightCollection[] | null>(null)
  const [items, setItems] = useState<Record<string, ArchivedStory[]>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [collected, setCollected] = useState<Map<string, number>>(new Map())
  const { status } = useStoryCollector()
  const connected = !!status?.connected

  // Re-run when the session connects (e.g. right after "Connecter ma session").
  useEffect(() => {
    if (!bridge || !connected) return
    let cancelled = false
    setError(null)
    ;(async () => {
      const tray = await bridge.highlights()
      if (cancelled) return
      if (!tray.ok) {
        setError(FAILURE[tray.reason] ?? tray.message)
        return
      }
      setCollections(tray.collections)
      if (tray.collections.length === 0) return
      setSelected(tray.collections[0].id)
      // First the selected collection, then the rest in the background
      // (main paces the requests and caches them).
      const first = await bridge.highlightItems([tray.collections[0].id])
      if (cancelled) return
      if (first.ok) setItems((prev) => ({ ...prev, ...first.items }))
      const rest = await bridge.highlightItems(tray.collections.slice(1).map((c) => c.id))
      if (!cancelled && rest.ok) setItems((prev) => ({ ...prev, ...rest.items }))
    })()
    return () => {
      cancelled = true
    }
  }, [bridge, connected])

  useEffect(() => {
    api
      .get<{ data: { stories: { story_pk: string; viewers_collected: number }[] } }>('/api/instagram/story-views?stories=100')
      .then((res) => setCollected(new Map(res.data.stories.map((s) => [s.story_pk, s.viewers_collected]))))
      .catch(() => setCollected(new Map()))
  }, [])

  const titleOf = useMemo(() => new Map((collections ?? []).map((c) => [c.id, c.title])), [collections])
  const collectionOf = useMemo(() => {
    const m = new Map<string, string>()
    for (const [id, list] of Object.entries(items)) for (const st of list) if (!m.has(st.pk)) m.set(st.pk, id)
    return m
  }, [items])

  const topAll = useMemo(() => {
    const seen = new Map<string, ArchivedStory>()
    for (const list of Object.values(items)) for (const st of list) if (!seen.has(st.pk)) seen.set(st.pk, st)
    return [...seen.values()].sort((a, b) => rankValue(b) - rankValue(a)).slice(0, 5)
  }, [items])

  const selectedItems = selected ? items[selected] : undefined
  const topSelected = useMemo(() => [...(selectedItems ?? [])].sort((a, b) => rankValue(b) - rankValue(a)).slice(0, 5), [selectedItems])

  function open(st: ArchivedStory) {
    navigate(`/instagram/stories/${st.pk}`, { state: { story: st } })
  }

  if (!bridge) return null

  return (
    <section className="story-gallery">
      <div className="story-section-title">
        Vos stories à la une <span>rangées par les personnes qui les ont aimées ou vues</span>
      </div>

      {!connected && <EmptyState title="Session Instagram non connectée" description={FAILURE.not_connected} />}
      {connected && error && <EmptyState title="Stories à la une indisponibles" description={error} />}
      {connected && !error && collections === null && <LoadingState label="Chargement de vos stories à la une…" />}
      {collections && collections.length === 0 && <EmptyState title="Aucune story à la une sur votre profil" />}

      {collections && collections.length > 0 && (
        <>
          <div className="story-section-title story-section-title--sub">
            Votre top 5 à la une <span>toutes collections confondues{Object.keys(items).length < collections.length ? ' (chargement…)' : ''}</span>
          </div>
          {topAll.length === 0 ? (
            <LoadingState label="Chargement des stories…" />
          ) : (
            <div className="story-row">
              {topAll.map((st, i) => (
                <StoryCard
                  key={st.pk}
                  story={st}
                  rank={i + 1}
                  subtitle={collectionOf.get(st.pk) ? `dans ${titleOf.get(collectionOf.get(st.pk) as string)}` : undefined}
                  collected={collected.get(st.pk)}
                  onClick={() => open(st)}
                />
              ))}
            </div>
          )}

          <div className="story-section-title story-section-title--sub">
            Vos collections <span>{collections.length}</span>
          </div>
          <div className="highlight-tray">
            {collections.map((c) => (
              <button key={c.id} type="button" className={`highlight-bubble ${selected === c.id ? 'highlight-bubble--active' : ''}`} onClick={() => setSelected(c.id)}>
                <span className="highlight-bubble-img">{c.coverUrl ? <img src={c.coverUrl} alt="" referrerPolicy="no-referrer" /> : null}</span>
                <span className="highlight-bubble-title">{c.title || 'Sans titre'}</span>
              </button>
            ))}
          </div>

          {selected && (
            <>
              <div className="story-section-title story-section-title--sub">
                Top 5 de « {titleOf.get(selected) || 'Sans titre'} » <span>{selectedItems ? `${selectedItems.length} stories dans la collection` : 'chargement…'}</span>
              </div>
              {!selectedItems ? (
                <LoadingState label="Chargement de la collection…" />
              ) : (
                <div className="story-row">
                  {topSelected.map((st, i) => (
                    <StoryCard key={st.pk} story={st} rank={i + 1} collected={collected.get(st.pk)} onClick={() => open(st)} />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  )
}
