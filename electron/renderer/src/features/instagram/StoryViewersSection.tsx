// "Lurkers acheteurs sur vos N dernières stories" — viewers of the coach's
// own stories collected from their Instagram session (lib/story-collector),
// read back from GET /api/instagram/story-views. Assiduité = stories watched
// out of the last N collected.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../../lib/api-client'
import { useStoryCollector } from '../../lib/story-collector'
import { useInstagramAccount } from '../../lib/instagram-account'
import { formatNumber } from '../../design-system/StatCard'
import { TableCard, ContactCell } from '../../design-system/TableCard'
import { Chips } from '../../design-system/Tabs'
import { Avatar } from '../../design-system/Avatar'
import { StatusPill } from '../../design-system/StatusPill'
import { LoadingState, EmptyState } from '../../design-system/States'
import { relativeTime, shortDate, statusEntry } from '../leads/status'
import type { LeadStatus } from '../leads/types'
import './instagram.css'
import { usePaged, PaginationBar } from '../../design-system/Pagination'
import { useCachedQuery } from '../../lib/use-cached-query'

export interface StoryViewerSummary {
  userId: string
  username: string
  fullName: string | null
  profilePicUrl: string | null
  isVerified: boolean | null
  views: number
  lastViewedAt: string
  followsTarget: boolean | null
  lead: { id: string; status: LeadStatus; name: string } | null
  contacted: boolean
}

export interface StoryLurkersResponse {
  totalStories: number
  lurkers: number
  viewers: StoryViewerSummary[]
}

type Window = '10' | '30'
type Filter = 'lurkers' | 'all' | 'leads' | 'not_leads'

export function useStoryLurkers(stories: number, refreshKey: unknown) {
  const key = `/api/instagram/story-views?stories=${stories}`
  const q = useCachedQuery<{ data: StoryLurkersResponse }>(key, { screen: 'StoryLurkers', staleMs: 60_000 })
  // A finished collection brings new viewers: refresh.
  useEffect(() => {
    if (refreshKey) void q.refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])
  return { data: q.data?.data ?? null, error: q.error }
}

function formatDelay(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m}` : `${h} h`
}

export function StorySessionPanel() {
  const { available, status, collecting, lastRun, pausedUntil, connect, disconnect, collectNow } = useStoryCollector()
  const { account } = useInstagramAccount()
  if (!available) return null
  const paused = pausedUntil && pausedUntil > Date.now()

  return (
    <div className="ig-story-session">
      {!status?.connected ? (
        <>
          <div>
            <strong>Connectez votre session Instagram</strong>
            <p>
              Pour savoir qui regarde vos stories, ClosRM lit la liste des viewers depuis votre propre compte, comme vous le feriez dans l&apos;app
              Instagram. Vous vous connectez vous-même dans une fenêtre dédiée : votre mot de passe et votre session restent sur cet ordinateur. Instagram
              n&apos;autorise pas officiellement cet usage — ClosRM fait peu de requêtes et s&apos;arrête au moindre contrôle, mais le risque de
              vérification du compte n&apos;est pas nul.
            </p>
          </div>
          <button type="button" className="ds-pill-button ds-pill-button--dark" onClick={connect}>
            Connecter ma session Instagram
          </button>
        </>
      ) : (
        <>
          <div>
            <strong>Session Instagram @{status.username ?? account?.username ?? '…'} · collecte automatique toutes les 15 à 60 min (au hasard, comme Insyder) tant que l&apos;app est ouverte</strong>
            <p>
              {collecting
                ? 'Collecte en cours…'
                : lastRun
                  ? `Dernière collecte ${relativeTime(lastRun.at)} — ${lastRun.ok ? `${formatNumber(lastRun.viewers)} vues sur ${lastRun.stories} stor${lastRun.stories > 1 ? 'ies' : 'y'}` : 'échec'}${lastRun.message ? ` · ${lastRun.message}` : ''}`
                  : 'Aucune collecte pour le moment.'}
              {paused && ` Reprise automatique dans ${formatDelay(pausedUntil - Date.now())}.`}
            </p>
          </div>
          <div className="ig-story-session-actions">
            <button type="button" className="ds-pill-button" onClick={collectNow} disabled={collecting} title={paused ? 'Collecte automatique en pause — vous pouvez quand même lancer une collecte' : undefined}>
              {collecting ? 'Collecte…' : 'Collecter maintenant'}
            </button>
            <button type="button" className="ds-pill-button" onClick={disconnect}>
              Déconnecter
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export function StoryViewersSection() {
  const navigate = useNavigate()
  const { lastRun } = useStoryCollector()
  const [win, setWin] = useState<Window>('10')
  const [filter, setFilter] = useState<Filter>('lurkers')
  const { data, error } = useStoryLurkers(Number(win), lastRun?.at)

  const rows = useMemo(
    () =>
      (data?.viewers ?? []).filter((v) => {
        if (filter === 'lurkers') return !v.contacted
        if (filter === 'leads') return !!v.lead
        if (filter === 'not_leads') return !v.lead
        return true
      }),
    [data, filter],
  )
  const paged = usePaged(rows)

  return (
    <TableCard
      title={`Lurkers acheteurs · ${data ? data.totalStories : win} dernières stories`}
      subtitle={data ? `${formatNumber(data.lurkers)} jamais contactés sur ${formatNumber(data.viewers.length)} viewers` : 'Qui regarde vos stories'}
      toolbar={
        <>
          <Chips
            items={[
              { key: 'lurkers' as Filter, label: 'Lurkers', count: data?.lurkers },
              { key: 'not_leads' as Filter, label: 'Pas encore leads', count: data?.viewers.filter((v) => !v.lead).length },
              { key: 'leads' as Filter, label: 'Leads', count: data?.viewers.filter((v) => v.lead).length },
              { key: 'all' as Filter, label: 'Tous', count: data?.viewers.length },
            ]}
            active={filter}
            onChange={setFilter}
          />
          <Chips
            items={[
              { key: '10' as Window, label: '10 stories' },
              { key: '30' as Window, label: '30 stories' },
            ]}
            active={win}
            onChange={setWin}
          />
        </>
      }
    >
      <StorySessionPanel />
      {error && <EmptyState title="Viewers indisponibles" description={error} />}
      {!error && data === null && <LoadingState label="Chargement des viewers…" />}
      {data && data.totalStories === 0 && (
        <EmptyState title="Aucune story collectée" description="Connectez votre session Instagram : les viewers de vos stories en ligne seront collectés automatiquement." />
      )}
      {data && data.totalStories > 0 && rows.length === 0 && <EmptyState title="Personne dans ce filtre" />}
      {data && rows.length > 0 && (
        <table className="ds-table">
          <thead>
            <tr>
              <th>Contact</th>
              <th className="ds-num-cell">Assiduité</th>
              <th>Abonné</th>
              <th>Lead</th>
              <th className="ds-num-cell">Dernière activité</th>
            </tr>
          </thead>
          <tbody>
            {paged.pageRows.map((v) => {
              const name = v.lead?.name || v.fullName || v.username
              const st = v.lead ? statusEntry(v.lead.status) : null
              return (
                <tr
                  key={v.userId}
                  className={v.lead ? 'ds-row-clickable' : undefined}
                  onClick={() => v.lead && navigate(`/leads/${v.lead.id}`)}
                >
                  <td>
                    <ContactCell name={`${name}${v.isVerified ? ' ✓' : ''}`} handle={v.username} avatar={<Avatar name={name} size={28} src={v.profilePicUrl} />} />
                  </td>
                  <td className="ds-num-cell">
                    <span className="ds-num">
                      {v.views} sur {data.totalStories}
                    </span>
                  </td>
                  <td>{v.followsTarget === null ? '—' : v.followsTarget ? 'Oui' : 'Non'}</td>
                  <td>{st ? <StatusPill label={st.label} color={st.color} bg={st.bg} /> : <span className="ds-muted">Non</span>}</td>
                  <td className="ds-num-cell">
                    <span className="ds-num">{shortDate(v.lastViewedAt)}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <PaginationBar total={paged.total} page={paged.page} pages={paged.pages} size={paged.size} onPage={paged.setPage} onSize={paged.setSize} />
    </TableCard>
  )
}
