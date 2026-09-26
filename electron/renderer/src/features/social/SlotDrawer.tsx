// Slot detail — port of planning/SlotDetailDrawer + BriefStep + MontageStep +
// PublicationStep + DiscussionFooter. Endpoints: GET/PATCH/DELETE
// /api/social/posts/:id, POST /api/social/posts/:id/publish,
// GET/POST /api/social/posts/:id/messages, PATCH …/messages/:mid (resolved),
// POST /api/social/generate-hooks|generate-script, GET /api/workspaces/members?role=monteur,
// GET /api/auth/me, R2 upload via /api/storage/upload-url + /api/storage/sign.
// Text fields save on blur (the web PATCHes on every keystroke).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../lib/api-client'
import { openWeb } from '../../lib/web-link'
import { Drawer } from '../../design-system/Drawer'
import { Tabs } from '../../design-system/Tabs'
import { Input, Textarea } from '../../design-system/Input'
import { Avatar } from '../../design-system/Avatar'
import { EmptyState, ErrorState, LoadingState } from '../../design-system/States'
import { ConfirmButton, Field } from './ui'
import { errMsg, resolveMediaUrl, uploadToR2 } from './http'
import { getDefaultStep, getTransitionAction, isStepComplete, PRODUCTION_STATUSES, type StepKey } from './social-utils'
import type { ContentPillar, SlotMessage, SocialContentKind, SocialPlatform, SocialPost, SocialPostPublication, SocialProductionStatus } from './types'

type Notify = (text: string, tone?: 'success' | 'danger' | 'info' | 'warning') => void
type Role = 'admin' | 'monteur' | 'closer' | 'setter'
interface Monteur {
  id: string
  label: string
}

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024
const PLATFORMS: { key: SocialPlatform; label: string }[] = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'tiktok', label: 'TikTok' },
]

function toIsoOrNull(v: unknown): string | null {
  if (typeof v !== 'string' || !v) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function cleanPublications(pubs: SocialPostPublication[]) {
  const seen = new Set<string>()
  const out: { id?: string; platform: SocialPlatform; config: Record<string, unknown>; scheduled_at: string | null }[] = []
  for (const p of pubs) {
    if (seen.has(p.platform)) continue
    seen.add(p.platform)
    out.push({ ...(p.id && UUID_RX.test(p.id) ? { id: p.id } : {}), platform: p.platform, config: p.config ?? {}, scheduled_at: toIsoOrNull(p.scheduled_at) })
  }
  return out
}

/** Text input that keeps a local draft and commits on blur. */
function BlurText({
  value,
  onCommit,
  multiline,
  rows,
  placeholder,
  disabled,
}: {
  value: string
  onCommit: (v: string) => void
  multiline?: boolean
  rows?: number
  placeholder?: string
  disabled?: boolean
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const commit = () => {
    if (draft !== value) onCommit(draft)
  }
  return multiline ? (
    <Textarea value={draft} rows={rows ?? 3} placeholder={placeholder} disabled={disabled} onChange={(e) => setDraft(e.target.value)} onBlur={commit} />
  ) : (
    <Input value={draft} placeholder={placeholder} disabled={disabled} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
  )
}

export function SlotDrawer({
  slotId,
  pillars,
  notify,
  onClose,
  onChange,
}: {
  slotId: string
  pillars: ContentPillar[]
  notify: Notify
  onClose: () => void
  onChange: () => void
}) {
  const [slot, setSlot] = useState<SocialPost | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<StepKey | 'discussion'>('brief')
  const [role, setRole] = useState<Role>('admin')
  const [monteurs, setMonteurs] = useState<Monteur[]>([])

  useEffect(() => {
    api
      .get<{ data?: { role?: Role } }>('/api/auth/me')
      .then((r) => r.data?.role && setRole(r.data.role))
      .catch(() => {})
    api
      .get<{ data?: { user_id: string; user?: { email?: string | null; full_name?: string | null } | null }[] }>('/api/workspaces/members?role=monteur')
      .then((r) => setMonteurs((r.data ?? []).map((m) => ({ id: m.user_id, label: m.user?.full_name || m.user?.email || m.user_id }))))
      .catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    api
      .get<{ data: SocialPost }>(`/api/social/posts/${slotId}`)
      .then((r) => {
        if (cancelled) return
        setSlot(r.data)
        setStep(getDefaultStep(r.data))
      })
      .catch((e) => !cancelled && setError(errMsg(e)))
    return () => {
      cancelled = true
    }
  }, [slotId])

  const update = useCallback(
    async (patch: Partial<SocialPost> & { revision_feedback?: string }): Promise<boolean> => {
      if (!slot) return false
      const previous = slot
      setSlot({ ...slot, ...patch })
      const body: Record<string, unknown> = { ...patch }
      if ('scheduled_at' in patch) body.scheduled_at = toIsoOrNull(patch.scheduled_at)
      if (Array.isArray(patch.publications)) body.publications = cleanPublications(patch.publications)
      try {
        const r = await api.patch<{ data?: SocialPost }>(`/api/social/posts/${slotId}`, body)
        if (r.data) setSlot(r.data)
        onChange()
        return true
      } catch (e) {
        notify(`Erreur sauvegarde : ${errMsg(e)}`, 'danger')
        setSlot(previous)
        return false
      }
    },
    [slot, slotId, notify, onChange],
  )

  async function remove() {
    try {
      await api.delete(`/api/social/posts/${slotId}`)
      notify('Slot supprimé')
      onChange()
      onClose()
    } catch (e) {
      notify(errMsg(e), 'danger')
    }
  }

  if (error) {
    return (
      <Drawer title="Slot" onClose={onClose}>
        <ErrorState message={error} />
      </Drawer>
    )
  }
  if (!slot) {
    return (
      <Drawer title="Slot" onClose={onClose}>
        <LoadingState />
      </Drawer>
    )
  }

  const readOnly = slot.status === 'scheduled' || slot.status === 'published' || slot.status === 'publishing'
  const done = (k: StepKey) => (isStepComplete(slot, k) ? ' ✓' : '')
  const stepItems: { key: StepKey | 'discussion'; label: string }[] = [
    { key: 'brief', label: `Brief${done('brief')}` },
    { key: 'montage', label: `Montage${done('montage')}` },
    { key: 'publication', label: `Publication${done('publication')}` },
    ...(slot.monteur_id ? [{ key: 'discussion' as const, label: 'Discussion' }] : []),
  ]

  return (
    <Drawer title={slot.plan_date ? `Slot du ${new Date(`${slot.plan_date.slice(0, 10)}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}` : 'Slot'} onClose={onClose}>
      <div className="soc-stack">
        <div className="soc-row">
          <select className="soc-select" value={slot.content_kind ?? 'post'} disabled={readOnly} onChange={(e) => void update({ content_kind: e.target.value as SocialContentKind })}>
            <option value="post">Post</option>
            <option value="story">Story</option>
            <option value="reel">Reel</option>
          </select>
          <select className="soc-select" value={slot.pillar_id ?? ''} disabled={readOnly} onChange={(e) => void update({ pillar_id: e.target.value || null })}>
            <option value="">Sans pilier</option>
            {pillars.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            className="soc-select"
            value={slot.production_status ?? 'idea'}
            disabled={readOnly}
            onChange={(e) => {
              const st = e.target.value as SocialProductionStatus
              if (st === 'ready' && (!slot.media_urls || slot.media_urls.length === 0)) {
                notify('Pour passer en "Prêt", il faut au moins un média.', 'warning')
                return
              }
              void update({ production_status: st })
            }}
          >
            {PRODUCTION_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <div className="soc-spacer" />
          {slot.content_kind === 'reel' && (
            <button type="button" className="ds-pill-button" onClick={() => void openWeb(`/acquisition/reels/tournage/prep?reel=${slot.id}`)}>
              Préparer le tournage ↗
            </button>
          )}
          {!readOnly && <ConfirmButton label="Supprimer" confirmLabel="Confirmer la suppression" onConfirm={() => void remove()} />}
        </div>
        <Field label="Titre">
          <BlurText value={slot.title ?? ''} placeholder="Titre du post…" disabled={readOnly} onCommit={(v) => void update({ title: v })} />
        </Field>
        <Tabs items={stepItems} active={step} onChange={setStep} />
        {step === 'brief' && <BriefStep slot={slot} role={role} update={update} notify={notify} onGoMontage={() => setStep('montage')} />}
        {step === 'montage' && <MontageStep slot={slot} role={role} monteurs={monteurs} update={update} notify={notify} onGoPublication={() => setStep('publication')} />}
        {step === 'publication' && <PublicationStep slot={slot} setSlot={setSlot} readOnly={readOnly} update={update} notify={notify} onDone={() => { onChange(); onClose() }} />}
        {step === 'discussion' && <Discussion slotId={slot.id} notify={notify} />}
      </div>
    </Drawer>
  )
}

type UpdateFn = (patch: Partial<SocialPost> & { revision_feedback?: string }) => Promise<boolean>

function BriefStep({ slot, role, update, notify, onGoMontage }: { slot: SocialPost; role: Role; update: UpdateFn; notify: Notify; onGoMontage: () => void }) {
  const [hooks, setHooks] = useState<string[]>([])
  const [genHooks, setGenHooks] = useState(false)
  const [genScript, setGenScript] = useState(false)
  const [refs, setRefs] = useState<string[]>(slot.references_urls ?? [])
  useEffect(() => setRefs(slot.references_urls ?? []), [slot.references_urls])

  async function generateHooks() {
    setGenHooks(true)
    try {
      const r = await api.post<{ hooks?: string[] }>('/api/social/generate-hooks', { pillar_id: slot.pillar_id, content_kind: slot.content_kind, topic: slot.title ?? undefined, count: 5 })
      setHooks(r.hooks ?? [])
    } catch (e) {
      notify(`Erreur génération : ${errMsg(e)}`, 'danger')
    } finally {
      setGenHooks(false)
    }
  }

  async function generateScript() {
    if (!slot.hook && !slot.title) {
      notify('Renseigne un hook ou un titre avant de générer le script.', 'warning')
      return
    }
    setGenScript(true)
    try {
      const r = await api.post<{ script?: string }>('/api/social/generate-script', { hook: slot.hook, title: slot.title, pillar_id: slot.pillar_id, content_kind: slot.content_kind })
      if (r.script) await update({ script: r.script })
    } catch (e) {
      notify(`Erreur génération script : ${errMsg(e)}`, 'danger')
    } finally {
      setGenScript(false)
    }
  }

  function commitRefs(next: string[]) {
    const cleaned = next.map((s) => s.trim()).filter(Boolean)
    const cur = slot.references_urls ?? []
    if (cleaned.length === cur.length && cleaned.every((u, i) => u === cur[i])) return
    void update({ references_urls: cleaned })
  }

  const action = role === 'monteur' ? null : getTransitionAction(slot, 'brief')

  return (
    <div className="soc-stack">
      <Field
        label="Hook"
        action={
          <button type="button" className="soc-link-btn" disabled={genHooks} onClick={() => void generateHooks()}>
            {genHooks ? 'Génération…' : '✦ Générer 5 hooks'}
          </button>
        }
      >
        <BlurText multiline rows={2} value={slot.hook ?? ''} placeholder="Ajoute une accroche…" onCommit={(v) => void update({ hook: v })} />
        {hooks.map((h, i) => (
          <button key={i} type="button" className="soc-chip-slot" onClick={() => void update({ hook: h })}>
            <span className="soc-chip-slot-hook" style={{ whiteSpace: 'normal', fontSize: 12 }}>{h}</span>
          </button>
        ))}
      </Field>
      <Field
        label="Script"
        action={
          <button type="button" className="soc-link-btn" disabled={genScript} onClick={() => void generateScript()}>
            {genScript ? 'Génération…' : '✦ Générer un script'}
          </button>
        }
      >
        <BlurText multiline rows={7} value={slot.script ?? ''} placeholder="Décris ton idée, tes points clés, le call-to-action…" onCommit={(v) => void update({ script: v })} />
      </Field>
      <Field label="Références">
        {refs.map((u, i) => (
          <div key={i} className="soc-row" style={{ flexWrap: 'nowrap' }}>
            <Input
              value={u}
              placeholder="https://…"
              onChange={(e) => setRefs((r) => r.map((x, idx) => (idx === i ? e.target.value : x)))}
              onBlur={() => commitRefs(refs)}
            />
            <button
              type="button"
              className="ds-pill-button"
              onClick={() => {
                const next = refs.filter((_, idx) => idx !== i)
                setRefs(next)
                commitRefs(next)
              }}
            >
              ×
            </button>
          </div>
        ))}
        <button type="button" className="ds-pill-button" onClick={() => setRefs((r) => [...r, ''])}>
          + Ajouter une référence
        </button>
      </Field>
      <Field label="Notes (privées)">
        <BlurText multiline rows={3} value={slot.notes ?? ''} placeholder="Notes internes…" onCommit={(v) => void update({ notes: v })} />
      </Field>
      {action && (
        <button
          type="button"
          className="ds-pill-button ds-pill-button--dark"
          style={{ alignSelf: 'flex-end' }}
          onClick={async () => {
            if (await update({ production_status: action.nextStatus })) {
              notify('Brief envoyé — le slot est passé en montage.')
              onGoMontage()
            }
          }}
        >
          {action.label} →
        </button>
      )}
    </div>
  )
}

function MediaPreview({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    let c = false
    resolveMediaUrl(path)
      .then((u) => !c && setUrl(u))
      .catch((e) => !c && setErr(errMsg(e)))
    return () => {
      c = true
    }
  }, [path])
  if (err) return <p className="soc-error">{err}</p>
  if (!url) return <span className="soc-muted">Chargement du média…</span>
  if (/\.(mp4|mov|webm|m4v)(\?|$)/i.test(path) || /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url)) {
    return <video src={url} controls preload="metadata" style={{ width: '100%', maxHeight: 360, borderRadius: 12, background: '#000' }} />
  }
  if (/\.(png|jpe?g|webp|gif)(\?|$)/i.test(path) || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url)) {
    return <img src={url} alt="" style={{ width: '100%', maxHeight: 360, objectFit: 'contain', borderRadius: 12 }} />
  }
  return (
    <button type="button" className="ds-pill-button" onClick={() => window.open(url, '_blank')}>
      Ouvrir le lien ↗
    </button>
  )
}

function MontageStep({
  slot,
  role,
  monteurs,
  update,
  notify,
  onGoPublication,
}: {
  slot: SocialPost
  role: Role
  monteurs: Monteur[]
  update: UpdateFn
  notify: Notify
  onGoPublication: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [pct, setPct] = useState(0)
  const [revisionOpen, setRevisionOpen] = useState(false)
  const [feedback, setFeedback] = useState('')
  const isMonteur = role === 'monteur'
  const action = isMonteur ? null : getTransitionAction(slot, 'montage')
  const canRevision = !isMonteur && !!slot.final_url && !!slot.monteur_id && (slot.production_status === 'edited' || slot.production_status === 'ready')

  async function uploadFinal(file: File) {
    if (file.size > MAX_FILE_BYTES) {
      notify('Fichier trop lourd (max 2 Go).', 'warning')
      return
    }
    setUploading(true)
    setPct(0)
    try {
      const { path } = await uploadToR2(file, { post_id: slot.id, target: 'final', onProgress: setPct })
      const advance = slot.production_status === null || ['idea', 'to_film', 'filmed'].includes(slot.production_status)
      await update({ final_url: path, ...(advance ? { production_status: 'edited' as const } : {}) })
    } catch (e) {
      notify(`Erreur upload : ${errMsg(e)}`, 'danger')
    } finally {
      setUploading(false)
    }
  }

  async function validate() {
    if (!action) return
    const patch: Partial<SocialPost> = { production_status: action.nextStatus }
    if (action.nextStatus === 'ready' && slot.final_url && (!slot.media_urls || slot.media_urls.length === 0)) {
      patch.media_urls = [slot.final_url]
      if (!slot.media_type) patch.media_type = 'VIDEO'
    }
    if (await update(patch)) {
      notify('Montage validé — le monteur a été notifié.')
      onGoPublication()
    }
  }

  async function requestRevision() {
    if (!feedback.trim()) return
    if (await update({ production_status: 'filmed', revision_feedback: feedback.trim() })) {
      await api.post(`/api/social/posts/${slot.id}/messages`, { body: `🔄 Retouches demandées: ${feedback.trim()}` }).catch(() => null)
      setRevisionOpen(false)
      setFeedback('')
      notify('Retouches demandées — le monteur a été notifié.')
    }
  }

  const deadlineLocal = slot.montage_deadline ? (() => {
    const d = new Date(slot.montage_deadline)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  })() : ''

  return (
    <div className="soc-stack">
      <Field label="Monteur">
        {monteurs.length === 0 ? (
          <button type="button" className="ds-pill-button" onClick={() => void openWeb('/parametres/equipe?invite=monteur')}>
            Inviter un monteur ↗
          </button>
        ) : (
          <select className="soc-select" value={slot.monteur_id ?? ''} onChange={(e) => void update({ monteur_id: e.target.value || null })}>
            <option value="">— Aucun —</option>
            {monteurs.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Lien du rush">
        <BlurText value={slot.rush_url ?? ''} placeholder="https://drive.google.com/…" onCommit={(v) => void update({ rush_url: v || null })} />
      </Field>
      <Field label="Délai pour le montage">
        <input
          className="ds-input"
          type="datetime-local"
          value={deadlineLocal}
          disabled={isMonteur}
          onChange={(e) => void update({ montage_deadline: e.target.value ? new Date(e.target.value).toISOString() : null })}
        />
      </Field>
      {(slot.final_versions?.length ?? 0) > 0 && (
        <Field label="Versions livrées">
          {(slot.final_versions ?? []).map((v) => (
            <div key={v.version} className="soc-row">
              <strong>V{v.version}</strong>
              <span className="soc-muted">{new Date(v.uploaded_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
              {v.url === slot.final_url && <span className="soc-success">actuelle</span>}
            </div>
          ))}
        </Field>
      )}
      <Field label="Montage final">
        <input ref={fileRef} type="file" accept="video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadFinal(f) }} />
        {slot.final_url ? (
          <>
            <MediaPreview path={slot.final_url} />
            <div className="soc-row">
              <span className="soc-muted" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slot.final_url.split('/').pop()}</span>
              <button type="button" className="ds-pill-button" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? `Upload… ${pct} %` : 'Remplacer'}
              </button>
              <ConfirmButton label="Retirer" onConfirm={() => void update({ final_url: null })} />
            </div>
          </>
        ) : (
          <div className="soc-row">
            <div style={{ flex: 1 }}>
              <BlurText value="" placeholder="Coller un lien…" onCommit={(v) => v.trim() && void update({ final_url: v.trim() })} />
            </div>
            <button type="button" className="ds-pill-button" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? `Upload… ${pct} %` : 'Uploader un fichier'}
            </button>
          </div>
        )}
        {uploading && (
          <div className="soc-bar">
            <span style={{ width: `${pct}%` }} />
          </div>
        )}
      </Field>
      <Field label="Notes du monteur">
        <BlurText multiline rows={3} value={slot.editor_notes ?? ''} placeholder="Instructions, retours, corrections…" onCommit={(v) => void update({ editor_notes: v || null })} />
      </Field>
      {revisionOpen ? (
        <section className="soc-card">
          <Field label="Demande de retouches">
            <Textarea value={feedback} autoFocus rows={3} onChange={(e) => setFeedback(e.target.value)} placeholder="Explique ce qui doit être retouché (timing, plans, sous-titres…)" />
          </Field>
          <div className="lead-create-actions">
            <button type="button" className="ds-pill-button" onClick={() => setRevisionOpen(false)}>
              Annuler
            </button>
            <button type="button" className="ds-pill-button ds-pill-button--dark" disabled={!feedback.trim()} onClick={() => void requestRevision()}>
              Envoyer au monteur
            </button>
          </div>
        </section>
      ) : (
        (canRevision || action) && (
          <div className="soc-row" style={{ justifyContent: 'space-between' }}>
            {canRevision ? (
              <button type="button" className="ds-pill-button" onClick={() => setRevisionOpen(true)}>
                Demander des retouches
              </button>
            ) : (
              <span />
            )}
            {action && (
              <button type="button" className="ds-pill-button ds-pill-button--dark" onClick={() => void validate()}>
                {action.label} →
              </button>
            )}
          </div>
        )
      )}
      <p className="soc-muted" style={{ margin: 0 }}>
        Les annotations horodatées sur la vidéo (revue image par image) se font sur le web.{' '}
        <button type="button" className="soc-link-btn" onClick={() => void openWeb('/acquisition/reseaux-sociaux')}>
          Ouvrir le planning web ↗
        </button>
      </p>
    </div>
  )
}

function PublicationStep({
  slot,
  setSlot,
  readOnly,
  update,
  notify,
  onDone,
}: {
  slot: SocialPost
  setSlot: (s: SocialPost) => void
  readOnly: boolean
  update: UpdateFn
  notify: Notify
  onDone: () => void
}) {
  const pubs = useMemo(() => slot.publications ?? [], [slot.publications])
  const enabled = PLATFORMS.filter((p) => pubs.some((x) => x.platform === p.key))
  const [active, setActive] = useState<SocialPlatform | null>(enabled[0]?.key ?? null)
  const resolved = active && enabled.some((p) => p.key === active) ? active : (enabled[0]?.key ?? null)
  const [time, setTime] = useState(() => {
    if (!slot.scheduled_at) return '18:00'
    const d = new Date(slot.scheduled_at)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  })
  const [date, setDate] = useState(() => (slot.plan_date ?? slot.scheduled_at ?? new Date().toISOString()).slice(0, 10))
  const [busy, setBusy] = useState<'schedule' | 'now' | null>(null)
  const [uploading, setUploading] = useState(false)
  const [pct, setPct] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const hasMedia = (slot.media_urls ?? []).length > 0
  const built = new Date(`${date}T${time}:00`)
  const inPast = !isNaN(built.getTime()) && built.getTime() <= Date.now()

  function togglePlatform(platform: SocialPlatform) {
    if (readOnly) return
    const on = pubs.some((p) => p.platform === platform)
    let next: SocialPostPublication[]
    if (on) next = pubs.filter((p) => p.platform !== platform)
    else {
      const config =
        platform === 'youtube'
          ? { title: slot.title ?? '', description: slot.caption ?? '', privacy_status: 'public' }
          : platform === 'instagram'
            ? { caption: slot.caption ?? '', hashtags: slot.hashtags ?? [] }
            : {}
      next = [...pubs, { platform, config, scheduled_at: slot.scheduled_at, status: 'pending' }]
      setActive(platform)
    }
    void update({ publications: next })
  }

  function patchConfig(platform: SocialPlatform, patch: Record<string, unknown>) {
    void update({ publications: pubs.map((p) => (p.platform === platform ? { ...p, config: { ...p.config, ...patch } } : p)) })
  }

  function validate(): boolean {
    if (enabled.length === 0) {
      notify('Sélectionne au moins une plateforme.', 'warning')
      return false
    }
    if (!hasMedia) {
      notify('Au moins un média est requis.', 'warning')
      return false
    }
    const yt = pubs.find((p) => p.platform === 'youtube')
    if (yt && !String(yt.config.title ?? '').trim()) {
      notify('Renseigne un titre YouTube avant de publier.', 'warning')
      return false
    }
    return true
  }

  async function schedule() {
    if (!validate()) return
    if (inPast) {
      notify('Date dans le passé — choisis une date future ou publie maintenant.', 'warning')
      return
    }
    setBusy('schedule')
    try {
      const at = built.toISOString()
      const r = await api.patch<{ data?: SocialPost }>(`/api/social/posts/${slot.id}`, {
        status: 'scheduled',
        scheduled_at: at,
        plan_date: date,
        ...(date !== (slot.plan_date ?? '').slice(0, 10) ? { slot_index: null } : {}),
        publications: enabled.map((e) => {
          const p = pubs.find((x) => x.platform === e.key)
          return { platform: e.key, config: p?.config ?? {}, scheduled_at: at }
        }),
      })
      if (r.data) setSlot(r.data)
      notify(slot.status === 'scheduled' ? 'Reprogrammé' : 'Publication programmée')
      onDone()
    } catch (e) {
      notify(`Erreur programmation : ${errMsg(e)}`, 'danger')
    } finally {
      setBusy(null)
    }
  }

  async function publishNow() {
    if (!validate()) return
    setBusy('now')
    try {
      const now = new Date().toISOString()
      await api.patch(`/api/social/posts/${slot.id}`, {
        status: 'scheduled',
        scheduled_at: now,
        publications: enabled.map((e) => ({ platform: e.key, config: pubs.find((x) => x.platform === e.key)?.config ?? {}, scheduled_at: now })),
      })
      const r = await api.post<{ published?: number; errors?: number }>(`/api/social/posts/${slot.id}/publish`, {})
      if ((r.errors ?? 0) > 0) notify(`Publication partielle : ${r.published ?? 0} publié(s), ${r.errors} échec(s).`, 'warning')
      else notify(`Publication lancée (${r.published ?? enabled.length}).`)
      onDone()
    } catch (e) {
      notify(`Erreur publication : ${errMsg(e)}`, 'danger')
    } finally {
      setBusy(null)
    }
  }

  async function uploadMedia(file: File) {
    if (file.size > MAX_FILE_BYTES) {
      notify('Fichier trop lourd (max 2 Go).', 'warning')
      return
    }
    setUploading(true)
    setPct(0)
    try {
      const { path } = await uploadToR2(file, { post_id: slot.id, target: 'media', onProgress: setPct })
      await update({ media_urls: [...(slot.media_urls ?? []), path] })
    } catch (e) {
      notify(`Erreur upload : ${errMsg(e)}`, 'danger')
    } finally {
      setUploading(false)
    }
  }

  const banner =
    slot.status === 'scheduled' && slot.scheduled_at
      ? { tone: 'info', text: `Programmé pour le ${new Date(slot.scheduled_at).toLocaleString('fr-FR', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}` }
      : slot.status === 'publishing'
        ? { tone: 'warning', text: 'Publication en cours…' }
        : slot.status === 'published'
          ? { tone: 'success', text: slot.published_at ? `Publié le ${new Date(slot.published_at).toLocaleString('fr-FR', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}` : 'Publié' }
          : slot.status === 'partial'
            ? { tone: 'warning', text: 'Publication partielle (certaines plateformes ont échoué)' }
            : slot.status === 'failed'
              ? { tone: 'danger', text: 'Publication échouée' }
              : null

  const activePub = pubs.find((p) => p.platform === resolved)

  return (
    <div className="soc-stack">
      {banner && (
        <div className={`soc-banner soc-banner--${banner.tone}`}>
          <span style={{ flex: 1 }}>{banner.text}</span>
          {slot.status === 'scheduled' && (
            <button type="button" className="ds-pill-button" onClick={() => void update({ status: 'draft', scheduled_at: null })}>
              Annuler la programmation
            </button>
          )}
          {(slot.status === 'failed' || slot.status === 'partial') && (
            <button type="button" className="ds-pill-button" disabled={busy !== null} onClick={() => void publishNow()}>
              {busy === 'now' ? 'Publication…' : '↻ Réessayer'}
            </button>
          )}
          {pubs.filter((p) => p.public_url).map((p) => (
            <button key={p.platform} type="button" className="soc-link-btn" onClick={() => window.open(p.public_url ?? '', '_blank')}>
              {p.platform} ↗
            </button>
          ))}
        </div>
      )}
      {pubs.filter((p) => p.error_message).map((p) => (
        <p key={p.platform} className="soc-error">
          {p.platform} : {p.error_message}
        </p>
      ))}
      <Field label="Plateformes">
        <div className="soc-row">
          {PLATFORMS.map((p) => {
            const on = pubs.some((x) => x.platform === p.key)
            return (
              <button key={p.key} type="button" disabled={readOnly} className={`ds-pill-button ${on ? 'ds-pill-button--dark' : ''}`} onClick={() => togglePlatform(p.key)}>
                {on ? '✓ ' : ''}
                {p.label}
              </button>
            )
          })}
        </div>
      </Field>
      <Field label={`Médias (${(slot.media_urls ?? []).length})`}>
        {(slot.media_urls ?? []).map((m) => (
          <div key={m} className="soc-stack" style={{ gap: 6 }}>
            <MediaPreview path={m} />
            {!readOnly && (
              <ConfirmButton label="Retirer ce média" onConfirm={() => void update({ media_urls: (slot.media_urls ?? []).filter((x) => x !== m) })} />
            )}
          </div>
        ))}
        {!readOnly && (
          <>
            <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadMedia(f) }} />
            <button type="button" className="ds-pill-button" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? `Upload… ${pct} %` : '+ Uploader un média'}
            </button>
          </>
        )}
      </Field>
      {enabled.length > 0 && resolved && (
        <section className="soc-card">
          <Tabs items={enabled.map((p) => ({ key: p.key, label: p.label }))} active={resolved} onChange={setActive} />
          {resolved === 'instagram' && activePub && (
            <>
              <Field label="Caption">
                <BlurText multiline rows={5} disabled={readOnly} value={String(activePub.config.caption ?? '')} placeholder="Rédige ta caption Instagram…" onCommit={(v) => patchConfig('instagram', { caption: v })} />
              </Field>
              <Field label="Hashtags">
                <BlurText
                  disabled={readOnly}
                  value={(Array.isArray(activePub.config.hashtags) ? (activePub.config.hashtags as string[]) : []).join(' ')}
                  placeholder="#coaching #motivation …"
                  onCommit={(v) => patchConfig('instagram', { hashtags: v.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean).map((t) => (t.startsWith('#') ? t : `#${t}`)) })}
                />
              </Field>
            </>
          )}
          {resolved === 'youtube' && activePub && (
            <>
              <Field label="Titre">
                <BlurText disabled={readOnly} value={String(activePub.config.title ?? '')} placeholder="Titre de la vidéo YouTube…" onCommit={(v) => patchConfig('youtube', { title: v })} />
              </Field>
              <Field label="Description">
                <BlurText multiline rows={4} disabled={readOnly} value={String(activePub.config.description ?? '')} onCommit={(v) => patchConfig('youtube', { description: v })} />
              </Field>
              <Field label="Visibilité">
                <select className="soc-select" disabled={readOnly} value={String(activePub.config.privacy_status ?? 'private')} onChange={(e) => patchConfig('youtube', { privacy_status: e.target.value })}>
                  <option value="private">Privé</option>
                  <option value="unlisted">Non répertorié</option>
                  <option value="public">Public</option>
                </select>
              </Field>
            </>
          )}
          {resolved === 'tiktok' && <EmptyState title="TikTok" description="La publication TikTok n'est pas encore disponible (même état que le web)." />}
        </section>
      )}
      {enabled.length > 0 && (
        <Field label="Date et heure de publication">
          <div className="soc-row">
            <input className="ds-input" type="date" value={date} disabled={slot.status === 'published' || slot.status === 'publishing'} onChange={(e) => setDate(e.target.value)} />
            <input className="ds-input" type="time" value={time} disabled={slot.status === 'published' || slot.status === 'publishing'} onChange={(e) => setTime(e.target.value)} />
          </div>
          {inPast && slot.status !== 'published' && <span className="soc-muted">La date sélectionnée est dans le passé — change-la ou publie maintenant.</span>}
        </Field>
      )}
      {enabled.length > 0 && hasMedia && slot.status !== 'published' && slot.status !== 'publishing' && (
        <div className="soc-row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="ds-pill-button" disabled={busy !== null} onClick={() => void publishNow()}>
            {busy === 'now' ? 'Publication…' : 'Publier maintenant'}
          </button>
          <button type="button" className="ds-pill-button ds-pill-button--dark" disabled={busy !== null || inPast} onClick={() => void schedule()}>
            {busy === 'schedule' ? 'Programmation…' : slot.status === 'scheduled' || slot.status === 'failed' || slot.status === 'partial' ? 'Reprogrammer' : 'Programmer la publication'}
          </button>
        </div>
      )}
    </div>
  )
}

function Discussion({ slotId, notify }: { slotId: string; notify: Notify }) {
  const [messages, setMessages] = useState<SlotMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await api.get<{ data: SlotMessage[] }>(`/api/social/posts/${slotId}/messages`)
      setMessages(r.data ?? [])
    } catch (e) {
      notify(errMsg(e), 'danger')
    } finally {
      setLoading(false)
    }
  }, [slotId, notify])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 20000)
    return () => clearInterval(t)
  }, [load])

  async function send() {
    if (!text.trim()) return
    setSending(true)
    try {
      const r = await api.post<{ data: SlotMessage }>(`/api/social/posts/${slotId}/messages`, { body: text.trim() })
      setMessages((m) => [...m, r.data])
      setText('')
    } catch (e) {
      notify(errMsg(e), 'danger')
    } finally {
      setSending(false)
    }
  }

  async function toggleResolved(m: SlotMessage) {
    try {
      await api.patch(`/api/social/posts/${slotId}/messages/${m.id}`, { resolved: !m.resolved_at })
      void load()
    } catch (e) {
      notify(errMsg(e), 'danger')
    }
  }

  if (loading) return <LoadingState />
  return (
    <div className="soc-stack">
      {messages.length === 0 && <EmptyState title="Aucun message" description="Échange ici avec ton monteur." />}
      {messages.map((m) => {
        const name = m.author?.full_name || m.author?.email || 'Utilisateur'
        return (
          <div key={m.id} className="soc-chat-msg">
            <Avatar name={name} size={28} src={m.author?.avatar_url} />
            <div>
              <div className="soc-chat-meta">
                {name} · {new Date(m.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                {m.video_timestamp_seconds !== null && ` · ⏱ ${Math.floor(m.video_timestamp_seconds / 60)}:${String(Math.floor(m.video_timestamp_seconds % 60)).padStart(2, '0')}`}
              </div>
              <div className="soc-chat-bubble" style={m.resolved_at ? { opacity: 0.6, textDecoration: 'line-through' } : undefined}>
                {m.body}
              </div>
              {m.video_timestamp_seconds !== null && (
                <button type="button" className="soc-link-btn" onClick={() => void toggleResolved(m)}>
                  {m.resolved_at ? 'Rouvrir' : 'Marquer résolu'}
                </button>
              )}
            </div>
          </div>
        )
      })}
      <div className="soc-row" style={{ alignItems: 'flex-end', flexWrap: 'nowrap' }}>
        <Textarea
          value={text}
          rows={2}
          placeholder="Écrire un message…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send()
            }
          }}
        />
        <button type="button" className="ds-pill-button ds-pill-button--dark" disabled={sending || !text.trim()} onClick={() => void send()}>
          Envoyer
        </button>
      </div>
    </div>
  )
}
