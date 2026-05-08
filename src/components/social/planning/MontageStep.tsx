'use client'

import { useRef, useState } from 'react'
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
          <select
            value={slot.monteur_id ?? ''}
            onChange={(e) => onUpdate({ monteur_id: e.target.value || null })}
            style={selectStyle}
          >
            <option value="">— Aucun —</option>
            {monteurs.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name || m.email}
              </option>
            ))}
          </select>
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

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  cursor: 'pointer',
  paddingRight: 28,
  backgroundImage:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='none' stroke='%23999' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' d='M1 1l4 4 4-4'/></svg>\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
  colorScheme: 'dark',
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
