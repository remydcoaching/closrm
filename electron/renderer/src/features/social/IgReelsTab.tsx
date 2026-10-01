// Instagram › Reels + Piliers — port of IgReelsTab.tsx. Endpoints:
// GET/PATCH /api/instagram/reels (reel_id, pillar_id, format),
// GET/POST/PUT/DELETE /api/instagram/pillars (PUT/DELETE take {id} in body).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api-client'
import { swrMany } from '../../lib/query-cache'
import { StatCard, StatGrid, formatNumber } from '../../design-system/StatCard'
import { SortHeader, TableCard } from '../../design-system/TableCard'
import { Drawer } from '../../design-system/Drawer'
import { Input, Textarea } from '../../design-system/Input'
import { EmptyState, ErrorState, LoadingState } from '../../design-system/States'
import { ConfirmButton, Field, Modal } from './ui'
import { errMsg, http } from './http'
import { reelUrl } from './social-utils'
import type { ContentPillar, IgReel, ListResponse } from './types'

type Notify = (text: string, tone?: 'success' | 'danger' | 'info' | 'warning') => void
type SortKey = 'published_at' | 'views' | 'saves' | 'shares' | 'comments' | 'engagement_rate'

const FORMATS: { value: NonNullable<IgReel['format']>; label: string }[] = [
  { value: 'talking_head', label: 'Talking Head' },
  { value: 'text_overlay', label: 'Text Overlay' },
  { value: 'raw_documentary', label: 'Raw Documentary' },
]

function readNotes(mediaId: string): string {
  try {
    return localStorage.getItem(`reel-notes-${mediaId}`) ?? ''
  } catch {
    return ''
  }
}

export function IgReelsTab({ notify }: { notify: Notify }) {
  const [reels, setReels] = useState<IgReel[]>([])
  const [pillars, setPillars] = useState<ContentPillar[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>('published_at')
  const [order, setOrder] = useState<'asc' | 'desc'>('desc')
  const [selected, setSelected] = useState<IgReel | null>(null)
  const [pillarModal, setPillarModal] = useState<{ pillar?: ContentPillar } | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      await swrMany<[ListResponse<IgReel>, ListResponse<ContentPillar>]>(['/api/instagram/reels?per_page=100', '/api/instagram/pillars'], ([r, p]) => {
        setReels(r.data ?? [])
        setPillars(p.data ?? [])
        setLoading(false)
      })
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const sorted = useMemo(() => {
    const dir = order === 'asc' ? 1 : -1
    return [...reels].sort((a, b) => {
      const va = sort === 'published_at' ? Date.parse(a.published_at) : a[sort]
      const vb = sort === 'published_at' ? Date.parse(b.published_at) : b[sort]
      return (va - vb) * dir
    })
  }, [reels, sort, order])

  function toggleSort(k: SortKey) {
    if (sort === k) setOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
    else {
      setSort(k)
      setOrder('desc')
    }
  }

  async function patchReel(reelId: string, patch: { pillar_id?: string | null; format?: string | null }) {
    try {
      await api.patch('/api/instagram/reels', { reel_id: reelId, ...patch })
      setReels((prev) =>
        prev.map((r) =>
          r.id === reelId
            ? {
                ...r,
                ...(patch.pillar_id !== undefined ? { pillar_id: patch.pillar_id || null } : {}),
                ...(patch.format !== undefined ? { format: (patch.format || null) as IgReel['format'] } : {}),
              }
            : r,
        ),
      )
      setSelected((s) => (s && s.id === reelId ? { ...s, ...(patch.pillar_id !== undefined ? { pillar_id: patch.pillar_id || null } : {}), ...(patch.format !== undefined ? { format: (patch.format || null) as IgReel['format'] } : {}) } : s))
    } catch (e) {
      notify(errMsg(e), 'danger')
    }
  }

  async function deletePillar(id: string) {
    try {
      await http('DELETE', '/api/instagram/pillars', { id })
      notify('Pilier supprimé')
      void load()
    } catch (e) {
      notify(errMsg(e), 'danger')
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />

  const totalViews = reels.reduce((s, r) => s + r.views, 0)
  const avgEng = reels.length ? reels.reduce((s, r) => s + r.engagement_rate, 0) / reels.length : null
  const avgReach = reels.length ? reels.reduce((s, r) => s + r.reach, 0) / reels.length : null
  const distribution = [
    ...pillars.map((p) => ({ name: p.name, color: p.color, value: reels.filter((r) => r.pillar_id === p.id).length })).filter((d) => d.value > 0),
    ...(reels.some((r) => !r.pillar_id) ? [{ name: 'Non assigné', color: '#9aa0a6', value: reels.filter((r) => !r.pillar_id).length }] : []),
  ]
  const distTotal = distribution.reduce((s, d) => s + d.value, 0)

  return (
    <div className="soc-stack">
      <StatGrid>
        <StatCard label="Total vues" value={totalViews} highlight />
        <StatCard label="Engagement moyen" value={avgEng === null ? '—' : `${avgEng.toFixed(1)} %`} />
        <StatCard label="Total reels" value={reels.length} />
        <StatCard label="Reach moyen" value={avgReach === null ? '—' : Math.round(avgReach)} />
      </StatGrid>

      <TableCard title="Reels" subtitle={`${reels.length} reels synchronisés`}>
        {reels.length === 0 ? (
          <EmptyState title="Aucun reel synchronisé" description="Utilise le bouton Synchroniser en haut de la page." />
        ) : (
          <table className="ds-table">
            <thead>
              <tr>
                <th>Caption</th>
                <th>Pilier</th>
                <SortHeader label="Publié" active={sort === 'published_at'} order={order} onClick={() => toggleSort('published_at')} align="right" />
                <SortHeader label="Vues" active={sort === 'views'} order={order} onClick={() => toggleSort('views')} align="right" />
                <SortHeader label="Saves" active={sort === 'saves'} order={order} onClick={() => toggleSort('saves')} align="right" />
                <SortHeader label="Partages" active={sort === 'shares'} order={order} onClick={() => toggleSort('shares')} align="right" />
                <SortHeader label="Com." active={sort === 'comments'} order={order} onClick={() => toggleSort('comments')} align="right" />
                <SortHeader label="Engagement" active={sort === 'engagement_rate'} order={order} onClick={() => toggleSort('engagement_rate')} align="right" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} className="ds-row-clickable" onClick={() => setSelected(r)}>
                  <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.caption?.slice(0, 80) ?? '—'}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <select className="soc-select" value={r.pillar_id ?? ''} onChange={(e) => void patchReel(r.id, { pillar_id: e.target.value || null })}>
                      <option value="">—</option>
                      {pillars.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="ds-num-cell"><span className="ds-num">{new Date(r.published_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span></td>
                  <td className="ds-num-cell"><span className="ds-num">{formatNumber(r.views)}</span></td>
                  <td className="ds-num-cell"><span className="ds-num">{formatNumber(r.saves)}</span></td>
                  <td className="ds-num-cell"><span className="ds-num">{formatNumber(r.shares)}</span></td>
                  <td className="ds-num-cell"><span className="ds-num">{formatNumber(r.comments)}</span></td>
                  <td className="ds-num-cell"><span className="ds-num">{r.engagement_rate.toFixed(1)} %</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableCard>

      <div className="soc-grid-2">
        <section className="soc-card">
          <div className="soc-card-head">
            <h2 className="soc-card-title">Piliers de contenu</h2>
            <button type="button" className="ds-pill-button ds-pill-button--dark" onClick={() => setPillarModal({})}>
              + Ajouter
            </button>
          </div>
          {pillars.length === 0 ? (
            <EmptyState title="Aucun pilier" description="Crée des piliers pour classer tes reels." />
          ) : (
            pillars.map((p) => (
              <div key={p.id} className="soc-row" style={{ flexWrap: 'nowrap', padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
                <span className="soc-dot" style={{ background: p.color }} />
                <span style={{ flex: 1, fontWeight: 600 }}>{p.name}</span>
                <span className="soc-muted ds-num">{reels.filter((r) => r.pillar_id === p.id).length} reels</span>
                <button type="button" className="ds-pill-button" onClick={() => setPillarModal({ pillar: p })}>
                  Modifier
                </button>
                <ConfirmButton label="Supprimer" onConfirm={() => void deletePillar(p.id)} />
              </div>
            ))
          )}
        </section>
        {distribution.length > 0 && (
          <section className="soc-card">
            <h2 className="soc-card-title">Distribution</h2>
            <div style={{ display: 'flex', height: 18, borderRadius: 999, overflow: 'hidden' }}>
              {distribution.map((d) => (
                <div key={d.name} title={`${d.name} (${d.value})`} style={{ width: `${(d.value / distTotal) * 100}%`, background: d.color }} />
              ))}
            </div>
            <div className="soc-legend">
              {distribution.map((d) => (
                <span key={d.name} className="soc-row">
                  <span className="soc-dot" style={{ background: d.color }} />
                  {d.name} ({d.value} · {Math.round((d.value / distTotal) * 100)} %)
                </span>
              ))}
            </div>
          </section>
        )}
      </div>

      {selected && (
        <ReelDetail
          key={selected.id}
          reel={selected}
          pillars={pillars}
          onClose={() => setSelected(null)}
          onPatch={(patch) => void patchReel(selected.id, patch)}
        />
      )}
      {pillarModal && (
        <PillarModal
          pillar={pillarModal.pillar}
          onClose={() => setPillarModal(null)}
          onSaved={() => {
            setPillarModal(null)
            void load()
          }}
          saveFn={async (data) => {
            if (pillarModal.pillar) await http('PUT', '/api/instagram/pillars', { id: pillarModal.pillar.id, ...data })
            else await api.post('/api/instagram/pillars', data)
          }}
        />
      )}
    </div>
  )
}

function ReelDetail({
  reel,
  pillars,
  onClose,
  onPatch,
}: {
  reel: IgReel
  pillars: ContentPillar[]
  onClose: () => void
  onPatch: (patch: { pillar_id?: string | null; format?: string | null }) => void
}) {
  // Notes are local-only on the web too (localStorage key reel-notes-<media id>).
  const [notes, setNotes] = useState(() => readNotes(reel.ig_media_id))
  const [saved, setSaved] = useState(false)
  const url = reelUrl(reel.ig_media_id)

  function saveNotes() {
    try {
      localStorage.setItem(`reel-notes-${reel.ig_media_id}`, notes)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      /* storage unavailable */
    }
  }

  return (
    <Drawer title="Détail du reel" onClose={onClose}>
      <div className="soc-stack">
        <div style={{ maxWidth: 260, alignSelf: 'center', width: '100%' }}>
          <div className="soc-thumb" style={{ cursor: 'default' }}>
            {reel.video_url ? (
              <video src={reel.video_url} poster={reel.thumbnail_url ?? undefined} controls preload="none" style={{ position: 'absolute', inset: 0 }} />
            ) : reel.thumbnail_url ? (
              <img src={reel.thumbnail_url} alt="" referrerPolicy="no-referrer" />
            ) : (
              <span className="soc-thumb-caption">Pas de preview disponible</span>
            )}
          </div>
        </div>
        <StatGrid>
          <StatCard label="Vues" value={reel.views} />
          <StatCard label="Reach" value={reel.reach} />
          <StatCard label="Likes" value={reel.likes} />
          <StatCard label="Commentaires" value={reel.comments} />
          <StatCard label="Partages" value={reel.shares} />
          <StatCard label="Saves" value={reel.saves} />
          <StatCard label="Engagement" value={`${reel.engagement_rate.toFixed(1)} %`} highlight />
        </StatGrid>
        <Field label="Contenu">
          <p style={{ margin: 0, fontSize: 13, whiteSpace: 'pre-wrap' }}>{reel.caption ?? 'Pas de caption'}</p>
          <span className="soc-muted">{new Date(reel.published_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </Field>
        <Field label="Pilier">
          <select className="soc-select" value={reel.pillar_id ?? ''} onChange={(e) => onPatch({ pillar_id: e.target.value || null })}>
            <option value="">—</option>
            {pillars.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Format">
          <select className="soc-select" value={reel.format ?? ''} onChange={(e) => onPatch({ format: e.target.value || null })}>
            <option value="">—</option>
            {FORMATS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Notes (locales à cet ordinateur)" action={saved ? <span className="soc-success">Sauvegardé</span> : undefined}>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder={'Ce qui a marché…\nÀ améliorer…'} />
          <button type="button" className="ds-pill-button" onClick={saveNotes}>
            Sauvegarder
          </button>
        </Field>
        {url && (
          <button type="button" className="ds-pill-button ds-pill-button--dark" onClick={() => window.open(url, '_blank')}>
            Ouvrir sur Instagram ↗
          </button>
        )}
      </div>
    </Drawer>
  )
}

export function PillarModal({
  pillar,
  onClose,
  onSaved,
  saveFn,
}: {
  pillar?: ContentPillar
  onClose: () => void
  onSaved: () => void
  saveFn: (data: { name: string; color: string }) => Promise<void>
}) {
  const [name, setName] = useState(pillar?.name ?? '')
  const [color, setColor] = useState(pillar?.color ?? '#3b82f6')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
      setError('Couleur hex invalide (#RRGGBB)')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await saveFn({ name: name.trim(), color })
      onSaved()
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={pillar ? 'Modifier le pilier' : 'Nouveau pilier'} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Nom">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex : Viral, Lead Magnet…" autoFocus />
        </Field>
        <Field label="Couleur">
          <div className="soc-row">
            <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : '#3b82f6'} onChange={(e) => setColor(e.target.value)} />
            <Input value={color} onChange={(e) => setColor(e.target.value)} />
          </div>
        </Field>
        {error && <p className="lead-create-error">{error}</p>}
        <div className="lead-create-actions">
          <button type="button" className="ds-pill-button" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="ds-pill-button ds-pill-button--dark" disabled={saving || !name.trim()}>
            {pillar ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
