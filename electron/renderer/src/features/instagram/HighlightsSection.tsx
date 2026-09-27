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
import { StoryCard, StoryCarousel } from './StoriesPage'
import { effectiveState, finalStoryPks, storyViewerNote, viewersOfStories, type HighlightViewersReport, type KnownStory, type StoryViewerState } from './story-scan'
import { TableCard, ContactCell } from '../../design-system/TableCard'
import { Avatar } from '../../design-system/Avatar'
import { shortDate } from '../leads/status'
import { invalidate } from '../../lib/query-cache'
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

  // Once the collections' stories are known: tag the stored stories with
  // their collection, then read who ClosRM saw viewing each of them.
  const [report, setReport] = useState<HighlightViewersReport | null>(null)
  const [reportVersion, setReportVersion] = useState(0)
  const allPks = useMemo(() => [...new Set(Object.values(items).flatMap((list) => list.map((st) => st.pk)))].sort(), [items])
  const allPksKey = allPks.join(',')
  useEffect(() => {
    if (!collections || allPks.length === 0) return
    let cancelled = false
    const tags = Object.entries(items).flatMap(([id, list]) => list.map((st) => ({ pk: st.pk, highlightId: id, highlightTitle: collections.find((c) => c.id === id)?.title ?? null })))
    ;(async () => {
      await api.post('/api/instagram/story-views/highlights', { items: tags }).catch(() => null)
      const res = await api
        .get<{ data: HighlightViewersReport }>(`/api/instagram/story-views/highlights?pks=${allPksKey}`)
        .catch(() => null)
      if (!cancelled) setReport(res?.data ?? { stories: [], viewers: [] })
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPksKey, collections, reportVersion])

  const stateOf = useMemo(() => new Map((report?.stories ?? []).map((st) => [st.pk, st])), [report])
  const noteOf = (st: ArchivedStory): string | undefined => {
    if (!report) return undefined
    const r = stateOf.get(st.pk)
    return storyViewerNote(effectiveState(r?.state, st.takenAt), r?.viewersCollected ?? null)
  }
  const countStates = (list: ArchivedStory[]) => {
    const c: Record<StoryViewerState, number> = { collected: 0, out_of_window: 0, error: 0, unknown: 0 }
    for (const st of list) c[effectiveState(stateOf.get(st.pk)?.state, st.takenAt)] += 1
    return c
  }

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

  // ─── Nominative viewers of highlight stories ───
  const [scanning, setScanning] = useState(false)
  const [scanReport, setScanReport] = useState<string | null>(null)

  async function scanViewers() {
    if (!bridge) return
    setScanning(true)
    setScanReport(null)
    try {
      const known = await api.get<{ data: KnownStory[] }>('/api/instagram/story-views?known=1').catch(() => ({ data: [] as KnownStory[] }))
      const res = await bridge.collectHighlightViewers(finalStoryPks(known.data))
      if (!res.ok) {
        setScanReport(FAILURE[res.reason] ?? res.message)
        return
      }
      if (res.stories.length === 0) {
        setScanReport(
          res.tooOld > 0 || res.skipped > 0
            ? `Aucune story à la une n'est dans sa fenêtre de 48 h : Instagram ne fournit plus leurs spectateurs (il renvoie une liste vide, même à vous). Les spectateurs de vos prochaines stories sont collectés automatiquement pendant 48 h et restent attachés à la story quand vous la mettez à la une.`
            : 'Aucune story à la une accessible.',
        )
        return
      }
      const saved = await api.post<{ data: { stories: number; storiesUnreadable: number; viewers: number; leadsMatched: number; errors: string[] } }>(
        '/api/instagram/story-views',
        {
          accountUsername: res.accountUsername,
          stories: res.stories.map((st) => ({
            pk: st.pk,
            takenAt: st.takenAt,
            mediaType: st.mediaType,
            thumbnailUrl: st.thumbnailUrl,
            viewerCount: st.viewerCount,
            likeCount: st.likeCount,
            highlightId: st.highlightId,
            highlightTitle: st.highlightTitle,
            status: st.status,
            error: st.error,
            viewers: st.viewers,
          })),
        },
      )
      const d = saved.data
      const withViewers = res.stories.filter((st) => st.status === 'ok' && st.viewers.length > 0).length
      const readableEmpty = res.stories.filter((st) => st.status === 'ok' && st.viewers.length === 0).length
      setScanReport(
        [
          `${res.stories.length} stories à la une lues`,
          `${withViewers} avec des spectateurs (${d.viewers} vues, ${d.leadsMatched} leads reconnus)`,
          readableEmpty > 0 ? `${readableEmpty} sans spectateur visible (Instagram ne les liste que 48 h après publication)` : null,
          d.storiesUnreadable > 0 ? `${d.storiesUnreadable} illisibles (erreur Instagram, réessayées au prochain scan)` : null,
          res.tooOld > 0 ? `${res.tooOld} de plus de 48 h : spectateurs plus fournis par Instagram` : null,
          res.stoppedEarly ? `arrêt anticipé : ${FAILURE[res.stoppedEarly] ?? res.stoppedEarly}` : null,
          d.errors.length > 0 ? `enregistrement partiel : ${d.errors[0]}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
      )
      invalidate((k) => k.startsWith('/api/instagram/story-views') || k.startsWith('/api/desktop/leads/'))
      setReportVersion((v) => v + 1)
    } catch (err) {
      setScanReport(err instanceof Error ? err.message : 'Récupération impossible')
    } finally {
      setScanning(false)
    }
  }

  function open(st: ArchivedStory) {
    navigate(`/instagram/stories/${st.pk}`, { state: { story: st } })
  }

  if (!bridge) return null

  return (
    <section className="story-gallery">
      <div className="story-section-head">
        <div className="story-section-title">
          Vos stories à la une <span>rangées par les personnes qui les ont aimées ou vues</span>
        </div>
        {connected && (
          <button type="button" className="ds-pill-button ds-pill-button--dark" onClick={scanViewers} disabled={scanning}>
            {scanning ? 'Récupération des spectateurs…' : 'Récupérer les spectateurs'}
          </button>
        )}
      </div>
      {scanReport && <p className="ds-muted story-scan-report">{scanReport}</p>}

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
                  viewerNote={noteOf(st)}
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
                « {titleOf.get(selected) || 'Sans titre'} » <span>{selectedItems ? `${selectedItems.length} stories — cliquez une story pour voir ses spectateurs` : 'chargement…'}</span>
              </div>
              {!selectedItems ? (
                <LoadingState label="Chargement de la collection…" />
              ) : (
                <>
                  {report && <CollectionSummary counts={countStates(selectedItems)} />}
                  <StoryCarousel>
                    {[...selectedItems]
                      .sort((a, b) => b.takenAt.localeCompare(a.takenAt))
                      .map((st) => (
                        <StoryCard key={st.pk} story={st} viewerNote={noteOf(st)} onClick={() => open(st)} />
                      ))}
                  </StoryCarousel>
                  <CollectionViewers
                    title={titleOf.get(selected) || 'Sans titre'}
                    viewers={report ? viewersOfStories(report.viewers, selectedItems.map((st) => st.pk)) : null}
                    storyCount={selectedItems.length}
                    onOpenLead={(id) => navigate(`/leads/${id}`)}
                  />
                </>
              )}
            </>
          )}
        </>
      )}
    </section>
  )
}

function CollectionSummary({ counts }: { counts: Record<StoryViewerState, number> }) {
  const parts = [
    counts.collected > 0 ? `${counts.collected} avec spectateurs collectés` : null,
    counts.out_of_window > 0
      ? `${counts.out_of_window} publiée${counts.out_of_window > 1 ? 's' : ''} avant la collecte : Instagram ne donne les spectateurs que pendant 48 h, il ne les fournit plus (même dans l'app Instagram)`
      : null,
    counts.error > 0 ? `${counts.error} illisible${counts.error > 1 ? 's' : ''} (réessayée${counts.error > 1 ? 's' : ''} au prochain scan)` : null,
    counts.unknown > 0 ? `${counts.unknown} en attente de collecte` : null,
  ].filter(Boolean)
  return <p className="ds-muted story-scan-report">{parts.join(' · ')}</p>
}

type CollectionViewer = ReturnType<typeof viewersOfStories>[number]

function CollectionViewers({
  title,
  viewers,
  storyCount,
  onOpenLead,
}: {
  title: string
  viewers: CollectionViewer[] | null
  storyCount: number
  onOpenLead: (leadId: string) => void
}) {
  return (
    <TableCard title={`Spectateurs de « ${title} »`} subtitle={viewers ? `${viewers.length} personne${viewers.length > 1 ? 's' : ''} identifiée${viewers.length > 1 ? 's' : ''}` : undefined}>
      {viewers === null && <LoadingState label="Chargement des spectateurs…" />}
      {viewers && viewers.length === 0 && (
        <EmptyState
          title="Aucun spectateur identifié pour cette collection"
          description="Instagram ne liste les spectateurs d'une story que pendant les 48 h qui suivent sa publication. Les stories publiées depuis que ClosRM Desktop est ouvert sont collectées automatiquement, et leurs spectateurs apparaîtront ici quand vous les mettrez à la une."
        />
      )}
      {viewers && viewers.length > 0 && (
        <table className="ds-table">
          <thead>
            <tr>
              <th>Contact</th>
              <th className="ds-num-cell">Stories vues</th>
              <th className="ds-num-cell">♥</th>
              <th>Lead</th>
              <th className="ds-num-cell">Dernière observation</th>
            </tr>
          </thead>
          <tbody>
            {viewers.map((v) => {
              const name = v.leadName || v.fullName || v.username
              return (
                <tr key={v.instagramUserId} className={v.leadId ? 'ds-row-clickable' : undefined} onClick={() => v.leadId && onOpenLead(v.leadId)}>
                  <td>
                    <ContactCell name={name} handle={v.username} avatar={<Avatar name={name} size={28} src={v.profilePicUrl} />} />
                  </td>
                  <td className="ds-num-cell">
                    <span className="ds-num">
                      {v.storiesSeen} sur {storyCount}
                    </span>
                  </td>
                  <td className="ds-num-cell">
                    <span className="ds-num">{v.liked > 0 ? v.liked : '—'}</span>
                  </td>
                  <td>{v.leadId ? 'Oui' : <span className="ds-muted">Pas encore</span>}</td>
                  <td className="ds-num-cell">
                    <span className="ds-num">{shortDate(v.lastObservedAt)}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </TableCard>
  )
}
