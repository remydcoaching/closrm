// Acquisition > Automations — mirrors src/app/(dashboard)/acquisition/automations
// (automations-client.tsx, WorkflowCard, NewWorkflowModal) on the same routes:
// GET/POST /api/workflows, DELETE /api/workflows/:id,
// POST /api/workflows/:id/{activate,deactivate}, POST /api/workflows/:id/steps,
// GET /api/workflows/templates. Details (history, dry-run, settings) live in
// WorkflowDrawer; the visual step canvas opens on the web.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api-client'
import { openWeb } from '../../lib/web-link'
import { Button } from '../../design-system/Button'
import { Input } from '../../design-system/Input'
import { SearchInput } from '../../design-system/SearchInput'
import { StatCard, StatGrid } from '../../design-system/StatCard'
import { TableCard, SortHeader } from '../../design-system/TableCard'
import { Chips, Tabs } from '../../design-system/Tabs'
import { StatusPill } from '../../design-system/StatusPill'
import { LoadingState, ErrorState, EmptyState } from '../../design-system/States'
import { apiPostEmpty, errorMessage } from './http'
import { formatDateTime, triggerLabel } from './format'
import { WORKFLOW_STATUS_PILL } from './emails/SequencesTab'
import { WorkflowDrawer, editorPath } from './automations/WorkflowDrawer'
import { AssetsTab } from './automations/AssetsTab'
import type { Workflow, WorkflowListResponse, WorkflowStatus, WorkflowTemplate } from './types'
import './marketing.css'
import '../leads/lead-create-modal.css'

type View = 'workflows' | 'assets'
type Filter = 'all' | WorkflowStatus
type SortKey = 'name' | 'executions' | 'last_run' | 'created_at'

const CATEGORY_LABELS: Record<string, string> = { leads: 'Leads', calls: 'Appels', instagram: 'Instagram', booking: 'Réservations' }

export function AutomationsPage() {
  const [view, setView] = useState<View>('workflows')
  const [workflows, setWorkflows] = useState<Workflow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; order: 'asc' | 'desc' }>({ key: 'created_at', order: 'desc' })
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ id: string; text: string } | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const r = await api.get<WorkflowListResponse>('/api/workflows?per_page=100')
      setWorkflows(r.data ?? [])
    } catch (err) {
      setError(errorMessage(err))
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const counts = useMemo(() => {
    const list = workflows ?? []
    return {
      all: list.length,
      actif: list.filter((w) => w.status === 'actif').length,
      inactif: list.filter((w) => w.status === 'inactif').length,
      brouillon: list.filter((w) => w.status === 'brouillon').length,
    }
  }, [workflows])

  const totalExec = useMemo(() => (workflows ?? []).reduce((s, w) => s + (w.execution_count ?? 0), 0), [workflows])
  const lastRun = useMemo(
    () => (workflows ?? []).map((w) => w.last_run_at).filter((d): d is string => !!d).sort().pop() ?? null,
    [workflows],
  )

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = (workflows ?? []).filter(
      (w) => (filter === 'all' || w.status === filter) && (!q || w.name.toLowerCase().includes(q) || (w.description ?? '').toLowerCase().includes(q)),
    )
    const dir = sort.order === 'asc' ? 1 : -1
    const val = (w: Workflow): string | number =>
      sort.key === 'name' ? w.name.toLowerCase() : sort.key === 'executions' ? (w.execution_count ?? 0) : sort.key === 'last_run' ? (w.last_run_at ?? '') : w.created_at
    return [...list].sort((a, b) => (val(a) < val(b) ? -dir : val(a) > val(b) ? dir : 0))
  }, [workflows, filter, search, sort])

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, order: s.order === 'asc' ? 'desc' : 'asc' } : { key, order: key === 'name' ? 'asc' : 'desc' }))
  }

  async function setActive(w: Workflow, active: boolean) {
    setBusy(w.id)
    setActionError(null)
    try {
      await apiPostEmpty(`/api/workflows/${w.id}/${active ? 'activate' : 'deactivate'}`)
      await load()
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  async function remove(w: Workflow) {
    if (!confirm('Cette action est irréversible. Voulez-vous vraiment supprimer ce workflow ?')) return
    setBusy(w.id)
    try {
      await api.delete(`/api/workflows/${w.id}`)
      await load()
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mk-page">
      <div className="mk-header">
        <div>
          <h1>Automations</h1>
          <p>Automatisez vos processus : messages, changements de statut, notifications et plus encore.</p>
        </div>
        <div className="mk-header-actions">
          <Tabs
            items={[
              { key: 'workflows' as View, label: 'Workflows' },
              { key: 'assets' as View, label: 'Assets' },
            ]}
            active={view}
            onChange={setView}
          />
          {view === 'workflows' && (
            <Button variant="primary" onClick={() => setShowNew(true)}>
              + Nouveau workflow
            </Button>
          )}
        </div>
      </div>

      {view === 'assets' && <AssetsTab />}

      {view === 'workflows' && (
        <>
          {notice && (
            <div className="mk-banner mk-banner--success">
              <span>{notice.text}</span>
              <button className="mk-action" onClick={() => openWeb(editorPath(notice.id))}>
                Ouvrir l'éditeur ↗
              </button>
              <button className="mk-action" onClick={() => setNotice(null)}>
                Fermer
              </button>
            </div>
          )}
          {actionError && (
            <div className="mk-banner mk-banner--warning">
              <span>{actionError}</span>
              <button className="mk-action" onClick={() => setActionError(null)}>
                Fermer
              </button>
            </div>
          )}
          {workflows === null && !error && <LoadingState label="Chargement des workflows…" />}
          {error && <ErrorState message={error} onRetry={load} />}
          {workflows && (
            <>
              <StatGrid>
                <StatCard label="Workflows" value={counts.all} caption={`${counts.brouillon} brouillon(s)`} />
                <StatCard label="Actifs" value={counts.actif} highlight caption={`${counts.inactif} inactif(s)`} />
                <StatCard label="Exécutions" value={totalExec} caption="Cumul depuis la création" />
                <StatCard label="Dernière exécution" value={lastRun ? formatDateTime(lastRun) : '—'} />
              </StatGrid>

              <TableCard
                title="Workflows"
                toolbar={
                  <>
                    <Chips
                      items={[
                        { key: 'all' as Filter, label: 'Tous', count: counts.all },
                        { key: 'actif' as Filter, label: 'Actifs', count: counts.actif },
                        { key: 'inactif' as Filter, label: 'Inactifs', count: counts.inactif },
                        { key: 'brouillon' as Filter, label: 'Brouillons', count: counts.brouillon },
                      ]}
                      active={filter}
                      onChange={setFilter}
                    />
                    <SearchInput value={search} onChange={setSearch} placeholder="Rechercher un workflow…" />
                  </>
                }
              >
                {workflows.length === 0 ? (
                  <EmptyState title="Aucun workflow" description="Créez votre premier workflow depuis un template ou à partir de zéro." />
                ) : visible.length === 0 ? (
                  <EmptyState title="Aucun workflow ne correspond à vos filtres" />
                ) : (
                  <table className="ds-table">
                    <thead>
                      <tr>
                        <SortHeader label="Workflow" active={sort.key === 'name'} order={sort.order} onClick={() => toggleSort('name')} />
                        <th>Déclencheur</th>
                        <th>Statut</th>
                        <SortHeader
                          label="Exécutions"
                          align="right"
                          active={sort.key === 'executions'}
                          order={sort.order}
                          onClick={() => toggleSort('executions')}
                        />
                        <SortHeader
                          label="Dernière exéc."
                          align="right"
                          active={sort.key === 'last_run'}
                          order={sort.order}
                          onClick={() => toggleSort('last_run')}
                        />
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((w) => (
                        <tr key={w.id} className="ds-row-clickable" onClick={() => setOpenId(w.id)}>
                          <td>
                            <div className="mk-name">{w.name}</div>
                            {w.description && <div className="ds-muted">{w.description}</div>}
                          </td>
                          <td>{triggerLabel(w.trigger_type)}</td>
                          <td>
                            <StatusPill {...(WORKFLOW_STATUS_PILL[w.status] ?? WORKFLOW_STATUS_PILL.brouillon)} />
                          </td>
                          <td className="ds-num-cell">
                            <span className="ds-num">{w.execution_count ?? 0}</span>
                          </td>
                          <td className="ds-num-cell ds-muted">{w.last_run_at ? formatDateTime(w.last_run_at) : 'Jamais'}</td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <div className="mk-row-actions">
                              {w.status === 'actif' ? (
                                <button className="mk-action" disabled={busy === w.id} onClick={() => setActive(w, false)}>
                                  Désactiver
                                </button>
                              ) : (
                                <button className="mk-action mk-action--primary" disabled={busy === w.id} onClick={() => setActive(w, true)}>
                                  Activer
                                </button>
                              )}
                              <button className="mk-action" onClick={() => openWeb(editorPath(w.id))}>
                                Éditer ↗
                              </button>
                              <button className="mk-action mk-action--danger" disabled={busy === w.id} onClick={() => remove(w)}>
                                Supprimer
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </TableCard>
            </>
          )}
        </>
      )}

      {showNew && (
        <NewWorkflowModal
          onClose={() => setShowNew(false)}
          onCreated={(w) => {
            setShowNew(false)
            setNotice({ id: w.id, text: `« ${w.name} » créé en brouillon. Configurez ses étapes dans l'éditeur puis activez-le.` })
            load()
            setOpenId(w.id)
          }}
        />
      )}

      {openId && <WorkflowDrawer workflowId={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  )
}

function NewWorkflowModal({ onClose, onCreated }: { onClose: () => void; onCreated: (w: Workflow) => void }) {
  const [templates, setTemplates] = useState<WorkflowTemplate[] | null>(null)
  const [blankName, setBlankName] = useState('')
  const [creating, setCreating] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<{ data: WorkflowTemplate[] }>('/api/workflows/templates')
      .then((r) => setTemplates(r.data ?? []))
      .catch((err) => setError(errorMessage(err)))
  }, [])

  async function createBlank() {
    if (!blankName.trim() || creating) return
    setCreating('blank')
    setError(null)
    try {
      const r = await api.post<{ data: Workflow }>('/api/workflows', { name: blankName.trim(), trigger_type: 'new_lead', trigger_config: {} })
      onCreated(r.data)
    } catch (err) {
      setError(errorMessage(err))
      setCreating(null)
    }
  }

  async function createFromTemplate(t: WorkflowTemplate) {
    if (creating) return
    setCreating(t.id)
    setError(null)
    try {
      const r = await api.post<{ data: Workflow }>('/api/workflows', {
        name: t.name,
        description: t.description,
        trigger_type: t.trigger_type,
        trigger_config: t.trigger_config,
      })
      for (const step of t.steps) {
        await api.post(`/api/workflows/${r.data.id}/steps`, {
          step_type: step.step_type,
          action_type: step.action_type || null,
          action_config: step.action_config || {},
          delay_value: step.delay_value || null,
          delay_unit: step.delay_unit || null,
        })
      }
      onCreated(r.data)
    } catch (err) {
      setError(errorMessage(err))
      setCreating(null)
    }
  }

  const grouped = useMemo(() => {
    const g: Record<string, WorkflowTemplate[]> = {}
    for (const t of templates ?? []) (g[t.category] ??= []).push(t)
    return g
  }, [templates])

  return (
    <div className="lead-create-overlay" onClick={onClose}>
      <div className="lead-create-modal mk-modal-wide" onClick={(e) => e.stopPropagation()}>
        <h2>Nouveau workflow</h2>
        <div className="mk-pick-card mk-pick-card--dashed">
          <div className="mk-pick-title">Workflow vide</div>
          <div className="mk-pick-desc">Partir de zéro et configurer chaque étape manuellement.</div>
          <form
            className="mk-form-row"
            onSubmit={(e) => {
              e.preventDefault()
              createBlank()
            }}
          >
            <Input placeholder="Nom du workflow" value={blankName} onChange={(e) => setBlankName(e.target.value)} />
            <Button type="submit" variant="primary" disabled={!blankName.trim() || !!creating} style={{ flex: 'none' }}>
              {creating === 'blank' ? 'Création…' : 'Créer'}
            </Button>
          </form>
        </div>
        {error && <p className="lead-create-error">{error}</p>}
        {templates === null && !error && <LoadingState label="Chargement des templates…" />}
        {Object.entries(grouped).map(([cat, list]) => (
          <div key={cat}>
            <div className="mk-group-title">{CATEGORY_LABELS[cat] ?? cat}</div>
            <div className="mk-card-grid">
              {list.map((t) => (
                <button key={t.id} className="mk-pick-card" disabled={!!creating} onClick={() => createFromTemplate(t)}>
                  <div className="mk-pick-title">{t.name}</div>
                  <div className="mk-pick-desc">{t.description}</div>
                  <div className="ds-muted">
                    {triggerLabel(t.trigger_type)} · {t.steps.length} étape{t.steps.length > 1 ? 's' : ''}
                    {t.requires_integration?.length ? ` · requiert ${t.requires_integration.join(', ')}` : ''}
                  </div>
                  {creating === t.id && <div className="ds-muted">Création…</div>}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="lead-create-actions">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
        </div>
      </div>
    </div>
  )
}
