// "Suivi de vos publications" (modèle Insyder): HikerAPI re-reads likers and
// comments of the coach's recent posts/reels once a day (Insyder: hourly); every gesture that
// appeared between two passes shows up here and in the lead's Parcours.
// Paid — off until the coach turns it on, capped per day.
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../../lib/api-client'
import { TableCard, ContactCell } from '../../design-system/TableCard'
import { Avatar } from '../../design-system/Avatar'
import { Chips } from '../../design-system/Tabs'
import { EmptyState, LoadingState } from '../../design-system/States'

interface MonitorRun {
  id: string
  trigger: 'cron' | 'manual'
  started_at: string
  status: 'RUNNING' | 'COMPLETED' | 'PARTIAL' | 'FAILED' | 'SKIPPED'
  requests: number
  contents_scanned: number
  new_likes: number
  new_comments: number
  leads_matched: number
  stopped_reason: string | null
}

interface Gesture {
  id: string
  content_id: string
  interaction_type: 'like' | 'comment'
  instagram_username: string
  full_name: string | null
  profile_pic_url: string | null
  comment_text: string | null
  commented_at: string | null
  first_observed_at: string
  previous_scan_at: string | null
  matched_lead_id: string | null
}

interface MonitorState {
  settings: { enabled: boolean; instagram_username: string | null; max_requests_per_day: number }
  requestsUsedToday: number
  hikerConfigured: boolean
  runs: MonitorRun[]
  gestures: Gesture[]
  contents: { content_id: string; content_type: 'media' | 'clip'; content_url: string | null; thumbnail_url: string | null }[]
}

const BUDGETS = [
  { key: '100', label: '100 / jour' },
  { key: '300', label: '300 / jour' },
  { key: '1000', label: '1 000 / jour' },
]

const REASON: Record<string, string> = {
  INSUFFICIENT_FUNDS: 'crédit HikerAPI épuisé',
  AUTH_ERROR: 'clé HikerAPI refusée',
  RATE_LIMIT: 'HikerAPI limite les requêtes',
  budget: 'budget du jour atteint',
  disabled: 'suivi désactivé',
  no_account: 'aucun compte Instagram renseigné',
}

const time = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function runSummary(r: MonitorRun): string {
  if (r.status === 'SKIPPED') return `Passage ignoré (${REASON[r.stopped_reason ?? ''] ?? r.stopped_reason})`
  if (r.status === 'FAILED') return `Échec du passage : ${REASON[r.stopped_reason ?? ''] ?? r.stopped_reason ?? 'erreur'}`
  const parts = [`${r.contents_scanned} publication${r.contents_scanned > 1 ? 's' : ''} relue${r.contents_scanned > 1 ? 's' : ''}`, `+${r.new_likes} j'aime`, `+${r.new_comments} commentaire${r.new_comments > 1 ? 's' : ''}`, `${r.requests} requêtes`]
  if (r.stopped_reason) parts.push(`arrêt : ${REASON[r.stopped_reason] ?? r.stopped_reason}`)
  return parts.join(' · ')
}

export function MonitorSection() {
  const navigate = useNavigate()
  const [state, setState] = useState<MonitorState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ data: MonitorState }>('/api/instagram/monitor')
      setState(res.data)
      setError(null)
    } catch (err) {
      setError(err instanceof ApiError && err.status === 503 ? 'Migration 118 à appliquer pour activer le suivi.' : err instanceof Error ? err.message : 'Suivi indisponible')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function save(patch: { enabled?: boolean; maxRequestsPerDay?: number }) {
    setBusy('save')
    try {
      await api.put('/api/instagram/monitor', patch)
      await load()
    } finally {
      setBusy(null)
    }
  }

  async function toggle() {
    if (!state) return
    if (!state.settings.enabled) {
      const max = state.settings.max_requests_per_day
      const ok = window.confirm(
        `Activer le suivi de vos publications ?\n\n` +
          `Une fois par jour, ClosRM relit via HikerAPI les j'aime et commentaires de vos posts et réels récents, et enregistre chaque nouveau geste dans le parcours des leads.\n\n` +
          `Service payant : au plus ${max} requêtes par jour (≈ ${(max * 0.001).toFixed(2).replace('.', ',')} $ / jour au tarif mesuré par Insyder). Les commentaires ne sont relus que si leur nombre a changé.`,
      )
      if (!ok) return
    }
    await save({ enabled: !state.settings.enabled })
  }

  async function scanNow() {
    setBusy('scan')
    try {
      await api.post('/api/instagram/monitor', {})
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Passage impossible')
    } finally {
      setBusy(null)
    }
  }

  const thumbOf = new Map((state?.contents ?? []).map((c) => [c.content_id, c]))
  const last = state?.runs[0]

  return (
    <TableCard
      title="Suivi de vos publications"
      subtitle={
        state
          ? state.settings.enabled
            ? `Actif · un passage par jour (6 h) · ${state.requestsUsedToday} / ${state.settings.max_requests_per_day} requêtes aujourd'hui`
            : "Désactivé · qui like et commente vos posts et réels, au fil de l'eau (HikerAPI, payant)"
          : undefined
      }
      toolbar={
        state && state.hikerConfigured ? (
          <>
            <Chips items={BUDGETS} active={String(state.settings.max_requests_per_day)} onChange={(k) => save({ maxRequestsPerDay: Number(k) })} />
            {state.settings.enabled && (
              <button type="button" className="ds-pill-button" onClick={scanNow} disabled={!!busy}>
                {busy === 'scan' ? 'Passage en cours…' : 'Scanner maintenant'}
              </button>
            )}
            <button type="button" className={`ds-pill-button ${state.settings.enabled ? '' : 'ds-pill-button--dark'}`} onClick={toggle} disabled={!!busy}>
              {state.settings.enabled ? 'Désactiver' : 'Activer le suivi'}
            </button>
          </>
        ) : undefined
      }
    >
      {error && <EmptyState title="Suivi indisponible" description={error} />}
      {!error && !state && <LoadingState label="Chargement du suivi…" />}
      {state && !state.hikerConfigured && <EmptyState title="HikerAPI non configuré" description="Ajoutez HIKER_API_KEY sur le serveur pour activer le suivi." />}
      {state && last && <p className="ds-muted story-scan-report">Dernier passage ({time(last.started_at)}) : {runSummary(last)}</p>}
      {state && state.gestures.length === 0 && state.hikerConfigured && (
        <EmptyState
          title="Aucun nouveau geste détecté pour l'instant"
          description={
            state.settings.enabled
              ? "Le premier passage mémorise qui a déjà liké ou commenté ; les passages suivants font apparaître ici chaque nouveau geste, daté de l'heure où il est apparu."
              : 'Activez le suivi pour voir chaque nouveau like et commentaire, daté, rattaché aux leads.'
          }
        />
      )}
      {state && state.gestures.length > 0 && (
        <table className="ds-table">
          <thead>
            <tr>
              <th>Contact</th>
              <th>Geste</th>
              <th>Publication</th>
              <th className="ds-num-cell">Apparu</th>
            </tr>
          </thead>
          <tbody>
            {state.gestures.map((g) => {
              const name = g.full_name || g.instagram_username
              const c = thumbOf.get(g.content_id)
              return (
                <tr key={g.id} className={g.matched_lead_id ? 'ds-row-clickable' : undefined} onClick={() => g.matched_lead_id && navigate(`/leads/${g.matched_lead_id}`)}>
                  <td>
                    <ContactCell name={name} handle={g.instagram_username} avatar={<Avatar name={name} size={28} src={g.profile_pic_url} />} />
                  </td>
                  <td>
                    {g.interaction_type === 'like' ? "a liké" : `a commenté${g.comment_text ? ` : « ${g.comment_text.length > 80 ? `${g.comment_text.slice(0, 80)}…` : g.comment_text} »` : ''}`}
                    {g.matched_lead_id ? '' : <span className="ds-muted"> · pas encore lead</span>}
                  </td>
                  <td>
                    {c?.thumbnail_url ? <img className="monitor-thumb" src={c.thumbnail_url} alt="" referrerPolicy="no-referrer" /> : <span className="ds-muted">{c?.content_type === 'clip' ? 'Réel' : 'Post'}</span>}
                  </td>
                  <td className="ds-num-cell">
                    <span className="ds-num">
                      {g.commented_at ? time(g.commented_at) : g.previous_scan_at ? `entre ${time(g.previous_scan_at)} et ${time(g.first_observed_at)}` : time(g.first_observed_at)}
                    </span>
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
