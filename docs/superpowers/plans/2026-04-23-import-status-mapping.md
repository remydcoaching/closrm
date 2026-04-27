# Mapping Intelligent des Statuts à l'Import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** À l'étape 2 du wizard d'import CSV, permettre à l'utilisateur de mapper chaque valeur de statut présente dans son CSV vers un statut ClosRM (ou en tag, ou ignorer), avec auto-suggestion par dictionnaire de synonymes FR/EN.

**Architecture:** Extension de l'existant (wizard 5 étapes). Ajout d'un type `StatusMappingAction` dans `ImportConfig`, d'un dictionnaire `STATUS_SYNONYMS` + helpers dans `csv-parser.ts`, d'un sous-composant `StatusValueMapper` rendu conditionnellement dans `Step2_MappingConfig`, et d'une branche supplémentaire dans `validateRow` pour appliquer le mapping avant l'enum check.

**Tech Stack:** Next.js 14 App Router + TypeScript, React client components, PapaParse (déjà en place), pas de framework de test installé → validation via scripts Node one-off + tests manuels.

**Spec:** [docs/superpowers/specs/2026-04-23-import-status-mapping-design.md](../specs/2026-04-23-import-status-mapping-design.md)

---

## File Structure

| Fichier | Type | Responsabilité |
|---|---|---|
| `src/types/index.ts` | modif | étendre `ImportConfig` avec `status_value_mapping` + export type `StatusMappingAction` |
| `src/lib/leads/csv-parser.ts` | modif | ajouter `STATUS_SYNONYMS`, `extractUniqueStatusValues`, `suggestStatusMapping` |
| `src/components/leads/import/StatusValueMapper.tsx` | nouveau | sous-composant rendu dans Step2 quand statut mappé |
| `src/components/leads/import/Step2_MappingConfig.tsx` | modif | intégrer StatusValueMapper + étendre la validation du bouton Continuer |
| `src/app/(dashboard)/leads/import/import-client.tsx` | modif | ajouter `status_value_mapping: {}` dans `INITIAL_CONFIG` |
| `src/lib/leads/import-engine.ts` | modif | appliquer `config.status_value_mapping` dans `validateRow` |
| `taches/tache-034-import-status-mapping.md` | modif | marquer tâche terminée à la fin |

---

## Task 1 — Types : `StatusMappingAction` et extension de `ImportConfig`

**Files:**
- Modify: `src/types/index.ts` (autour de `ImportConfig`, ligne ~121)

- [ ] **Step 1: Localiser `ImportConfig` et vérifier sa structure actuelle**

Run:
```bash
grep -n "ImportConfig" src/types/index.ts
```

Expected : `ImportConfig` défini autour de la ligne 121, comprend `mapping`, `default_source`, `default_status`, `batch_tags`, `dedup_strategy`, `dedup_action`.

- [ ] **Step 2: Ajouter le type `StatusMappingAction` et étendre `ImportConfig`**

Dans `src/types/index.ts`, **avant** la définition de `ImportConfig` :

```typescript
export type StatusMappingAction =
  | { type: 'map'; status: LeadStatus }
  | { type: 'tag' }
  | { type: 'ignore' }
```

Et dans l'interface `ImportConfig`, ajouter la propriété (en dernier) :

```typescript
export interface ImportConfig {
  mapping: Record<string, string>
  default_source: LeadSource | null
  default_status: LeadStatus
  batch_tags: string[]
  dedup_strategy: ImportDedupStrategy
  dedup_action: ImportDedupAction
  // Nouveau : mapping des valeurs CSV de statut → action ClosRM
  // Clé = valeur CSV brute (ex: "RDV Bilan Pris"), valeur = action à appliquer.
  // Absence de clé = valeur non mappée (fallback enum actuel).
  status_value_mapping: Record<string, StatusMappingAction>
}
```

- [ ] **Step 3: Vérifier la compilation TypeScript**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -E "types/index|ImportConfig" | head -10
```

Expected : aucune erreur nouvelle (le type est optionnel nulle part, on va initialiser `{}` dans Task 5).

**Note :** des erreurs de compilation vont apparaître dans les fichiers consommateurs de `ImportConfig` (Step2, import-client) parce qu'il manque maintenant `status_value_mapping`. On les corrige dans les tâches 5 et 6.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add StatusMappingAction and status_value_mapping to ImportConfig

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2 — Parser : dictionnaire de synonymes + helpers

**Files:**
- Modify: `src/lib/leads/csv-parser.ts`
- Test: script one-off `/tmp/test-status-mapping.mjs`

- [ ] **Step 1: Ajouter imports pour `LeadStatus`**

En haut de `src/lib/leads/csv-parser.ts`, après l'import de Papa :

```typescript
import type { LeadStatus } from '@/types'
```

- [ ] **Step 2: Ajouter le dictionnaire `STATUS_SYNONYMS` et helpers**

À la fin de `src/lib/leads/csv-parser.ts`, ajouter :

```typescript
// ------------------------------------------------------------------
// Status synonyms (FR + EN) — used by the import wizard to pre-fill
// suggestions for each unique CSV status value.
// ------------------------------------------------------------------
export const STATUS_SYNONYMS: Record<LeadStatus, string[]> = {
  nouveau: [
    'nouveau', 'new', 'lead', 'entrant', 'fresh',
  ],
  scripte: [
    'scripté', 'scripte', 'contacté', 'contacte', 'contacted',
    'en attente de reponse', 'en attente de réponse', 'en attente',
    'awaiting response', 'a recontacter', 'à recontacter',
  ],
  setting_planifie: [
    'setting planifié', 'setting planifie', 'setting',
    'rdv setting', 'rdv bilan pris', 'bilan pris',
    'rdv planifié', 'rdv planifie', 'rendez-vous planifié',
    'rendez-vous', 'appointment booked',
  ],
  no_show_setting: [
    'no show setting', 'absent setting', 'jamais décroché',
    'jamais decroche', 'no answer', 'manqué', 'manque',
  ],
  closing_planifie: [
    'closing planifié', 'closing planifie', 'closing',
    'rdv closing', 'closing booked',
  ],
  no_show_closing: [
    'no show closing', 'absent closing', 'no show',
  ],
  clos: [
    'clos', 'closé', 'close', 'fermé', 'ferme',
    'converti', 'conversion', 'won', 'signé', 'signe',
    'vendu', 'deal', 'bilan effectué', 'bilan effectue',
    'meeting done', 'rdv effectué', 'rdv effectue',
  ],
  dead: [
    'dead', 'mort', 'refusé', 'refuse', 'rejeté', 'rejete',
    'perdu', 'lost', 'avorté', 'avorte',
    'avorte - plus de reponse', 'avorté - plus de réponse',
    'plus de reponse', 'plus de réponse',
    'non qualifié', 'non qualifie', 'not qualified',
    'disqualifié', 'disqualifie', 'abandonné', 'abandonne',
  ],
}

// ------------------------------------------------------------------
// Extract unique non-empty status values from the raw rows, given the
// CSV header name that was mapped to the status field.
// ------------------------------------------------------------------
export function extractUniqueStatusValues(
  rows: Record<string, string>[],
  csvHeader: string,
): string[] {
  const set = new Set<string>()
  for (const row of rows) {
    const val = (row[csvHeader] || '').trim()
    if (val) set.add(val)
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'))
}

// ------------------------------------------------------------------
// Suggest a ClosRM status for a given raw CSV status value.
// Returns null if no confident match.
// ------------------------------------------------------------------
export function suggestStatusMapping(value: string): LeadStatus | null {
  const norm = normalize(value)
  if (!norm) return null

  // Pass 1: exact match on any synonym
  for (const [status, synonyms] of Object.entries(STATUS_SYNONYMS) as [LeadStatus, string[]][]) {
    if (synonyms.some((s) => normalize(s) === norm)) {
      return status
    }
  }

  // Pass 2: inclusion match (value contains synonym or vice versa)
  for (const [status, synonyms] of Object.entries(STATUS_SYNONYMS) as [LeadStatus, string[]][]) {
    if (synonyms.some((s) => {
      const ns = normalize(s)
      return ns.length >= 3 && (norm.includes(ns) || ns.includes(norm))
    })) {
      return status
    }
  }

  return null
}
```

**Note :** réutilise la fonction `normalize` existante (ligne 33 du fichier), qui fait lowercase + trim + strip accents.

- [ ] **Step 3: Écrire un script de validation des helpers**

Create: `test-status-mapping.mjs` (à la racine du projet, fichier temporaire)

```javascript
// Temp script — tests manuels des helpers de mapping de statut.
// À supprimer après validation. N'utilise pas de framework de test.

function normalize(str) {
  return str.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

const STATUS_SYNONYMS = {
  nouveau: ['nouveau', 'new', 'lead', 'entrant', 'fresh'],
  scripte: ['scripté', 'scripte', 'contacté', 'contacte', 'contacted',
    'en attente de reponse', 'en attente de réponse', 'en attente',
    'awaiting response', 'a recontacter', 'à recontacter'],
  setting_planifie: ['setting planifié', 'setting planifie', 'setting',
    'rdv setting', 'rdv bilan pris', 'bilan pris',
    'rdv planifié', 'rdv planifie', 'rendez-vous planifié',
    'rendez-vous', 'appointment booked'],
  no_show_setting: ['no show setting', 'absent setting', 'jamais décroché',
    'jamais decroche', 'no answer', 'manqué', 'manque'],
  closing_planifie: ['closing planifié', 'closing planifie', 'closing',
    'rdv closing', 'closing booked'],
  no_show_closing: ['no show closing', 'absent closing', 'no show'],
  clos: ['clos', 'closé', 'close', 'fermé', 'ferme',
    'converti', 'conversion', 'won', 'signé', 'signe',
    'vendu', 'deal', 'bilan effectué', 'bilan effectue',
    'meeting done', 'rdv effectué', 'rdv effectue'],
  dead: ['dead', 'mort', 'refusé', 'refuse', 'rejeté', 'rejete',
    'perdu', 'lost', 'avorté', 'avorte',
    'avorte - plus de reponse', 'avorté - plus de réponse',
    'plus de reponse', 'plus de réponse',
    'non qualifié', 'non qualifie', 'not qualified',
    'disqualifié', 'disqualifie', 'abandonné', 'abandonne'],
}

function suggestStatusMapping(value) {
  const norm = normalize(value)
  if (!norm) return null
  for (const [status, synonyms] of Object.entries(STATUS_SYNONYMS)) {
    if (synonyms.some((s) => normalize(s) === norm)) return status
  }
  for (const [status, synonyms] of Object.entries(STATUS_SYNONYMS)) {
    if (synonyms.some((s) => {
      const ns = normalize(s)
      return ns.length >= 3 && (norm.includes(ns) || ns.includes(norm))
    })) return status
  }
  return null
}

// Les 12 statuts rencontrés par Rémy dans son CSV :
const realCases = [
  ['Nouveau',                     'nouveau'],
  ['En attente de réponse',       'scripte'],
  ['Contacté',                    'scripte'],
  ['RDV Bilan Pris',              'setting_planifie'],
  ['Bilan effectué',              'clos'],
  ['Converti',                    'clos'],
  ['Jamais décroché',             'no_show_setting'],
  ['Avorté - Plus de réponse',    'dead'],
  ['Refusé',                      'dead'],
  ['No Show',                     'no_show_closing'],  // pass 2 inclusion
  ['Non qualifié',                'dead'],
  ['A recontacter',               'scripte'],
]

let pass = 0, fail = 0
for (const [input, expected] of realCases) {
  const got = suggestStatusMapping(input)
  const ok = got === expected
  console.log(ok ? '✓' : '✗', input.padEnd(30), '→', got, ok ? '' : `(expected ${expected})`)
  if (ok) pass++; else fail++
}
console.log(`\n${pass}/${pass + fail} passed`)

// Edge cases
console.log('\n-- edge cases --')
console.log('empty    →', suggestStatusMapping(''))         // null
console.log('XYZ blabla →', suggestStatusMapping('XYZ blabla')) // null
console.log('  NEW   →', suggestStatusMapping('  NEW   '))  // nouveau (trim + lowercase)
```

- [ ] **Step 4: Exécuter le script de validation**

Run:
```bash
node test-status-mapping.mjs
```

Expected :
```
✓ Nouveau                        → nouveau
✓ En attente de réponse          → scripte
✓ Contacté                       → scripte
✓ RDV Bilan Pris                 → setting_planifie
✓ Bilan effectué                 → clos
✓ Converti                       → clos
✓ Jamais décroché                → no_show_setting
✓ Avorté - Plus de réponse       → dead
✓ Refusé                         → dead
✓ No Show                        → no_show_closing
✓ Non qualifié                   → dead
✓ A recontacter                  → scripte

12/12 passed

-- edge cases --
empty    → null
XYZ blabla → null
  NEW   → nouveau
```

Si un cas échoue, ajuster les synonymes dans `STATUS_SYNONYMS` (dans `csv-parser.ts` **et** dans le script) et relancer.

- [ ] **Step 5: Supprimer le script temporaire et commit**

```bash
rm test-status-mapping.mjs
git add src/lib/leads/csv-parser.ts
git commit -m "feat(leads): add STATUS_SYNONYMS dictionary and mapping helpers

- STATUS_SYNONYMS: FR/EN dictionary covering the 8 ClosRM statuses
- extractUniqueStatusValues: dedupe + sort unique values from a CSV column
- suggestStatusMapping: 2-pass match (exact synonym → inclusion)

Validated against the 12 real-world status values from Rémy's CSV import.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3 — Import engine : appliquer le mapping dans `validateRow`

**Files:**
- Modify: `src/lib/leads/import-engine.ts` (autour de ligne 173, après la validation du status enum)

- [ ] **Step 1: Localiser le bloc de validation du statut**

Run:
```bash
grep -n "validStatuses" src/lib/leads/import-engine.ts
```

Expected : bloc autour de la ligne 170, vérifie `prepared.status` contre `validStatuses` et fallback sur `config.default_status`.

- [ ] **Step 2: Remplacer la logique de statut par une version qui applique `status_value_mapping`**

Dans `src/lib/leads/import-engine.ts`, **remplacer** le bloc :

```typescript
  // Validate status against enum
  const validStatuses: LeadStatus[] = ['nouveau', 'setting_planifie', 'no_show_setting', 'closing_planifie', 'no_show_closing', 'clos', 'dead']
  if (!validStatuses.includes(prepared.status as LeadStatus)) {
    prepared.status = config.default_status
  }
```

par :

```typescript
  // Apply status_value_mapping if the raw CSV status matches an entry.
  // Falls back to enum validation for compat (programmatic API calls, old batches).
  const rawStatus = (row.status || '').trim()
  let tagFromStatus: string | null = null

  if (rawStatus && config.status_value_mapping && config.status_value_mapping[rawStatus]) {
    const action = config.status_value_mapping[rawStatus]
    if (action.type === 'map') {
      prepared.status = action.status
    } else if (action.type === 'tag') {
      prepared.status = config.default_status
      tagFromStatus = rawStatus
    } else {
      // action.type === 'ignore'
      prepared.status = config.default_status
    }
  } else {
    // Legacy fallback: validate against enum, else use default
    const validStatuses: LeadStatus[] = ['nouveau', 'scripte', 'setting_planifie', 'no_show_setting', 'closing_planifie', 'no_show_closing', 'clos', 'dead']
    if (!validStatuses.includes(prepared.status as LeadStatus)) {
      prepared.status = config.default_status
    }
  }
```

**Note :** ajout de `'scripte'` dans la liste `validStatuses` (le statut a été ajouté en migration 028 mais cette ligne ne l'avait pas — bug latent à corriger au passage).

- [ ] **Step 3: Injecter le tag si applicable**

Dans le même fichier, trouver le retour final valide de `validateRow` :

```typescript
  const data: Record<string, unknown> = { ...parsed.data, status: prepared.status }
  if (createdAt) data.created_at = createdAt.toISOString()

  return { valid: true, data, errors: [] }
```

**Remplacer** par :

```typescript
  const data: Record<string, unknown> = { ...parsed.data, status: prepared.status }
  if (createdAt) data.created_at = createdAt.toISOString()
  if (tagFromStatus) {
    const existingTags = (data.tags as string[]) || []
    data.tags = [...existingTags, tagFromStatus]
  }

  return { valid: true, data, errors: [] }
```

- [ ] **Step 4: Écrire un script de validation de `validateRow`**

Create: `test-validate-row.mjs` (temp, à la racine)

```javascript
// Temp — simule les 4 branches de la nouvelle logique de statut.
// Vérifie uniquement le comportement ajouté, pas toute la fonction.

// Reproduction simplifiée de la logique ajoutée
function simulateStatus(row, config) {
  const rawStatus = (row.status || '').trim()
  let tagFromStatus = null
  let status = null

  if (rawStatus && config.status_value_mapping && config.status_value_mapping[rawStatus]) {
    const action = config.status_value_mapping[rawStatus]
    if (action.type === 'map') {
      status = action.status
    } else if (action.type === 'tag') {
      status = config.default_status
      tagFromStatus = rawStatus
    } else {
      status = config.default_status
    }
  } else {
    const validStatuses = ['nouveau', 'scripte', 'setting_planifie', 'no_show_setting', 'closing_planifie', 'no_show_closing', 'clos', 'dead']
    status = validStatuses.includes(rawStatus) ? rawStatus : config.default_status
  }
  return { status, tagFromStatus }
}

const config = {
  default_status: 'nouveau',
  status_value_mapping: {
    'RDV Bilan Pris': { type: 'map', status: 'setting_planifie' },
    'Converti': { type: 'map', status: 'clos' },
    'A recontacter': { type: 'tag' },
    'Obsolète': { type: 'ignore' },
  },
}

const cases = [
  // [row.status, expected.status, expected.tag]
  ['RDV Bilan Pris', 'setting_planifie', null],        // map
  ['Converti',       'clos',              null],        // map
  ['A recontacter',  'nouveau',           'A recontacter'], // tag
  ['Obsolète',       'nouveau',           null],        // ignore
  ['clos',           'clos',              null],        // enum fallback
  ['xyz',            'nouveau',           null],        // no mapping, not in enum
  ['',               'nouveau',           null],        // empty
]

let pass = 0, fail = 0
for (const [input, expStatus, expTag] of cases) {
  const { status, tagFromStatus } = simulateStatus({ status: input }, config)
  const ok = status === expStatus && tagFromStatus === expTag
  console.log(ok ? '✓' : '✗', `"${input}"`.padEnd(25), '→',
    `status=${status}`.padEnd(30), `tag=${tagFromStatus}`,
    ok ? '' : `(expected status=${expStatus}, tag=${expTag})`)
  if (ok) pass++; else fail++
}
console.log(`\n${pass}/${pass + fail} passed`)
```

- [ ] **Step 5: Exécuter le script**

Run:
```bash
node test-validate-row.mjs
```

Expected: `7/7 passed`.

- [ ] **Step 6: Vérifier que TypeScript compile**

Run:
```bash
npx tsc --noEmit 2>&1 | grep "import-engine"
```

Expected : aucune erreur dans `import-engine.ts`.

- [ ] **Step 7: Supprimer le script temp et commit**

```bash
rm test-validate-row.mjs
git add src/lib/leads/import-engine.ts
git commit -m "feat(leads): apply status_value_mapping in validateRow

- Branches for 'map', 'tag', 'ignore' actions
- Tag action pushes the raw CSV value into lead tags
- Falls back to enum check when no mapping entry (compat)
- Fixes latent bug: 'scripte' was missing from enum fallback list

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4 — UI : composant `StatusValueMapper`

**Files:**
- Create: `src/components/leads/import/StatusValueMapper.tsx`

- [ ] **Step 1: Créer le fichier avec le composant complet**

Create: `src/components/leads/import/StatusValueMapper.tsx`

```tsx
'use client'

import { useMemo } from 'react'
import { AlertCircle, CheckCircle2, Tag } from 'lucide-react'
import type { LeadStatus, StatusMappingAction } from '@/types'

interface Props {
  uniqueValues: string[]
  mapping: Record<string, StatusMappingAction>
  onChange: (mapping: Record<string, StatusMappingAction>) => void
}

const STATUS_LABELS: Record<LeadStatus, string> = {
  nouveau: 'Nouveau',
  scripte: 'Scripté',
  setting_planifie: 'Setting planifié',
  no_show_setting: 'No-show Setting',
  closing_planifie: 'Closing planifié',
  no_show_closing: 'No-show Closing',
  clos: 'Closé',
  dead: 'Dead',
}

const STATUS_ORDER: LeadStatus[] = [
  'nouveau', 'scripte', 'setting_planifie', 'no_show_setting',
  'closing_planifie', 'no_show_closing', 'clos', 'dead',
]

// Encoded value for the <select> (separates action type from status)
function encodeAction(action: StatusMappingAction | undefined): string {
  if (!action) return ''
  if (action.type === 'map') return `map:${action.status}`
  if (action.type === 'tag') return 'tag'
  return 'ignore'
}

function decodeAction(value: string): StatusMappingAction | null {
  if (!value) return null
  if (value === 'tag') return { type: 'tag' }
  if (value === 'ignore') return { type: 'ignore' }
  if (value.startsWith('map:')) {
    return { type: 'map', status: value.slice(4) as LeadStatus }
  }
  return null
}

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '6px 8px', borderRadius: 6, fontSize: 13,
  background: 'var(--bg-input)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)',
  cursor: 'pointer',
}

export default function StatusValueMapper({ uniqueValues, mapping, onChange }: Props) {
  const unresolvedCount = useMemo(
    () => uniqueValues.filter((v) => !mapping[v]).length,
    [uniqueValues, mapping],
  )

  const handleChange = (value: string, selectValue: string) => {
    const action = decodeAction(selectValue)
    const next = { ...mapping }
    if (action) {
      next[value] = action
    } else {
      delete next[value]
    }
    onChange(next)
  }

  if (uniqueValues.length === 0) return null

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Valeurs de statut détectées ({uniqueValues.length})
        </h3>
        {unresolvedCount > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 12, color: '#E53E3E', fontWeight: 600,
          }}>
            <AlertCircle size={12} />
            {unresolvedCount} à régler
          </span>
        )}
      </div>

      <div style={{ borderRadius: 8, border: '1px solid var(--border-primary)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-elevated)' }}>
                Valeur CSV
              </th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-elevated)', width: 280 }}>
                Action
              </th>
              <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-elevated)', width: 80 }}>
                Résultat
              </th>
            </tr>
          </thead>
          <tbody>
            {uniqueValues.map((value) => {
              const action = mapping[value]
              const selectValue = encodeAction(action)
              return (
                <tr key={value} style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                  <td style={{ padding: '8px 14px', color: 'var(--text-primary)' }}>{value}</td>
                  <td style={{ padding: '8px 14px' }}>
                    <select
                      value={selectValue}
                      onChange={(e) => handleChange(value, e.target.value)}
                      style={{
                        ...selectStyle,
                        color: selectValue ? 'var(--text-primary)' : 'var(--text-muted)',
                        borderColor: selectValue ? 'var(--border-primary)' : '#E53E3E',
                      }}
                    >
                      <option value="">— Choisir… —</option>
                      <optgroup label="Mapper vers un statut ClosRM">
                        {STATUS_ORDER.map((s) => (
                          <option key={s} value={`map:${s}`}>{STATUS_LABELS[s]}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Autres">
                        <option value="tag">Convertir en tag</option>
                        <option value="ignore">Ignorer (statut par défaut)</option>
                      </optgroup>
                    </select>
                  </td>
                  <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                    {!action ? (
                      <AlertCircle size={16} color="#E53E3E" />
                    ) : action.type === 'map' ? (
                      <CheckCircle2 size={16} color="#38A169" />
                    ) : action.type === 'tag' ? (
                      <Tag size={16} color="#3B82F6" />
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Vérifier la compilation**

Run:
```bash
npx tsc --noEmit 2>&1 | grep "StatusValueMapper"
```

Expected : aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add src/components/leads/import/StatusValueMapper.tsx
git commit -m "feat(leads): add StatusValueMapper component

Renders a table of unique status values detected in the CSV, with
a dropdown per value offering: map to a ClosRM status, convert to
tag, or ignore. Shows unresolved count in the header.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5 — UI : intégration dans Step2 + validation du bouton Continuer

**Files:**
- Modify: `src/app/(dashboard)/leads/import/import-client.tsx` (INITIAL_CONFIG)
- Modify: `src/components/leads/import/Step2_MappingConfig.tsx` (intégration)

- [ ] **Step 1: Initialiser `status_value_mapping` dans INITIAL_CONFIG**

Dans `src/app/(dashboard)/leads/import/import-client.tsx`, trouver `INITIAL_CONFIG` (ligne ~32) et ajouter le champ :

```typescript
const INITIAL_CONFIG: ImportConfig = {
  mapping: {},
  default_source: null,
  default_status: 'nouveau',
  batch_tags: [],
  dedup_strategy: 'email',
  dedup_action: 'skip',
  status_value_mapping: {},
}
```

- [ ] **Step 2: Importer les helpers dans Step2**

Dans `src/components/leads/import/Step2_MappingConfig.tsx`, remplacer la ligne d'import du csv-parser (ligne ~6) :

```typescript
import { TARGET_FIELDS, applyMapping, extractUniqueStatusValues, suggestStatusMapping } from '@/lib/leads/csv-parser'
```

Et ajouter l'import du composant + du type :

```typescript
import StatusValueMapper from '@/components/leads/import/StatusValueMapper'
import type { ImportDedupAction, ImportDedupStrategy, LeadSource, LeadStatus, StatusMappingAction } from '@/types'
```

- [ ] **Step 3: Ajouter la logique de détection et d'auto-suggestion**

Dans le composant `Step2_MappingConfig`, juste après `const { columnMappings, config } = state` (ligne ~65), ajouter :

```typescript
  // Détecter la colonne CSV mappée vers "status"
  const statusCsvHeader = useMemo(
    () => columnMappings.find((m) => m.targetField === 'status')?.csvHeader || null,
    [columnMappings],
  )

  // Extraire les valeurs uniques de cette colonne (vide si pas mappée)
  const uniqueStatusValues = useMemo(() => {
    if (!statusCsvHeader) return []
    return extractUniqueStatusValues(state.rows, statusCsvHeader)
  }, [state.rows, statusCsvHeader])

  // Auto-suggérer le mapping quand la colonne est (re)mappée ou les valeurs changent
  useEffect(() => {
    if (uniqueStatusValues.length === 0) {
      // Clear mapping when column unmapped
      if (Object.keys(config.status_value_mapping).length > 0) {
        updateConfig({ status_value_mapping: {} })
      }
      return
    }
    // Fill only values not yet in the mapping (don't overwrite user choices)
    const next = { ...config.status_value_mapping }
    let changed = false
    for (const value of uniqueStatusValues) {
      if (!next[value]) {
        const suggested = suggestStatusMapping(value)
        if (suggested) {
          next[value] = { type: 'map', status: suggested }
          changed = true
        }
      }
    }
    // Remove stale entries (values no longer present)
    for (const key of Object.keys(next)) {
      if (!uniqueStatusValues.includes(key)) {
        delete next[key]
        changed = true
      }
    }
    if (changed) {
      updateConfig({ status_value_mapping: next })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uniqueStatusValues])
```

**Note :** `useMemo` et `useEffect` sont déjà disponibles via les imports React (vérifier ligne 3 : `import { useMemo } from 'react'`). Si `useEffect` manque, l'ajouter :

```typescript
import { useEffect, useMemo, useState } from 'react'
```

- [ ] **Step 4: Étendre la validation du bouton Continuer**

Trouver `hasRequiredField` (ligne ~68) et le laisser inchangé, puis **ajouter** juste après :

```typescript
  const hasUnresolvedStatusValues = useMemo(() => {
    return uniqueStatusValues.some((v) => !config.status_value_mapping[v])
  }, [uniqueStatusValues, config.status_value_mapping])

  const canContinue = hasRequiredField && !hasUnresolvedStatusValues
```

Puis, dans le JSX, **remplacer** les deux occurrences de `hasRequiredField` sur le bouton Continuer (ligne ~275 et ~279) par `canContinue`.

Exemple de changement :

```typescript
<button
  onClick={handleNext}
  disabled={!canContinue}
  style={{
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600,
    background: canContinue ? 'var(--color-primary)' : 'var(--border-primary)', border: 'none',
    color: canContinue ? '#000' : 'var(--text-muted)', cursor: canContinue ? 'pointer' : 'not-allowed',
  }}
>
```

- [ ] **Step 5: Rendre `StatusValueMapper` conditionnellement**

Dans le JSX de Step2, trouver la section `{/* Left: Mapping */}` (ligne ~99). À la fin du `<div>` qui contient le tableau de mapping des colonnes (juste avant la fermeture `</div>` du bloc gauche, autour de ligne 155, après le paragraphe d'erreur `hasRequiredField`), **ajouter** :

```tsx
          {statusCsvHeader && uniqueStatusValues.length > 0 && (
            <StatusValueMapper
              uniqueValues={uniqueStatusValues}
              mapping={config.status_value_mapping}
              onChange={(m) => updateConfig({ status_value_mapping: m })}
            />
          )}
```

- [ ] **Step 6: Vérifier la compilation**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -E "Step2|import-client" | head
```

Expected : aucune erreur.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(dashboard\)/leads/import/import-client.tsx src/components/leads/import/Step2_MappingConfig.tsx
git commit -m "feat(leads): integrate StatusValueMapper into Step2 of import wizard

- Auto-detect unique CSV status values when the status column is mapped
- Pre-fill status_value_mapping using STATUS_SYNONYMS auto-suggestions
- Clear stale entries when the mapped column changes
- Block 'Continuer' button until all detected values have an action

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6 — Test manuel end-to-end

**Files:**
- Manual test in browser, using Rémy's CSV

- [ ] **Step 1: Préparer un CSV de test**

Créer un fichier `test-import-status.csv` à la racine (ne pas committer) :

```csv
Prénom;Nom;Email;Téléphone;Statut;Date
Camille;Dupont;camille.d@test.com;0612345678;Nouveau;6 janvier 2026
Lucas;Martin;lucas.m@test.com;0623456789;RDV Bilan Pris;10 janvier 2026
Sarah;Doe;sarah@test.com;0634567890;Converti;15 janvier 2026
Paul;Roy;paul@test.com;0645678901;Bilan effectué;16 janvier 2026
Marie;Leblanc;marie@test.com;0656789012;Jamais décroché;17 janvier 2026
Max;Dubois;max@test.com;0667890123;A recontacter;18 janvier 2026
Zoé;Simon;zoe@test.com;0678901234;Foo Bar XYZ;19 janvier 2026
```

- [ ] **Step 2: Lancer le dev server**

Run:
```bash
npm run dev
```

Expected : serveur démarré sur http://localhost:3000.

- [ ] **Step 3: Tester le flux dans le navigateur**

1. Aller sur http://localhost:3000/leads/import
2. Uploader `test-import-status.csv`
3. **Étape 2 (Mapping) :** vérifier que la colonne `Statut` est auto-mappée vers `status`. Si non, mapper manuellement.
4. Observer le nouveau bloc "**Valeurs de statut détectées (7)**" :
   - "Nouveau" → Mapper: Nouveau ✓
   - "RDV Bilan Pris" → Mapper: Setting planifié ✓
   - "Converti" → Mapper: Closé ✓
   - "Bilan effectué" → Mapper: Closé ✓
   - "Jamais décroché" → Mapper: No-show Setting ✓
   - "A recontacter" → Mapper: Scripté ✓
   - "Foo Bar XYZ" → Choisir… ⚠
5. Vérifier que le bouton **Continuer est désactivé** tant que "Foo Bar XYZ" n'a pas d'action.
6. Changer "Foo Bar XYZ" en "Convertir en tag". Bouton Continuer activé.
7. Cliquer Continuer, aller jusqu'au bout de l'import.
8. Vérifier sur `/leads` que :
   - Les 7 leads sont créés
   - Leurs statuts sont corrects (ex: Sarah en `clos`, Marie en `no_show_setting`)
   - Zoé a le statut par défaut `nouveau` **ET** un tag `Foo Bar XYZ`
   - Les dates de création sont correctes (6 janv., 10 janv., etc.)

- [ ] **Step 4: Vérifier les cas de régression**

1. Relancer un import **sans** colonne statut mappée (décocher) → le bloc "Valeurs de statut détectées" ne doit **pas** apparaître, le bouton Continuer reste activé (comportement actuel préservé).
2. Importer un CSV avec des valeurs dans l'enum directement (`nouveau`, `clos`) — elles doivent être auto-mappées par l'auto-suggestion.

- [ ] **Step 5: Cleanup**

Run:
```bash
rm test-import-status.csv
```

- [ ] **Step 6: Pas de commit à cette étape** (tests manuels). Si un bug est trouvé, retourner à la tâche concernée, corriger, re-commit.

---

## Task 7 — Finalisation

**Files:**
- Modify: `taches/tache-034-import-status-mapping.md`

- [ ] **Step 1: Mettre à jour le fichier de tâche**

Dans `taches/tache-034-import-status-mapping.md`, changer la ligne `**Statut :** spec validée, à implémenter` par :

```markdown
**Statut :** terminé
```

Ajouter en bas du fichier :

```markdown
## Résultat

- Commits : `feat(types)`, `feat(leads): add STATUS_SYNONYMS`, `feat(leads): apply status_value_mapping`, `feat(leads): add StatusValueMapper`, `feat(leads): integrate StatusValueMapper`
- Testé manuellement avec un CSV de 7 leads couvrant les 3 actions (map/tag/ignore) + auto-suggestion + blocage du bouton
- Intégré dans la PR #286 (branche `feature/remy-restore-plus-dropdown`)
```

- [ ] **Step 2: Commit final et push**

```bash
git add taches/tache-034-import-status-mapping.md
git commit -m "docs(leads): mark T-034 (import status mapping) as done

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin feature/remy-restore-plus-dropdown
```

- [ ] **Step 3: Vérifier l'état final de la PR**

Run:
```bash
gh pr view 286 --json state,title,body | head -20
```

Expected : PR existe toujours, les commits de T-034 sont intégrés automatiquement puisque branch tracking.

---

## Self-Review (à effectuer avant de commencer)

- **Spec coverage :** chaque section de la spec a une tâche dédiée (types → T1, parser → T2, engine → T3, UI composant → T4, UI intégration → T5, tests manuels → T6).
- **Placeholder scan :** tous les blocs de code sont complets, pas de "…" ou "TODO".
- **Type consistency :** `StatusMappingAction`, `ImportConfig.status_value_mapping`, `extractUniqueStatusValues`, `suggestStatusMapping` utilisés avec des signatures identiques partout.
- **Compat descendante :** le fallback enum dans `validateRow` reste en place pour les appels programmatiques sans `status_value_mapping`.
- **Fix latent :** ajout de `'scripte'` dans `validStatuses` (mentionné dans T3 step 2).
