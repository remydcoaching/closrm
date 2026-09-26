// Instagram › Brouillons (drafts, programmés, hashtags, templates) — the web's
// IgCalendarTab / IgDraftsList / IgDraftModal / IgHashtagGroups /
// IgCaptionTemplates. NB: on the web these components exist but are no longer
// mounted in /acquisition/reseaux-sociaux; the APIs are live, so the desktop
// exposes them. Endpoints: /api/instagram/drafts (+ /:id PUT/DELETE, /:id/publish),
// /api/instagram/hashtag-groups, /api/instagram/caption-templates.
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api-client'
import { supabase } from '../../lib/supabase'
import { TableCard } from '../../design-system/TableCard'
import { Chips } from '../../design-system/Tabs'
import { Input, Textarea } from '../../design-system/Input'
import { EmptyState, ErrorState, LoadingState } from '../../design-system/States'
import { ConfirmButton, Field, Modal } from './ui'
import { errMsg, http } from './http'
import type { IgCaptionCategory, IgCaptionTemplate, IgDraft, IgDraftMediaType, IgHashtagGroup, ListResponse } from './types'

type Notify = (text: string, tone?: 'success' | 'danger' | 'info' | 'warning') => void
type View = 'draft' | 'scheduled' | 'published' | 'failed' | 'hashtags' | 'templates'

const CATEGORIES: { value: IgCaptionCategory; label: string }[] = [
  { value: 'general', label: 'Général' },
  { value: 'education', label: 'Éducation' },
  { value: 'storytelling', label: 'Storytelling' },
  { value: 'offre', label: 'Offre' },
  { value: 'preuve_sociale', label: 'Preuve sociale' },
  { value: 'motivation', label: 'Motivation' },
  { value: 'behind_the_scenes', label: 'Behind the scenes' },
]

const DRAFT_STATUS: Record<IgDraft['status'], { label: string; color: string }> = {
  draft: { label: 'Brouillon', color: '#8a8e96' },
  scheduled: { label: 'Programmé', color: '#3b82f6' },
  publishing: { label: 'Publication…', color: '#d9820b' },
  published: { label: 'Publié', color: '#1a7f4e' },
  failed: { label: 'Échec', color: '#d63447' },
}

function parseTags(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith('#') ? t : `#${t}`))
}

export function IgDraftsTab({ notify }: { notify: Notify }) {
  const [view, setView] = useState<View>('draft')
  return (
    <div className="soc-stack">
      <Chips
        items={[
          { key: 'draft', label: 'Brouillons' },
          { key: 'scheduled', label: 'Programmés' },
          { key: 'published', label: 'Publiés' },
          { key: 'failed', label: 'Échecs' },
          { key: 'hashtags', label: 'Hashtags' },
          { key: 'templates', label: 'Templates' },
        ]}
        active={view}
        onChange={setView}
      />
      {view === 'hashtags' ? (
        <HashtagGroups notify={notify} />
      ) : view === 'templates' ? (
        <CaptionTemplates notify={notify} />
      ) : (
        <DraftsList key={view} status={view} notify={notify} />
      )}
    </div>
  )
}

function DraftsList({ status, notify }: { status: IgDraft['status']; notify: Notify }) {
  const [drafts, setDrafts] = useState<IgDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ draft?: IgDraft } | null>(null)
  const [publishing, setPublishing] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await api.get<ListResponse<IgDraft>>(`/api/instagram/drafts?status=${status}&per_page=100`)
      setDrafts(r.data ?? [])
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    void load()
  }, [load])

  async function publish(d: IgDraft) {
    setPublishing(d.id)
    try {
      await api.post(`/api/instagram/drafts/${d.id}/publish`, {})
      notify('Publié sur Instagram')
      void load()
    } catch (e) {
      notify(`Publication échouée : ${errMsg(e)}`, 'danger')
      void load()
    } finally {
      setPublishing(null)
    }
  }

  async function remove(id: string) {
    try {
      await api.delete(`/api/instagram/drafts/${id}`)
      void load()
    } catch (e) {
      notify(errMsg(e), 'danger')
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />

  return (
    <>
      <TableCard
        title={DRAFT_STATUS[status].label + 's'}
        subtitle={`${drafts.length} élément${drafts.length > 1 ? 's' : ''}`}
        toolbar={
          <button type="button" className="ds-pill-button ds-pill-button--dark" onClick={() => setEditing({})}>
            + Nouveau brouillon
          </button>
        }
      >
        {drafts.length === 0 ? (
          <EmptyState title="Rien ici pour l'instant" />
        ) : (
          <table className="ds-table">
            <thead>
              <tr>
                <th>Légende</th>
                <th>Type</th>
                <th className="ds-num-cell">Médias</th>
                <th>Statut</th>
                <th className="ds-num-cell">Programmé / publié</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {drafts.map((d) => (
                <tr key={d.id} className="ds-row-clickable" onClick={() => setEditing({ draft: d })}>
                  <td style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.caption || <span className="ds-muted">(sans légende)</span>}
                    {d.error_message && <div className="soc-error">{d.error_message}</div>}
                  </td>
                  <td className="ds-muted">{d.media_type ?? '—'}</td>
                  <td className="ds-num-cell"><span className="ds-num">{d.media_urls.length}</span></td>
                  <td>
                    <span className="ds-status-pill" style={{ color: DRAFT_STATUS[d.status].color, background: `${DRAFT_STATUS[d.status].color}1a` }}>
                      {DRAFT_STATUS[d.status].label}
                    </span>
                  </td>
                  <td className="ds-num-cell">
                    <span className="ds-num">
                      {d.published_at
                        ? new Date(d.published_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
                        : d.scheduled_at
                          ? new Date(d.scheduled_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
                          : '—'}
                    </span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="soc-row" style={{ flexWrap: 'nowrap' }}>
                      {d.status !== 'published' && (
                        <button type="button" className="ds-pill-button" disabled={publishing === d.id || d.media_urls.length === 0} onClick={() => void publish(d)}>
                          {publishing === d.id ? 'Publication…' : 'Publier'}
                        </button>
                      )}
                      <ConfirmButton label="Supprimer" onConfirm={() => void remove(d.id)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableCard>
      {editing && (
        <DraftModal
          draft={editing.draft}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            notify('Brouillon enregistré')
            void load()
          }}
        />
      )}
    </>
  )
}

function DraftModal({ draft, onClose, onSaved }: { draft?: IgDraft; onClose: () => void; onSaved: () => void }) {
  const [caption, setCaption] = useState(draft?.caption ?? '')
  const [hashtags, setHashtags] = useState((draft?.hashtags ?? []).join(' '))
  const [mediaUrls, setMediaUrls] = useState<string[]>(draft?.media_urls ?? [])
  const [mediaType, setMediaType] = useState<IgDraftMediaType>(draft?.media_type ?? 'IMAGE')
  const [scheduledAt, setScheduledAt] = useState(draft?.scheduled_at ? draft.scheduled_at.slice(0, 16) : '')
  const [urlDraft, setUrlDraft] = useState('')
  const [groups, setGroups] = useState<IgHashtagGroup[]>([])
  const [templates, setTemplates] = useState<IgCaptionTemplate[]>([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.get<ListResponse<IgHashtagGroup>>('/api/instagram/hashtag-groups').then((r) => setGroups(r.data ?? [])).catch(() => {})
    api.get<ListResponse<IgCaptionTemplate>>('/api/instagram/caption-templates').then((r) => setTemplates(r.data ?? [])).catch(() => {})
  }, [])

  // Same storage bucket as the web's IgDraftModal (content-drafts, public URL).
  async function upload(file: File) {
    const isVideo = file.type.startsWith('video/')
    const max = isVideo ? 200 * 1024 * 1024 : 10 * 1024 * 1024
    if (file.size > max) {
      setError(`Fichier trop volumineux (max ${isVideo ? '200' : '10'} Mo)`)
      return
    }
    setUploading(true)
    setError(null)
    try {
      const path = `${Date.now()}.${file.name.split('.').pop()}`
      const { error: upErr } = await supabase.storage.from('content-drafts').upload(path, file, { contentType: file.type, upsert: false })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('content-drafts').getPublicUrl(path)
      setMediaUrls((m) => [...m, data.publicUrl])
      if (isVideo && mediaType === 'IMAGE') setMediaType('REELS')
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function save(status: 'draft' | 'scheduled') {
    if (status === 'scheduled' && !scheduledAt) {
      setError('Date de programmation requise')
      return
    }
    setSaving(true)
    setError(null)
    const body = {
      caption,
      hashtags: parseTags(hashtags),
      media_urls: mediaUrls,
      media_type: mediaType,
      status,
      scheduled_at: status === 'scheduled' ? new Date(scheduledAt).toISOString() : undefined,
    }
    try {
      if (draft) await http('PUT', `/api/instagram/drafts/${draft.id}`, body)
      else await api.post('/api/instagram/drafts', body)
      onSaved()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  const fullLength = caption.length + parseTags(hashtags).join(' ').length + 2

  return (
    <Modal title={draft ? 'Modifier le brouillon' : 'Nouveau brouillon'} onClose={onClose} size="mid">
      <div className="soc-stack">
        {templates.length > 0 && (
          <Field label="Partir d'un template">
            <select
              className="soc-select"
              value=""
              onChange={(e) => {
                const t = templates.find((x) => x.id === e.target.value)
                if (t) {
                  setCaption(t.body)
                  if (t.hashtags.length) setHashtags(t.hashtags.join(' '))
                }
              }}
            >
              <option value="">— Choisir —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Légende" action={<span className={fullLength > 2200 ? 'soc-error' : 'soc-muted'}>{fullLength} / 2200</span>}>
          <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={6} />
        </Field>
        <Field
          label="Hashtags"
          action={
            groups.length > 0 ? (
              <select
                className="soc-select"
                value=""
                onChange={(e) => {
                  const g = groups.find((x) => x.id === e.target.value)
                  if (g) setHashtags((h) => [...new Set([...parseTags(h), ...g.hashtags.map((t) => (t.startsWith('#') ? t : `#${t}`))])].join(' '))
                }}
              >
                <option value="">+ Groupe</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            ) : undefined
          }
        >
          <Input value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="#coaching #motivation" />
        </Field>
        <Field label="Type de média">
          <select className="soc-select" value={mediaType} onChange={(e) => setMediaType(e.target.value as IgDraftMediaType)}>
            {(['IMAGE', 'VIDEO', 'CAROUSEL', 'REELS', 'STORY'] as const).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`Médias (${mediaUrls.length})`}>
          {mediaUrls.map((u) => (
            <div key={u} className="soc-row" style={{ flexWrap: 'nowrap' }}>
              <span className="soc-muted" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u}</span>
              <button type="button" className="ds-pill-button" onClick={() => setMediaUrls((m) => m.filter((x) => x !== u))}>
                Retirer
              </button>
            </div>
          ))}
          <div className="soc-row">
            <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
            <button type="button" className="ds-pill-button" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? 'Upload…' : 'Uploader un fichier'}
            </button>
            <Input value={urlDraft} onChange={(e) => setUrlDraft(e.target.value)} placeholder="ou coller une URL publique" />
            <button
              type="button"
              className="ds-pill-button"
              disabled={!/^https?:\/\//.test(urlDraft.trim())}
              onClick={() => {
                setMediaUrls((m) => [...m, urlDraft.trim()])
                setUrlDraft('')
              }}
            >
              Ajouter
            </button>
          </div>
        </Field>
        <Field label="Programmer pour">
          <input className="ds-input" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
        </Field>
        {error && <p className="lead-create-error">{error}</p>}
        <div className="lead-create-actions">
          <button type="button" className="ds-pill-button" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="ds-pill-button" disabled={saving} onClick={() => void save('draft')}>
            Enregistrer en brouillon
          </button>
          <button type="button" className="ds-pill-button ds-pill-button--dark" disabled={saving || !scheduledAt} onClick={() => void save('scheduled')}>
            Programmer
          </button>
        </div>
      </div>
    </Modal>
  )
}

function HashtagGroups({ notify }: { notify: Notify }) {
  const [groups, setGroups] = useState<IgHashtagGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<{ group?: IgHashtagGroup } | null>(null)
  const [name, setName] = useState('')
  const [tags, setTags] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get<ListResponse<IgHashtagGroup>>('/api/instagram/hashtag-groups')
      setGroups(r.data ?? [])
    } catch (e) {
      notify(errMsg(e), 'danger')
    } finally {
      setLoading(false)
    }
  }, [notify])

  useEffect(() => {
    void load()
  }, [load])

  function open(group?: IgHashtagGroup) {
    setName(group?.name ?? '')
    setTags((group?.hashtags ?? []).join(' '))
    setEditing({ group })
  }

  async function save() {
    const body = { name: name.trim(), hashtags: parseTags(tags) }
    try {
      if (editing?.group) await http('PUT', '/api/instagram/hashtag-groups', { id: editing.group.id, ...body })
      else await api.post('/api/instagram/hashtag-groups', body)
      setEditing(null)
      void load()
    } catch (e) {
      notify(errMsg(e), 'danger')
    }
  }

  async function remove(id: string) {
    try {
      await http('DELETE', '/api/instagram/hashtag-groups', { id })
      void load()
    } catch (e) {
      notify(errMsg(e), 'danger')
    }
  }

  if (loading) return <LoadingState />

  return (
    <TableCard
      title="Groupes de hashtags"
      toolbar={
        <button type="button" className="ds-pill-button ds-pill-button--dark" onClick={() => open()}>
          + Nouveau groupe
        </button>
      }
    >
      {groups.length === 0 ? (
        <EmptyState title="Aucun groupe de hashtags" />
      ) : (
        <table className="ds-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Hashtags</th>
              <th className="ds-num-cell">Nb</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.id} className="ds-row-clickable" onClick={() => open(g)}>
                <td style={{ fontWeight: 600 }}>{g.name}</td>
                <td className="ds-muted" style={{ maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.hashtags.join(' ')}</td>
                <td className="ds-num-cell"><span className="ds-num">{g.hashtags.length}</span></td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="soc-row">
                    <button type="button" className="ds-pill-button" onClick={() => void navigator.clipboard.writeText(g.hashtags.join(' '))}>
                      Copier
                    </button>
                    <ConfirmButton label="Supprimer" onConfirm={() => void remove(g.id)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editing && (
        <Modal title={editing.group ? 'Modifier le groupe' : 'Nouveau groupe'} onClose={() => setEditing(null)}>
          <div className="soc-stack">
            <Field label="Nom">
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </Field>
            <Field label={`Hashtags (${parseTags(tags).length})`}>
              <Textarea value={tags} onChange={(e) => setTags(e.target.value)} rows={4} placeholder="#fitness #coaching …" />
            </Field>
            <div className="lead-create-actions">
              <button type="button" className="ds-pill-button" onClick={() => setEditing(null)}>
                Annuler
              </button>
              <button type="button" className="ds-pill-button ds-pill-button--dark" disabled={!name.trim() || parseTags(tags).length === 0} onClick={() => void save()}>
                Enregistrer
              </button>
            </div>
          </div>
        </Modal>
      )}
    </TableCard>
  )
}

function CaptionTemplates({ notify }: { notify: Notify }) {
  const [templates, setTemplates] = useState<IgCaptionTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<{ tpl?: IgCaptionTemplate } | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState<IgCaptionCategory>('general')
  const [tags, setTags] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get<ListResponse<IgCaptionTemplate>>('/api/instagram/caption-templates')
      setTemplates(r.data ?? [])
    } catch (e) {
      notify(errMsg(e), 'danger')
    } finally {
      setLoading(false)
    }
  }, [notify])

  useEffect(() => {
    void load()
  }, [load])

  function open(tpl?: IgCaptionTemplate) {
    setTitle(tpl?.title ?? '')
    setBody(tpl?.body ?? '')
    setCategory(tpl?.category ?? 'general')
    setTags((tpl?.hashtags ?? []).join(' '))
    setEditing({ tpl })
  }

  async function save() {
    const payload = { title: title.trim(), body, category, hashtags: parseTags(tags) }
    try {
      if (editing?.tpl) await http('PUT', '/api/instagram/caption-templates', { id: editing.tpl.id, ...payload })
      else await api.post('/api/instagram/caption-templates', payload)
      setEditing(null)
      void load()
    } catch (e) {
      notify(errMsg(e), 'danger')
    }
  }

  async function remove(id: string) {
    try {
      await http('DELETE', '/api/instagram/caption-templates', { id })
      void load()
    } catch (e) {
      notify(errMsg(e), 'danger')
    }
  }

  if (loading) return <LoadingState />

  return (
    <TableCard
      title="Templates de légende"
      toolbar={
        <button type="button" className="ds-pill-button ds-pill-button--dark" onClick={() => open()}>
          + Nouveau template
        </button>
      }
    >
      {templates.length === 0 ? (
        <EmptyState title="Aucun template" />
      ) : (
        <table className="ds-table">
          <thead>
            <tr>
              <th>Titre</th>
              <th>Catégorie</th>
              <th>Aperçu</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id} className="ds-row-clickable" onClick={() => open(t)}>
                <td style={{ fontWeight: 600 }}>{t.title}</td>
                <td className="ds-muted">{CATEGORIES.find((c) => c.value === t.category)?.label ?? t.category}</td>
                <td className="ds-muted" style={{ maxWidth: 380, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.body}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <ConfirmButton label="Supprimer" onConfirm={() => void remove(t.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editing && (
        <Modal title={editing.tpl ? 'Modifier le template' : 'Nouveau template'} onClose={() => setEditing(null)} size="mid">
          <div className="soc-stack">
            <Field label="Titre">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            </Field>
            <Field label="Catégorie">
              <select className="soc-select" value={category} onChange={(e) => setCategory(e.target.value as IgCaptionCategory)}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Texte">
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} />
            </Field>
            <Field label="Hashtags">
              <Input value={tags} onChange={(e) => setTags(e.target.value)} />
            </Field>
            <div className="lead-create-actions">
              <button type="button" className="ds-pill-button" onClick={() => setEditing(null)}>
                Annuler
              </button>
              <button type="button" className="ds-pill-button ds-pill-button--dark" disabled={!title.trim()} onClick={() => void save()}>
                Enregistrer
              </button>
            </div>
          </div>
        </Modal>
      )}
    </TableCard>
  )
}
