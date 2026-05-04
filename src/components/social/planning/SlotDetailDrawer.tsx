'use client'

import { useState, useEffect } from 'react'
import { X, Calendar as CalIcon, Send, Trash2, Camera, Film, FileText, Plus } from 'lucide-react'
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
      const platform = slot.content_kind === 'story' ? 'instagram' : 'instagram'
      await fetch(`/api/social/posts/${slot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'scheduled',
          scheduled_at: dt.toISOString(),
          publications: [{ platform, scheduled_at: dt.toISOString() }],
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
      <div style={drawerOverlayStyle} onClick={onClose}>
        <div style={drawerStyle} onClick={(e) => e.stopPropagation()}>
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)' }}>Chargement…</div>
        </div>
      </div>
    )
  }
  if (!slot) {
    return (
      <div style={drawerOverlayStyle} onClick={onClose}>
        <div style={drawerStyle} onClick={(e) => e.stopPropagation()}>
          <div style={{ padding: 60, textAlign: 'center', color: '#ef4444' }}>Slot introuvable</div>
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

  return (
    <div style={drawerOverlayStyle} onClick={onClose}>
      <div style={drawerStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <KindIcon size={16} color="var(--text-tertiary)" />
            <select
              value={slot.pillar_id ?? ''}
              onChange={(e) => patch({ pillar_id: e.target.value || null })}
              style={{
                padding: '4px 10px', fontSize: 11, fontWeight: 700,
                color: '#fff',
                background: pillar?.color ?? '#666',
                border: 'none', borderRadius: 999, cursor: 'pointer',
              }}
            >
              <option value="" style={{ color: '#000', background: '#fff' }}>(aucun pillar)</option>
              {pillars.map((p) => (
                <option key={p.id} value={p.id} style={{ color: '#000', background: '#fff' }}>{p.name}</option>
              ))}
            </select>
          </div>
          <button onClick={onClose} style={iconBtnStyle}><X size={18} /></button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: 20 }}>
          {/* Plan date + status */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={labelStyle}>Date prévue</label>
              <input
                type="date"
                value={slot.plan_date ?? ''}
                onChange={(e) => patch({ plan_date: e.target.value || null })}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={labelStyle}>Statut production</label>
              <select
                value={slot.production_status ?? 'idea'}
                onChange={(e) => patch({ production_status: e.target.value as SocialProductionStatus })}
                style={inputStyle}
              >
                {PRODUCTION_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={labelStyle}>Type</label>
              <select
                value={slot.content_kind ?? 'post'}
                onChange={(e) => patch({ content_kind: e.target.value as SocialContentKind })}
                style={inputStyle}
              >
                <option value="post">Post</option>
                <option value="story">Story</option>
                <option value="reel">Reel</option>
              </select>
            </div>
          </div>

          {/* Hook */}
          <Field label="Accroche / Hook">
            <input
              type="text"
              value={slot.hook ?? ''}
              onChange={(e) => setSlot({ ...slot, hook: e.target.value })}
              onBlur={() => patch({ hook: slot.hook })}
              placeholder="Ton accroche en 1 ligne…"
              style={inputStyle}
            />
          </Field>

          {/* Title */}
          <Field label="Titre">
            <input
              type="text"
              value={slot.title ?? ''}
              onChange={(e) => setSlot({ ...slot, title: e.target.value })}
              onBlur={() => patch({ title: slot.title })}
              placeholder="Sujet du contenu…"
              style={inputStyle}
            />
          </Field>

          {/* Script */}
          <Field label="Script">
            <textarea
              value={slot.script ?? ''}
              onChange={(e) => setSlot({ ...slot, script: e.target.value })}
              onBlur={() => patch({ script: slot.script })}
              placeholder="Script complet, plan de tournage…"
              rows={6}
              style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
            />
          </Field>

          {/* References */}
          <Field label="Références (liens rushs, moodboard)">
            <RefsList
              urls={slot.references_urls ?? []}
              onChange={(urls) => patch({ references_urls: urls })}
            />
          </Field>

          {/* Media */}
          <Field label="Media uploadé">
            <MediaList
              urls={slot.media_urls ?? []}
              onChange={(urls) => patch({ media_urls: urls })}
            />
          </Field>

          {/* Caption */}
          <Field label="Caption">
            <textarea
              value={slot.caption ?? ''}
              onChange={(e) => setSlot({ ...slot, caption: e.target.value })}
              onBlur={() => patch({ caption: slot.caption })}
              placeholder="Caption finale…"
              rows={4}
              style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
            />
          </Field>

          {/* Hashtags */}
          <Field label="Hashtags (séparés par espace)">
            <input
              type="text"
              defaultValue={(slot.hashtags ?? []).join(' ')}
              onBlur={(e) => {
                const tags = e.target.value.split(/\s+/).filter(Boolean).map((t) => t.replace(/^#/, ''))
                patch({ hashtags: tags })
              }}
              placeholder="fitness coaching motivation"
              style={inputStyle}
            />
          </Field>

          {/* Notes */}
          <Field label="Notes">
            <textarea
              value={slot.notes ?? ''}
              onChange={(e) => setSlot({ ...slot, notes: e.target.value })}
              onBlur={() => patch({ notes: slot.notes })}
              rows={3}
              style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
            />
          </Field>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderTop: '1px solid var(--border-primary)', gap: 8 }}>
          <button onClick={handleDelete} style={dangerBtnStyle}>
            <Trash2 size={14} /> Supprimer
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  style={{ ...inputStyle, width: 100 }}
                />
                <button onClick={() => setShowScheduleConfirm(false)} style={cancelBtnStyle}>Annuler</button>
                <button onClick={handleSchedule} disabled={scheduling} style={primaryBtnStyle}>
                  {scheduling ? '…' : 'Confirmer'}
                </button>
              </div>
            )}
          </div>
        </div>

        {saving && (
          <div style={{ position: 'absolute', top: 8, right: 60, fontSize: 10, color: 'var(--text-tertiary)' }}>
            Sauvegarde…
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

function RefsList({ urls, onChange }: { urls: string[]; onChange: (urls: string[]) => void }) {
  const [input, setInput] = useState('')
  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
        {urls.map((u, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <a href={u} target="_blank" rel="noreferrer" style={{ flex: 1, fontSize: 12, color: '#5b9bf5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u}</a>
            <button onClick={() => onChange(urls.filter((_, j) => j !== i))} style={iconBtnStyle}><Trash2 size={12} /></button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="url"
          value={input}
          onChange={(e) => setInput(e.target.value)}
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
          style={primaryBtnStyle}
        ><Plus size={14} /></button>
      </div>
    </div>
  )
}

function MediaList({ urls, onChange }: { urls: string[]; onChange: (urls: string[]) => void }) {
  const [input, setInput] = useState('')
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {urls.map((u, i) => (
          <div key={i} style={{ position: 'relative', width: 80, height: 80, background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 6, overflow: 'hidden' }}>
            <img src={u} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            <button onClick={() => onChange(urls.filter((_, j) => j !== i))} style={{ position: 'absolute', top: 2, right: 2, padding: 2, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
              <Trash2 size={10} />
            </button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="url"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="URL média (image/vidéo)"
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          onClick={() => {
            if (input) {
              onChange([...urls, input])
              setInput('')
            }
          }}
          style={primaryBtnStyle}
        ><Plus size={14} /></button>
      </div>
      <p style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
        V1 : URL média manuelle. Upload direct via composer scheduler existant.
      </p>
    </div>
  )
}

const drawerOverlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', justifyContent: 'flex-end', zIndex: 100,
}
const drawerStyle: React.CSSProperties = {
  width: 'min(560px, 95vw)', height: '100vh',
  background: 'var(--bg-primary)', borderLeft: '1px solid var(--border-primary)',
  display: 'flex', flexDirection: 'column', position: 'relative',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)',
  textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  color: 'var(--text-primary)', background: 'var(--bg-secondary)',
  border: '1px solid var(--border-primary)', borderRadius: 6,
  outline: 'none',
}
const iconBtnStyle: React.CSSProperties = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  color: 'var(--text-tertiary)', padding: 4,
}
const primaryBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4,
  padding: '8px 14px', fontSize: 12, fontWeight: 600,
  color: '#fff', background: '#a78bfa',
  border: 'none', borderRadius: 6, cursor: 'pointer',
}
const cancelBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4,
  padding: '8px 14px', fontSize: 12, fontWeight: 600,
  color: 'var(--text-secondary)', background: 'var(--bg-secondary)',
  border: '1px solid var(--border-primary)', borderRadius: 6, cursor: 'pointer',
}
const dangerBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4,
  padding: '8px 14px', fontSize: 12, fontWeight: 600,
  color: '#ef4444', background: 'transparent',
  border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, cursor: 'pointer',
}
