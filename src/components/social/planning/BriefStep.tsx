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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '12px 18px 18px' }}>
      {/* Hook */}
      <Field label="Hook">
        <textarea
          value={slot.hook ?? ''}
          onChange={(e) => onUpdate({ hook: e.target.value })}
          placeholder="Cliquer pour ajouter une accroche…"
          rows={2}
          style={textareaStyle}
        />
        <button onClick={onGenerateHooks} disabled={generatingHooks} style={aiBtnStyle}>
          <Sparkles size={12} /> {generatingHooks ? 'Génération…' : 'Générer 5 hooks IA'}
        </button>
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

      {/* Titre */}
      <Field label="Titre">
        <input
          type="text"
          value={slot.title ?? ''}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Titre du contenu"
          style={inputStyle}
        />
      </Field>

      {/* Script */}
      <Field label="Script">
        <textarea
          value={slot.script ?? ''}
          onChange={(e) => onUpdate({ script: e.target.value })}
          placeholder="Cliquer pour ajouter un script…"
          rows={6}
          style={textareaStyle}
        />
        <button onClick={onGenerateScript} disabled={generatingScript} style={aiBtnStyle}>
          <Sparkles size={12} /> {generatingScript ? 'Génération…' : 'Générer un script IA'}
        </button>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{
        fontSize: 11, fontWeight: 700,
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

function ReferencesList({ urls, onChange }: { urls: string[]; onChange: (urls: string[]) => void }) {
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
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            onClick={() => onChange(urls.filter((_, idx) => idx !== i))}
            style={removeBtnStyle}
          >
            ×
          </button>
        </div>
      ))}
      <button onClick={() => onChange([...urls, ''])} style={addBtnStyle}>
        + Ajouter une référence
      </button>
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

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
  fontFamily: 'inherit',
}

const aiBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 10px',
  fontSize: 11,
  fontWeight: 600,
  color: '#fff',
  background: '#a78bfa',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  alignSelf: 'flex-start',
}

const hookSuggestionStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  fontSize: 12,
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-primary)',
  borderRadius: 6,
  cursor: 'pointer',
}

const removeBtnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  fontSize: 16,
  background: 'transparent',
  color: 'var(--text-tertiary)',
  border: '1px solid var(--border-primary)',
  borderRadius: 6,
  cursor: 'pointer',
}

const addBtnStyle: React.CSSProperties = {
  alignSelf: 'flex-start',
  fontSize: 12,
  padding: '6px 10px',
  background: 'transparent',
  color: 'var(--color-primary)',
  border: '1px dashed var(--border-primary)',
  borderRadius: 6,
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
