// Stories gallery (Audience page) — your stories, big, from your own Instagram archive
// (fresh media URLs), with what ClosRM collected on each (views, identified
// viewers). Click a story to open its page.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api-client'
import { formatNumber } from '../../design-system/StatCard'
import { Chips } from '../../design-system/Tabs'
import { LoadingState, EmptyState } from '../../design-system/States'
import { shortDate } from '../leads/status'
import { useStoryArchive, type ArchivedStory } from './stories-data'
import './stories.css'

interface CollectedStory {
  story_pk: string
  viewers_collected: number
  viewer_count: number | null
}

type Sort = 'recent' | 'views'

export function StoryCard({ story, rank, collected, onClick }: { story: ArchivedStory; rank?: number; collected?: number; onClick: () => void }) {
  const [broken, setBroken] = useState(false)
  return (
    <button type="button" className="story-card" onClick={onClick}>
      <div className="story-card-media">
        {story.imageUrl && !broken ? (
          <img src={story.imageUrl} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
        ) : (
          <div className="story-card-placeholder">Visuel indisponible</div>
        )}
        <span className="story-card-badge">
          {rank !== undefined && <b>{rank}</b>}
          {shortDate(story.takenAt)}
        </span>
        {story.mediaType === 'video' && <span className="story-card-play">▶</span>}
      </div>
      <div className="story-card-meta">
        <span className="ds-num">{story.viewerCount !== null ? `${formatNumber(story.viewerCount)} vues` : '—'}</span>
        {collected !== undefined && <span className="story-card-sub">{formatNumber(collected)} spectateurs identifiés</span>}
      </div>
    </button>
  )
}

/** Stories gallery (top 5 + all), used on the Audience page. */
export function StoriesGallery() {
  const navigate = useNavigate()
  const { stories, error, reload } = useStoryArchive()
  const [collected, setCollected] = useState<Map<string, CollectedStory>>(new Map())
  const [sort, setSort] = useState<Sort>('recent')

  useEffect(() => {
    api
      .get<{ data: { stories: CollectedStory[] } }>('/api/instagram/story-views?stories=100')
      .then((res) => setCollected(new Map(res.data.stories.map((s) => [s.story_pk, s]))))
      .catch(() => setCollected(new Map()))
  }, [])

  const sorted = useMemo(() => {
    const list = [...(stories ?? [])]
    if (sort === 'views') list.sort((a, b) => (b.viewerCount ?? 0) - (a.viewerCount ?? 0))
    return list
  }, [stories, sort])

  const top = useMemo(() => [...(stories ?? [])].sort((a, b) => (b.viewerCount ?? 0) - (a.viewerCount ?? 0)).slice(0, 5), [stories])

  function open(s: ArchivedStory) {
    navigate(`/instagram/stories/${s.pk}`, { state: { story: s } })
  }

  return (
    <section className="story-gallery">
      <div className="story-section-head">
        <div>
          <div className="story-section-title">
            Vos stories <span>depuis votre archive Instagram — cliquez une story pour voir ses spectateurs</span>
          </div>
        </div>
        <button type="button" className="ds-pill-button" onClick={reload}>
          Actualiser
        </button>
      </div>

      {stories === null && !error && <LoadingState label="Chargement de vos stories depuis Instagram…" />}
      {error && <EmptyState title="Stories indisponibles" description={error} />}
      {stories && stories.length === 0 && <EmptyState title="Aucune story dans votre archive récente" />}

      {stories && stories.length > 0 && (
        <>
          <div className="story-section-title">
            Votre top 5 <span>les plus vues</span>
          </div>
          <div className="story-row">
            {top.map((s, i) => (
              <StoryCard key={s.pk} story={s} rank={i + 1} collected={collected.get(s.pk)?.viewers_collected} onClick={() => open(s)} />
            ))}
          </div>

          <div className="story-section-head story-section-head--spaced">
            <div className="story-section-title">
              Toutes vos stories <span>{stories.length}</span>
            </div>
            <Chips
              items={[
                { key: 'recent' as Sort, label: 'Plus récentes' },
                { key: 'views' as Sort, label: 'Plus vues' },
              ]}
              active={sort}
              onChange={setSort}
            />
          </div>
          <div className="story-grid">
            {sorted.map((s) => (
              <StoryCard key={s.pk} story={s} collected={collected.get(s.pk)?.viewers_collected} onClick={() => open(s)} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
