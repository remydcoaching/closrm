'use client'

import { useRef, useState, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import type { SocialPostWithPublications } from '@/types'

interface MontageStepProps {
  slot: SocialPostWithPublications
  monteurs: Array<{ id: string; email: string; full_name?: string | null }>
  onUpdate: (patch: Partial<SocialPostWithPublications>) => void
  onUploadFinal: (file: File) => Promise<void>
  uploading: boolean
  uploadPct?: number
  transitionAction: { label: string; nextStatus: 'ready' } | null
  onTransition: () => void
  onRequestRevision?: (feedback: string) => Promise<void>
}

export default function MontageStep({
  slot,
  monteurs,
  onUpdate,
  onUploadFinal,
  uploading,
  uploadPct = 0,
  transitionAction,
  onTransition,
  onRequestRevision,
}: MontageStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [revisionOpen, setRevisionOpen] = useState(false)
  const [revisionFeedback, setRevisionFeedback] = useState('')
  const [submittingRevision, setSubmittingRevision] = useState(false)
  const canRequestRevision =
    !!onRequestRevision &&
    !!slot.final_url &&
    !!slot.monteur_id &&
    (slot.production_status === 'edited' || slot.production_status === 'ready')

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      onUploadFinal(file)
      // Reset input so same file can be re-selected if needed
      e.target.value = ''
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, padding: '20px 22px 24px' }}>
      {/* Monteur */}
      <Field label="Monteur">
        {monteurs.length === 0 ? (
          <a
            href="/parametres/equipe?invite=monteur"
            style={{
              fontSize: 12,
              color: 'var(--color-primary)',
              textDecoration: 'none',
            }}
          >
            Inviter un monteur →
          </a>
        ) : (
          <MonteurDropdown
            value={slot.monteur_id ?? null}
            options={monteurs}
            onChange={(id) => onUpdate({ monteur_id: id })}
          />
        )}
      </Field>

      {/* Lien du rush */}
      <Field label="Lien du rush">
        <input
          type="url"
          value={slot.rush_url ?? ''}
          onChange={(e) => onUpdate({ rush_url: e.target.value || null })}
          placeholder="https://drive.google.com/…"
          style={inputStyle}
        />
      </Field>

      {/* Montage final — preview vidéo gérée dans le panneau droit du drawer */}
      <Field label="Montage final">
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        {slot.final_url ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', wordBreak: 'break-all' }}>
              {slot.final_url.split('/').pop()?.slice(0, 60) ?? '—'}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={uploadBtnStyle}
              >
                {uploading ? `Upload… ${uploadPct}%` : 'Remplacer'}
              </button>
              <button
                onClick={() => onUpdate({ final_url: null })}
                style={{
                  padding: '6px 10px', fontSize: 11, fontWeight: 600,
                  color: 'var(--text-tertiary)', background: 'transparent',
                  border: 'none', cursor: 'pointer', textDecoration: 'underline',
                }}
              >
                Supprimer
              </button>
            </div>
          </div>
        ) : (
          <>
            <input
              type="url"
              value={slot.final_url ?? ''}
              onChange={(e) => onUpdate({ final_url: e.target.value || null })}
              placeholder="Coller un lien ou uploader…"
              style={inputStyle}
              disabled={uploading}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={uploadBtnStyle}
            >
              {uploading ? `Upload… ${uploadPct}%` : '📁 Uploader un fichier'}
            </button>
            {uploading && <ProgressBar pct={uploadPct} />}
          </>
        )}
      </Field>

      {/* Notes du monteur */}
      <Field label="Notes du monteur">
        <textarea
          value={slot.editor_notes ?? ''}
          onChange={(e) => onUpdate({ editor_notes: e.target.value || null })}
          placeholder="Instructions, retours, corrections…"
          rows={3}
          style={textareaStyle}
        />
      </Field>

      {/* Demander des retouches (si final upload + monteur assigne + status >= edited) */}
      {canRequestRevision && !revisionOpen && (
        <button
          onClick={() => setRevisionOpen(true)}
          style={revisionBtnStyle}
        >
          🔄 Demander des retouches
        </button>
      )}
      {canRequestRevision && revisionOpen && (
        <div style={{
          padding: 12, background: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.4)', borderRadius: 8,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Demande de retouches
          </div>
          <textarea
            value={revisionFeedback}
            onChange={(e) => setRevisionFeedback(e.target.value)}
            placeholder="Explique ce qui doit être retouché (timing, choix de plans, sous-titres, etc.)…"
            rows={3}
            autoFocus
            style={textareaStyle}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={() => { setRevisionOpen(false); setRevisionFeedback('') }}
              disabled={submittingRevision}
              style={{
                padding: '6px 12px', fontSize: 12, fontWeight: 600,
                background: 'transparent', color: 'var(--text-tertiary)',
                border: '1px solid var(--border-primary)', borderRadius: 6, cursor: 'pointer',
              }}
            >
              Annuler
            </button>
            <button
              onClick={async () => {
                if (!onRequestRevision || !revisionFeedback.trim()) return
                setSubmittingRevision(true)
                try {
                  await onRequestRevision(revisionFeedback.trim())
                  setRevisionOpen(false)
                  setRevisionFeedback('')
                } finally {
                  setSubmittingRevision(false)
                }
              }}
              disabled={submittingRevision || !revisionFeedback.trim()}
              style={{
                padding: '7px 14px', fontSize: 12, fontWeight: 700,
                color: '#fff', background: '#f59e0b',
                border: 'none', borderRadius: 6,
                cursor: submittingRevision ? 'wait' : 'pointer',
                opacity: submittingRevision || !revisionFeedback.trim() ? 0.5 : 1,
              }}
            >
              {submittingRevision ? 'Envoi…' : 'Envoyer au monteur'}
            </button>
          </div>
        </div>
      )}

      {/* Bouton de transition (Valider le montage) */}
      {transitionAction && (
        <button onClick={onTransition} style={transitionBtnStyle}>
          {transitionAction.label} →
        </button>
      )}
    </div>
  )
}

/**
 * Dropdown thémé custom — remplace le `<select>` natif dont le menu deroulant
 * (les `<option>`) ne respecte pas le theme dark sur Safari/Chrome (fond bleu
 * macOS systeme moche).
 */
function MonteurDropdown({
  value,
  options,
  onChange,
}: {
  value: string | null
  options: Array<{ id: string; email: string; full_name?: string | null }>
  onChange: (id: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [open])

  const selected = options.find((o) => o.id === value)
  const displayLabel = selected ? (selected.full_name || selected.email) : '— Aucun —'

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          ...inputStyle,
          width: '100%',
          textAlign: 'left',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span style={{ color: selected ? 'var(--text-primary)' : 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayLabel}
        </span>
        <ChevronDown size={14} style={{ flexShrink: 0, color: 'var(--text-tertiary)', transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 50,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-primary)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            maxHeight: 240,
            overflowY: 'auto',
            padding: 4,
          }}
        >
          <DropdownOption
            label="— Aucun —"
            selected={value === null}
            onClick={() => { onChange(null); setOpen(false) }}
            muted
          />
          {options.map((o) => (
            <DropdownOption
              key={o.id}
              label={o.full_name || o.email}
              hint={o.full_name ? o.email : undefined}
              selected={o.id === value}
              onClick={() => { onChange(o.id); setOpen(false) }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function DropdownOption({
  label,
  hint,
  selected,
  onClick,
  muted = false,
}: {
  label: string
  hint?: string
  selected: boolean
  onClick: () => void
  muted?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '8px 10px',
        background: selected ? 'var(--bg-active)' : 'transparent',
        color: muted ? 'var(--text-tertiary)' : 'var(--text-primary)',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        fontSize: 13,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.background = 'var(--bg-hover)'
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.background = 'transparent'
      }}
    >
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
        {hint && (
          <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-tertiary)' }}>
            {hint}
          </span>
        )}
      </span>
      {selected && <Check size={13} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />}
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--text-tertiary)',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div style={{
      width: '100%',
      height: 6,
      background: 'var(--bg-elevated)',
      borderRadius: 3,
      overflow: 'hidden',
      marginTop: 4,
    }}>
      <div style={{
        width: `${Math.max(0, Math.min(100, pct))}%`,
        height: '100%',
        background: 'var(--color-primary)',
        transition: 'width 0.2s ease',
      }} />
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  fontSize: 13,
  lineHeight: 1.4,
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-primary)',
  borderRadius: 8,
  outline: 'none',
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
  fontFamily: 'inherit',
}

const uploadBtnStyle: React.CSSProperties = {
  alignSelf: 'flex-start',
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-primary)',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-primary)',
  borderRadius: 6,
  cursor: 'pointer',
}

const videoWrapperStyle: React.CSSProperties = {
  borderRadius: 8,
  overflow: 'hidden',
  background: '#000',
  aspectRatio: '9/16',
  width: 140,
  flexShrink: 0,
}

const revisionBtnStyle: React.CSSProperties = {
  alignSelf: 'flex-start',
  padding: '8px 14px',
  fontSize: 12,
  fontWeight: 600,
  color: '#d97706',
  background: 'rgba(245,158,11,0.08)',
  border: '1px solid rgba(245,158,11,0.4)',
  borderRadius: 8,
  cursor: 'pointer',
}

const transitionBtnStyle: React.CSSProperties = {
  alignSelf: 'flex-end',
  marginTop: 8,
  padding: '10px 18px',
  fontSize: 13,
  fontWeight: 600,
  color: '#fff',
  background: 'var(--color-primary)',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
}
