'use client'

import { Sparkles } from 'lucide-react'
import type { SocialPostWithPublications } from '@/types'

interface BriefStepProps {
  slot: SocialPostWithPublications
  onUpdate: (patch: Partial<SocialPostWithPublications>) => void
  onGenerateHooks: () => void
  onGenerateScript: () => void
  generatingHooks: boolean
  generatingScript: boolean
  hooksLibrary: string[]
  onPickHook: (hook: string) => void
  transitionAction: { label: string; nextStatus: 'filmed' | 'ready' } | null
  onTransition: () => void
}

export default function BriefStep({
  slot, onUpdate,
  onGenerateHooks, onGenerateScript,
  generatingHooks, generatingScript,
  hooksLibrary, onPickHook,
  transitionAction, onTransition,
}: BriefStepProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, padding: '20px 22px 24px' }}>
      {/* Hook */}
      <Field
        label="Hook"
        action={
          <AiButton onClick={onGenerateHooks} loading={generatingHooks}>
            {generatingHooks ? 'Génération…' : 'Générer 5 hooks'}
          </AiButton>
        }
      >
        <textarea
          value={slot.hook ?? ''}
          onChange={(e) => onUpdate({ hook: e.target.value })}
          placeholder="Cliquer pour ajouter une accroche…"
          rows={2}
          style={textareaStyle}
        />
        {hooksLibrary.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {hooksLibrary.map((h, i) => (
              <button key={i} onClick={() => onPickHook(h)} style={hookSuggestionStyle}>
                {h}
              </button>
            ))}
          </div>
        )}
      </Field>

      {/* Script */}
      <Field
        label="Script"
        action={
          <AiButton onClick={onGenerateScript} loading={generatingScript}>
            {generatingScript ? 'Génération…' : 'Générer un script'}
          </AiButton>
        }
      >
        <textarea
          value={slot.script ?? ''}
          onChange={(e) => onUpdate({ script: e.target.value })}
          placeholder="Décris ton idée, tes points clés, le call-to-action…"
          rows={7}
          style={textareaStyle}
        />
      </Field>

      {/* Références */}
      <Field label="Références">
        <ReferencesList
          urls={slot.references_urls ?? []}
          onChange={(urls) => onUpdate({ references_urls: urls })}
        />
      </Field>

      {/* Notes coach */}
      <Field label="Notes (privées)">
        <textarea
          value={slot.notes ?? ''}
          onChange={(e) => onUpdate({ notes: e.target.value })}
          placeholder="Notes internes…"
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

// ─── Sous-composants ────────────────────────────────────────────────────────

function Field({
  label,
  action,
  children,
}: {
  label: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 22 }}>
        <label style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: 0.6,
        }}>
          {label}
        </label>
        {action}
      </div>
      {children}
    </div>
  )
}

function AiButton({
  onClick,
  loading,
  children,
}: {
  onClick: () => void
  loading: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 10px',
        fontSize: 11,
        fontWeight: 600,
        color: '#a78bfa',
        background: 'transparent',
        border: '1px solid rgba(167, 139, 250, 0.3)',
        borderRadius: 6,
        cursor: loading ? 'wait' : 'pointer',
        opacity: loading ? 0.6 : 1,
        whiteSpace: 'nowrap',
        transition: 'all 0.15s',
      }}
    >
      <Sparkles size={11} /> {children}
    </button>
  )
}

function ReferencesList({ urls, onChange }: { urls: string[]; onChange: (urls: string[]) => void }) {
  if (urls.length === 0) {
    return (
      <button onClick={() => onChange([''])} style={addBtnEmptyStyle}>
        + Ajouter une référence
      </button>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {urls.map((url, i) => (
        <div key={i} style={{ display: 'flex', gap: 6 }}>
          <input
            type="text"
            value={url}
            onChange={(e) => {
              const next = [...urls]
              next[i] = e.target.value
              onChange(next)
            }}
            placeholder="https://…"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            onClick={() => onChange(urls.filter((_, idx) => idx !== i))}
            style={removeBtnStyle}
            aria-label="Supprimer la référence"
          >
            ×
          </button>
        </div>
      ))}
      <button onClick={() => onChange([...urls, ''])} style={addBtnInlineStyle}>
        + Ajouter
      </button>
    </div>
  )
}

// ─── Styles ─────────────────────────────────────────────────────────────────

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
  transition: 'border-color 0.15s',
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
  fontFamily: 'inherit',
  minHeight: 60,
}

const hookSuggestionStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  fontSize: 12,
  lineHeight: 1.45,
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-primary)',
  borderRadius: 8,
  cursor: 'pointer',
  transition: 'border-color 0.15s',
}

const removeBtnStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  fontSize: 18,
  background: 'transparent',
  color: 'var(--text-tertiary)',
  border: '1px solid var(--border-primary)',
  borderRadius: 8,
  cursor: 'pointer',
  flexShrink: 0,
}

const addBtnEmptyStyle: React.CSSProperties = {
  padding: '14px 16px',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--text-tertiary)',
  background: 'transparent',
  border: '1px dashed var(--border-primary)',
  borderRadius: 8,
  cursor: 'pointer',
  textAlign: 'center',
}

const addBtnInlineStyle: React.CSSProperties = {
  alignSelf: 'flex-start',
  fontSize: 12,
  padding: '6px 12px',
  background: 'transparent',
  color: 'var(--text-tertiary)',
  border: 'none',
  cursor: 'pointer',
}

const transitionBtnStyle: React.CSSProperties = {
  alignSelf: 'flex-end',
  marginTop: 4,
  padding: '11px 22px',
  fontSize: 13,
  fontWeight: 600,
  color: '#fff',
  background: 'var(--color-primary)',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
}
