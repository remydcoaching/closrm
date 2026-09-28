// Instagram › Stories — port of IgStoriesTab / IgSequenceModal / IgSequenceDetail /
// IgStoriesSelector. Endpoints: GET /api/instagram/stories, GET/POST
// /api/instagram/sequences, DELETE /api/instagram/sequences/:id,
// GET/PUT /api/instagram/sequences/:id/items.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api-client'
import { swrGet } from '../../lib/query-cache'
import { StatCard, StatGrid, formatNumber } from '../../design-system/StatCard'
import { TableCard } from '../../design-system/TableCard'
import { Chips } from '../../design-system/Tabs'
import { Drawer } from '../../design-system/Drawer'
import { Input, Textarea } from '../../design-system/Input'
import { EmptyState, ErrorState, LoadingState } from '../../design-system/States'
import { ConfirmButton, Field, Modal } from './ui'
import { errMsg, http } from './http'
import { isoDay } from './social-utils'
import type { IgStory, ListResponse, StorySequence, StorySequenceItem, StorySequenceType } from './types'

type Notify = (text: string, tone?: 'success' | 'danger' | 'info' | 'warning') => void

export const SEQ_TYPES: Record<StorySequenceType, { label: string; color: string }> = {
  confiance: { label: 'Confiance', color: '#3b82f6' },
  peur: { label: 'Peur', color: '#ef4444' },
  preuve_sociale: { label: 'Preuve sociale', color: '#22c55e' },
  urgence: { label: 'Urgence', color: '#f97316' },
  autorite: { label: 'Autorité', color: '#8b5cf6' },
  storytelling: { label: 'Storytelling', color: '#ec4899' },
  offre: { label: 'Offre', color: '#eab308' },
  education: { label: 'Éducation', color: '#06b6d4' },
}

function weekDays(offset: number): { date: string; label: string }[] {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7)
  const labels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
  return labels.map((l, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return { date: isoDay(d), label: `${l} ${d.getDate()}` }
  })
}

function dropColor(pct: number): string {
  return pct > 30 ? 'var(--color-danger)' : pct > 15 ? 'var(--color-warning)' : 'var(--color-success)'
}

function sortItems(items: StorySequenceItem[]): StorySequenceItem[] {
  return [...items].sort(
    (a, b) => (a.story?.published_at ? Date.parse(a.story.published_at) : 0) - (b.story?.published_at ? Date.parse(b.story.published_at) : 0),
  )
}

function StoryThumb({ story, label }: { story?: IgStory | null; label?: string }) {
  const src = story?.thumbnail_url || story?.ig_media_url
  return (
    <div className="soc-thumb" style={{ width: 120, cursor: 'default' }}>
      {src ? <img src={src} alt="" referrerPolicy="no-referrer" /> : <span className="soc-thumb-caption">Story</span>}
      {label && (
        <span className="soc-thumb-top">
          <span className="soc-thumb-badge">{label}</span>
          <span />
        </span>
      )}
      {story && (
        <span className="soc-thumb-bottom">
          <span>{formatNumber(story.impressions)} vues</span>
          <span>
            {story.replies} rép. · {story.exits} sorties
          </span>
        </span>
      )}
    </div>
  )
}

export function IgStoriesTab({ notify }: { notify: Notify }) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedDay, setSelectedDay] = useState<string>(isoDay(new Date()))
  const [stories, setStories] = useState<IgStory[]>([])
  const [sequences, setSequences] = useState<StorySequence[]>([])
  const [seqItems, setSeqItems] = useState<Record<string, StorySequenceItem[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [detail, setDetail] = useState<StorySequence | null>(null)

  const days = useMemo(() => weekDays(weekOffset), [weekOffset])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [st, sq] = await Promise.all([
        api.get<ListResponse<IgStory>>('/api/instagram/stories'),
        api.get<ListResponse<StorySequence>>('/api/instagram/sequences'),
      ])
      setStories(st.data ?? [])
      const seqs = sq.data ?? []
      setSequences(seqs)
      const map: Record<string, StorySequenceItem[]> = {}
      await Promise.all(
        seqs.map(async (s) => {
          map[s.id] = await api
            .get<ListResponse<StorySequenceItem>>(`/api/instagram/sequences/${s.id}/items`)
            .then((r) => r.data ?? [])
            .catch(() => [])
        }),
      )
      setSeqItems(map)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!days.some((d) => d.date === selectedDay)) setSelectedDay(days[0].date)
  }, [days, selectedDay])

  const inSeq = useMemo(() => new Set(Object.values(seqItems).flat().map((i) => i.story_id)), [seqItems])
  const seqDate = (s: StorySequence) => (s.published_at || s.created_at).slice(0, 10)
  const seqDays = useMemo(() => new Set(sequences.map(seqDate)), [sequences])
  const daySequences = sequences.filter((s) => seqDate(s) === selectedDay)
  const dayStories = stories
    .filter((s) => s.published_at.slice(0, 10) === selectedDay)
    .sort((a, b) => Date.parse(a.published_at) - Date.parse(b.published_at))
  const dayOrphans = dayStories.filter((s) => !inSeq.has(s.id))
  const otherOrphans = stories
    .filter((s) => !inSeq.has(s.id) && s.published_at.slice(0, 10) !== selectedDay)
    .sort((a, b) => Date.parse(a.published_at) - Date.parse(b.published_at))

  const sum = (k: keyof Pick<IgStory, 'impressions' | 'reach' | 'replies' | 'exits' | 'taps_back' | 'taps_forward'>) =>
    dayStories.reduce((s, st) => s + (st[k] ?? 0), 0)

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />

  const weekLabel = `${new Date(days[0].date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} — ${new Date(days[6].date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`

  return (
    <div className="soc-stack">
      <div className="soc-toolbar">
        <button type="button" className="ds-pill-button" onClick={() => setWeekOffset((w) => w - 1)}>
          ‹
        </button>
        <strong style={{ minWidth: 240, textAlign: 'center' }}>{weekLabel}</strong>
        <button type="button" className="ds-pill-button" onClick={() => setWeekOffset((w) => w + 1)}>
          ›
        </button>
        <div className="soc-spacer" />
        <button type="button" className="ds-pill-button ds-pill-button--dark" onClick={() => setCreating(true)}>
          + Nouvelle séquence
        </button>
      </div>
      <Chips
        items={days.map((d) => ({ key: d.date, label: `${d.label}${seqDays.has(d.date) ? ' •' : ''}` }))}
        active={selectedDay}
        onChange={setSelectedDay}
      />

      <StatGrid>
        <StatCard label="Stories" value={dayStories.length} />
        <StatCard label="Impressions" value={sum('impressions')} highlight />
        <StatCard label="Reach" value={sum('reach')} />
        <StatCard label="Réponses" value={sum('replies')} />
        <StatCard label="Sorties" value={sum('exits')} />
        <StatCard label="Profil" value={sum('taps_forward')} caption="Champ taps_forward (comme le web)" />
        <StatCard label="Abonnés" value={sum('taps_back')} caption="Champ taps_back (comme le web)" />
      </StatGrid>

      {daySequences.length === 0 ? (
        <EmptyState title="Aucune séquence pour ce jour" />
      ) : (
        daySequences.map((seq) => {
          const items = sortItems(seqItems[seq.id] ?? [])
          const first = items[0]?.story?.impressions ?? 0
          const last = items[items.length - 1]?.story?.impressions ?? 0
          const drop = Math.min(100, Math.max(0, first > 0 ? Math.round((1 - last / first) * 100) : 0))
          const type = SEQ_TYPES[seq.sequence_type]
          return (
            <section key={seq.id} className="soc-card" style={{ cursor: 'pointer' }} onClick={() => setDetail(seq)}>
              <div className="soc-card-head">
                <div className="soc-row">
                  <h2 className="soc-card-title">{seq.name}</h2>
                  {type && <span className="ds-status-pill" style={{ color: type.color, background: `${type.color}22` }}>{type.label}</span>}
                </div>
                <span className="soc-row soc-muted">
                  <span className="ds-num">{formatNumber(items.reduce((s, i) => s + (i.story?.impressions ?? 0), 0))} impressions</span>
                  <span className="ds-num" style={{ color: dropColor(drop) }}>{drop} % drop-off</span>
                </span>
              </div>
              {seq.objective && <p className="soc-card-sub">{seq.objective}</p>}
              <div className="soc-row" style={{ flexWrap: 'nowrap', overflowX: 'auto', alignItems: 'center' }}>
                {items.map((it, idx) => {
                  const prev = idx > 0 ? (items[idx - 1].story?.impressions ?? 0) : 0
                  const cur = it.story?.impressions ?? 0
                  const d = idx > 0 && prev > 0 ? Math.round((1 - cur / prev) * 100) : null
                  return (
                    <div key={it.id} className="soc-row" style={{ flexWrap: 'nowrap' }}>
                      {d !== null && (
                        <span className="ds-num" style={{ color: dropColor(d), fontSize: 12, fontWeight: 700 }}>
                          −{d} %
                        </span>
                      )}
                      <StoryThumb story={it.story} label={`${idx + 1}`} />
                    </div>
                  )
                })}
              </div>
              {items.length > 0 && first > 0 && (
                <div className="soc-field">
                  <span className="soc-label">Rétention</span>
                  <div className="soc-row" style={{ flexWrap: 'nowrap', alignItems: 'flex-end', height: 40 }}>
                    {items.map((it) => {
                      const pct = ((it.story?.impressions ?? 0) / first) * 100
                      return (
                        <div
                          key={it.id}
                          title={`${Math.round(pct)} %`}
                          style={{ flex: 1, height: `${Math.min(100, Math.max(4, pct))}%`, background: `hsl(${(pct / 100) * 120}, 60%, 50%)`, borderRadius: 4 }}
                        />
                      )
                    })}
                  </div>
                </div>
              )}
            </section>
          )
        })
      )}

      {dayOrphans.length > 0 && (
        <section className="soc-card">
          <h2 className="soc-card-title">
            Stories hors séquence — {new Date(selectedDay).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
          </h2>
          <div className="soc-row">{dayOrphans.map((s) => <StoryThumb key={s.id} story={s} />)}</div>
        </section>
      )}

      {otherOrphans.length > 0 && (
        <section className="soc-card">
          <div>
            <h2 className="soc-card-title">Toutes les stories hors séquence</h2>
            <p className="soc-card-sub">{otherOrphans.length} stories non assignées à une séquence</p>
          </div>
          <div className="soc-row">
            {otherOrphans.map((s) => (
              <StoryThumb key={s.id} story={s} label={new Date(s.published_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} />
            ))}
          </div>
        </section>
      )}

      {sequences.length > 0 && (
        <TableCard title="Toutes les séquences" subtitle={`${sequences.length} séquence${sequences.length > 1 ? 's' : ''}`}>
          <table className="ds-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Type</th>
                <th className="ds-num-cell">Stories</th>
                <th className="ds-num-cell">Impressions</th>
                <th className="ds-num-cell">Drop-off</th>
                <th className="ds-num-cell">Réponses</th>
                <th className="ds-num-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {sequences.map((seq) => {
                const type = SEQ_TYPES[seq.sequence_type]
                const drop = Math.min(100, Math.max(0, Math.round(seq.overall_dropoff_rate)))
                return (
                  <tr key={seq.id} className="ds-row-clickable" onClick={() => setDetail(seq)}>
                    <td style={{ fontWeight: 600 }}>{seq.name}</td>
                    <td>{type && <span className="ds-status-pill" style={{ color: type.color, background: `${type.color}22` }}>{type.label}</span>}</td>
                    <td className="ds-num-cell"><span className="ds-num">{(seqItems[seq.id] ?? []).length}</span></td>
                    <td className="ds-num-cell"><span className="ds-num">{formatNumber(seq.total_impressions)}</span></td>
                    <td className="ds-num-cell"><span className="ds-num" style={{ color: dropColor(drop) }}>{drop} %</span></td>
                    <td className="ds-num-cell"><span className="ds-num">{seq.total_replies}</span></td>
                    <td className="ds-num-cell"><span className="ds-num">{new Date(seq.published_at || seq.created_at).toLocaleDateString('fr-FR')}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </TableCard>
      )}

      {creating && (
        <SequenceModal
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false)
            notify('Séquence créée')
            void load()
          }}
        />
      )}
      {detail && (
        <SequenceDetail
          sequence={detail}
          stories={stories}
          onClose={() => setDetail(null)}
          onChanged={() => void load()}
          notify={notify}
        />
      )}
    </div>
  )
}

function SequenceModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState<StorySequenceType>('confiance')
  const [objective, setObjective] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Le nom est requis')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await api.post('/api/instagram/sequences', {
        name: name.trim(),
        sequence_type: type,
        objective: objective.trim() || undefined,
        notes: notes.trim() || undefined,
        published_at: new Date().toISOString(),
      })
      onSaved()
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Nouvelle séquence" onClose={onClose}>
      <form onSubmit={save}>
        <Field label="Nom *">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Séquence confiance lundi" autoFocus />
        </Field>
        <Field label="Type">
          <select className="soc-select" value={type} onChange={(e) => setType(e.target.value as StorySequenceType)}>
            {Object.entries(SEQ_TYPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Objectif">
          <Input value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Ex : Générer 10 DMs" />
        </Field>
        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Notes optionnelles…" />
        </Field>
        {error && <p className="lead-create-error">{error}</p>}
        <div className="lead-create-actions">
          <button type="button" className="ds-pill-button" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="ds-pill-button ds-pill-button--dark" disabled={saving}>
            {saving ? 'Création…' : 'Créer'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function SequenceDetail({
  sequence,
  stories,
  onClose,
  onChanged,
  notify,
}: {
  sequence: StorySequence
  stories: IgStory[]
  onClose: () => void
  onChanged: () => void
  notify: Notify
}) {
  const [items, setItems] = useState<StorySequenceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      await swrGet<ListResponse<StorySequenceItem>>(`/api/instagram/sequences/${sequence.id}/items`, (r) => {
        setItems(r.data ?? [])
        setSelected(new Set((r.data ?? []).map((i) => i.story_id)))
        setLoading(false)
      })
    } catch (e) {
      notify(errMsg(e), 'danger')
    } finally {
      setLoading(false)
    }
  }, [sequence.id, notify])

  useEffect(() => {
    void load()
  }, [load])

  async function saveItems() {
    setSaving(true)
    try {
      await http('PUT', `/api/instagram/sequences/${sequence.id}/items`, {
        items: Array.from(selected).map((story_id, idx) => ({ story_id, position: idx + 1 })),
      })
      setSelecting(false)
      await load()
      onChanged()
    } catch (e) {
      notify(errMsg(e), 'danger')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    try {
      await api.delete(`/api/instagram/sequences/${sequence.id}`)
      onChanged()
      onClose()
    } catch (e) {
      notify(errMsg(e), 'danger')
    }
  }

  const max = items.length > 0 ? Math.max(...items.map((i) => i.story?.impressions ?? 0)) : 0
  const type = SEQ_TYPES[sequence.sequence_type]

  return (
    <Drawer title={sequence.name} onClose={onClose}>
      <div className="soc-stack">
        <div className="soc-row">
          {type && <span className="ds-status-pill" style={{ color: type.color, background: `${type.color}22` }}>{type.label}</span>}
          <div className="soc-spacer" />
          <button type="button" className="ds-pill-button ds-pill-button--dark" onClick={() => setSelecting((s) => !s)}>
            {selecting ? 'Fermer la sélection' : '+ Ajouter des stories'}
          </button>
          <ConfirmButton label="Supprimer" confirmLabel="Confirmer la suppression" onConfirm={() => void remove()} />
        </div>
        {sequence.objective && <p className="soc-muted" style={{ margin: 0 }}>{sequence.objective}</p>}
        {sequence.notes && <p className="soc-muted" style={{ margin: 0 }}>{sequence.notes}</p>}
        <StatGrid>
          <StatCard label="Stories" value={items.length} />
          <StatCard label="Impressions" value={sequence.total_impressions} />
          <StatCard label="Drop-off" value={`${Math.min(100, Math.max(0, Math.round(sequence.overall_dropoff_rate)))} %`} />
          <StatCard label="Réponses" value={sequence.total_replies} />
        </StatGrid>

        {selecting && (
          <section className="soc-card">
            <h2 className="soc-card-title">Sélectionner des stories ({selected.size})</h2>
            {stories.length === 0 ? (
              <EmptyState title="Aucune story synchronisée." />
            ) : (
              <div className="soc-row" style={{ maxHeight: 360, overflowY: 'auto' }}>
                {stories.map((s) => {
                  const on = selected.has(s.id)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() =>
                        setSelected((prev) => {
                          const n = new Set(prev)
                          if (n.has(s.id)) n.delete(s.id)
                          else n.add(s.id)
                          return n
                        })
                      }
                      style={{ border: on ? '2px solid var(--color-text-strong)' : '2px solid transparent', borderRadius: 14, padding: 0, background: 'none', cursor: 'pointer' }}
                    >
                      <StoryThumb story={s} label={new Date(s.published_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} />
                    </button>
                  )
                })}
              </div>
            )}
            <div className="lead-create-actions">
              <button type="button" className="ds-pill-button ds-pill-button--dark" disabled={saving || selected.size === 0} onClick={() => void saveItems()}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </section>
        )}

        {loading ? (
          <LoadingState label="Chargement des stories…" />
        ) : items.length === 0 ? (
          <EmptyState title="Aucune story dans cette séquence" />
        ) : (
          <>
            <section className="soc-card">
              <h2 className="soc-card-title">Funnel de rétention</h2>
              {items.map((it) => {
                const imp = it.story?.impressions ?? 0
                return (
                  <div key={it.id} className="soc-row" style={{ flexWrap: 'nowrap' }}>
                    <span className="soc-muted" style={{ minWidth: 60 }}>Story {it.position}</span>
                    <div className="soc-bar" style={{ flex: 1, height: 16 }}>
                      <span style={{ width: `${max > 0 ? (imp / max) * 100 : 0}%` }} />
                    </div>
                    <span className="ds-num" style={{ minWidth: 60, textAlign: 'right' }}>{formatNumber(imp)}</span>
                  </div>
                )
              })}
            </section>
            <div className="soc-row">{items.map((it) => <StoryThumb key={it.id} story={it.story} label={`${it.position}`} />)}</div>
          </>
        )}
      </div>
    </Drawer>
  )
}
