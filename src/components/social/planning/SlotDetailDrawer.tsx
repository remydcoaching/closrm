'use client'

import { useState, useEffect } from 'react'
import {
  X, Calendar as CalIcon, Send, Trash2, Plus, Image as ImgIcon,
  Camera, Film, FileText, Sparkles, Hash, Link2,
} from 'lucide-react'
import {
  type ContentPillar,
  type SocialPostWithPublications,
  type SocialProductionStatus,
  type SocialContentKind,
  PRODUCTION_STATUSES,
} from '@/types'

interface Props {
  slotId: string
  pillars: ContentPillar[]
  onClose: () => void
  onChange: () => void
}

export default function SlotDetailDrawer({ slotId, pillars, onClose, onChange }: Props) {
  const [slot, setSlot] = useState<SocialPostWithPublications | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const [scheduleTime, setScheduleTime] = useState('18:00')
  const [showScheduleConfirm, setShowScheduleConfirm] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const res = await fetch(`/api/social/posts/${slotId}`)
      if (cancelled) return
      const json = await res.json()
      setSlot(json.data ?? null)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [slotId])

  const patch = async (fields: Partial<SocialPostWithPublications>) => {
    if (!slot) return
    setSaving(true)
    setSlot({ ...slot, ...fields })
    try {
      await fetch(`/api/social/posts/${slot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      onChange()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!slot) return
    if (!confirm('Supprimer ce slot ?')) return
    await fetch(`/api/social/posts/${slot.id}`, { method: 'DELETE' })
    onChange()
    onClose()
  }

  const handleSchedule = async () => {
    if (!slot || !slot.plan_date) {
      alert('Une date de plan est requise pour programmer le slot.')
      return
    }
    if (slot.production_status !== 'ready') {
      alert('Le slot doit être en statut "Prêt".')
      return
    }
    if (!slot.media_urls || slot.media_urls.length === 0) {
      alert('Au moins un media doit être uploadé.')
      return
    }
    setScheduling(true)
    try {
      const [hh, mm] = scheduleTime.split(':')
      const dt = new Date(slot.plan_date + 'T' + hh + ':' + mm + ':00')
      await fetch(`/api/social/posts/${slot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'scheduled',
          scheduled_at: dt.toISOString(),
          publications: [{ platform: 'instagram', scheduled_at: dt.toISOString() }],
        }),
      })
      setShowScheduleConfirm(false)
      onChange()
      onClose()
    } finally {
      setScheduling(false)
    }
  }

  const handleUnschedule = async () => {
    if (!slot) return
    await patch({ status: 'draft', scheduled_at: null })
  }

  if (loading) {
    return (
      <div style={overlayStyle} onClick={onClose}>
        <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
          <div style={{ padding: 80, textAlign: 'center', color: 'var(--text-tertiary)' }}>Chargement…</div>
        </div>
      </div>
    )
  }
  if (!slot) {
    return (
      <div style={overlayStyle} onClick={onClose}>
        <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
          <div style={{ padding: 80, textAlign: 'center', color: '#ef4444' }}>Slot introuvable</div>
        </div>
      </div>
    )
  }

  const pillar = pillars.find((p) => p.id === slot.pillar_id)
  const KindIcon = slot.content_kind === 'story' ? Camera : slot.content_kind === 'reel' ? Film : FileText
  const canSchedule =
    slot.production_status === 'ready' &&
    slot.media_urls && slot.media_urls.length > 0 &&
    slot.status === 'draft'
  const isPublished = slot.status === 'published' || slot.status === 'publishing'

  // Color for header banner
  const headerColor = pillar?.color ?? '#666'

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* HEADER with pillar color band */}
        <div style={{
          background: `linear-gradient(180deg, ${headerColor}22 0%, transparent 100%)`,
          borderBottom: '1px solid var(--border-primary)',
          padding: '20px 24px',
          position: 'relative',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: headerColor }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <select
                  value={slot.pillar_id ?? ''}
                  onChange={(e) => patch({ pillar_id: e.target.value || null })}
                  style={{
                    padding: '4px 12px', fontSize: 11, fontWeight: 700,
                    color: '#fff',
                    background: headerColor,
                    border: 'none', borderRadius: 999, cursor: 'pointer',
                    appearance: 'none', textTransform: 'uppercase', letterSpacing: 0.4,
                  }}
                >
                  <option value="" style={{ color: '#000', background: '#fff' }}>(aucun pillar)</option>
                  {pillars.map((p) => (
                    <option key={p.id} value={p.id} style={{ color: '#000', background: '#fff' }}>{p.name}</option>
                  ))}
                </select>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', background: 'var(--bg-secondary)', borderRadius: 999, border: '1px solid var(--border-primary)' }}>
                  <KindIcon size={11} color="var(--text-tertiary)" />
                  <select
                    value={slot.content_kind ?? 'post'}
                    onChange={(e) => patch({ content_kind: e.target.value as SocialContentKind })}
                    style={{ background: 'transparent', border: 'none', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', appearance: 'none', textTransform: 'uppercase' }}
                  >
                    <option value="post">Post</option>
                    <option value="story">Story</option>
                    <option value="reel">Reel</option>
                  </select>
                </div>
                {isPublished && (
                  <span style={{ padding: '3px 10px', fontSize: 10, fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.15)', borderRadius: 999, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    Publié
                  </span>
                )}
                {slot.status === 'scheduled' && (
                  <span style={{ padding: '3px 10px', fontSize: 10, fontWeight: 700, color: '#a78bfa', background: 'rgba(167,139,250,0.15)', borderRadius: 999, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    Programmé
                  </span>
                )}
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                {slot.hook || slot.title || <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>Sans accroche</span>}
              </h2>
            </div>
            <button onClick={onClose} style={iconBtnStyle}><X size={18} /></button>
          </div>

          {/* Quick metadata row — pill chips */}
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <MetaPill icon={CalIcon} label="Date prévue">
              <input
                type="date"
                value={slot.plan_date ?? ''}
                onChange={(e) => patch({ plan_date: e.target.value || null })}
                style={pillInputStyle}
              />
            </MetaPill>
            <MetaPill icon={Sparkles} label="Statut" iconColor={statusColor(slot.production_status)}>
              <select
                value={slot.production_status ?? 'idea'}
                onChange={(e) => patch({ production_status: e.target.value as SocialProductionStatus })}
                style={pillInputStyle}
              >
                {PRODUCTION_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </MetaPill>
            {slot.scheduled_at && (
              <MetaPill icon={Send} label="Programmé" iconColor="#a78bfa">
                <span style={{ ...pillInputStyle, display: 'inline-block', cursor: 'default' }}>
                  {new Date(slot.scheduled_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </MetaPill>
            )}
          </div>
        </div>

        {/* BODY — 2 columns */}
        <div style={bodyStyle}>
          {/* LEFT COLUMN — Production */}
          <div style={columnStyle}>
            <ColumnHeader icon={Sparkles} label="Production" color="#a78bfa" />

            <Field label="Accroche / Hook" hint="1 ligne percutante">
              <input
                type="text"
                value={slot.hook ?? ''}
                onChange={(e) => setSlot({ ...slot, hook: e.target.value })}
                onBlur={() => patch({ hook: slot.hook })}
                placeholder="Ex: Comment j'ai perdu 5kg en 2 semaines…"
                style={inputStyle}
              />
            </Field>

            <Field label="Titre / Sujet">
              <input
                type="text"
                value={slot.title ?? ''}
                onChange={(e) => setSlot({ ...slot, title: e.target.value })}
                onBlur={() => patch({ title: slot.title })}
                placeholder="Sujet du contenu…"
                style={inputStyle}
              />
            </Field>

            <Field label="Script">
              <textarea
                value={slot.script ?? ''}
                onChange={(e) => setSlot({ ...slot, script: e.target.value })}
                onBlur={() => patch({ script: slot.script })}
                placeholder="Plan de tournage, dialogues, points clés…"
                rows={8}
                style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5 }}
              />
            </Field>

            <Field label="Références" icon={Link2} hint="Liens rushs, moodboard, inspirations">
              <RefsList
                urls={slot.references_urls ?? []}
                onChange={(urls) => patch({ references_urls: urls })}
              />
            </Field>
          </div>

          {/* DIVIDER */}
          <div style={{ width: 1, background: 'var(--border-primary)' }} />

          {/* RIGHT COLUMN — Publication */}
          <div style={columnStyle}>
            <ColumnHeader icon={Send} label="Publication" color="#10b981" />

            <Field label="Media" icon={ImgIcon} hint="Vidéo finale, image, carrousel">
              <MediaList
                urls={slot.media_urls ?? []}
                onChange={(urls) => patch({ media_urls: urls })}
              />
            </Field>

            <Field label="Caption">
              <textarea
                value={slot.caption ?? ''}
                onChange={(e) => setSlot({ ...slot, caption: e.target.value })}
                onBlur={() => patch({ caption: slot.caption })}
                placeholder="Caption finale qui sera publiée…"
                rows={5}
                style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5 }}
              />
            </Field>

            <Field label="Hashtags" icon={Hash}>
              <HashtagsInput
                tags={slot.hashtags ?? []}
                onChange={(tags) => patch({ hashtags: tags })}
              />
            </Field>

            <Field label="Notes">
              <textarea
                value={slot.notes ?? ''}
                onChange={(e) => setSlot({ ...slot, notes: e.target.value })}
                onBlur={() => patch({ notes: slot.notes })}
                placeholder="Notes internes, todos…"
                rows={3}
                style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
              />
            </Field>
          </div>
        </div>

        {/* FOOTER */}
        <div style={footerStyle}>
          <button onClick={handleDelete} style={dangerBtnStyle}>
            <Trash2 size={14} /> Supprimer
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {saving && (
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Sauvegarde…</span>
            )}
            {slot.status === 'scheduled' && (
              <button onClick={handleUnschedule} style={cancelBtnStyle}>
                <CalIcon size={14} /> Dé-programmer
              </button>
            )}
            {slot.status === 'draft' && canSchedule && !showScheduleConfirm && (
              <button onClick={() => setShowScheduleConfirm(true)} style={primaryBtnStyle}>
                <Send size={14} /> Programmer
              </button>
            )}
            {showScheduleConfirm && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-secondary)', padding: '4px 6px', borderRadius: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', paddingLeft: 6 }}>à</span>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  style={{ ...inputStyle, width: 90, padding: '6px 8px' }}
                />
                <button onClick={() => setShowScheduleConfirm(false)} style={cancelBtnStyle}>Annuler</button>
                <button onClick={handleSchedule} disabled={scheduling} style={primaryBtnStyle}>
                  {scheduling ? '…' : 'Confirmer'}
                </button>
              </div>
            )}
            {slot.status === 'draft' && !canSchedule && (
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                {slot.production_status !== 'ready'
                  ? 'Passe en "Prêt" + media pour programmer'
                  : 'Upload un media pour programmer'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────

function MetaField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={metaLabelStyle}>{label}</span>
      {children}
    </div>
  )
}

function MetaPill({
  icon: Icon, label, iconColor, children,
}: {
  icon: typeof Send
  label: string
  iconColor?: string
  children: React.ReactNode
}) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '6px 10px 6px 12px',
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-primary)',
      borderRadius: 999,
    }}>
      <Icon size={12} color={iconColor ?? 'var(--text-tertiary)'} />
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
          {label}
        </span>
        {children}
      </div>
    </div>
  )
}

function statusColor(status: SocialProductionStatus | null | undefined): string {
  switch (status) {
    case 'idea':    return '#94a3b8'
    case 'to_film': return '#f59e0b'
    case 'filmed':  return '#06b6d4'
    case 'edited':  return '#8b5cf6'
    case 'ready':   return '#10b981'
    default:        return '#94a3b8'
  }
}

function ColumnHeader({ icon: Icon, label, color }: { icon: typeof Send; label: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={14} color={color} />
      </div>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </h3>
    </div>
  )
}

function Field({
  label, hint, icon: Icon, children,
}: {
  label: string
  hint?: string
  icon?: typeof Send
  children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        {Icon && <Icon size={11} color="var(--text-tertiary)" />}
        <label style={labelStyle}>{label}</label>
        {hint && <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>· {hint}</span>}
      </div>
      {children}
    </div>
  )
}

function RefsList({ urls, onChange }: { urls: string[]; onChange: (urls: string[]) => void }) {
  const [input, setInput] = useState('')
  return (
    <div>
      {urls.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
          {urls.map((u, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'var(--bg-secondary)', borderRadius: 6 }}>
              <Link2 size={11} color="var(--text-tertiary)" />
              <a href={u} target="_blank" rel="noreferrer" style={{ flex: 1, fontSize: 12, color: '#5b9bf5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u}</a>
              <button onClick={() => onChange(urls.filter((_, j) => j !== i))} style={iconBtnStyle}><X size={12} /></button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="url"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && input) {
              onChange([...urls, input])
              setInput('')
            }
          }}
          placeholder="https://…"
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          onClick={() => {
            if (input) {
              onChange([...urls, input])
              setInput('')
            }
          }}
          style={addInlineBtnStyle}
        ><Plus size={14} /></button>
      </div>
    </div>
  )
}

function MediaList({ urls, onChange }: { urls: string[]; onChange: (urls: string[]) => void }) {
  const [input, setInput] = useState('')
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        {urls.map((u, i) => (
          <div key={i} style={{ position: 'relative', width: 90, height: 90, background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 8, overflow: 'hidden' }}>
            <img src={u} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            <button onClick={() => onChange(urls.filter((_, j) => j !== i))} style={{ position: 'absolute', top: 4, right: 4, padding: 4, background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', display: 'flex' }}>
              <Trash2 size={11} />
            </button>
          </div>
        ))}
        {urls.length === 0 && (
          <div style={{ width: 90, height: 90, background: 'var(--bg-secondary)', border: '1px dashed var(--border-primary)', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--text-tertiary)' }}>
            <ImgIcon size={20} />
            <span style={{ fontSize: 9 }}>Vide</span>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="url"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && input) {
              onChange([...urls, input])
              setInput('')
            }
          }}
          placeholder="URL média (image/vidéo)…"
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          onClick={() => {
            if (input) {
              onChange([...urls, input])
              setInput('')
            }
          }}
          style={addInlineBtnStyle}
        ><Plus size={14} /></button>
      </div>
    </div>
  )
}

function HashtagsInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState('')
  const addTag = (raw: string) => {
    const clean = raw.replace(/^#+/, '').trim()
    if (!clean) return
    if (tags.includes(clean)) return
    onChange([...tags, clean])
  }
  return (
    <div>
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
          {tags.map((t, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 999, fontSize: 11, fontWeight: 500, color: 'var(--text-primary)' }}>
              #{t}
              <button onClick={() => onChange(tags.filter((_, j) => j !== i))} style={{ ...iconBtnStyle, padding: 0, display: 'flex' }}><X size={10} /></button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ' || e.key === ',') && input) {
            e.preventDefault()
            addTag(input)
            setInput('')
          } else if (e.key === 'Backspace' && !input && tags.length > 0) {
            onChange(tags.slice(0, -1))
          }
        }}
        onBlur={() => {
          if (input) { addTag(input); setInput('') }
        }}
        placeholder="Tape un hashtag puis Entrée ou espace"
        style={inputStyle}
      />
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 100, padding: 20,
}
const modalStyle: React.CSSProperties = {
  width: 'min(1100px, 100%)', maxHeight: '92vh',
  background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
  borderRadius: 16,
  display: 'flex', flexDirection: 'column',
  boxShadow: '0 20px 80px rgba(0,0,0,0.6)',
  overflow: 'hidden',
}
const bodyStyle: React.CSSProperties = {
  flex: 1, overflowY: 'auto',
  display: 'grid', gridTemplateColumns: '1fr 1px 1fr',
}
const columnStyle: React.CSSProperties = {
  padding: '20px 24px',
}
const footerStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
  padding: '14px 24px', borderTop: '1px solid var(--border-primary)',
  background: 'var(--bg-secondary)',
}
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
  textTransform: 'uppercase', letterSpacing: 0.5,
}
const metaLabelStyle: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)',
  textTransform: 'uppercase', letterSpacing: 0.5,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  color: 'var(--text-primary)', background: 'var(--bg-secondary)',
  border: '1px solid var(--border-primary)', borderRadius: 6, outline: 'none',
}
const metaInputStyle: React.CSSProperties = {
  padding: '5px 10px', fontSize: 12, fontWeight: 500,
  color: 'var(--text-primary)', background: 'var(--bg-secondary)',
  border: '1px solid var(--border-primary)', borderRadius: 6, outline: 'none',
  cursor: 'pointer',
}
const pillInputStyle: React.CSSProperties = {
  padding: 0, fontSize: 12, fontWeight: 600,
  color: 'var(--text-primary)', background: 'transparent',
  border: 'none', outline: 'none', cursor: 'pointer',
  appearance: 'none',
}
const iconBtnStyle: React.CSSProperties = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  color: 'var(--text-tertiary)', padding: 4,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const addInlineBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '0 12px', fontSize: 12, fontWeight: 600,
  color: '#fff', background: '#a78bfa',
  border: 'none', borderRadius: 6, cursor: 'pointer',
}
const primaryBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '8px 16px', fontSize: 12, fontWeight: 600,
  color: '#fff', background: '#a78bfa',
  border: 'none', borderRadius: 6, cursor: 'pointer',
}
const cancelBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', fontSize: 12, fontWeight: 600,
  color: 'var(--text-secondary)', background: 'transparent',
  border: '1px solid var(--border-primary)', borderRadius: 6, cursor: 'pointer',
}
const dangerBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', fontSize: 12, fontWeight: 600,
  color: '#ef4444', background: 'transparent',
  border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, cursor: 'pointer',
}
