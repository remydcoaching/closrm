'use client'

import { useRef } from 'react'
import type { SocialPostWithPublications } from '@/types'

interface MontageStepProps {
  slot: SocialPostWithPublications
  monteurs: Array<{ id: string; email: string; full_name?: string | null }>
  onUpdate: (patch: Partial<SocialPostWithPublications>) => void
  onUploadFinal: (file: File) => Promise<void>
  uploading: boolean
  transitionAction: { label: string; nextStatus: 'ready' } | null
  onTransition: () => void
}

export default function MontageStep({
  slot,
  monteurs,
  onUpdate,
  onUploadFinal,
  uploading,
  transitionAction,
  onTransition,
}: MontageStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      onUploadFinal(file)
      // Reset input so same file can be re-selected if needed
      e.target.value = ''
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '12px 18px 18px' }}>
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

      {/* Montage final */}
      <Field label="Montage final">
        <input
          type="url"
          value={slot.final_url ?? ''}
          onChange={(e) => onUpdate({ final_url: e.target.value || null })}
          placeholder="https://…"
          style={inputStyle}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={uploadBtnStyle}
        >
          {uploading ? 'Upload en cours…' : '📁 Uploader un fichier'}
        </button>
      </Field>

      {/* Preview vidéo — only when final_url is set */}
      {slot.final_url && (
        <div style={videoWrapperStyle}>
          <video
            src={slot.final_url}
            controls
            preload="metadata"
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        </div>
      )}

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

      {/* Bouton de transition */}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--text-tertiary)',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 10px',
  fontSize: 13,
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-primary)',
  borderRadius: 6,
  outline: 'none',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'auto',
  cursor: 'pointer',
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
  maxWidth: 320,
  alignSelf: 'flex-start',
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
