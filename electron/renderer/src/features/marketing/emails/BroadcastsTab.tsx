// Emails > Campagnes — web broadcasts-client.tsx + broadcasts/new + broadcasts/[id].
// Routes: GET/POST /api/emails/broadcasts, DELETE /api/emails/broadcasts/:id,
// POST /api/emails/broadcasts/_/preview-count, POST .../:id/send,
// GET .../:id/stats, GET /api/emails/templates, POST /api/emails/templates/preview.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../../lib/api-client'
import { swrGet } from '../../../lib/query-cache'
import { openWeb } from '../../../lib/web-link'
import { Button } from '../../../design-system/Button'
import { Input, Textarea } from '../../../design-system/Input'
import { Drawer } from '../../../design-system/Drawer'
import { StatCard, formatNumber } from '../../../design-system/StatCard'
import { TableCard } from '../../../design-system/TableCard'
import { Chips, Tabs } from '../../../design-system/Tabs'
import { StatusPill } from '../../../design-system/StatusPill'
import { LoadingState, ErrorState, EmptyState } from '../../../design-system/States'
import { apiPostEmpty, apiPostText, errorMessage } from '../http'
import { BROADCAST_SOURCES, BROADCAST_STATUSES } from '../catalog'
import { formatDate, formatDateTime, formatPercent, htmlToPlainLine, textToEmailHtml } from '../format'
import type { BroadcastStats, EmailBroadcast, EmailBroadcastFilters, EmailBroadcastStatus, EmailTemplate } from '../types'
import type { LeadSource, LeadStatus } from '../../leads/types'

const STATUS_MAP: Record<EmailBroadcastStatus, { label: string; color: string; bg: string }> = {
  draft: { label: 'Brouillon', color: 'var(--color-text-tertiary)', bg: 'var(--color-bg-muted)' },
  scheduled: { label: 'Planifié', color: 'var(--color-warning)', bg: 'var(--color-warning-soft)' },
  sending: { label: 'Envoi…', color: 'var(--color-info)', bg: 'var(--color-info-soft)' },
  sent: { label: 'Envoyé', color: 'var(--color-success)', bg: 'var(--color-success-soft)' },
  failed: { label: 'Échoué', color: 'var(--color-danger)', bg: 'var(--color-danger-soft)' },
}

const RECIPIENT_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  sent: { label: 'Envoyé', color: 'var(--color-text-secondary)', bg: 'var(--color-bg-muted)' },
  delivered: { label: 'Remis', color: 'var(--color-success)', bg: 'var(--color-success-soft)' },
  opened: { label: 'Ouvert', color: 'var(--color-info)', bg: 'var(--color-info-soft)' },
  clicked: { label: 'Cliqué', color: 'var(--color-accent-solid)', bg: 'var(--color-accent-soft)' },
  bounced: { label: 'Bounce', color: 'var(--color-danger)', bg: 'var(--color-danger-soft)' },
  complained: { label: 'Plainte', color: 'var(--color-warning)', bg: 'var(--color-warning-soft)' },
}

type Filter = 'all' | EmailBroadcastStatus

export function BroadcastsTab({ onCount }: { onCount: (n: number) => void }) {
  const [broadcasts, setBroadcasts] = useState<EmailBroadcast[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [composing, setComposing] = useState(false)
  const [statsFor, setStatsFor] = useState<EmailBroadcast | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      await swrGet<EmailBroadcast[]>('/api/emails/broadcasts', (data) => {
        const arr = Array.isArray(data) ? data : []
        setBroadcasts(arr)
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
    const c: Record<string, number> = { all: broadcasts?.length ?? 0 }
    for (const b of broadcasts ?? []) c[b.status] = (c[b.status] ?? 0) + 1
    return c
  }, [broadcasts])

  const visible = (broadcasts ?? []).filter((b) => filter === 'all' || b.status === filter)

  async function handleDelete(b: EmailBroadcast) {
    if (!confirm('Supprimer cette campagne ?')) return
    setBusy(b.id)
    try {
      await api.delete(`/api/emails/broadcasts/${b.id}`)
      await load()
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  async function handleSendDraft(b: EmailBroadcast) {
    if (!confirm(`Envoyer maintenant la campagne « ${b.name} » à tous les destinataires ciblés ?`)) return
    setBusy(b.id)
    setActionError(null)
    try {
      await apiPostEmpty(`/api/emails/broadcasts/${b.id}/send`)
      await load()
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  if (composing) {
    return (
      <BroadcastComposer
        onCancel={() => setComposing(false)}
        onDone={() => {
          setComposing(false)
          load()
        }}
      />
    )
  }

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
      {broadcasts === null && !error && <LoadingState label="Chargement des campagnes…" />}
      {error && <ErrorState message={error} onRetry={load} />}
      {broadcasts && (
        <TableCard
          title="Campagnes"
          subtitle="Emails ponctuels envoyés à une audience ciblée"
          toolbar={
            <>
              <Chips
                items={[
                  { key: 'all' as Filter, label: 'Toutes', count: counts.all },
                  { key: 'sent' as Filter, label: 'Envoyées', count: counts.sent ?? 0 },
                  { key: 'draft' as Filter, label: 'Brouillons', count: counts.draft ?? 0 },
                  { key: 'failed' as Filter, label: 'Échouées', count: counts.failed ?? 0 },
                ]}
                active={filter}
                onChange={setFilter}
              />
              <button className="ds-pill-button ds-pill-button--dark" onClick={() => setComposing(true)}>
                + Nouvelle campagne
              </button>
            </>
          }
        >
          {visible.length === 0 ? (
            <EmptyState title="Aucune campagne" description="Envoie ton premier email de masse à tes contacts." />
          ) : (
            <table className="ds-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Sujet</th>
                  <th className="ds-num-cell">Destinataires</th>
                  <th>Statut</th>
                  <th className="ds-num-cell">Date d'envoi</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((b) => (
                  <tr key={b.id} className={b.status === 'draft' ? '' : 'ds-row-clickable'} onClick={() => b.status !== 'draft' && setStatsFor(b)}>
                    <td className="mk-name">{b.name}</td>
                    <td className="ds-muted">{b.subject || '—'}</td>
                    <td className="ds-num-cell">
                      <span className="ds-num">
                        {b.status === 'sent' ? `${formatNumber(b.sent_count)}/${formatNumber(b.total_count)}` : b.total_count > 0 ? formatNumber(b.total_count) : '—'}
                      </span>
                    </td>
                    <td>
                      <StatusPill {...(STATUS_MAP[b.status] ?? STATUS_MAP.draft)} />
                    </td>
                    <td className="ds-num-cell">
                      <span className="ds-muted">{b.status === 'sent' ? formatDate(b.sent_at) : formatDate(b.scheduled_at)}</span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="mk-row-actions">
                        {b.status !== 'draft' && (
                          <button className="mk-action" onClick={() => setStatsFor(b)}>
                            Stats
                          </button>
                        )}
                        {(b.status === 'draft' || b.status === 'failed') && (
                          <button className="mk-action mk-action--primary" disabled={busy === b.id} onClick={() => handleSendDraft(b)}>
                            Envoyer
                          </button>
                        )}
                        <button className="mk-action mk-action--danger" disabled={busy === b.id} onClick={() => handleDelete(b)}>
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
      )}
      {statsFor && <BroadcastStatsDrawer broadcast={statsFor} onClose={() => setStatsFor(null)} />}
    </>
  )
}

// ─── Stats drawer (web broadcasts/[id]) ────────────────────────────────────

function BroadcastStatsDrawer({ broadcast, onClose }: { broadcast: EmailBroadcast; onClose: () => void }) {
  const navigate = useNavigate()
  const [data, setData] = useState<BroadcastStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<BroadcastStats>(`/api/emails/broadcasts/${broadcast.id}/stats`)
      .then(setData)
      .catch((err) => setError(errorMessage(err)))
  }, [broadcast.id])

  return (
    <div className="mk-drawer-wide">
      <Drawer title={broadcast.name} onClose={onClose}>
        {error && <ErrorState message={error} />}
        {!data && !error && <LoadingState label="Chargement des statistiques…" />}
        {data && (
          <>
            <p className="ds-muted">
              {data.broadcast.subject || 'Sans sujet'}
              {data.broadcast.sent_at && ` · Envoyé le ${new Date(data.broadcast.sent_at).toLocaleString('fr-FR')}`}
            </p>
            <div className="mk-drawer-stats">
              <StatCard label="Envoyés" value={data.counts.total} />
              <StatCard label="Remis" value={data.counts.delivered} />
              <StatCard label="Ouverts" value={data.counts.opened} caption={`${formatPercent(data.rates.open)} d'ouverture`} highlight />
              <StatCard label="Cliqués" value={data.counts.clicked} caption={`${formatPercent(data.rates.click)} de clic`} />
              <StatCard label="Bounces" value={data.counts.bounced} caption={formatPercent(data.rates.bounce)} />
              <StatCard label="Plaintes" value={data.counts.complained} />
            </div>
            <div className="mk-drawer-section">Destinataires ({formatNumber(data.recipients.length)})</div>
            {data.recipients.length === 0 ? (
              <EmptyState title="Aucun envoi enregistré" />
            ) : (
              <TableCard>
                <table className="ds-table">
                  <thead>
                    <tr>
                      <th>Destinataire</th>
                      <th>Statut</th>
                      <th className="ds-num-cell">Envoyé</th>
                      <th className="ds-num-cell">Ouvert</th>
                      <th className="ds-num-cell">Cliqué</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recipients.map((r) => {
                      const name = r.lead ? [r.lead.first_name, r.lead.last_name].filter(Boolean).join(' ') || '—' : '—'
                      const st = RECIPIENT_STATUS[r.status] ?? RECIPIENT_STATUS.sent
                      return (
                        <tr
                          key={r.send_id}
                          className={r.lead_id ? 'ds-row-clickable' : ''}
                          onClick={() => r.lead_id && navigate(`/leads/${r.lead_id}`)}
                        >
                          <td>
                            <div className="mk-name">{name}</div>
                            <div className="ds-muted">{r.lead?.email || '—'}</div>
                          </td>
                          <td>
                            <StatusPill {...st} />
                          </td>
                          <td className="ds-num-cell ds-muted">{formatDateTime(r.sent_at)}</td>
                          <td className="ds-num-cell ds-muted">{formatDateTime(r.opened_at)}</td>
                          <td className="ds-num-cell ds-muted">{formatDateTime(r.clicked_at)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </TableCard>
            )}
          </>
        )}
      </Drawer>
    </div>
  )
}

// ─── Composer (web broadcasts/new + BroadcastFilterBuilder) ─────────────────

type Mode = 'template' | 'libre'

function BroadcastComposer({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [mode, setMode] = useState<Mode>('template')
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [body, setBody] = useState('')
  const [filters, setFilters] = useState<EmailBroadcastFilters>({})
  const [count, setCount] = useState<number | null>(null)
  const [counting, setCounting] = useState(false)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const selectedTemplate = templates.find((t) => t.id === templateId)

  useEffect(() => {
    api
      .get<EmailTemplate[]>('/api/emails/templates')
      .then((d) => setTemplates(Array.isArray(d) ? d : []))
      .catch(() => setTemplates([]))
  }, [])

  // Auto-fill subject from the chosen template (web behaviour).
  useEffect(() => {
    if (mode === 'template' && selectedTemplate?.subject && !subject) setSubject(selectedTemplate.subject)
  }, [mode, selectedTemplate, subject])

  // Debounced recipient count (web BroadcastFilterBuilder).
  useEffect(() => {
    const t = setTimeout(async () => {
      setCounting(true)
      try {
        const r = await api.post<{ count: number }>('/api/emails/broadcasts/_/preview-count', filters)
        setCount(r.count)
      } catch {
        setCount(null)
      }
      setCounting(false)
    }, 500)
    return () => clearTimeout(t)
  }, [filters])

  // Template preview compiled server-side.
  useEffect(() => {
    if (mode !== 'template' || !selectedTemplate) {
      setPreviewHtml(null)
      return
    }
    let cancelled = false
    apiPostText('/api/emails/templates/preview', { blocks: selectedTemplate.blocks ?? [], preview_text: selectedTemplate.preview_text ?? undefined })
      .then((html) => !cancelled && setPreviewHtml(html))
      .catch(() => !cancelled && setPreviewHtml(null))
    return () => {
      cancelled = true
    }
  }, [mode, selectedTemplate])

  function toggle<K extends 'statuses' | 'sources'>(key: K, value: string) {
    const current = (filters[key] ?? []) as string[]
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
    setFilters({ ...filters, [key]: next } as EmailBroadcastFilters)
  }

  function validate(): string | null {
    if (!name.trim()) return 'Donne un nom à la campagne'
    if (!subject.trim()) return 'Sujet requis'
    if (mode === 'template' && !templateId) return 'Choisis un template'
    if (mode === 'libre' && !body.trim()) return 'Le message ne peut pas être vide'
    return null
  }

  function payload(): Record<string, unknown> {
    const p: Record<string, unknown> = { name, subject, filters }
    if (mode === 'template') p.template_id = templateId
    else {
      const html = textToEmailHtml(body)
      p.body_html = html
      p.body_text = htmlToPlainLine(html)
    }
    return p
  }

  async function submit(send: boolean) {
    const v = validate()
    if (v) {
      setError(v)
      return
    }
    if (send && !confirm(`Envoyer maintenant à ${count != null ? formatNumber(count) : '?'} destinataire(s) ?`)) return
    setError('')
    setSending(true)
    try {
      const created = await api.post<EmailBroadcast>('/api/emails/broadcasts', payload())
      if (send) await apiPostEmpty(`/api/emails/broadcasts/${created.id}/send`)
      onDone()
    } catch (err) {
      setError(errorMessage(err))
      setSending(false)
    }
  }

  const libreHtml = body.trim()
    ? `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;font-size:14px;line-height:1.6;background:#fff;}</style></head><body>${textToEmailHtml(body)}</body></html>`
    : null

  return (
    <div className="mk-card">
      <div className="mk-header">
        <div>
          <h2 className="mk-section-title">Nouvelle campagne</h2>
          <p>Compose, cible et envoie un email à tes leads.</p>
        </div>
        <div className="mk-header-actions">
          <button className="mk-action" onClick={() => openWeb('/acquisition/emails/broadcasts/new')}>
            Éditeur riche sur le web ↗
          </button>
          <Button variant="ghost" onClick={onCancel}>
            ← Retour aux campagnes
          </Button>
        </div>
      </div>

      <div className="mk-compose-grid">
        <div className="mk-form">
          <div className="mk-field">
            <label>Nom de la campagne</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Promo janvier" />
          </div>
          <div className="mk-field">
            <label>Contenu</label>
            <Tabs
              items={[
                { key: 'template' as Mode, label: 'Template' },
                { key: 'libre' as Mode, label: 'Email libre' },
              ]}
              active={mode}
              onChange={setMode}
            />
          </div>
          {mode === 'template' ? (
            <div className="mk-field">
              <label>Template email</label>
              <select className="ds-input" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                <option value="">Choisir un template…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="mk-field">
              <label>Message</label>
              <Textarea
                rows={10}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Écris ton message ici… Variables disponibles : {{prenom}}, {{nom}}…"
              />
            </div>
          )}
          <div className="mk-field">
            <label>Sujet de l'email</label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex : Une offre spéciale pour toi {{prenom}}" />
          </div>

          <div className="mk-drawer-section">Ciblage</div>
          <div className="mk-recipient-count">
            Destinataires : <strong>{counting ? '…' : count != null ? formatNumber(count) : '—'}</strong>
          </div>
          <div className="mk-field">
            <span className="mk-label">Statut pipeline</span>
            <div className="mk-toggle-chips">
              {BROADCAST_STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  className={`mk-toggle-chip ${(filters.statuses ?? []).includes(s.value as LeadStatus) ? 'mk-toggle-chip--on' : ''}`}
                  onClick={() => toggle('statuses', s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mk-field">
            <span className="mk-label">Source</span>
            <div className="mk-toggle-chips">
              {BROADCAST_SOURCES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  className={`mk-toggle-chip ${(filters.sources ?? []).includes(s.value as LeadSource) ? 'mk-toggle-chip--on' : ''}`}
                  onClick={() => toggle('sources', s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mk-form-row">
            <div className="mk-field">
              <label>Créé après</label>
              <Input type="date" value={filters.date_from ?? ''} onChange={(e) => setFilters({ ...filters, date_from: e.target.value || undefined })} />
            </div>
            <div className="mk-field">
              <label>Créé avant</label>
              <Input type="date" value={filters.date_to ?? ''} onChange={(e) => setFilters({ ...filters, date_to: e.target.value || undefined })} />
            </div>
          </div>
          <div className="mk-field">
            <label>Joint</label>
            <select
              className="ds-input"
              value={filters.reached ?? 'all'}
              onChange={(e) => setFilters({ ...filters, reached: e.target.value as 'all' | 'true' | 'false' })}
            >
              <option value="all">Tous</option>
              <option value="true">Oui</option>
              <option value="false">Non</option>
            </select>
          </div>

          {error && <p className="lead-create-error">{error}</p>}
          <div className="lead-create-actions">
            <Button variant="primary" disabled={sending} onClick={() => submit(true)}>
              {sending ? 'Envoi en cours…' : 'Envoyer maintenant'}
            </Button>
            <Button variant="secondary" disabled={sending} onClick={() => submit(false)}>
              Enregistrer en brouillon
            </Button>
          </div>
        </div>

        <div className="mk-form">
          <span className="mk-label">Aperçu de l'email</span>
          {mode === 'template' && previewHtml ? (
            <iframe className="mk-preview-frame" sandbox="" srcDoc={previewHtml} title="Aperçu" />
          ) : mode === 'libre' && libreHtml ? (
            <iframe className="mk-preview-frame" sandbox="" srcDoc={libreHtml} title="Aperçu" />
          ) : (
            <div className="mk-preview-empty">
              {mode === 'template' ? "Sélectionne un template pour voir l'aperçu" : "Écris ton message pour voir l'aperçu"}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
