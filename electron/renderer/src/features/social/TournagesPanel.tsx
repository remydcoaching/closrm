// Sessions de tournage — port of social/tournages/TournagesModal.tsx
// (index view). Endpoints: GET/POST /api/tournage-sessions, PATCH/DELETE
// /api/tournage-sessions/:id, POST /:id/reels, DELETE /:id/reels/:reelId,
// GET /api/social/posts?content_kind=reel. The shot-by-shot "Préparer" and
// "Brief" screens (PrepView/BriefView, teleprompter-like) open on the web.
import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api-client'
import { openWeb } from '../../lib/web-link'
import { Chips } from '../../design-system/Tabs'
import { Input } from '../../design-system/Input'
import { SearchInput } from '../../design-system/SearchInput'
import { EmptyState, ErrorState, LoadingState } from '../../design-system/States'
import { ConfirmButton, Field, Modal } from './ui'
import { errMsg } from './http'
import type { ListResponse, SocialPost, TournageSession } from './types'

type Notify = (text: string, tone?: 'success' | 'danger' | 'info' | 'warning') => void
type Status = TournageSession['status']

const STATUS_META: Record<Status, { label: string; color: string }> = {
  draft: { label: 'Brouillon', color: '#8a8e96' },
  ready: { label: 'Prête à filmer', color: '#3b82f6' },
  in_progress: { label: 'En cours', color: '#d9820b' },
  completed: { label: 'Terminée', color: '#1a7f4e' },
  archived: { label: 'Archivée', color: '#6b6f76' },
}

/** Same derived status as the web (only `archived` is read from the DB). */
function derivedStatus(s: TournageSession): Status {
  if (s.status === 'archived') return 'archived'
  if (s.stats.total > 0 && s.stats.done === s.stats.total) return 'completed'
  if (s.stats.done > 0) return 'in_progress'
  if (s.reels_count > 0) return 'ready'
  return 'draft'
}

function reelIds(s: TournageSession): string[] {
  return (s.reels ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((r) => r.social_post_id)
}

export function TournagesPanel({ notify, onClose }: { notify: Notify; onClose: () => void }) {
  const [sessions, setSessions] = useState<TournageSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | Status>('all')
  const [showArchived, setShowArchived] = useState(false)
  const [creating, setCreating] = useState(false)
  const [addingTo, setAddingTo] = useState<TournageSession | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await api.get<ListResponse<TournageSession>>('/api/tournage-sessions')
      setSessions(r.data ?? [])
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function patch(id: string, body: Record<string, unknown>) {
    try {
      await api.patch(`/api/tournage-sessions/${id}`, body)
      void load()
    } catch (e) {
      notify(errMsg(e), 'danger')
    }
  }

  async function remove(id: string) {
    try {
      await api.delete(`/api/tournage-sessions/${id}`)
      void load()
    } catch (e) {
      notify(errMsg(e), 'danger')
    }
  }

  async function removeReel(sessionId: string, reelId: string) {
    try {
      await api.delete(`/api/tournage-sessions/${sessionId}/reels/${reelId}`)
      void load()
    } catch (e) {
      notify(errMsg(e), 'danger')
    }
  }

  const visible = sessions
    .filter((s) => showArchived || s.status !== 'archived')
    .filter((s) => filter === 'all' || derivedStatus(s) === filter)
    .filter((s) => !search.trim() || (s.name ?? '').toLowerCase().includes(search.toLowerCase()))

  return (
    <Modal title="Sessions de tournage" onClose={onClose} size="wide">
      <div className="soc-stack">
        <p className="soc-muted" style={{ margin: 0 }}>
          Groupe les reels que tu films ensemble — chaque session = une date + N reels.
        </p>
        <div className="soc-toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Rechercher une session…" />
          <Chips
            items={[
              { key: 'all', label: 'Tout' },
              { key: 'draft', label: 'Brouillon' },
              { key: 'ready', label: 'Prête' },
              { key: 'in_progress', label: 'En cours' },
              { key: 'completed', label: 'Terminée' },
            ]}
            active={filter}
            onChange={setFilter}
          />
          <label className="soc-row soc-muted">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> + archivées
          </label>
          <div className="soc-spacer" />
          <button type="button" className="ds-pill-button ds-pill-button--dark" onClick={() => setCreating(true)}>
            + Nouvelle session
          </button>
        </div>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : visible.length === 0 ? (
          <EmptyState title={sessions.length ? 'Aucune session ne correspond à ton filtre.' : "Aucune session pour l'instant"} description="Crée une session pour grouper les reels que tu vas filmer le même jour." />
        ) : (
          visible.map((s) => {
            const st = derivedStatus(s)
            const ids = reelIds(s)
            const pct = s.stats.total ? (s.stats.done / s.stats.total) * 100 : 0
            const qs = `reel=${ids.join(',')}&session=${s.id}`
            return (
              <section key={s.id} className="soc-card">
                <div className="soc-card-head">
                  <div>
                    <div className="soc-row">
                      <h3 className="soc-card-title">{s.name || 'Session sans nom'}</h3>
                      <span className="ds-status-pill" style={{ color: STATUS_META[st].color, background: `${STATUS_META[st].color}1a` }}>
                        {STATUS_META[st].label}
                      </span>
                    </div>
                    <p className="soc-card-sub">
                      {s.scheduled_date ? new Date(s.scheduled_date).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' }) : 'Sans date'} · {s.reels_count} reel
                      {s.reels_count > 1 ? 's' : ''} · {s.stats.done}/{s.stats.total} phrases tournées
                      {s.stats.skipped > 0 ? ` · ${s.stats.skipped} passées` : ''}
                    </p>
                  </div>
                  <div className="soc-row">
                    <button type="button" className="ds-pill-button" disabled={ids.length === 0} onClick={() => void openWeb(`/acquisition/reels/tournage/prep?${qs}`)}>
                      Préparer ↗
                    </button>
                    <button type="button" className="ds-pill-button" disabled={ids.length === 0} onClick={() => void openWeb(`/acquisition/reels/tournage/brief?${qs}`)}>
                      Brief ↗
                    </button>
                    <button type="button" className="ds-pill-button" onClick={() => setAddingTo(s)}>
                      + Reels
                    </button>
                    {s.status === 'archived' ? (
                      <button type="button" className="ds-pill-button" onClick={() => void patch(s.id, { status: 'draft' })}>
                        Désarchiver
                      </button>
                    ) : (
                      <ConfirmButton label="Archiver" onConfirm={() => void patch(s.id, { status: 'archived' })} />
                    )}
                    <ConfirmButton label="Supprimer" confirmLabel="Supprimer (reels conservés) ?" onConfirm={() => void remove(s.id)} />
                  </div>
                </div>
                {s.stats.total > 0 && (
                  <div className="soc-bar">
                    <span style={{ width: `${pct}%`, background: 'var(--color-success)' }} />
                  </div>
                )}
                <div className="soc-row">
                  <input
                    className="ds-input"
                    type="date"
                    style={{ width: 170 }}
                    value={s.scheduled_date?.slice(0, 10) ?? ''}
                    onChange={(e) => void patch(s.id, { scheduled_date: e.target.value || null })}
                  />
                  {(s.reels ?? [])
                    .slice()
                    .sort((a, b) => a.position - b.position)
                    .map((r) => (
                      <span key={r.social_post_id} className="soc-tag">
                        {r.post?.hook || r.post?.title || 'Reel'}
                        <button type="button" title="Retirer de la session" onClick={() => void removeReel(s.id, r.social_post_id)}>
                          ×
                        </button>
                      </span>
                    ))}
                </div>
              </section>
            )
          })
        )}
      </div>
      {creating && (
        <ReelPicker
          title="Nouvelle session"
          withMeta
          onClose={() => setCreating(false)}
          onConfirm={async (ids, name, date) => {
            await api.post('/api/tournage-sessions', { name: name.trim() || null, scheduled_date: date || null, social_post_ids: ids })
            setCreating(false)
            void load()
          }}
        />
      )}
      {addingTo && (
        <ReelPicker
          title={`Ajouter des reels — ${addingTo.name || 'session'}`}
          exclude={reelIds(addingTo)}
          onClose={() => setAddingTo(null)}
          onConfirm={async (ids) => {
            if (ids.length) await api.post(`/api/tournage-sessions/${addingTo.id}/reels`, { social_post_ids: ids })
            setAddingTo(null)
            void load()
          }}
        />
      )}
    </Modal>
  )
}

function ReelPicker({
  title,
  withMeta,
  exclude = [],
  onClose,
  onConfirm,
}: {
  title: string
  withMeta?: boolean
  exclude?: string[]
  onClose: () => void
  onConfirm: (ids: string[], name: string, date: string) => Promise<void>
}) {
  const [reels, setReels] = useState<SocialPost[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<ListResponse<SocialPost>>('/api/social/posts?content_kind=reel&slim=true&per_page=100')
      .then((r) => setReels((r.data ?? []).filter((p) => !exclude.includes(p.id))))
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm([...selected], name, date)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose} size="mid">
      <div className="soc-stack">
        {withMeta && (
          <>
            <Field label="Nom">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex : Salle wellness — pectoraux" />
            </Field>
            <Field label="Date du tournage">
              <input className="ds-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </>
        )}
        <Field label={`Reels (${selected.size} sélectionné${selected.size > 1 ? 's' : ''})`}>
          {loading ? (
            <LoadingState />
          ) : reels.length === 0 ? (
            <p className="soc-muted">Aucun reel disponible dans le planning.</p>
          ) : (
            <div style={{ maxHeight: 320, overflowY: 'auto' }} className="soc-stack">
              {reels.map((r) => (
                <label key={r.id} className="soc-row" style={{ flexWrap: 'nowrap', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() =>
                      setSelected((prev) => {
                        const n = new Set(prev)
                        if (n.has(r.id)) n.delete(r.id)
                        else n.add(r.id)
                        return n
                      })
                    }
                  />
                  <span style={{ flex: 1 }}>{r.hook || r.title || '(sans accroche)'}</span>
                  <span className="soc-muted">{r.plan_date ? new Date(`${r.plan_date.slice(0, 10)}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''}</span>
                </label>
              ))}
            </div>
          )}
        </Field>
        {error && <p className="lead-create-error">{error}</p>}
        <div className="lead-create-actions">
          <button type="button" className="ds-pill-button" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="ds-pill-button ds-pill-button--dark" disabled={submitting || (!withMeta && selected.size === 0)} onClick={() => void submit()}>
            {submitting ? 'Enregistrement…' : withMeta ? 'Créer la session' : 'Ajouter'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
