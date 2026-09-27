// Acquisition > Funnels — mirrors src/app/(dashboard)/acquisition/funnels
// (list + /new template gallery + FunnelCard menu) on the same routes:
// GET/POST /api/funnels, GET/PUT/DELETE /api/funnels/:id,
// POST /api/funnels/:id/publish, GET/POST /api/funnels/:id/pages,
// GET /api/funnels/:id/stats?days=N, GET/PUT /api/workspaces/slug.
// Per-funnel views/leads/conversion come from the stats route (the same data
// the web builder exposes). The visual page builder stays on the web
// (openWeb('/acquisition/funnels/:id')).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, ApiError } from '../../lib/api-client'
import { openWeb, webUrl } from '../../lib/web-link'
import { Button } from '../../design-system/Button'
import { Input } from '../../design-system/Input'
import { Drawer } from '../../design-system/Drawer'
import { SearchInput } from '../../design-system/SearchInput'
import { StatCard, StatGrid, formatNumber } from '../../design-system/StatCard'
import { TableCard, SortHeader } from '../../design-system/TableCard'
import { Chips, Tabs } from '../../design-system/Tabs'
import { StatusPill } from '../../design-system/StatusPill'
import { LoadingState, ErrorState, EmptyState } from '../../design-system/States'
import { apiPostEmpty, errorMessage } from './http'
import { FUNNEL_TEMPLATES, type FunnelTemplateMeta } from './catalog'
import { formatDate, formatPercent, normalizeWorkspaceSlug, percent, publicFunnelPath } from './format'
import type { FunnelDetail, FunnelListItem, FunnelStats } from './types'
import './marketing.css'
import '../leads/lead-create-modal.css'
import { swrGet } from '../../lib/query-cache'

type Period = '7' | '30' | '90'
type StatusFilter = 'all' | 'published' | 'draft'
type SortKey = 'name' | 'views' | 'leads' | 'conversion' | 'created_at'

const PERIODS: { key: Period; label: string }[] = [
  { key: '7', label: '7 jours' },
  { key: '30', label: '30 jours' },
  { key: '90', label: '90 jours' },
]

const STATUS_PILL = {
  published: { label: 'En ligne', color: 'var(--color-success)', bg: 'var(--color-success-soft)' },
  draft: { label: 'Brouillon', color: 'var(--color-text-tertiary)', bg: 'var(--color-bg-muted)' },
}

const builderPath = (id: string) => `/acquisition/funnels/${id}`

interface Row extends FunnelListItem {
  stats: FunnelStats | null | undefined // undefined = loading, null = failed
}

function rowViews(r: Row): number | null {
  return r.stats ? r.stats.totals.views : null
}
function rowLeads(r: Row): number | null {
  return r.stats ? r.stats.totals.form_submits : null
}
function rowConversion(r: Row): number | null {
  return r.stats ? percent(r.stats.totals.form_submits, r.stats.totals.views) : null
}

export function FunnelsPage() {
  const [funnels, setFunnels] = useState<FunnelListItem[] | null>(null)
  const [stats, setStats] = useState<Record<string, FunnelStats | null>>({})
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>('30')
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; order: 'asc' | 'desc' }>({ key: 'created_at', order: 'desc' })
  const [workspaceSlug, setWorkspaceSlug] = useState<{ slug: string | null; fetched: boolean }>({ slug: null, fetched: false })
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ id: string; text: string } | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [renaming, setRenaming] = useState<FunnelListItem | null>(null)
  const [slugModal, setSlugModal] = useState<{ thenPublish: FunnelListItem | null } | null>(null)
  const [statsFor, setStatsFor] = useState<FunnelListItem | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      await swrGet<{ data: FunnelListItem[] }>('/api/funnels', (res) => setFunnels(Array.isArray(res.data) ? res.data : []))
    } catch (err) {
      setError(errorMessage(err))
    }
  }, [])

  useEffect(() => {
    load()
    api
      .get<{ slug: string | null }>('/api/workspaces/slug')
      .then((r) => setWorkspaceSlug({ slug: typeof r.slug === 'string' ? r.slug : null, fetched: true }))
      .catch(() => setWorkspaceSlug({ slug: null, fetched: true }))
  }, [load])

  // Per-funnel stats for the selected period (one request per funnel — the
  // list route carries no analytics).
  useEffect(() => {
    if (!funnels) return
    let cancelled = false
    setStats({})
    Promise.all(
      funnels.map(async (f) => {
        try {
          const r = await api.get<{ data: FunnelStats }>(`/api/funnels/${f.id}/stats?days=${period}`)
          return [f.id, r.data] as const
        } catch {
          return [f.id, null] as const
        }
      }),
    ).then((entries) => {
      if (!cancelled) setStats(Object.fromEntries(entries))
    })
    return () => {
      cancelled = true
    }
  }, [funnels, period])

  const rows: Row[] = useMemo(
    () => (funnels ?? []).map((f) => ({ ...f, stats: f.id in stats ? stats[f.id] : undefined })),
    [funnels, stats],
  )

  const counts = useMemo(
    () => ({
      all: rows.length,
      published: rows.filter((r) => r.status === 'published').length,
      draft: rows.filter((r) => r.status === 'draft').length,
    }),
    [rows],
  )

  const statsReady = rows.length > 0 && rows.every((r) => r.stats !== undefined)
  const totals = useMemo(() => {
    let views = 0
    let leads = 0
    for (const r of rows) {
      views += rowViews(r) ?? 0
      leads += rowLeads(r) ?? 0
    }
    return { views, leads }
  }, [rows])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = rows.filter(
      (r) => (filter === 'all' || r.status === filter) && (!q || r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q)),
    )
    const dir = sort.order === 'asc' ? 1 : -1
    const val = (r: Row): number | string => {
      switch (sort.key) {
        case 'name':
          return r.name.toLowerCase()
        case 'views':
          return rowViews(r) ?? -1
        case 'leads':
          return rowLeads(r) ?? -1
        case 'conversion':
          return rowConversion(r) ?? -1
        default:
          return r.created_at
      }
    }
    return [...list].sort((a, b) => (val(a) < val(b) ? -dir : val(a) > val(b) ? dir : 0))
  }, [rows, filter, search, sort])

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, order: s.order === 'asc' ? 'desc' : 'asc' } : { key, order: key === 'name' ? 'asc' : 'desc' }))
  }

  async function run(id: string, fn: () => Promise<void>) {
    setBusy(id)
    setActionError(null)
    try {
      await fn()
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  async function doTogglePublish(f: FunnelListItem) {
    await run(f.id, async () => {
      const r = await apiPostEmpty<{ data: { status: FunnelListItem['status'] } }>(`/api/funnels/${f.id}/publish`)
      setFunnels((prev) => prev?.map((x) => (x.id === f.id ? { ...x, status: r.data.status } : x)) ?? prev)
    })
  }

  function handleTogglePublish(f: FunnelListItem) {
    // Web builder: publishing without a workspace name first asks for it.
    if (f.status === 'draft' && workspaceSlug.fetched && !workspaceSlug.slug) {
      setSlugModal({ thenPublish: f })
      return
    }
    doTogglePublish(f)
  }

  async function handleDelete(f: FunnelListItem) {
    if (!confirm(`Supprimer le funnel « ${f.name} » ? Ses pages et statistiques seront supprimées.`)) return
    await run(f.id, async () => {
      await api.delete(`/api/funnels/${f.id}`)
      setFunnels((prev) => prev?.filter((x) => x.id !== f.id) ?? prev)
    })
  }

  async function handleDuplicate(f: FunnelListItem) {
    await run(f.id, async () => {
      const src = await api.get<{ data: FunnelDetail }>(`/api/funnels/${f.id}`)
      const created = await api.post<{ data: FunnelListItem }>('/api/funnels', {
        name: `${src.data.name} (copie)`,
        description: src.data.description ?? undefined,
      })
      const newId = created.data.id
      try {
        for (const page of src.data.pages) {
          await api.post(`/api/funnels/${newId}/pages`, { name: page.name, slug: page.slug, blocks: page.blocks ?? [] })
        }
        const design: Record<string, unknown> = {}
        if (src.data.preset_id) design.preset_id = src.data.preset_id
        if (src.data.preset_override !== undefined) design.preset_override = src.data.preset_override
        if (src.data.effects_config) design.effects_config = src.data.effects_config
        if (src.data.meta_pixel_id) design.meta_pixel_id = src.data.meta_pixel_id
        if (Object.keys(design).length > 0) await api.put(`/api/funnels/${newId}`, design)
      } catch (err) {
        await api.delete(`/api/funnels/${newId}`).catch(() => undefined)
        throw err
      }
      setNotice({ id: newId, text: `« ${created.data.name} » créé (brouillon).` })
      await load()
    })
  }

  function publicPath(f: FunnelListItem): string | null {
    return f.status === 'published' ? publicFunnelPath(workspaceSlug.slug, f.slug, f.first_page_slug) : null
  }

  const missingSlug = workspaceSlug.fetched && !workspaceSlug.slug && counts.published > 0

  return (
    <div className="mk-page">
      <div className="mk-header">
        <div>
          <h1>Funnels</h1>
          <p>Créez et gérez vos tunnels de vente</p>
        </div>
        <div className="mk-header-actions">
          <Tabs items={PERIODS} active={period} onChange={setPeriod} />
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            + Nouveau funnel
          </Button>
        </div>
      </div>

      {missingSlug && (
        <div className="mk-banner mk-banner--warning">
          <span>Des funnels sont publiés mais votre espace n'a pas de nom : leurs liens publics ne sont pas encore disponibles.</span>
          <button className="mk-action" onClick={() => setSlugModal({ thenPublish: null })}>
            Configurer le nom de votre espace
          </button>
        </div>
      )}
      {notice && (
        <div className="mk-banner mk-banner--success">
          <span>{notice.text}</span>
          <button className="mk-action" onClick={() => openWeb(builderPath(notice.id))}>
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

      {funnels === null && !error && <LoadingState label="Chargement des funnels…" />}
      {error && <ErrorState message={error} onRetry={load} />}

      {funnels && (
        <StatGrid>
          <StatCard label="Funnels" value={counts.all} caption={`${formatNumber(counts.published)} en ligne · ${formatNumber(counts.draft)} brouillon(s)`} />
          <StatCard label={`Vues · ${period} j`} value={statsReady ? totals.views : '—'} caption="Pages vues sur tous les funnels" />
          <StatCard label={`Leads · ${period} j`} value={statsReady ? totals.leads : '—'} caption="Formulaires soumis" />
          <StatCard
            label="Taux de conversion"
            highlight
            value={statsReady ? formatPercent(percent(totals.leads, totals.views)) : '—'}
            caption="Leads / vues"
          />
        </StatGrid>
      )}

      {funnels && funnels.length === 0 && (
        <EmptyState title="Aucun funnel" description="Commencez par créer votre premier tunnel de vente." />
      )}

      {funnels && funnels.length > 0 && (
        <TableCard
          title="Vos funnels"
          subtitle={`Statistiques sur les ${period} derniers jours`}
          toolbar={
            <>
              <Chips
                items={[
                  { key: 'all' as const, label: 'Tous', count: counts.all },
                  { key: 'published' as const, label: 'En ligne', count: counts.published },
                  { key: 'draft' as const, label: 'Brouillons', count: counts.draft },
                ]}
                active={filter}
                onChange={setFilter}
              />
              <SearchInput value={search} onChange={setSearch} placeholder="Rechercher un funnel…" />
            </>
          }
        >
          {visible.length === 0 ? (
            <EmptyState title="Aucun funnel ne correspond à vos filtres" />
          ) : (
            <table className="ds-table">
              <thead>
                <tr>
                  <SortHeader label="Funnel" active={sort.key === 'name'} order={sort.order} onClick={() => toggleSort('name')} />
                  <th>Statut</th>
                  <th className="ds-num-cell">Pages</th>
                  <SortHeader label="Vues" align="right" active={sort.key === 'views'} order={sort.order} onClick={() => toggleSort('views')} />
                  <SortHeader label="Leads" align="right" active={sort.key === 'leads'} order={sort.order} onClick={() => toggleSort('leads')} />
                  <SortHeader
                    label="Conversion"
                    align="right"
                    active={sort.key === 'conversion'}
                    order={sort.order}
                    onClick={() => toggleSort('conversion')}
                  />
                  <SortHeader label="Créé le" align="right" active={sort.key === 'created_at'} order={sort.order} onClick={() => toggleSort('created_at')} />
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((f) => {
                  const path = publicPath(f)
                  const views = rowViews(f)
                  const leads = rowLeads(f)
                  const loadingStat = f.stats === undefined
                  return (
                    <tr key={f.id} className="ds-row-clickable" onClick={() => setStatsFor(f)}>
                      <td>
                        <div className="mk-name">{f.name}</div>
                        {path ? (
                          <button
                            className="mk-link"
                            title={webUrl(path)}
                            onClick={(e) => {
                              e.stopPropagation()
                              openWeb(path)
                            }}
                          >
                            {webUrl(path).replace(/^https?:\/\//, '')} ↗
                          </button>
                        ) : (
                          <div className="ds-muted">/{f.slug}</div>
                        )}
                      </td>
                      <td>
                        <StatusPill {...STATUS_PILL[f.status]} />
                      </td>
                      <td className="ds-num-cell">
                        <span className="ds-num">{formatNumber(f.page_count)}</span>
                      </td>
                      <td className="ds-num-cell">
                        <span className="ds-num">{loadingStat ? '…' : views == null ? '—' : formatNumber(views)}</span>
                      </td>
                      <td className="ds-num-cell">
                        <span className="ds-num">{loadingStat ? '…' : leads == null ? '—' : formatNumber(leads)}</span>
                      </td>
                      <td className="ds-num-cell">
                        <span className="ds-num">{loadingStat ? '…' : formatPercent(rowConversion(f))}</span>
                      </td>
                      <td className="ds-num-cell">
                        <span className="ds-muted">{formatDate(f.created_at)}</span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="mk-row-actions">
                          <button className="mk-action" onClick={() => openWeb(builderPath(f.id))}>
                            Éditer ↗
                          </button>
                          <button
                            className={`mk-action ${f.status === 'draft' ? 'mk-action--primary' : ''}`}
                            disabled={busy === f.id}
                            onClick={() => handleTogglePublish(f)}
                          >
                            {f.status === 'published' ? 'Dépublier' : 'Publier'}
                          </button>
                          <button className="mk-action" disabled={busy === f.id} onClick={() => handleDuplicate(f)}>
                            Dupliquer
                          </button>
                          <button className="mk-action" disabled={busy === f.id} onClick={() => setRenaming(f)}>
                            Renommer
                          </button>
                          <button className="mk-action mk-action--danger" disabled={busy === f.id} onClick={() => handleDelete(f)}>
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

      {showCreate && (
        <CreateFunnelModal
          onClose={() => setShowCreate(false)}
          onCreated={(f) => {
            setShowCreate(false)
            setNotice({ id: f.id, text: `« ${f.name} » créé. Personnalisez ses pages dans l'éditeur.` })
            load()
          }}
        />
      )}

      {renaming && (
        <RenameFunnelModal
          funnel={renaming}
          onClose={() => setRenaming(null)}
          onSaved={(name) => {
            setFunnels((prev) => prev?.map((x) => (x.id === renaming.id ? { ...x, name } : x)) ?? prev)
            setRenaming(null)
          }}
        />
      )}

      {slugModal && (
        <WorkspaceNameModal
          onCancel={() => setSlugModal(null)}
          onSaved={(slug) => {
            setWorkspaceSlug({ slug, fetched: true })
            const pending = slugModal.thenPublish
            setSlugModal(null)
            if (pending) doTogglePublish(pending)
          }}
        />
      )}

      {statsFor && (
        <FunnelStatsDrawer
          funnel={statsFor}
          publicPath={publicPath(statsFor)}
          onClose={() => setStatsFor(null)}
        />
      )}
    </div>
  )
}

// ─── Create (web /acquisition/funnels/new) ─────────────────────────────────

function CreateFunnelModal({ onClose, onCreated }: { onClose: () => void; onCreated: (f: FunnelListItem) => void }) {
  const [creating, setCreating] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function create(template: FunnelTemplateMeta | null) {
    if (creating) return
    setCreating(template?.id ?? 'blank')
    setError(null)
    try {
      const body: Record<string, string> = { name: template?.name ?? 'Mon funnel' }
      if (template) body.template_id = template.id
      const res = await api.post<{ data: FunnelListItem }>('/api/funnels', body)
      onCreated(res.data)
    } catch (err) {
      setError(errorMessage(err))
      setCreating(null)
    }
  }

  const renderCard = (t: FunnelTemplateMeta) => (
    <button key={t.id} className="mk-pick-card" disabled={!!creating || t.comingSoon} onClick={() => create(t)}>
      <div className="mk-pick-title">
        <span>{t.name}</span>
        <span className="ds-muted">{t.comingSoon ? 'Bientôt' : `${t.pageCount} page${t.pageCount > 1 ? 's' : ''}`}</span>
      </div>
      <div className="mk-pick-desc">{t.description}</div>
      {creating === t.id && <div className="ds-muted">Création…</div>}
    </button>
  )

  return (
    <div className="lead-create-overlay" onClick={onClose}>
      <div className="lead-create-modal mk-modal-wide" onClick={(e) => e.stopPropagation()}>
        <h2>Nouveau funnel</h2>
        <p className="mk-section-sub">Choisissez un template ou partez de zéro</p>
        {error && <p className="lead-create-error">{error}</p>}
        <button className="mk-pick-card mk-pick-card--dashed" disabled={!!creating} onClick={() => create(null)}>
          <div className="mk-pick-title">Page vierge</div>
          <div className="mk-pick-desc">Partez de zéro avec une page vide</div>
          {creating === 'blank' && <div className="ds-muted">Création…</div>}
        </button>
        <div className="mk-group-title">Funnels complets</div>
        <div className="mk-card-grid">{FUNNEL_TEMPLATES.filter((t) => t.kind === 'funnel').map(renderCard)}</div>
        <div className="mk-group-title">Pages individuelles</div>
        <div className="mk-card-grid">{FUNNEL_TEMPLATES.filter((t) => t.kind === 'page').map(renderCard)}</div>
        <div className="lead-create-actions">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
        </div>
      </div>
    </div>
  )
}

function RenameFunnelModal({ funnel, onClose, onSaved }: { funnel: FunnelListItem; onClose: () => void; onSaved: (name: string) => void }) {
  const [name, setName] = useState(funnel.name)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await api.put(`/api/funnels/${funnel.id}`, { name: name.trim() })
      onSaved(name.trim())
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <div className="lead-create-overlay" onClick={onClose}>
      <div className="lead-create-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Renommer le funnel</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          {error && <p className="lead-create-error">{error}</p>}
          <div className="lead-create-actions">
            <Button type="submit" variant="primary" disabled={saving || !name.trim()}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

/** Web WorkspaceNameModal — PUT /api/workspaces/slug. */
function WorkspaceNameModal({ onSaved, onCancel }: { onSaved: (slug: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const normalized = normalizeWorkspaceSlug(value)
  const isValid = normalized.length >= 3

  async function submit() {
    if (!isValid || saving) return
    setSaving(true)
    setError(null)
    try {
      await api.put('/api/workspaces/slug', { slug: normalized })
      onSaved(normalized)
    } catch (err) {
      const msg = errorMessage(err)
      setError(err instanceof ApiError && err.status === 409 ? 'Ce nom est déjà pris. Essaie un autre.' : msg)
      setSaving(false)
    }
  }

  return (
    <div className="lead-create-overlay" onClick={onCancel}>
      <div className="lead-create-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Choisissez un nom pour vos pages</h2>
        <p className="mk-section-sub">Ce nom court apparaîtra dans l'adresse de toutes vos pages publiées.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="ex : remy-coaching" autoFocus />
          <p className="ds-muted">{normalized ? webUrl(`/f/${normalized}/…`) : 'Au moins 3 caractères'}</p>
          {error && <p className="lead-create-error">{error}</p>}
          <div className="lead-create-actions">
            <Button type="submit" variant="primary" disabled={!isValid || saving}>
              {saving ? 'Enregistrement…' : 'Valider'}
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel}>
              Annuler
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Stats drawer (GET /api/funnels/:id/stats) ─────────────────────────────

function FunnelStatsDrawer({ funnel, publicPath, onClose }: { funnel: FunnelListItem; publicPath: string | null; onClose: () => void }) {
  const [days, setDays] = useState<Period>('30')
  const [stats, setStats] = useState<FunnelStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setStats(null)
    setError(null)
    try {
      const r = await api.get<{ data: FunnelStats }>(`/api/funnels/${funnel.id}/stats?days=${days}`)
      setStats(r.data)
    } catch (err) {
      setError(errorMessage(err))
    }
  }, [funnel.id, days])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="mk-drawer-wide">
      <Drawer title={funnel.name} onClose={onClose}>
        <div className="mk-toolbar">
          <Tabs items={PERIODS} active={days} onChange={setDays} />
          <button className="mk-action" onClick={() => openWeb(builderPath(funnel.id))}>
            Ouvrir l'éditeur ↗
          </button>
          {publicPath && (
            <button className="mk-action" onClick={() => openWeb(publicPath)}>
              Voir la page publique ↗
            </button>
          )}
        </div>

        {error && <ErrorState message={error} onRetry={load} />}
        {!stats && !error && <LoadingState label="Chargement des statistiques…" />}
        {stats && (
          <>
            <div className="mk-drawer-section">Période · {stats.period_days} jours</div>
            <div className="mk-drawer-stats">
              <StatCard label="Vues" value={stats.totals.views} />
              <StatCard label="Leads (formulaires)" value={stats.totals.form_submits} />
              <StatCard label="Clics boutons" value={stats.totals.button_clicks} />
              <StatCard label="Lectures vidéo" value={stats.totals.video_plays} />
              <StatCard
                label="Conversion vues → leads"
                highlight
                value={formatPercent(percent(stats.totals.form_submits, stats.totals.views))}
              />
              <StatCard
                label="Parcours complet"
                value={stats.pages.length > 1 ? formatPercent(stats.funnel_conversion.conversion_rate) : '—'}
                caption={
                  stats.pages.length > 1
                    ? `${formatNumber(stats.funnel_conversion.last_page_views)} / ${formatNumber(stats.funnel_conversion.first_page_views)} vues 1ʳᵉ → dernière page`
                    : 'Funnel d’une seule page'
                }
              />
            </div>

            <div className="mk-drawer-section">Par page</div>
            {stats.pages.length === 0 ? (
              <EmptyState title="Aucune page" description="Ce funnel ne contient pas encore de page." />
            ) : (
              <TableCard>
                <table className="ds-table">
                  <thead>
                    <tr>
                      <th>Page</th>
                      <th className="ds-num-cell">Vues</th>
                      <th className="ds-num-cell">Leads</th>
                      <th className="ds-num-cell">Conv.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.pages.map((p, i) => (
                      <tr key={p.id}>
                        <td>
                          <div className="mk-name">
                            {i + 1}. {p.name}
                          </div>
                          <div className="ds-muted">/{p.slug}</div>
                        </td>
                        <td className="ds-num-cell">
                          <span className="ds-num">{formatNumber(p.views_count)}</span>
                        </td>
                        <td className="ds-num-cell">
                          <span className="ds-num">{formatNumber(p.submissions_count)}</span>
                        </td>
                        <td className="ds-num-cell">
                          <span className="ds-num">{p.views_count > 0 ? formatPercent(p.conversion_rate) : '—'}</span>
                        </td>
                      </tr>
                    ))}
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
