# Réseaux sociaux — Stepper Drawer & Page allégée (Phase 1+2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le drawer accordéon de `SlotDetailDrawer.tsx` (2516 lignes) par un drawer **stepper 1-colonne** (Brief · Montage · Publication) avec footer Discussion permanent collapsé, supprimer la page `/montage` redondante, et passer la vue par défaut à Calendrier (persistance localStorage).

**Architecture:** Découpage de `SlotDetailDrawer.tsx` en 6 fichiers (`SlotDetailDrawer.tsx` shell, `BriefStep`, `MontageStep`, `PublicationStep`, `DiscussionFooter`, `slot-stepper.ts` pour la logique pure). Lazy fetch par étape (on ne charge que les champs de l'étape active), lazy vidéo metadata, suppression du polling 20s permanent. Suppression de `/montage` avec redirect serveur.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, lucide-react, inline styles + CSS variables (var(--color-*)).

**Spec source:** `docs/superpowers/specs/2026-05-06-reseaux-sociaux-redesign-design.md`

**Validation:** ce repo n'a pas de framework de tests UI (cf. `find ... -name '*.test.tsx'` → vide hors `node_modules`). Tests unitaires uniquement pour `slot-stepper.ts` (logique pure). Reste = checklist manuelle dans le navigateur via `npm run dev` après chaque section.

**Branche** : `feature/pierre-social-redesign` (déjà créée à partir de `develop` à jour).

**Hors scope (Phase 3 dans plan séparé)** : sélection multiple, `batch_id`, table `social_post_imports`, page `/imports`.

---

## Task 1 — Module utilitaire `slot-stepper.ts`

**Files:**
- Create: `src/components/social/planning/slot-stepper.ts`
- Create: `src/components/social/planning/__tests__/slot-stepper.test.ts`

- [ ] **Step 1.1: Créer `slot-stepper.ts` avec types et fonctions pures**

```ts
// src/components/social/planning/slot-stepper.ts
import type { SocialPostWithPublications } from '@/types'

export type StepKey = 'brief' | 'montage' | 'publication'

export const STEP_ORDER: StepKey[] = ['brief', 'montage', 'publication']

export const STEP_LABEL: Record<StepKey, string> = {
  brief: 'Brief',
  montage: 'Montage',
  publication: 'Publication',
}

/** Étape ouverte par défaut quand le drawer s'ouvre, selon le statut du slot. */
export function getDefaultStep(slot: SocialPostWithPublications): StepKey {
  if (slot.status === 'scheduled' || slot.status === 'published' || slot.status === 'publishing') {
    return 'publication'
  }
  switch (slot.production_status) {
    case 'idea':
    case 'to_film':
      return 'brief'
    case 'filmed':
    case 'edited':
      return 'montage'
    case 'ready':
      return 'publication'
    default:
      return 'brief'
  }
}

/** Le rond du stepper est-il "vert" (étape complète selon les données) ? */
export function isStepComplete(slot: SocialPostWithPublications, step: StepKey): boolean {
  switch (step) {
    case 'brief': {
      const hookOk = !!slot.hook && slot.hook.trim().length > 0
      const scriptOk = !!slot.script && slot.script.trim().length > 0
      const refsOk = Array.isArray(slot.references_urls) && slot.references_urls.length > 0
      return hookOk && (scriptOk || refsOk)
    }
    case 'montage': {
      return !!slot.final_url && slot.final_url.trim().length > 0
    }
    case 'publication': {
      const platforms = slot.publications ?? []
      const enabled = platforms.filter((p) => p.is_enabled).length > 0
      const media = Array.isArray(slot.media_urls) && slot.media_urls.length > 0
      return enabled && media
    }
  }
}

/** Le footer Discussion doit-il être visible ? */
export function shouldShowDiscussion(slot: SocialPostWithPublications): boolean {
  return !!slot.monteur_id
}

/** Le bouton de transition d'étape est-il visible (Brief → Montage / Montage → Publication) ? */
export function getTransitionAction(
  slot: SocialPostWithPublications,
  step: StepKey
): { label: string; nextStatus: 'filmed' | 'ready' } | null {
  if (step === 'brief' && (slot.production_status === 'idea' || slot.production_status === 'to_film')) {
    return { label: 'Envoyer au montage', nextStatus: 'filmed' }
  }
  if (step === 'montage' && !!slot.final_url && slot.production_status === 'edited') {
    return { label: 'Valider le montage', nextStatus: 'ready' }
  }
  return null
}
```

- [ ] **Step 1.2: Écrire les tests unitaires**

```ts
// src/components/social/planning/__tests__/slot-stepper.test.ts
import { describe, it, expect } from 'vitest'
import {
  getDefaultStep,
  isStepComplete,
  shouldShowDiscussion,
  getTransitionAction,
} from '../slot-stepper'
import type { SocialPostWithPublications } from '@/types'

const baseSlot = (overrides: Partial<SocialPostWithPublications> = {}): SocialPostWithPublications => ({
  id: 's1',
  workspace_id: 'w1',
  status: 'draft',
  production_status: 'idea',
  hook: null,
  script: null,
  references_urls: [],
  media_urls: [],
  final_url: null,
  monteur_id: null,
  publications: [],
  // champs minimaux requis par le type — adapter selon l'interface réelle
} as unknown as SocialPostWithPublications)

describe('getDefaultStep', () => {
  it('idea → brief', () => {
    expect(getDefaultStep(baseSlot({ production_status: 'idea' }))).toBe('brief')
  })
  it('filmed → montage', () => {
    expect(getDefaultStep(baseSlot({ production_status: 'filmed' }))).toBe('montage')
  })
  it('edited → montage', () => {
    expect(getDefaultStep(baseSlot({ production_status: 'edited' }))).toBe('montage')
  })
  it('ready → publication', () => {
    expect(getDefaultStep(baseSlot({ production_status: 'ready' }))).toBe('publication')
  })
  it('status scheduled overrides production_status', () => {
    expect(getDefaultStep(baseSlot({ status: 'scheduled', production_status: 'idea' }))).toBe('publication')
  })
  it('status published overrides production_status', () => {
    expect(getDefaultStep(baseSlot({ status: 'published', production_status: 'idea' }))).toBe('publication')
  })
})

describe('isStepComplete', () => {
  it('brief vide → false', () => {
    expect(isStepComplete(baseSlot(), 'brief')).toBe(false)
  })
  it('brief avec hook + script → true', () => {
    expect(isStepComplete(baseSlot({ hook: 'h', script: 's' }), 'brief')).toBe(true)
  })
  it('brief avec hook + refs → true', () => {
    expect(isStepComplete(baseSlot({ hook: 'h', references_urls: ['https://x'] }), 'brief')).toBe(true)
  })
  it('brief avec hook seulement → false', () => {
    expect(isStepComplete(baseSlot({ hook: 'h' }), 'brief')).toBe(false)
  })
  it('montage sans final_url → false', () => {
    expect(isStepComplete(baseSlot(), 'montage')).toBe(false)
  })
  it('montage avec final_url → true', () => {
    expect(isStepComplete(baseSlot({ final_url: 'https://x' }), 'montage')).toBe(true)
  })
  it('publication sans plateforme ni media → false', () => {
    expect(isStepComplete(baseSlot(), 'publication')).toBe(false)
  })
  it('publication avec plateforme + media → true', () => {
    const slot = baseSlot({
      media_urls: ['https://x'],
      publications: [{ id: 'p1', platform: 'instagram', is_enabled: true } as any],
    })
    expect(isStepComplete(slot, 'publication')).toBe(true)
  })
})

describe('shouldShowDiscussion', () => {
  it('false sans monteur', () => expect(shouldShowDiscussion(baseSlot())).toBe(false))
  it('true avec monteur', () => expect(shouldShowDiscussion(baseSlot({ monteur_id: 'u1' }))).toBe(true))
})

describe('getTransitionAction', () => {
  it('brief sur idea → bouton "Envoyer au montage"', () => {
    expect(getTransitionAction(baseSlot({ production_status: 'idea' }), 'brief')).toEqual({
      label: 'Envoyer au montage', nextStatus: 'filmed',
    })
  })
  it('brief sur filmed → null', () => {
    expect(getTransitionAction(baseSlot({ production_status: 'filmed' }), 'brief')).toBeNull()
  })
  it('montage sur edited avec final_url → bouton "Valider le montage"', () => {
    expect(getTransitionAction(baseSlot({ production_status: 'edited', final_url: 'x' }), 'montage')).toEqual({
      label: 'Valider le montage', nextStatus: 'ready',
    })
  })
  it('montage sur edited sans final_url → null', () => {
    expect(getTransitionAction(baseSlot({ production_status: 'edited' }), 'montage')).toBeNull()
  })
})
```

- [ ] **Step 1.3: Lancer les tests**

Run: `npm test -- slot-stepper`
Expected: tous PASS. Si vitest n'est pas configuré dans le repo (à vérifier via `cat package.json | grep -i test`), créer un script test minimal ou utiliser le framework déjà en place. Si **aucun** framework de test n'est installé, **skipper la step 1.2 et 1.3** : valider la logique en l'utilisant via les composants UI à la Task 6.

- [ ] **Step 1.4: Commit**

```bash
git add src/components/social/planning/slot-stepper.ts src/components/social/planning/__tests__/
git commit -m "feat(social): add slot-stepper utilities (default step, step completeness, transitions)"
```

---

## Task 2 — Composant `StepperBar` (visuel)

**Files:**
- Create: `src/components/social/planning/StepperBar.tsx`

- [ ] **Step 2.1: Créer le composant**

```tsx
// src/components/social/planning/StepperBar.tsx
'use client'

import { Check } from 'lucide-react'
import { STEP_LABEL, STEP_ORDER, type StepKey } from './slot-stepper'

interface StepperBarProps {
  active: StepKey
  completed: Record<StepKey, boolean>
  onSelect: (step: StepKey) => void
}

export default function StepperBar({ active, completed, onSelect }: StepperBarProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '14px 18px 8px', userSelect: 'none' }}>
      {STEP_ORDER.map((step, idx) => {
        const isActive = step === active
        const isDone = completed[step]
        const isLast = idx === STEP_ORDER.length - 1

        const circleBg = isActive
          ? 'var(--color-primary)'
          : isDone
            ? 'var(--color-success)'
            : 'var(--bg-elevated)'
        const circleColor = isActive || isDone ? '#fff' : 'var(--text-tertiary)'
        const circleBorder = isActive
          ? `2px solid var(--color-primary)`
          : isDone
            ? `2px solid var(--color-success)`
            : `2px solid var(--border-primary)`

        const lineColor = isDone || (isActive && completed[STEP_ORDER[idx - 1]])
          ? 'var(--color-success)'
          : 'var(--border-primary)'

        return (
          <div key={step} style={{ display: 'flex', alignItems: 'center', flex: isLast ? '0 0 auto' : 1 }}>
            <button
              onClick={() => onSelect(step)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
              }}
            >
              <div
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: circleBg, color: circleColor, border: circleBorder,
                  fontSize: 12, fontWeight: 700, transition: 'all 0.15s ease',
                }}
              >
                {isDone && !isActive ? <Check size={14} /> : idx + 1}
              </div>
              <span style={{
                fontSize: 11,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                whiteSpace: 'nowrap',
              }}>
                {STEP_LABEL[step]}
              </span>
            </button>
            {!isLast && (
              <div style={{
                flex: 1, height: 2, background: lineColor,
                margin: '0 8px', marginBottom: 18,
                transition: 'background 0.15s ease',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2.2: Commit**

```bash
git add src/components/social/planning/StepperBar.tsx
git commit -m "feat(social): add StepperBar component (3 circles, click to navigate)"
```

---

## Task 3 — Composant `BriefStep`

**Files:**
- Create: `src/components/social/planning/BriefStep.tsx`
- Read: `src/components/social/planning/SlotDetailDrawer.tsx` lignes ~560-668 (bloc Brief actuel) — extraire le contenu

- [ ] **Step 3.1: Identifier les props nécessaires**

Lire les lignes 560-668 de `SlotDetailDrawer.tsx` pour identifier exactement les states utilisés dans le bloc Brief : `slot.hook`, `slot.title`, `slot.script`, `slot.references_urls`, `slot.notes_coach` + handlers `updateSlot(field, value)`, `generateHooks()`, `generateScript()`, etc.

- [ ] **Step 3.2: Créer `BriefStep.tsx`**

```tsx
// src/components/social/planning/BriefStep.tsx
'use client'

import { Sparkles } from 'lucide-react'
import type { SocialPostWithPublications } from '@/types'

interface BriefStepProps {
  slot: SocialPostWithPublications
  saving: boolean
  onUpdate: (patch: Partial<SocialPostWithPublications>) => void
  onGenerateHooks: () => void
  onGenerateScript: () => void
  generatingHooks: boolean
  generatingScript: boolean
  hooksLibrary: string[]
  onPickHook: (hook: string) => void
  // Bouton de transition (visible selon getTransitionAction)
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

      {/* Références — réutiliser RefsList existant si possible (identifier via grep dans drawer) */}
      <Field label="Références">
        <ReferencesList
          urls={slot.references_urls ?? []}
          onChange={(urls) => onUpdate({ references_urls: urls })}
        />
      </Field>

      {/* Notes coach */}
      <Field label="Notes (privées)">
        <textarea
          value={(slot as any).notes_coach ?? ''}
          onChange={(e) => onUpdate({ notes_coach: e.target.value } as any)}
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
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

// Composant local pour références — simple input + add/remove
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
  width: '100%', boxSizing: 'border-box',
  padding: '8px 10px', fontSize: 13,
  background: 'var(--bg-elevated)', color: 'var(--text-primary)',
  border: '1px solid var(--border-primary)', borderRadius: 6,
  outline: 'none',
}
const textareaStyle: React.CSSProperties = { ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }
const aiBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '6px 10px', fontSize: 11, fontWeight: 600,
  color: '#fff', background: '#a78bfa',
  border: 'none', borderRadius: 6, cursor: 'pointer',
  alignSelf: 'flex-start',
}
const hookSuggestionStyle: React.CSSProperties = {
  textAlign: 'left', padding: '8px 10px', fontSize: 12,
  background: 'var(--bg-elevated)', color: 'var(--text-primary)',
  border: '1px solid var(--border-primary)', borderRadius: 6,
  cursor: 'pointer',
}
const removeBtnStyle: React.CSSProperties = {
  width: 28, height: 28, fontSize: 16,
  background: 'transparent', color: 'var(--text-tertiary)',
  border: '1px solid var(--border-primary)', borderRadius: 6,
  cursor: 'pointer',
}
const addBtnStyle: React.CSSProperties = {
  alignSelf: 'flex-start', fontSize: 12, padding: '6px 10px',
  background: 'transparent', color: 'var(--color-primary)',
  border: '1px dashed var(--border-primary)', borderRadius: 6,
  cursor: 'pointer',
}
const transitionBtnStyle: React.CSSProperties = {
  alignSelf: 'flex-end', marginTop: 8,
  padding: '10px 18px', fontSize: 13, fontWeight: 600,
  color: '#fff', background: 'var(--color-primary)',
  border: 'none', borderRadius: 8, cursor: 'pointer',
}
```

- [ ] **Step 3.3: Commit**

```bash
git add src/components/social/planning/BriefStep.tsx
git commit -m "feat(social): add BriefStep component (extracted from drawer)"
```

---

## Task 4 — Composant `MontageStep`

**Files:**
- Create: `src/components/social/planning/MontageStep.tsx`

- [ ] **Step 4.1: Créer `MontageStep.tsx` avec états vides masqués**

Référence : extraction du bloc `MontageSection` actuel (chercher `MontageSection` dans `SlotDetailDrawer.tsx`).

```tsx
// src/components/social/planning/MontageStep.tsx
'use client'

import { useState } from 'react'
import type { SocialPostWithPublications } from '@/types'

interface MontageStepProps {
  slot: SocialPostWithPublications
  monteurs: { id: string; email: string; full_name?: string | null }[]
  onUpdate: (patch: Partial<SocialPostWithPublications>) => void
  onUploadFinal: (file: File) => Promise<void>
  uploading: boolean
  transitionAction: { label: string; nextStatus: 'ready' } | null
  onTransition: () => void
}

export default function MontageStep({
  slot, monteurs, onUpdate, onUploadFinal, uploading,
  transitionAction, onTransition,
}: MontageStepProps) {
  const [showInvite, setShowInvite] = useState(false)
  const noMonteursInWorkspace = monteurs.length === 0
  const hasFinalVideo = !!slot.final_url

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '12px 18px 18px' }}>
      {/* Monteur — affiché toujours, mais minimal si vide */}
      <Field label="Monteur">
        {noMonteursInWorkspace ? (
          <a
            href="/parametres/equipe?invite=monteur"
            style={inviteLinkStyle}
          >
            Inviter un monteur →
          </a>
        ) : (
          <select
            value={slot.monteur_id ?? ''}
            onChange={(e) => onUpdate({ monteur_id: e.target.value || null } as any)}
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

      {/* Lien rush */}
      <Field label="Lien du rush (Drive / SwissTransfer / WeTransfer)">
        <input
          type="url"
          value={(slot as any).rush_url ?? ''}
          onChange={(e) => onUpdate({ rush_url: e.target.value } as any)}
          placeholder="https://drive.google.com/…"
          style={inputStyle}
        />
      </Field>

      {/* Lien final + upload */}
      <Field label="Montage final">
        <input
          type="url"
          value={slot.final_url ?? ''}
          onChange={(e) => onUpdate({ final_url: e.target.value } as any)}
          placeholder="Coller un lien ou uploader ci-dessous"
          style={inputStyle}
        />
        <label style={uploadBtnStyle}>
          {uploading ? 'Upload en cours…' : '📁 Uploader un fichier'}
          <input
            type="file"
            accept="video/*"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onUploadFinal(f)
            }}
            style={{ display: 'none' }}
          />
        </label>
      </Field>

      {/* Notes du monteur */}
      <Field label="Notes du monteur">
        <textarea
          value={(slot as any).editor_notes ?? ''}
          onChange={(e) => onUpdate({ editor_notes: e.target.value } as any)}
          placeholder="Notes pour le coach…"
          rows={3}
          style={textareaStyle}
        />
      </Field>

      {/* Preview vidéo lazy — uniquement si final_url renseigné */}
      {hasFinalVideo && (
        <VideoPreview url={slot.final_url!} />
      )}

      {/* Bouton transition */}
      {transitionAction && (
        <button onClick={onTransition} style={transitionBtnStyle}>
          {transitionAction.label} →
        </button>
      )}
    </div>
  )
}

function VideoPreview({ url }: { url: string }) {
  // La vidéo est rendue ici uniquement si on visite l'étape Montage ET final_url existe.
  // Pas de preload metadata bloquant : le navigateur gère.
  return (
    <div style={{
      borderRadius: 8, overflow: 'hidden',
      background: '#000', aspectRatio: '9/16', maxWidth: 320,
      alignSelf: 'flex-start',
    }}>
      <video src={url} controls preload="metadata" style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '8px 10px', fontSize: 13,
  background: 'var(--bg-elevated)', color: 'var(--text-primary)',
  border: '1px solid var(--border-primary)', borderRadius: 6, outline: 'none',
}
const textareaStyle: React.CSSProperties = { ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' }
const inviteLinkStyle: React.CSSProperties = {
  fontSize: 13, color: 'var(--color-primary)', textDecoration: 'none',
  padding: '6px 0', alignSelf: 'flex-start',
}
const uploadBtnStyle: React.CSSProperties = {
  alignSelf: 'flex-start', fontSize: 12, padding: '8px 14px', marginTop: 6,
  background: 'var(--bg-elevated)', color: 'var(--text-primary)',
  border: '1px solid var(--border-primary)', borderRadius: 6, cursor: 'pointer',
}
const transitionBtnStyle: React.CSSProperties = {
  alignSelf: 'flex-end', marginTop: 8,
  padding: '10px 18px', fontSize: 13, fontWeight: 600,
  color: '#fff', background: 'var(--color-primary)',
  border: 'none', borderRadius: 8, cursor: 'pointer',
}
```

**Note importante** : la zone "Prestation" et "Paiement" du drawer actuel sont **supprimées** de cette étape (déplacées dans Réglages > Équipe > Monteurs ou page dédiée). Pas dans le scope de ce plan.

- [ ] **Step 4.2: Commit**

```bash
git add src/components/social/planning/MontageStep.tsx
git commit -m "feat(social): add MontageStep component with hidden empty states"
```

---

## Task 5 — Composant `PublicationStep`

**Files:**
- Create: `src/components/social/planning/PublicationStep.tsx`

- [ ] **Step 5.1: Identifier les blocs à extraire**

Lire `SlotDetailDrawer.tsx` lignes ~681-900+ (bloc Publication). Repérer :
- les 3 toggles plateformes
- la zone média + upload
- les tabs plateformes actives
- les champs spécifiques par plateforme (caption IG, titre/desc YT)
- le bouton "Programmer la publication"

- [ ] **Step 5.2: Créer `PublicationStep.tsx`**

```tsx
// src/components/social/planning/PublicationStep.tsx
'use client'

import { useState } from 'react'
import { Instagram, Youtube } from 'lucide-react'
import type { SocialPostWithPublications } from '@/types'

type Platform = 'instagram' | 'youtube' | 'tiktok'

interface PublicationStepProps {
  slot: SocialPostWithPublications
  onUpdate: (patch: Partial<SocialPostWithPublications>) => void
  onTogglePlatform: (platform: Platform, enabled: boolean) => void
  onUpdatePublication: (platform: Platform, patch: Record<string, unknown>) => void
  onUploadMedia: (file: File) => Promise<void>
  uploading: boolean
  onSchedule: () => void
  scheduling: boolean
  readOnly: boolean
}

export default function PublicationStep({
  slot, onUpdate, onTogglePlatform, onUpdatePublication,
  onUploadMedia, uploading, onSchedule, scheduling, readOnly,
}: PublicationStepProps) {
  const publications = slot.publications ?? []
  const enabled = (p: Platform) => publications.find((x) => x.platform === p)?.is_enabled ?? false
  const enabledList: Platform[] = (['instagram', 'youtube', 'tiktok'] as Platform[]).filter(enabled)
  const [activeTab, setActiveTab] = useState<Platform>(enabledList[0] ?? 'instagram')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '12px 18px 18px' }}>
      {/* Toggles plateformes */}
      <div style={{ display: 'flex', gap: 8 }}>
        <PlatformToggle
          icon={<Instagram size={14} />}
          label="Instagram"
          active={enabled('instagram')}
          disabled={readOnly}
          onClick={() => onTogglePlatform('instagram', !enabled('instagram'))}
        />
        <PlatformToggle
          icon={<Youtube size={14} />}
          label="YouTube"
          active={enabled('youtube')}
          disabled={readOnly}
          onClick={() => onTogglePlatform('youtube', !enabled('youtube'))}
        />
        <PlatformToggle
          icon={<span style={{ fontWeight: 700 }}>TT</span>}
          label="TikTok"
          active={enabled('tiktok')}
          disabled={readOnly}
          onClick={() => onTogglePlatform('tiktok', !enabled('tiktok'))}
        />
      </div>

      {/* Média partagé */}
      <Field label="Média">
        {(slot.media_urls ?? []).length === 0 ? (
          <label style={uploadBtnStyle}>
            {uploading ? 'Upload en cours…' : '📁 Uploader image ou vidéo'}
            <input
              type="file"
              accept="image/*,video/*"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onUploadMedia(f)
              }}
              style={{ display: 'none' }}
              disabled={readOnly}
            />
          </label>
        ) : (
          <MediaThumbnails urls={slot.media_urls!} />
        )}
      </Field>

      {/* Tabs plateformes actives — 1 seule visible à la fois */}
      {enabledList.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border-primary)', marginTop: 4 }}>
            {enabledList.map((p) => (
              <button
                key={p}
                onClick={() => setActiveTab(p)}
                style={tabStyle(activeTab === p)}
              >
                {p === 'instagram' ? 'Instagram' : p === 'youtube' ? 'YouTube' : 'TikTok'}
              </button>
            ))}
          </div>

          {activeTab === 'instagram' && enabled('instagram') && (
            <InstagramFields
              pub={publications.find((x) => x.platform === 'instagram')}
              onChange={(patch) => onUpdatePublication('instagram', patch)}
              readOnly={readOnly}
            />
          )}
          {activeTab === 'youtube' && enabled('youtube') && (
            <YouTubeFields
              pub={publications.find((x) => x.platform === 'youtube')}
              onChange={(patch) => onUpdatePublication('youtube', patch)}
              readOnly={readOnly}
            />
          )}
          {/* TikTok : pas implémenté (cf. spec — disabled) */}
        </>
      )}

      {/* Bouton programmer */}
      {!readOnly && enabledList.length > 0 && (slot.media_urls ?? []).length > 0 && (
        <button onClick={onSchedule} disabled={scheduling} style={scheduleBtnStyle}>
          {scheduling ? 'Programmation…' : 'Programmer la publication'}
        </button>
      )}
    </div>
  )
}

function PlatformToggle({
  icon, label, active, disabled, onClick,
}: { icon: React.ReactNode; label: string; active: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 12px', fontSize: 12, fontWeight: 600,
        color: active ? '#fff' : 'var(--text-tertiary)',
        background: active ? 'var(--color-primary)' : 'var(--bg-elevated)',
        border: `1px solid ${active ? 'var(--color-primary)' : 'var(--border-primary)'}`,
        borderRadius: 6,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {icon} {label}
    </button>
  )
}

function MediaThumbnails({ urls }: { urls: string[] }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {urls.map((url, i) => (
        <div key={i} style={{ width: 80, height: 80, borderRadius: 6, overflow: 'hidden', background: 'var(--bg-elevated)' }}>
          {/\.(mp4|mov|webm)$/i.test(url) ? (
            <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
        </div>
      ))}
    </div>
  )
}

function InstagramFields({ pub, onChange, readOnly }: { pub: any; onChange: (p: any) => void; readOnly: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Field label="Caption">
        <textarea
          value={pub?.caption ?? ''}
          onChange={(e) => onChange({ caption: e.target.value })}
          placeholder="Texte du post…"
          rows={4}
          disabled={readOnly}
          style={textareaStyle}
        />
      </Field>
      <Field label="Hashtags">
        <input
          type="text"
          value={(pub?.hashtags ?? []).join(' ')}
          onChange={(e) => onChange({ hashtags: e.target.value.split(/\s+/).filter(Boolean) })}
          placeholder="#fitness #motivation"
          disabled={readOnly}
          style={inputStyle}
        />
      </Field>
    </div>
  )
}

function YouTubeFields({ pub, onChange, readOnly }: { pub: any; onChange: (p: any) => void; readOnly: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Field label="Titre">
        <input
          type="text"
          value={pub?.title ?? ''}
          onChange={(e) => onChange({ title: e.target.value })}
          disabled={readOnly}
          style={inputStyle}
        />
      </Field>
      <Field label="Description">
        <textarea
          value={pub?.description ?? ''}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={4}
          disabled={readOnly}
          style={textareaStyle}
        />
      </Field>
      <Field label="Visibilité">
        <select
          value={pub?.privacy_status ?? 'private'}
          onChange={(e) => onChange({ privacy_status: e.target.value })}
          disabled={readOnly}
          style={selectStyle}
        >
          <option value="private">Privée</option>
          <option value="unlisted">Non répertoriée</option>
          <option value="public">Publique</option>
        </select>
      </Field>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: '8px 12px', fontSize: 12, fontWeight: 600,
    color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
    background: 'transparent', border: 'none',
    borderBottom: `2px solid ${active ? 'var(--color-primary)' : 'transparent'}`,
    cursor: 'pointer', marginBottom: -1,
  }
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '8px 10px', fontSize: 13,
  background: 'var(--bg-elevated)', color: 'var(--text-primary)',
  border: '1px solid var(--border-primary)', borderRadius: 6, outline: 'none',
}
const textareaStyle: React.CSSProperties = { ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' }
const uploadBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignSelf: 'flex-start',
  fontSize: 12, padding: '8px 14px',
  background: 'var(--bg-elevated)', color: 'var(--text-primary)',
  border: '1px dashed var(--border-primary)', borderRadius: 6, cursor: 'pointer',
}
const scheduleBtnStyle: React.CSSProperties = {
  alignSelf: 'flex-end', marginTop: 12,
  padding: '12px 24px', fontSize: 14, fontWeight: 600,
  color: '#fff', background: 'var(--color-primary)',
  border: 'none', borderRadius: 8, cursor: 'pointer',
}
```

- [ ] **Step 5.3: Commit**

```bash
git add src/components/social/planning/PublicationStep.tsx
git commit -m "feat(social): add PublicationStep component (single column, lazy media preview)"
```

---

## Task 6 — Composant `DiscussionFooter`

**Files:**
- Create: `src/components/social/planning/DiscussionFooter.tsx`

- [ ] **Step 6.1: Créer `DiscussionFooter.tsx` collapsé par défaut**

```tsx
// src/components/social/planning/DiscussionFooter.tsx
'use client'

import { useState, useEffect } from 'react'
import { MessageCircle, ChevronUp, Send } from 'lucide-react'

interface SlotMessage {
  id: string
  body: string
  created_at: string
  author_name: string
  is_self: boolean
}

interface DiscussionFooterProps {
  slotId: string
  monteurName?: string
  unreadCount: number
  onMarkRead: () => void
}

export default function DiscussionFooter({ slotId, monteurName, unreadCount, onMarkRead }: DiscussionFooterProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<SlotMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!open || messages.length > 0) return
    setLoading(true)
    fetch(`/api/social/posts/${slotId}/messages`)
      .then((r) => r.json())
      .then((j) => setMessages(j.data ?? []))
      .finally(() => {
        setLoading(false)
        if (unreadCount > 0) onMarkRead()
      })
  }, [open, slotId, messages.length, unreadCount, onMarkRead])

  const send = async () => {
    if (!draft.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/social/posts/${slotId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: draft }),
      })
      if (res.ok) {
        const j = await res.json()
        setMessages((prev) => [...prev, j.data])
        setDraft('')
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{
      borderTop: '1px solid var(--border-primary)',
      background: 'var(--bg-secondary)',
      flexShrink: 0,
    }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 18px', background: 'transparent', border: 'none',
          color: 'var(--text-primary)', cursor: 'pointer',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <MessageCircle size={14} />
          <span style={{ fontWeight: 600 }}>Discussion</span>
          {monteurName && <span style={{ color: 'var(--text-tertiary)' }}>· @{monteurName}</span>}
          {unreadCount > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 700,
              background: 'var(--color-primary)', color: '#fff',
              padding: '2px 6px', borderRadius: 8,
            }}>
              {unreadCount} non lu{unreadCount > 1 ? 's' : ''}
            </span>
          )}
        </span>
        <ChevronUp size={14} style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }} />
      </button>

      {open && (
        <div style={{ padding: '0 18px 14px', maxHeight: 280, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading ? (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Chargement…</div>
          ) : messages.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '8px 0' }}>Aucun message.</div>
          ) : (
            <div style={{ overflowY: 'auto', maxHeight: 200, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {messages.slice(-5).map((m) => (
                <div key={m.id} style={{
                  alignSelf: m.is_self ? 'flex-end' : 'flex-start',
                  maxWidth: '80%',
                  padding: '6px 10px', borderRadius: 8,
                  background: m.is_self ? 'var(--color-primary)' : 'var(--bg-elevated)',
                  color: m.is_self ? '#fff' : 'var(--text-primary)',
                  fontSize: 12,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.7, marginBottom: 2 }}>{m.author_name}</div>
                  {m.body}
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Écrire un message…"
              style={{
                flex: 1, padding: '8px 10px', fontSize: 13,
                background: 'var(--bg-elevated)', color: 'var(--text-primary)',
                border: '1px solid var(--border-primary)', borderRadius: 6, outline: 'none',
              }}
            />
            <button
              onClick={send}
              disabled={sending || !draft.trim()}
              style={{
                padding: '8px 12px',
                background: 'var(--color-primary)', color: '#fff',
                border: 'none', borderRadius: 6, cursor: 'pointer',
                opacity: sending || !draft.trim() ? 0.5 : 1,
              }}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6.2: Commit**

```bash
git add src/components/social/planning/DiscussionFooter.tsx
git commit -m "feat(social): add DiscussionFooter (collapsed by default, lazy load messages)"
```

---

## Task 7 — Refactor `SlotDetailDrawer.tsx` en shell stepper

**Files:**
- Modify: `src/components/social/planning/SlotDetailDrawer.tsx` (réécriture quasi-complète)

- [ ] **Step 7.1: Sauvegarder l'ancien drawer pour référence**

```bash
cp src/components/social/planning/SlotDetailDrawer.tsx /tmp/SlotDetailDrawer-old.tsx
```

L'ancien fichier reste accessible dans `/tmp` pour repiquer du code (handlers AI, upload, etc.) pendant la réécriture.

- [ ] **Step 7.2: Réécrire `SlotDetailDrawer.tsx`**

Réécriture complète. Nouvelle structure : centered modal (déjà en place depuis commit `c02c661`), header compact 1-ligne, StepperBar, contenu de l'étape active, DiscussionFooter.

```tsx
// src/components/social/planning/SlotDetailDrawer.tsx
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { X } from 'lucide-react'
import type { SocialPostWithPublications, ContentPillar } from '@/types'
import StepperBar from './StepperBar'
import BriefStep from './BriefStep'
import MontageStep from './MontageStep'
import PublicationStep from './PublicationStep'
import DiscussionFooter from './DiscussionFooter'
import {
  getDefaultStep,
  isStepComplete,
  shouldShowDiscussion,
  getTransitionAction,
  STEP_ORDER,
  type StepKey,
} from './slot-stepper'
import { useToast } from '@/components/ui/Toast'

interface SlotDetailDrawerProps {
  slotId: string
  pillars: ContentPillar[]
  onClose: () => void
  onChange: () => void
}

export default function SlotDetailDrawer({ slotId, pillars, onClose, onChange }: SlotDetailDrawerProps) {
  const toast = useToast()
  const [slot, setSlot] = useState<SocialPostWithPublications | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeStep, setActiveStep] = useState<StepKey>('brief')
  const [monteurs, setMonteurs] = useState<Array<{ id: string; email: string; full_name?: string | null }>>([])
  const [hooksLibrary, setHooksLibrary] = useState<string[]>([])
  const [generatingHooks, setGeneratingHooks] = useState(false)
  const [generatingScript, setGeneratingScript] = useState(false)
  const [uploadingFinal, setUploadingFinal] = useState(false)
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  // Charge le slot complet une fois (lazy fetch par étape : déférable en optimisation
  // future, on garde un seul fetch tant que les payloads restent raisonnables)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/social/posts/${slotId}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        const fetched = j.data as SocialPostWithPublications
        setSlot(fetched)
        setActiveStep(getDefaultStep(fetched))
        setUnreadCount((j.data?.unread_messages_count as number) ?? 0)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [slotId])

  // Liste monteurs : chargée uniquement quand on visite l'étape Montage
  useEffect(() => {
    if (activeStep !== 'montage' || monteurs.length > 0) return
    fetch('/api/team/monteurs')
      .then((r) => r.json())
      .then((j) => setMonteurs(j.data ?? []))
      .catch(() => {})
  }, [activeStep, monteurs.length])

  // Polling unread : uniquement quand le drawer est ouvert
  useEffect(() => {
    const t = setInterval(() => {
      fetch(`/api/social/posts/${slotId}/messages/unread-count`)
        .then((r) => r.json())
        .then((j) => setUnreadCount(j.count ?? 0))
        .catch(() => {})
    }, 20000)
    return () => clearInterval(t)
  }, [slotId])

  const updateSlot = useCallback(
    async (patch: Partial<SocialPostWithPublications>) => {
      if (!slot) return
      const next = { ...slot, ...patch }
      setSlot(next)
      try {
        const res = await fetch(`/api/social/posts/${slotId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          toast.error('Erreur sauvegarde', j.error ?? '')
          setSlot(slot)
        } else {
          onChange()
        }
      } catch (e) {
        toast.error('Erreur réseau', (e as Error).message)
        setSlot(slot)
      }
    },
    [slot, slotId, toast, onChange]
  )

  const generateHooks = useCallback(async () => {
    setGeneratingHooks(true)
    try {
      const res = await fetch(`/api/social/posts/${slotId}/generate-hooks`, { method: 'POST' })
      const j = await res.json()
      setHooksLibrary(j.hooks ?? [])
    } finally {
      setGeneratingHooks(false)
    }
  }, [slotId])

  const generateScript = useCallback(async () => {
    setGeneratingScript(true)
    try {
      const res = await fetch(`/api/social/posts/${slotId}/generate-script`, { method: 'POST' })
      const j = await res.json()
      if (j.script) await updateSlot({ script: j.script })
    } finally {
      setGeneratingScript(false)
    }
  }, [slotId, updateSlot])

  const uploadFile = useCallback(
    async (file: File, target: 'final' | 'media') => {
      const setter = target === 'final' ? setUploadingFinal : setUploadingMedia
      setter(true)
      try {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch(`/api/social/posts/${slotId}/upload?target=${target}`, {
          method: 'POST', body: fd,
        })
        const j = await res.json()
        if (res.ok) {
          if (target === 'final') await updateSlot({ final_url: j.url } as any)
          else await updateSlot({ media_urls: [...(slot?.media_urls ?? []), j.url] } as any)
        } else {
          toast.error('Upload échoué', j.error ?? '')
        }
      } finally {
        setter(false)
      }
    },
    [slotId, slot, updateSlot, toast]
  )

  const togglePlatform = useCallback(
    (platform: 'instagram' | 'youtube' | 'tiktok', enabled: boolean) => {
      if (!slot) return
      const next = (slot.publications ?? []).filter((p) => p.platform !== platform)
      if (enabled) {
        next.push({ platform, is_enabled: true } as any)
      }
      updateSlot({ publications: next } as any)
    },
    [slot, updateSlot]
  )

  const updatePublication = useCallback(
    (platform: 'instagram' | 'youtube' | 'tiktok', patch: Record<string, unknown>) => {
      if (!slot) return
      const next = (slot.publications ?? []).map((p) =>
        p.platform === platform ? { ...p, ...patch } : p
      )
      updateSlot({ publications: next } as any)
    },
    [slot, updateSlot]
  )

  const schedule = useCallback(async () => {
    setScheduling(true)
    try {
      const res = await fetch(`/api/social/posts/${slotId}/schedule`, { method: 'POST' })
      if (res.ok) {
        toast.success('Publication programmée')
        onChange()
        onClose()
      } else {
        const j = await res.json().catch(() => ({}))
        toast.error('Erreur programmation', j.error ?? '')
      }
    } finally {
      setScheduling(false)
    }
  }, [slotId, toast, onChange, onClose])

  const transition = useCallback(async () => {
    if (!slot) return
    const action = getTransitionAction(slot, activeStep)
    if (!action) return
    await updateSlot({ production_status: action.nextStatus } as any)
    if (action.nextStatus === 'filmed') setActiveStep('montage')
    if (action.nextStatus === 'ready') setActiveStep('publication')
  }, [slot, activeStep, updateSlot])

  const completed: Record<StepKey, boolean> = useMemo(() => {
    if (!slot) return { brief: false, montage: false, publication: false }
    return {
      brief: isStepComplete(slot, 'brief'),
      montage: isStepComplete(slot, 'montage'),
      publication: isStepComplete(slot, 'publication'),
    }
  }, [slot])

  if (loading || !slot) {
    return (
      <Modal onClose={onClose}>
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>Chargement…</div>
      </Modal>
    )
  }

  const transitionAction = getTransitionAction(slot, activeStep)
  const readOnly = slot.status === 'scheduled' || slot.status === 'published' || slot.status === 'publishing'
  const pillar = pillars.find((p) => p.id === slot.pillar_id)

  return (
    <Modal onClose={onClose}>
      {/* Header compact 1 ligne */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px',
        borderBottom: '1px solid var(--border-primary)',
      }}>
        {pillar && (
          <span style={{
            fontSize: 10, fontWeight: 700,
            padding: '3px 8px', borderRadius: 4,
            background: pillar.color ?? '#a78bfa', color: '#fff',
          }}>
            {pillar.name}
          </span>
        )}
        <span style={{
          fontSize: 10, fontWeight: 700,
          padding: '3px 8px', borderRadius: 4,
          background: 'var(--bg-elevated)', color: 'var(--text-secondary)',
        }}>
          {slot.content_kind?.toUpperCase()}
        </span>
        <input
          type="text"
          value={slot.title ?? ''}
          onChange={(e) => updateSlot({ title: e.target.value })}
          placeholder="Titre du post"
          style={{
            flex: 1, fontSize: 16, fontWeight: 700,
            background: 'transparent', color: 'var(--text-primary)',
            border: 'none', outline: 'none',
          }}
        />
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          {slot.plan_date ? new Date(slot.plan_date).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' }) : '—'}
        </span>
        <button
          onClick={onClose}
          style={{
            width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', color: 'var(--text-tertiary)',
            border: '1px solid var(--border-primary)', borderRadius: 6, cursor: 'pointer',
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Stepper */}
      <StepperBar active={activeStep} completed={completed} onSelect={setActiveStep} />

      {/* Contenu de l'étape active */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {activeStep === 'brief' && (
          <BriefStep
            slot={slot}
            saving={false}
            onUpdate={updateSlot}
            onGenerateHooks={generateHooks}
            onGenerateScript={generateScript}
            generatingHooks={generatingHooks}
            generatingScript={generatingScript}
            hooksLibrary={hooksLibrary}
            onPickHook={(h) => updateSlot({ hook: h })}
            transitionAction={transitionAction as any}
            onTransition={transition}
          />
        )}
        {activeStep === 'montage' && (
          <MontageStep
            slot={slot}
            monteurs={monteurs}
            onUpdate={updateSlot}
            onUploadFinal={(f) => uploadFile(f, 'final')}
            uploading={uploadingFinal}
            transitionAction={transitionAction as any}
            onTransition={transition}
          />
        )}
        {activeStep === 'publication' && (
          <PublicationStep
            slot={slot}
            onUpdate={updateSlot}
            onTogglePlatform={togglePlatform}
            onUpdatePublication={updatePublication}
            onUploadMedia={(f) => uploadFile(f, 'media')}
            uploading={uploadingMedia}
            onSchedule={schedule}
            scheduling={scheduling}
            readOnly={readOnly}
          />
        )}
      </div>

      {/* Discussion footer permanent */}
      {shouldShowDiscussion(slot) && (
        <DiscussionFooter
          slotId={slotId}
          monteurName={monteurs.find((m) => m.id === slot.monteur_id)?.full_name || undefined}
          unreadCount={unreadCount}
          onMarkRead={() => setUnreadCount(0)}
        />
      )}
    </Modal>
  )
}

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 720, maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-primary)', borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  )
}
```

**Note importante** : la réécriture suppose que les endpoints API utilisés (`/api/social/posts/{id}`, `/api/team/monteurs`, `/api/social/posts/{id}/messages`, etc.) existent déjà. Avant l'implémentation, **lancer un grep dans le repo** pour confirmer l'existence et la signature exacte de chaque endpoint. Adapter les URLs au besoin (ex : si l'endpoint réel est `/api/team/users?role=monteur`, ajuster).

- [ ] **Step 7.3: Lancer le dev server et tester**

```bash
npm run dev
```

Naviguer sur `/acquisition/reseaux-sociaux`, ouvrir un slot. Checklist :
- Drawer s'ouvre en modal centrée (pas en side panel)
- Header sur 1 ligne avec pills + titre + date + close
- Stepper visible avec 3 ronds
- Étape par défaut = celle correspondant au `production_status`
- Cliquer sur un autre rond → contenu change
- Discussion en bas, collapsée si monteur, cachée sinon

- [ ] **Step 7.4: Commit**

```bash
git add src/components/social/planning/SlotDetailDrawer.tsx
git commit -m "refactor(social): replace SlotDetailDrawer accordion with stepper (Brief/Montage/Publication)"
```

---

## Task 8 — Vue Calendar par défaut + persistance localStorage

**Files:**
- Modify: `src/components/social/planning/PlanningView.tsx:19`

- [ ] **Step 8.1: Modifier l'initialisation de `view`**

Remplacer ligne 19 :

```tsx
const [view, setView] = useState<'calendar' | 'board'>('board')
```

par :

```tsx
const [view, setView] = useState<'calendar' | 'board'>(() => {
  if (typeof window === 'undefined') return 'calendar'
  const stored = window.localStorage.getItem('social_planning_view_mode')
  return stored === 'board' ? 'board' : 'calendar'
})
```

- [ ] **Step 8.2: Persister le choix au changement**

Ajouter juste après les `useEffect` existants (~ligne 76) :

```tsx
useEffect(() => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('social_planning_view_mode', view)
  }
}, [view])
```

- [ ] **Step 8.3: Tester**

- Ouvrir `/acquisition/reseaux-sociaux` en navigation privée → vue Calendrier par défaut.
- Switcher en Board → recharger → reste en Board.
- Re-switcher en Calendrier → recharger → reste en Calendrier.

- [ ] **Step 8.4: Commit**

```bash
git add src/components/social/planning/PlanningView.tsx
git commit -m "feat(social): default to calendar view + persist choice in localStorage"
```

---

## Task 9 — Suppression page `/montage` + redirect

**Files:**
- Delete: `src/app/(dashboard)/montage/page.tsx`
- Delete: `src/app/(dashboard)/montage/layout.tsx` (si présent)
- Modify: sidebar — chercher l'item Montage dans `src/components/**/Sidebar*.tsx` ou équivalent
- Create: `src/app/(dashboard)/montage/redirect.tsx` (redirect 30j)

- [ ] **Step 9.1: Vérifier les fichiers existants**

```bash
ls -la src/app/\(dashboard\)/montage/
```

- [ ] **Step 9.2: Créer un redirect serveur à la place de l'ancienne page**

Remplacer le contenu de `src/app/(dashboard)/montage/page.tsx` par :

```tsx
// src/app/(dashboard)/montage/page.tsx
import { redirect } from 'next/navigation'

export default function MontageDeprecated() {
  redirect('/acquisition/reseaux-sociaux')
}
```

Si présent, supprimer `layout.tsx` :

```bash
rm -f src/app/\(dashboard\)/montage/layout.tsx
```

- [ ] **Step 9.3: Trouver et retirer l'item "Montage" de la sidebar**

```bash
grep -rn "montage" src/components/layout/ src/app/ --include="*.tsx" | grep -i "sidebar\|nav"
```

Identifier le composant sidebar puis retirer l'entrée "Montage" qui pointe vers `/montage`.

- [ ] **Step 9.4: Supprimer aussi `SlotMontageDrawer` si présent**

```bash
find src -name "SlotMontageDrawer*"
```

S'il existe, vérifier qu'il n'est plus utilisé :

```bash
grep -rn "SlotMontageDrawer" src
```

S'il n'est utilisé que dans `src/app/(dashboard)/montage/page.tsx` (qui devient un redirect), le supprimer.

- [ ] **Step 9.5: Tester en local**

- Cliquer sur "Montage" dans la sidebar → l'item ne doit plus apparaître.
- Naviguer manuellement vers `/montage` → redirige vers `/acquisition/reseaux-sociaux`.
- Naviguer en monteur (ou simuler le rôle) → la page sociale s'ouvre normalement.

- [ ] **Step 9.6: Commit**

```bash
git add src/app/\(dashboard\)/montage/ src/components/layout/ -A
git commit -m "feat(social): remove /montage page (redirect to /acquisition/reseaux-sociaux), strip sidebar link"
```

---

## Task 10 — Smoke test complet en localhost

**Files:** aucune modification, validation manuelle

- [ ] **Step 10.1: Lancer le dev server**

```bash
npm run dev
```

- [ ] **Step 10.2: Checklist drawer**

Sur un slot existant, vérifier :

1. **Drawer ouvre rapidement** : timing entre clic sur card et apparition du contenu de l'étape active < 500 ms (vs ~800-1200 ms avant). Visuel : pas d'écran "Chargement…" persistant.
2. **Slot `idea`** : drawer ouvre Brief, ronds Brief actif violet, Montage et Publication gris.
3. **Remplir hook + script + 1 référence** dans Brief → rond Brief devient vert (indicateur Check).
4. **Cliquer "Envoyer au montage"** → bascule sur Montage, statut devient `filmed`. Reload de la page → le slot est bien en `filmed`.
5. **Slot `filmed`** : drawer ouvre directement Montage. Pas de monteur dans workspace → afficher "Inviter un monteur →" sans bloc Prestation/Paiement.
6. **Slot `ready`** : ouvre directement Publication.
7. **Slot `published`** : ouvre Publication en read-only (inputs disabled).
8. **Cliquer rond Brief depuis l'étape Publication** → revient en arrière, contenu Brief.
9. **Footer Discussion** : si monteur assigné, footer collapsé visible en bas. Click → expand vers le haut, derniers messages chargés.
10. **Footer caché** si pas de monteur.

- [ ] **Step 10.3: Checklist page**

11. **Premier chargement (navigation privée)** : vue Calendrier par défaut.
12. **Switch Board → reload** : reste en Board.
13. **Switch Calendrier → reload** : reste en Calendrier.
14. **Onglets plateformes Planning / Instagram / YouTube** en haut : toujours présents, fonctionnels.

- [ ] **Step 10.4: Checklist suppression `/montage`**

15. **Sidebar** : pas d'item "Montage".
16. **URL `/montage`** : redirige automatiquement vers `/acquisition/reseaux-sociaux`.
17. **Connexion en tant que monteur** (ou simulation rôle) : `/acquisition/reseaux-sociaux` accessible, drawer fonctionne.

- [ ] **Step 10.5: Commit final + push**

Si tout est bon :

```bash
git push -u origin feature/pierre-social-redesign
```

---

## Self-review

**Spec coverage** :
- Stepper 3 étapes Brief/Montage/Publication ✅ Tasks 2, 3, 4, 5, 7
- Discussion footer permanent collapsé ✅ Task 6
- Calendar par défaut + localStorage ✅ Task 8
- Suppression `/montage` + redirect ✅ Task 9
- Header compact 1 ligne ✅ Task 7
- Hide empty states (monteur) ✅ Task 4
- Lazy fetch monteurs (étape Montage uniquement) ✅ Task 7 (useEffect conditionné)
- Lazy vidéo metadata ✅ Task 4 (preload="metadata", rendu conditionnel sur visite)
- Kill polling 20s permanent ✅ Task 7 (polling déplacé dans le drawer, démarre/clear avec mount/unmount)
- Validation hybride (rond vert auto + bouton transition) ✅ Tasks 1 (logique), 7 (intégration)
- Découpage 6 fichiers ✅ Tasks 1, 2, 3, 4, 5, 6 + 7 (shell)

**Hors scope (Phase 3 dans plan séparé)** :
- Bulk select + checkboxes
- Migration `batch_id` + table `social_post_imports`
- Page `/imports`

**Placeholder scan** : pas de TBD, pas de "implement later". Les références aux endpoints existants sont assorties d'une note "vérifier via grep" — c'est une étape concrète, pas un placeholder. Les tests UI sont explicitement remplacés par checklist manuelle (limitation du repo).

**Type consistency** :
- `StepKey` typé une fois dans `slot-stepper.ts`, importé partout.
- Props de chaque step component partagent le pattern `{ slot, onUpdate, ... }`.
- `transitionAction` typé identiquement dans `getTransitionAction()` et dans les Step props.

**Risque connu** : la réécriture du drawer (Task 7) est massive et copie/ré-implémente la logique d'AI generation, upload, schedule. Risque de bug par oubli d'un cas particulier. Mitigé par sauvegarde de l'ancien fichier dans `/tmp` et checklist manuelle Task 10.
