// Emails > Séquences — web sequences-client.tsx + sequences/[id] (SequenceTimeline).
// Routes: GET/POST /api/emails/sequences, GET/PUT/DELETE /api/emails/sequences/:id,
// GET /api/emails/templates. The timeline editor is simple enough to be
// fully native (email step = template, delay step = N min/heures/jours).
import { useEffect, useMemo, useState } from 'react'
import { api } from '../../../lib/api-client'
import { swrGet } from '../../../lib/query-cache'
import { Button } from '../../../design-system/Button'
import { Input } from '../../../design-system/Input'
import { Drawer } from '../../../design-system/Drawer'
import { formatNumber } from '../../../design-system/StatCard'
import { TableCard } from '../../../design-system/TableCard'
import { Chips } from '../../../design-system/Tabs'
import { StatusPill } from '../../../design-system/StatusPill'
import { LoadingState, ErrorState, EmptyState } from '../../../design-system/States'
import { errorMessage } from '../http'
import { addSequenceEmail, emailStepNumber, formatDate, removeSequenceStep, type SequenceDraftStep } from '../format'
import type { EmailTemplate, SequenceWorkflow, WorkflowStatus } from '../types'

export const WORKFLOW_STATUS_PILL: Record<WorkflowStatus, { label: string; color: string; bg: string }> = {
  brouillon: { label: 'Brouillon', color: 'var(--color-text-tertiary)', bg: 'var(--color-bg-muted)' },
  actif: { label: 'Actif', color: 'var(--color-success)', bg: 'var(--color-success-soft)' },
  inactif: { label: 'Inactif', color: 'var(--color-danger)', bg: 'var(--color-danger-soft)' },
}

type Filter = 'all' | WorkflowStatus

export function SequencesTab({ onCount }: { onCount: (n: number) => void }) {
  const [sequences, setSequences] = useState<SequenceWorkflow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      await swrGet<SequenceWorkflow[]>('/api/emails/sequences', (data) => {
        const arr = Array.isArray(data) ? data : []
        setSequences(arr)
        onCount(arr.length)
      })
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: sequences?.length ?? 0 }
    for (const s of sequences ?? []) c[s.status] = (c[s.status] ?? 0) + 1
    return c
  }, [sequences])

  async function handleCreate() {
    setActionError(null)
    try {
      const seq = await api.post<SequenceWorkflow>('/api/emails/sequences', { name: 'Nouvelle séquence' })
      await load()
      setEditing(seq.id)
    } catch (err) {
      setActionError(errorMessage(err))
    }
  }

  async function setStatus(s: SequenceWorkflow, status: WorkflowStatus) {
    setBusy(s.id)
    setActionError(null)
    try {
      await api.put(`/api/emails/sequences/${s.id}`, { status })
      await load()
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  async function handleDelete(s: SequenceWorkflow) {
    if (!confirm('Supprimer cette séquence ?')) return
    setBusy(s.id)
    try {
      await api.delete(`/api/emails/sequences/${s.id}`)
      await load()
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const visible = (sequences ?? []).filter((s) => filter === 'all' || s.status === filter)

  return (
    <>
      {actionError && (
        <div className="mk-banner mk-banner--warning">
          <span>{actionError}</span>
          <button className="mk-action" onClick={() => setActionError(null)}>
            Fermer
          </button>
        </div>
      )}
      {sequences === null && !error && <LoadingState label="Chargement des séquences…" />}
      {error && <ErrorState message={error} onRetry={load} />}
      {sequences && (
        <TableCard
          title="Séquences"
          subtitle="Séries d'emails automatiques envoyés à intervalles définis"
          toolbar={
            <>
              <Chips
                items={[
                  { key: 'all' as Filter, label: 'Toutes', count: counts.all },
                  { key: 'actif' as Filter, label: 'Actives', count: counts.actif ?? 0 },
                  { key: 'inactif' as Filter, label: 'Inactives', count: counts.inactif ?? 0 },
                  { key: 'brouillon' as Filter, label: 'Brouillons', count: counts.brouillon ?? 0 },
                ]}
                active={filter}
                onChange={setFilter}
              />
              <button className="ds-pill-button ds-pill-button--dark" onClick={handleCreate}>
                + Nouvelle séquence
              </button>
            </>
          }
        >
          {visible.length === 0 ? (
            <EmptyState title="Aucune séquence" description="Crée ta première séquence d'emails automatiques." />
          ) : (
            <table className="ds-table">
              <thead>
                <tr>
                  <th>Séquence</th>
                  <th>Statut</th>
                  <th className="ds-num-cell">Emails</th>
                  <th className="ds-num-cell">Inscrits</th>
                  <th className="ds-num-cell">Créée le</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((s) => {
                  const emails = (s.workflow_steps ?? []).filter((st) => st.step_type === 'action').length
                  return (
                    <tr key={s.id} className="ds-row-clickable" onClick={() => setEditing(s.id)}>
                      <td className="mk-name">{s.name}</td>
                      <td>
                        <StatusPill {...(WORKFLOW_STATUS_PILL[s.status] ?? WORKFLOW_STATUS_PILL.brouillon)} />
                      </td>
                      <td className="ds-num-cell">
                        <span className="ds-num">{formatNumber(emails)}</span>
                      </td>
                      <td className="ds-num-cell">
                        <span className="ds-num">{formatNumber(s.execution_count ?? 0)}</span>
                      </td>
                      <td className="ds-num-cell ds-muted">{formatDate(s.created_at)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="mk-row-actions">
                          <button className="mk-action" onClick={() => setEditing(s.id)}>
                            Éditer
                          </button>
                          {s.status === 'actif' ? (
                            <button className="mk-action" disabled={busy === s.id} onClick={() => setStatus(s, 'inactif')}>
                              Désactiver
                            </button>
                          ) : (
                            <button className="mk-action mk-action--primary" disabled={busy === s.id} onClick={() => setStatus(s, 'actif')}>
                              Activer
                            </button>
                          )}
                          <button className="mk-action mk-action--danger" disabled={busy === s.id} onClick={() => handleDelete(s)}>
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </TableCard>
      )}
      {editing && (
        <SequenceEditorDrawer
          id={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            load()
          }}
        />
      )}
    </>
  )
}

function SequenceEditorDrawer({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved: () => void }) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [status, setStatus] = useState<WorkflowStatus>('brouillon')
  const [steps, setSteps] = useState<SequenceDraftStep[]>([])
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api
      .get<SequenceWorkflow>(`/api/emails/sequences/${id}`)
      .then((data) => {
        setName(data.name || '')
        setStatus(data.status || 'brouillon')
        const sorted = [...(data.workflow_steps ?? [])].sort((a, b) => a.step_order - b.step_order)
        setSteps(
          sorted.map((s) => ({
            step_type: s.step_type === 'delay' ? 'delay' : 'action',
            action_type: s.action_type ?? undefined,
            action_config: s.action_config || {},
            delay_value: s.delay_value ?? undefined,
            delay_unit: s.delay_unit ?? undefined,
          })),
        )
        setLoaded(true)
      })
      .catch((err) => setError(errorMessage(err)))
    api
      .get<EmailTemplate[]>('/api/emails/templates')
      .then((d) => setTemplates(Array.isArray(d) ? d : []))
      .catch(() => setTemplates([]))
  }, [id])

  function update(index: number, patch: Partial<SequenceDraftStep>) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  async function save() {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      await api.put(`/api/emails/sequences/${id}`, { name, status, steps: steps.map((s, i) => ({ ...s, step_order: i })) })
      setSaved(true)
      onSaved()
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const emailCount = steps.filter((s) => s.step_type === 'action').length

  return (
    <div className="mk-drawer-wide">
      <Drawer title="Séquence" onClose={onClose}>
        {error && <ErrorState message={error} />}
        {!loaded && !error && <LoadingState />}
        {loaded && (
          <div className="mk-form">
            <div className="mk-field">
              <label>Nom de la séquence</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="mk-field">
              <label>Statut</label>
              <select className="ds-input" value={status} onChange={(e) => setStatus(e.target.value as WorkflowStatus)}>
                <option value="brouillon">Brouillon</option>
                <option value="actif">Actif</option>
                <option value="inactif">Inactif</option>
              </select>
            </div>

            <div className="mk-drawer-section">Étapes</div>
            {steps.length === 0 && <p className="ds-muted">Aucun email pour l'instant.</p>}
            <div className="mk-timeline">
              {steps.map((step, i) =>
                step.step_type === 'delay' ? (
                  <div key={i} className="mk-timeline-delay">
                    <span>Attendre</span>
                    <Input
                      type="number"
                      min={1}
                      value={step.delay_value || 1}
                      onChange={(e) => update(i, { delay_value: Math.max(1, Number(e.target.value) || 1) })}
                    />
                    <select className="ds-input" value={step.delay_unit || 'days'} onChange={(e) => update(i, { delay_unit: e.target.value })}>
                      <option value="minutes">min</option>
                      <option value="hours">heures</option>
                      <option value="days">jours</option>
                    </select>
                  </div>
                ) : (
                  <div key={i} className="mk-timeline-email">
                    <div className="mk-pick-title">
                      <span>Email {emailStepNumber(steps, i)}</span>
                      {emailCount > 1 && (
                        <button className="mk-action mk-action--danger" onClick={() => setSteps((prev) => removeSequenceStep(prev, i))}>
                          Supprimer
                        </button>
                      )}
                    </div>
                    <select
                      className="ds-input"
                      value={(step.action_config?.template_id as string) || ''}
                      onChange={(e) => update(i, { action_config: { ...step.action_config, template_id: e.target.value } })}
                    >
                      <option value="">Choisir un template…</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} — {t.subject || 'Sans sujet'}
                        </option>
                      ))}
                    </select>
                  </div>
                ),
              )}
            </div>
            <button className="mk-action" onClick={() => setSteps((prev) => addSequenceEmail(prev))}>
              + Ajouter un email
            </button>

            <div className="lead-create-actions">
              <Button variant="primary" disabled={saving} onClick={save}>
                {saving ? 'Sauvegarde…' : 'Sauvegarder'}
              </Button>
              {saved && <span className="ds-muted">Sauvegardé</span>}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}
