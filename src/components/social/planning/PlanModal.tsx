'use client'

import { useState } from 'react'
import { X, FileText, Camera, CalendarRange, Sparkles } from 'lucide-react'

interface Props {
  onClose: () => void
  onConfirm: (params: {
    kinds: ('post' | 'story')[]
    start_date: string
    end_date: string
  }) => Promise<void>
}

type Preset = 'next_week' | 'next_month' | 'this_week' | 'this_month' | 'custom'

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'this_week',  label: 'Cette semaine' },
  { key: 'next_week',  label: '7 prochains jours' },
  { key: 'this_month', label: 'Ce mois' },
  { key: 'next_month', label: 'Mois prochain' },
  { key: 'custom',     label: 'Période personnalisée' },
]

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function presetRange(preset: Preset): { start: string; end: string } {
  const today = new Date()
  if (preset === 'this_week') {
    const dow = (today.getDay() + 6) % 7
    const start = new Date(today); start.setDate(today.getDate() - dow)
    const end = new Date(start); end.setDate(start.getDate() + 6)
    return { start: fmt(start), end: fmt(end) }
  }
  if (preset === 'next_week') {
    const end = new Date(today); end.setDate(today.getDate() + 6)
    return { start: fmt(today), end: fmt(end) }
  }
  if (preset === 'this_month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    return { start: fmt(start), end: fmt(end) }
  }
  if (preset === 'next_month') {
    const start = new Date(today.getFullYear(), today.getMonth() + 1, 1)
    const end = new Date(today.getFullYear(), today.getMonth() + 2, 0)
    return { start: fmt(start), end: fmt(end) }
  }
  // custom — defaults to next 14 days
  const end = new Date(today); end.setDate(today.getDate() + 13)
  return { start: fmt(today), end: fmt(end) }
}

export default function PlanModal({ onClose, onConfirm }: Props) {
  const [preset, setPreset] = useState<Preset>('next_month')
  const [{ start, end }, setRange] = useState(() => presetRange('next_month'))
  const [kinds, setKinds] = useState<{ post: boolean; story: boolean }>({ post: true, story: false })
  const [submitting, setSubmitting] = useState(false)

  const handlePresetChange = (p: Preset) => {
    setPreset(p)
    if (p !== 'custom') setRange(presetRange(p))
    // Smart defaults : si on choisit semaine → activer stories aussi
    if (p === 'this_week' || p === 'next_week') {
      setKinds({ post: true, story: true })
    } else if (p === 'this_month' || p === 'next_month') {
      setKinds({ post: true, story: false })
    }
  }

  const submit = async () => {
    if (!kinds.post && !kinds.story) return
    setSubmitting(true)
    try {
      await onConfirm({
        kinds: [
          ...(kinds.post ? ['post' as const] : []),
          ...(kinds.story ? ['story' as const] : []),
        ],
        start_date: start,
        end_date: end,
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Preview count
  const days = Math.max(0, Math.floor((new Date(end + 'T00:00:00').getTime() - new Date(start + 'T00:00:00').getTime()) / 86400000) + 1)
  const fmtPretty = (s: string) =>
    new Date(s + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={(e) => e.stopPropagation()} style={modalStyle}>
        <div style={headerStyle}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <CalendarRange size={16} color="#a78bfa" />
              Planifier des slots
            </h2>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
              Crée des slots vides à partir de ta trame, prêts à enrichir.
            </p>
          </div>
          <button onClick={onClose} style={iconBtnStyle}><X size={16} /></button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Période */}
          <div>
            <label style={labelStyle}>Période</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => handlePresetChange(p.key)}
                  style={{
                    padding: '6px 12px', fontSize: 11, fontWeight: 600,
                    color: preset === p.key ? '#fff' : 'var(--text-secondary)',
                    background: preset === p.key ? '#a78bfa' : 'var(--bg-secondary)',
                    border: `1px solid ${preset === p.key ? '#a78bfa' : 'var(--border-primary)'}`,
                    borderRadius: 999, cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <span style={smallLabelStyle}>Du</span>
                <input
                  type="date"
                  value={start}
                  onChange={(e) => { setRange((r) => ({ ...r, start: e.target.value })); setPreset('custom') }}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <span style={smallLabelStyle}>Au</span>
                <input
                  type="date"
                  value={end}
                  onChange={(e) => { setRange((r) => ({ ...r, end: e.target.value })); setPreset('custom') }}
                  style={inputStyle}
                />
              </div>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6 }}>
              {days} jour{days > 1 ? 's' : ''} · {fmtPretty(start)} → {fmtPretty(end)}
            </div>
          </div>

          {/* Types */}
          <div>
            <label style={labelStyle}>Types de contenu</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setKinds((k) => ({ ...k, post: !k.post }))}
                style={typeBtnStyle(kinds.post, '#a78bfa')}
              >
                <FileText size={14} />
                Posts
                <span style={typeCountStyle(kinds.post)}>1-2/j</span>
              </button>
              <button
                onClick={() => setKinds((k) => ({ ...k, story: !k.story }))}
                style={typeBtnStyle(kinds.story, '#ec4899')}
              >
                <Camera size={14} />
                Stories
                <span style={typeCountStyle(kinds.story)}>5/j</span>
              </button>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6 }}>
              Conseil : stories sur la semaine, posts sur le mois.
            </div>
          </div>

          {/* Info */}
          <div style={{ padding: 10, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 8, fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', gap: 8 }}>
            <Sparkles size={12} color="#a78bfa" style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              <strong style={{ color: 'var(--text-secondary)' }}>Note :</strong> ça ne génère pas de contenu IA. Ça crée juste des slots vides à partir de ta trame, prêts à être enrichis (hook, script, media). Idempotent : ne duplique pas les slots existants.
            </span>
          </div>
        </div>

        <div style={footerStyle}>
          <button onClick={onClose} style={cancelBtnStyle}>Annuler</button>
          <button
            onClick={submit}
            disabled={submitting || (!kinds.post && !kinds.story)}
            style={confirmBtnStyle(submitting || (!kinds.post && !kinds.story))}
          >
            {submitting ? 'Création…' : 'Créer les slots'}
          </button>
        </div>
      </div>
    </div>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20,
}
const modalStyle: React.CSSProperties = {
  width: 'min(520px, 95vw)',
  background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
  borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  display: 'flex', flexDirection: 'column', overflow: 'hidden',
}
const headerStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  padding: '16px 20px', borderBottom: '1px solid var(--border-primary)',
}
const footerStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'flex-end', gap: 8,
  padding: '14px 20px', borderTop: '1px solid var(--border-primary)',
  background: 'var(--bg-secondary)',
}
const iconBtnStyle: React.CSSProperties = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  color: 'var(--text-tertiary)', padding: 4,
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
  textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
}
const smallLabelStyle: React.CSSProperties = {
  display: 'block', fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)',
  textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 12,
  color: 'var(--text-primary)', background: 'var(--bg-secondary)',
  border: '1px solid var(--border-primary)', borderRadius: 6, outline: 'none',
}
const typeBtnStyle = (active: boolean, color: string): React.CSSProperties => ({
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  padding: '12px 16px', fontSize: 13, fontWeight: 600,
  color: active ? '#fff' : 'var(--text-tertiary)',
  background: active ? color : 'var(--bg-secondary)',
  border: `1px solid ${active ? color : 'var(--border-primary)'}`,
  borderRadius: 8, cursor: 'pointer',
  transition: 'all 0.15s',
})
const typeCountStyle = (active: boolean): React.CSSProperties => ({
  fontSize: 10, fontWeight: 600, opacity: 0.8,
  marginLeft: 4, padding: '2px 6px',
  background: active ? 'rgba(255,255,255,0.2)' : 'var(--bg-elevated)',
  borderRadius: 999,
})
const cancelBtnStyle: React.CSSProperties = {
  padding: '8px 16px', fontSize: 12, fontWeight: 600,
  color: 'var(--text-secondary)', background: 'transparent',
  border: '1px solid var(--border-primary)', borderRadius: 6, cursor: 'pointer',
}
const confirmBtnStyle = (disabled: boolean): React.CSSProperties => ({
  padding: '8px 18px', fontSize: 12, fontWeight: 600,
  color: '#fff', background: disabled ? '#4b5563' : '#a78bfa',
  border: 'none', borderRadius: 6,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.7 : 1,
})
