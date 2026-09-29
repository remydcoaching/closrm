// Workflow detail — everything of the web /acquisition/automations/[id] except
// the visual step canvas (opened on the web): overview of trigger + steps,
// execution history with logs + retry (ExecutionHistoryPanel), dry-run test
// on a real lead (DryRunDialog) and settings (name, description,
// notify_on_failure, channel — the web's settings panel).
// Routes: GET/PATCH /api/workflows/:id, GET .../executions,
// GET .../executions/:execId/logs, POST .../executions/:execId/retry,
// POST .../dry-run, GET /api/leads.
import { Fragment, useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../../lib/api-client'
import { openWeb } from '../../../lib/web-link'
import { Button } from '../../../design-system/Button'
import { Input, Textarea } from '../../../design-system/Input'
import { Drawer } from '../../../design-system/Drawer'
import { SearchInput } from '../../../design-system/SearchInput'
import { StatCard, formatNumber } from '../../../design-system/StatCard'
import { TableCard } from '../../../design-system/TableCard'
import { Chips, Tabs } from '../../../design-system/Tabs'
import { StatusPill } from '../../../design-system/StatusPill'
import { LoadingState, ErrorState, EmptyState } from '../../../design-system/States'
import type { LeadsListResponse } from '../../leads/types'
import { apiPostEmpty, errorMessage } from '../http'
import { formatDuration, formatDateTime, stepLabel, triggerLabel } from '../format'
import { WORKFLOW_STATUS_PILL } from '../emails/SequencesTab'
import type { ExecutionStatus, Workflow, WorkflowExecution, WorkflowExecutionLog, WorkflowStep } from '../types'

type View = 'overview' | 'history' | 'test' | 'settings'

const EXEC_PILL: Record<ExecutionStatus, { label: string; color: string; bg: string }> = {
  completed: { label: 'Terminée', color: 'var(--color-success)', bg: 'var(--color-success-soft)' },
  failed: { label: 'Échec', color: 'var(--color-danger)', bg: 'var(--color-danger-soft)' },
  running: { label: 'En cours', color: 'var(--color-warning)', bg: 'var(--color-warning-soft)' },
  waiting: { label: 'En attente', color: 'var(--color-text-tertiary)', bg: 'var(--color-bg-muted)' },
}

const LOG_PILL: Record<string, { label: string; color: string; bg: string }> = {
  success: { label: 'Succès', color: 'var(--color-success)', bg: 'var(--color-success-soft)' },
  failed: { label: 'Échec', color: 'var(--color-danger)', bg: 'var(--color-danger-soft)' },
  skipped: { label: 'Ignorée', color: 'var(--color-text-tertiary)', bg: 'var(--color-bg-muted)' },
}

export const editorPath = (id: string) => `/acquisition/automations/${id}`

interface Detail extends Workflow {
  steps: WorkflowStep[]
}

export function WorkflowDrawer({ workflowId, onClose, onChanged }: { workflowId: string; onClose: () => void; onChanged: () => void }) {
  const [view, setView] = useState<View>('overview')
  const [detail, setDetail] = useState<Detail | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const r = await api.get<{ data: Detail }>(`/api/workflows/${workflowId}`)
      setDetail(r.data)
    } catch (err) {
      setError(errorMessage(err))
    }
  }, [workflowId])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="mk-drawer-wide">
      <Drawer title={detail?.name ?? 'Workflow'} onClose={onClose}>
        {error && <ErrorState message={error} onRetry={load} />}
        {!detail && !error && <LoadingState />}
        {detail && (
          <div className="mk-form">
            <div className="mk-toolbar">
              <StatusPill {...(WORKFLOW_STATUS_PILL[detail.status] ?? WORKFLOW_STATUS_PILL.brouillon)} />
              <button className="mk-action mk-action--primary" onClick={() => openWeb(editorPath(detail.id))}>
                Ouvrir l'éditeur visuel ↗
              </button>
            </div>
            <Tabs
              items={[
                { key: 'overview' as View, label: 'Aperçu' },
                { key: 'history' as View, label: 'Historique' },
                { key: 'test' as View, label: 'Test' },
                { key: 'settings' as View, label: 'Réglages' },
              ]}
              active={view}
              onChange={setView}
            />
            {view === 'overview' && <Overview detail={detail} />}
            {view === 'history' && <History workflowId={detail.id} />}
            {view === 'test' && <DryRun workflowId={detail.id} />}
            {view === 'settings' && (
              <Settings
                detail={detail}
                onSaved={() => {
                  load()
                  onChanged()
                }}
              />
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}

function Overview({ detail }: { detail: Detail }) {
  return (
    <>
      <div className="mk-drawer-stats">
        <StatCard label="Exécutions" value={detail.execution_count ?? 0} highlight />
        <StatCard label="Dernière exécution" value={detail.last_run_at ? formatDateTime(detail.last_run_at) : '—'} />
      </div>
      {detail.description && <p className="ds-muted">{detail.description}</p>}
      <div className="mk-drawer-section">Déclencheur</div>
      <div className="mk-timeline-email">
        <strong>{triggerLabel(detail.trigger_type)}</strong>
        {Object.keys(detail.trigger_config ?? {}).length > 0 && (
          <div className="mk-log">
            <pre>{JSON.stringify(detail.trigger_config, null, 2)}</pre>
          </div>
        )}
      </div>
      <div className="mk-drawer-section">Étapes ({detail.steps.length})</div>
      {detail.steps.length === 0 ? (
        <EmptyState title="Aucune étape" description="Ajoutez des étapes dans l'éditeur visuel — au moins une est requise pour activer le workflow." />
      ) : (
        <ol className="mk-steps">
          {detail.steps.map((s, i) => (
            <li key={s.id}>
              <span className="mk-step-index">{i + 1}</span>
              <span>{stepLabel(s)}</span>
            </li>
          ))}
        </ol>
      )}
    </>
  )
}

type ExecFilter = 'all' | 'completed' | 'failed' | 'running' | 'waiting'

function History({ workflowId }: { workflowId: string }) {
  const navigate = useNavigate()
  const [execs, setExecs] = useState<WorkflowExecution[] | null>(null)
  const [meta, setMeta] = useState({ total: 0, total_pages: 1 })
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<ExecFilter>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [logs, setLogs] = useState<Record<string, WorkflowExecutionLog[] | null>>({})
  const [retrying, setRetrying] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const r = await api.get<{ data: WorkflowExecution[]; meta: { total: number; total_pages: number } }>(
        `/api/workflows/${workflowId}/executions?page=${page}&per_page=25`,
      )
      setExecs(r.data ?? [])
      setMeta({ total: r.meta.total, total_pages: r.meta.total_pages })
    } catch (err) {
      setError(errorMessage(err))
    }
  }, [workflowId, page])

  useEffect(() => {
    load()
  }, [load])

  async function toggle(id: string) {
    if (expanded === id) {
      setExpanded(null)
      return
    }
    setExpanded(id)
    if (logs[id] !== undefined) return
    try {
      const r = await api.get<{ data: WorkflowExecutionLog[] }>(`/api/workflows/${workflowId}/executions/${id}/logs`)
      setLogs((l) => ({ ...l, [id]: r.data ?? [] }))
    } catch {
      setLogs((l) => ({ ...l, [id]: null }))
    }
  }

  async function retry(id: string) {
    setRetrying(id)
    try {
      await apiPostEmpty(`/api/workflows/${workflowId}/executions/${id}/retry`)
      setLogs((l) => {
        const next = { ...l }
        delete next[id]
        return next
      })
      await load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setRetrying(null)
    }
  }

  if (error) return <ErrorState message={error} onRetry={load} />
  if (!execs) return <LoadingState label="Chargement de l'historique…" />

  const visible = filter === 'all' ? execs : execs.filter((e) => e.status === filter)

  return (
    <>
      <div className="mk-toolbar">
        <Chips
          items={[
            { key: 'all' as ExecFilter, label: 'Toutes' },
            { key: 'completed' as ExecFilter, label: 'Terminées' },
            { key: 'failed' as ExecFilter, label: 'Échecs' },
            { key: 'running' as ExecFilter, label: 'En cours' },
            { key: 'waiting' as ExecFilter, label: 'En attente' },
          ]}
          active={filter}
          onChange={setFilter}
        />
        <button className="mk-action" onClick={load}>
          Rafraîchir
        </button>
      </div>
      <p className="ds-muted">{formatNumber(meta.total)} exécution(s) au total</p>
      {visible.length === 0 ? (
        <EmptyState title="Aucune exécution" />
      ) : (
        <TableCard>
          <table className="ds-table">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Statut</th>
                <th className="ds-num-cell">Démarrée</th>
                <th className="ds-num-cell">Durée</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((e) => {
                const name = e.lead ? `${e.lead.first_name} ${e.lead.last_name}`.trim() || '—' : '—'
                return (
                  <Fragment key={e.id}>
                    <tr className={`ds-row-clickable ${e.status === 'failed' ? 'ds-row--alert' : ''}`} onClick={() => toggle(e.id)}>
                      <td>
                        <div className="mk-name">
                          {expanded === e.id ? '▾' : '▸'} {name}
                        </div>
                        {e.error_message && <div className="ds-muted">{e.error_message}</div>}
                      </td>
                      <td>
                        <StatusPill {...(EXEC_PILL[e.status] ?? EXEC_PILL.waiting)} />
                      </td>
                      <td className="ds-num-cell ds-muted">{formatDateTime(e.started_at)}</td>
                      <td className="ds-num-cell">
                        <span className="ds-num">{formatDuration(e.started_at, e.completed_at)}</span>
                      </td>
                      <td onClick={(ev) => ev.stopPropagation()}>
                        <div className="mk-row-actions">
                          {e.lead_id && (
                            <button className="mk-action" onClick={() => navigate(`/leads/${e.lead_id}`)}>
                              Lead
                            </button>
                          )}
                          {e.status === 'failed' && (
                            <button className="mk-action mk-action--primary" disabled={retrying === e.id} onClick={() => retry(e.id)}>
                              {retrying === e.id ? '…' : 'Relancer'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expanded === e.id && (
                      <tr>
                        <td colSpan={5}>
                          <LogList logs={logs[e.id]} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </TableCard>
      )}
      {meta.total_pages > 1 && (
        <div className="mk-toolbar">
          <button className="mk-action" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ← Précédent
          </button>
          <span className="ds-muted">
            Page {page}/{meta.total_pages}
          </span>
          <button className="mk-action" disabled={page >= meta.total_pages} onClick={() => setPage((p) => p + 1)}>
            Suivant →
          </button>
        </div>
      )}
    </>
  )
}

function LogList({ logs }: { logs: WorkflowExecutionLog[] | null | undefined }) {
  if (logs === undefined) return <LoadingState label="Chargement des logs…" />
  if (logs === null) return <p className="lead-create-error">Impossible de charger les logs.</p>
  if (logs.length === 0) return <p className="ds-muted">Aucun log pour cette exécution.</p>
  return (
    <div className="mk-form">
      {logs.map((l) => (
        <div key={l.id} className="mk-log">
          <div className="mk-pick-title">
            <span>
              Étape {l.step_order} · {stepLabel({ step_type: l.step_type, action_type: l.action_type })}
            </span>
            <StatusPill {...(LOG_PILL[l.status] ?? LOG_PILL.skipped)} />
          </div>
          <span className="ds-muted">{formatDateTime(l.executed_at)}</span>
          {l.error_message && <span className="lead-create-error">{l.error_message}</span>}
          {l.result && Object.keys(l.result).length > 0 && <pre>{JSON.stringify(l.result, null, 2)}</pre>}
        </div>
      ))}
    </div>
  )
}

function DryRun({ workflowId }: { workflowId: string }) {
  const [search, setSearch] = useState('')
  const [leads, setLeads] = useState<LeadsListResponse['data']>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<WorkflowExecutionLog[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      const p = new URLSearchParams({ per_page: '50' })
      if (search.trim()) p.set('search', search.trim())
      api
        .get<LeadsListResponse>(`/api/leads?${p.toString()}`)
        .then((r) => setLeads(r.data ?? []))
        .catch(() => setLeads([]))
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  async function run() {
    if (!selected) return
    setRunning(true)
    setResults(null)
    setError(null)
    try {
      const r = await api.post<{ data: { logs: WorkflowExecutionLog[] } }>(`/api/workflows/${workflowId}/dry-run`, { lead_id: selected })
      setResults(r.data?.logs ?? [])
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setRunning(false)
    }
  }

  return (
    <>
      <p className="ds-muted">Simule l'exécution du workflow sur un lead réel sans envoyer de message ni modifier de donnée.</p>
      <SearchInput value={search} onChange={setSearch} placeholder="Rechercher un lead…" />
      <div className="mk-lead-list">
        {leads.length === 0 ? (
          <p className="ds-muted" style={{ padding: 'var(--space-3)' }}>
            Aucun lead
          </p>
        ) : (
          leads.map((l) => (
            <button key={l.id} className={`mk-lead-option ${selected === l.id ? 'mk-lead-option--active' : ''}`} onClick={() => setSelected(l.id)}>
              <span className="mk-name">{`${l.first_name} ${l.last_name}`.trim() || '—'}</span> <span className="ds-muted">{l.email ?? ''}</span>
            </button>
          ))
        )}
      </div>
      <div className="lead-create-actions">
        <Button variant="primary" disabled={!selected || running} onClick={run}>
          {running ? 'Test en cours…' : 'Lancer le test'}
        </Button>
      </div>
      {error && <p className="lead-create-error">{error}</p>}
      {results && (
        <>
          <div className="mk-drawer-section">Résultat</div>
          <LogList logs={results} />
        </>
      )}
    </>
  )
}

function Settings({ detail, onSaved }: { detail: Detail; onSaved: () => void }) {
  const [name, setName] = useState(detail.name)
  const [description, setDescription] = useState(detail.description ?? '')
  const [notify, setNotify] = useState(detail.notify_on_failure)
  const [channel, setChannel] = useState(detail.failure_notification_channel ?? '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    setMsg(null)
    try {
      await api.patch(`/api/workflows/${detail.id}`, {
        name: name.trim(),
        description,
        notify_on_failure: notify,
        failure_notification_channel: notify ? channel || null : null,
      })
      setMsg({ ok: true, text: 'Enregistré' })
      onSaved()
    } catch (err) {
      setMsg({ ok: false, text: errorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="mk-field">
        <label>Nom</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="mk-field">
        <label>Description</label>
        <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Décrivez ce que fait ce workflow…" />
      </div>
      <div className="mk-drawer-section">Notifications</div>
      <label className="mk-check">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
        <span>Notifier en cas d'échec</span>
      </label>
      {notify && (
        <div className="mk-field">
          <label>Canal de notification</label>
          <select className="ds-input" value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="">Sélectionner…</option>
            <option value="telegram">Telegram</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </div>
      )}
      <div className="lead-create-actions">
        <Button variant="primary" disabled={saving || !name.trim()} onClick={save}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
        {msg && <span className={msg.ok ? 'ds-muted' : 'lead-create-error'}>{msg.text}</span>}
      </div>
    </>
  )
}
