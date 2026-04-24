# Mapping Intelligent des Sources à l'Import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** À l'étape 2 du wizard d'import CSV, permettre à l'utilisateur de mapper chaque valeur de source présente dans son CSV vers une source ClosRM (ou en tag, ou ignorer), avec auto-suggestion par dictionnaire conservateur FR/EN.

**Architecture:** Pattern miroir de T-034 (status mapping). Ajout de `SourceMappingAction` + `source_value_mapping` dans `ImportConfig`, dictionnaire `SOURCE_SYNONYMS` + helpers dans `csv-parser.ts`, nouveau composant `SourceValueMapper` (clone de `StatusValueMapper`), branche dans `validateRow` pour appliquer le mapping avant le fallback enum existant.

**Tech Stack:** Next.js 14 App Router + TypeScript, React client components, PapaParse. Pas de framework de test installé → validation via scripts Node one-off + tests manuels (pattern T-034).

**Spec:** [docs/superpowers/specs/2026-04-24-import-source-mapping-design.md](../specs/2026-04-24-import-source-mapping-design.md)

---

## File Structure

| Fichier | Type | Responsabilité |
|---|---|---|
| `src/types/index.ts` | modif | ajouter `SourceMappingAction` + `ImportConfig.source_value_mapping` |
| `src/lib/leads/csv-parser.ts` | modif | ajouter `SOURCE_SYNONYMS`, `extractUniqueSourceValues`, `suggestSourceMapping` |
| `src/components/leads/import/SourceValueMapper.tsx` | nouveau | sous-composant rendu dans Step2 quand source mappée |
| `src/components/leads/import/Step2_MappingConfig.tsx` | modif | intégrer SourceValueMapper + étendre gating du bouton |
| `src/app/(dashboard)/leads/import/import-client.tsx` | modif | `source_value_mapping: {}` dans `INITIAL_CONFIG` |
| `src/lib/leads/import-engine.ts` | modif | appliquer `source_value_mapping` dans `validateRow` avant fallback enum |
| `taches/tache-035-import-source-mapping.md` | modif | marquer tâche terminée à la fin |

---

## Task 1 — Types : `SourceMappingAction` + extension de `ImportConfig`

**Files:**
- Modify: `src/types/index.ts` (autour de `StatusMappingAction` et `ImportConfig`)

- [ ] **Step 1: Localiser les types existants**

Run:
```bash
grep -n "StatusMappingAction\|status_value_mapping" src/types/index.ts
```

Expected : `StatusMappingAction` défini vers ligne 121, utilisé dans `ImportConfig.status_value_mapping` en dernière position de l'interface.

- [ ] **Step 2: Ajouter le type `SourceMappingAction` juste après `StatusMappingAction`**

Dans `src/types/index.ts`, **immédiatement après** le bloc :

```typescript
export type StatusMappingAction =
  | { type: 'map'; status: LeadStatus }
  | { type: 'tag' }
  | { type: 'ignore' }
```

Ajouter :

```typescript
export type SourceMappingAction =
  | { type: 'map'; source: LeadSource }
  | { type: 'tag' }
  | { type: 'ignore' }
```

- [ ] **Step 3: Étendre `ImportConfig` avec `source_value_mapping`**

Dans la même interface `ImportConfig`, **immédiatement après** `status_value_mapping: Record<string, StatusMappingAction>` (et son commentaire), ajouter :

```typescript
  // Mapping des valeurs CSV de source → action ClosRM (miroir de status_value_mapping).
  // Clé = valeur CSV brute (ex: "Meta Ads"), valeur = action à appliquer.
  // Absence de clé = valeur non mappée (fallback enum actuel).
  source_value_mapping: Record<string, SourceMappingAction>
```

- [ ] **Step 4: Vérifier la compilation TypeScript**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -E "types/index|ImportConfig" | head -10
```

Expected : aucune erreur dans `src/types/index.ts`. Des erreurs de compilation vont apparaître dans `import-client.tsx` (missing property dans `INITIAL_CONFIG`) — c'est attendu, résolues dans Task 5.

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add SourceMappingAction and source_value_mapping to ImportConfig

Mirror of StatusMappingAction for lead source values at CSV import.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2 — Parser : dictionnaire `SOURCE_SYNONYMS` + helpers

**Files:**
- Modify: `src/lib/leads/csv-parser.ts`
- Test: script one-off `test-source-mapping.mjs` (racine projet, temporaire)

- [ ] **Step 1: Vérifier que `LeadSource` est disponible**

Run:
```bash
grep -n "LeadSource\|LeadStatus" src/lib/leads/csv-parser.ts | head
```

Expected : `LeadStatus` est déjà importé en type-only (ligne ~3). `LeadSource` doit être ajouté au même import.

- [ ] **Step 2: Étendre l'import pour inclure `LeadSource`**

Dans `src/lib/leads/csv-parser.ts`, remplacer l'import :

```typescript
import type { LeadStatus } from '@/types'
```

par :

```typescript
import type { LeadSource, LeadStatus } from '@/types'
```

- [ ] **Step 3: Ajouter le dictionnaire `SOURCE_SYNONYMS` et les deux helpers**

À la fin de `src/lib/leads/csv-parser.ts` (après `suggestStatusMapping`), ajouter :

```typescript
// ------------------------------------------------------------------
// Source synonyms (FR + EN) — conservative dictionary used by the
// import wizard to pre-fill suggestions for each unique CSV source
// value. Deliberately excludes ambiguous single-platform names like
// "Instagram" or "Facebook" alone, which can mean either ads or
// organic depending on the user's workflow.
// ------------------------------------------------------------------
export const SOURCE_SYNONYMS: Record<LeadSource, string[]> = {
  facebook_ads: [
    'facebook ads', 'meta ads', 'fb ads',
  ],
  instagram_ads: [
    'instagram ads', 'ig ads', 'insta ads',
  ],
  follow_ads: [
    'follow ads',
  ],
  formulaire: [
    'formulaire', 'form', 'website form', 'landing page', 'contact form',
  ],
  manuel: [
    'manuel', 'manual', 'direct', 'import', 'inconnu',
  ],
  funnel: [
    'funnel', 'tunnel', 'vsl',
  ],
}

// ------------------------------------------------------------------
// Extract unique non-empty source values from the raw rows, given the
// CSV header name that was mapped to the source field. (Mirror of
// extractUniqueStatusValues.)
// ------------------------------------------------------------------
export function extractUniqueSourceValues(
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
// Suggest a ClosRM source for a given raw CSV source value.
// 2-pass match (exact synonym → inclusion). Returns null if no
// confident match. Mirror of suggestStatusMapping.
// ------------------------------------------------------------------
export function suggestSourceMapping(value: string): LeadSource | null {
  const norm = normalize(value)
  if (!norm) return null

  // Pass 1: exact match on any synonym
  for (const [source, synonyms] of Object.entries(SOURCE_SYNONYMS) as [LeadSource, string[]][]) {
    if (synonyms.some((s) => normalize(s) === norm)) {
      return source
    }
  }

  // Pass 2: inclusion match (value contains synonym or vice versa)
  for (const [source, synonyms] of Object.entries(SOURCE_SYNONYMS) as [LeadSource, string[]][]) {
    if (synonyms.some((s) => {
      const ns = normalize(s)
      return ns.length >= 3 && (norm.includes(ns) || ns.includes(norm))
    })) {
      return source
    }
  }

  return null
}
```

- [ ] **Step 4: Écrire un script de validation**

Create at project root: `test-source-mapping.mjs`

```javascript
// Temp — tests des helpers de mapping de source.

function normalize(str) {
  return str.trim().toLowerCase().normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
}

const SOURCE_SYNONYMS = {
  facebook_ads: ['facebook ads', 'meta ads', 'fb ads'],
  instagram_ads: ['instagram ads', 'ig ads', 'insta ads'],
  follow_ads: ['follow ads'],
  formulaire: ['formulaire', 'form', 'website form', 'landing page', 'contact form'],
  manuel: ['manuel', 'manual', 'direct', 'import', 'inconnu'],
  funnel: ['funnel', 'tunnel', 'vsl'],
}

function suggestSourceMapping(value) {
  const norm = normalize(value)
  if (!norm) return null
  for (const [source, synonyms] of Object.entries(SOURCE_SYNONYMS)) {
    if (synonyms.some((s) => normalize(s) === norm)) return source
  }
  for (const [source, synonyms] of Object.entries(SOURCE_SYNONYMS)) {
    if (synonyms.some((s) => {
      const ns = normalize(s)
      return ns.length >= 3 && (norm.includes(ns) || ns.includes(norm))
    })) return source
  }
  return null
}

// Rémy's 4 historical sources + edge cases + regressions
const cases = [
  // [input, expected, description]
  ['Meta Ads',           'facebook_ads',  'real: Meta Ads → fb ads'],
  ['Instagram',          null,            'real: ambiguous, force manual'],
  ['Salle',              null,            'real: no match → tag'],
  ['Bouche-à-oreille',   null,            'real: no match → tag'],

  ['Facebook',           null,            'conservative: alone is ambiguous'],

  ['funnel',             'funnel',        'regression: enum-valid value'],
  ['Formulaire',         'formulaire',    'regression: FR form'],
  ['Manual',             'manuel',        'regression: EN synonym'],
  ['tunnel',             'funnel',        'synonym: tunnel → funnel'],
  ['VSL',                'funnel',        'synonym: VSL → funnel'],

  ['  META ADS  ',       'facebook_ads',  'normalization: trim + upper'],
  ['',                   null,            'edge: empty'],
  ['XYZ blabla',         null,            'edge: unknown'],
]

let pass = 0, fail = 0
for (const [input, expected, desc] of cases) {
  const got = suggestSourceMapping(input)
  const ok = got === expected
  console.log(ok ? '✓' : '✗', JSON.stringify(input).padEnd(22), '→', String(got).padEnd(15), `(${desc})`,
    ok ? '' : ` EXPECTED ${expected}`)
  if (ok) pass++; else fail++
}
console.log(`\n${pass}/${pass + fail} passed`)
```

- [ ] **Step 5: Exécuter le script**

Run:
```bash
node test-source-mapping.mjs
```

Expected : `13/13 passed`. Si un cas échoue, ajuster `SOURCE_SYNONYMS` (dans `.ts` ET dans le script) et relancer. Vérifier particulièrement qu'"Instagram" et "Facebook" seuls restent `null` (conservatisme voulu).

- [ ] **Step 6: Vérifier la compilation**

Run:
```bash
npx tsc --noEmit 2>&1 | grep "csv-parser"
```

Expected : aucune erreur dans `csv-parser.ts`.

- [ ] **Step 7: Supprimer le script et commit**

```bash
rm test-source-mapping.mjs
git add src/lib/leads/csv-parser.ts
git commit -m "feat(leads): add SOURCE_SYNONYMS dictionary and mapping helpers

- SOURCE_SYNONYMS: conservative FR/EN dictionary for the 6 ClosRM sources
- extractUniqueSourceValues: dedupe + sort unique values from a CSV column
- suggestSourceMapping: 2-pass match (exact synonym → inclusion)

Intentionally excludes 'Instagram' and 'Facebook' alone (ambiguous)
to avoid the T-034 'Qualifié→dead' class of silent false positives.
Validated against Rémy's 4 historical source values + regressions.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3 — Import engine : appliquer `source_value_mapping` dans `validateRow`

**Files:**
- Modify: `src/lib/leads/import-engine.ts`

- [ ] **Step 1: Localiser le bloc de validation enum des sources**

Run:
```bash
grep -n "validSources\|Validate source against enum" src/lib/leads/import-engine.ts
```

Expected : un bloc autour des lignes 152-168 qui définit `validSources: LeadSource[]` et fait le fallback sur `config.default_source` ou emet une erreur.

- [ ] **Step 2: Remplacer le bloc source par une version mapping-aware**

Dans `src/lib/leads/import-engine.ts`, **remplacer** le bloc existant :

```typescript
  // Validate source against enum
  const validSources: LeadSource[] = ['facebook_ads', 'instagram_ads', 'follow_ads', 'formulaire', 'manuel', 'funnel']
  if (!validSources.includes(prepared.source as LeadSource)) {
    if (config.default_source) {
      // Default source set → replace silently
      prepared.source = config.default_source
    } else {
      // No default → flag as error
      errors.push({
        row: rowIndex + 1,
        field: 'source',
        value: row.source || '',
        reason: `Source inconnue : « ${row.source} ». Sources valides : facebook_ads, instagram_ads, follow_ads, formulaire, manuel, funnel`,
      })
      return { valid: false, errors }
    }
  }
```

**Par** :

```typescript
  // Apply source_value_mapping if the raw CSV source matches an entry.
  // Falls back to enum validation for compat (programmatic API calls, old batches).
  const rawSource = (row.source || '').trim()
  let tagFromSource: string | null = null

  if (rawSource && config.source_value_mapping && config.source_value_mapping[rawSource]) {
    const action = config.source_value_mapping[rawSource]
    if (action.type === 'map') {
      prepared.source = action.source
    } else if (action.type === 'tag') {
      prepared.source = config.default_source || 'manuel'
      tagFromSource = rawSource
    } else {
      // action.type === 'ignore'
      prepared.source = config.default_source || 'manuel'
    }
  } else {
    // Legacy fallback: validate against enum, else use default or emit error
    const validSources: LeadSource[] = ['facebook_ads', 'instagram_ads', 'follow_ads', 'formulaire', 'manuel', 'funnel']
    if (!validSources.includes(prepared.source as LeadSource)) {
      if (config.default_source) {
        prepared.source = config.default_source
      } else {
        errors.push({
          row: rowIndex + 1,
          field: 'source',
          value: row.source || '',
          reason: `Source inconnue : « ${row.source} ». Sources valides : facebook_ads, instagram_ads, follow_ads, formulaire, manuel, funnel`,
        })
        return { valid: false, errors }
      }
    }
  }
```

- [ ] **Step 3: Injecter le tag source dans `data.tags` si applicable**

Localiser la fin de `validateRow` — le bloc qui injecte `tagFromStatus` dans `data.tags`. Il ressemble à :

```typescript
  const data: Record<string, unknown> = { ...parsed.data, status: prepared.status }
  if (createdAt) data.created_at = createdAt.toISOString()
  // tagFromStatus is only non-null when action.type === 'tag'.
  // Early-return paths above (invalid rows) correctly discard it.
  if (tagFromStatus) {
    const existingTags = (data.tags as string[]) || []
    data.tags = [...existingTags, tagFromStatus]
  }

  return { valid: true, data, errors: [] }
```

**Remplacer** ce bloc par (ajout uniquement d'un bloc miroir pour `tagFromSource`) :

```typescript
  const data: Record<string, unknown> = { ...parsed.data, status: prepared.status }
  if (createdAt) data.created_at = createdAt.toISOString()
  // tagFromStatus is only non-null when action.type === 'tag'.
  // Early-return paths above (invalid rows) correctly discard it.
  if (tagFromStatus) {
    const existingTags = (data.tags as string[]) || []
    data.tags = [...existingTags, tagFromStatus]
  }
  // tagFromSource — same invariant as tagFromStatus. Source tag appended
  // after the status tag so tag ordering is deterministic.
  if (tagFromSource) {
    const existingTags = (data.tags as string[]) || []
    data.tags = [...existingTags, tagFromSource]
  }

  return { valid: true, data, errors: [] }
```

- [ ] **Step 4: Écrire un script de validation de la logique source**

Create: `test-validate-row-source.mjs` (racine, temp)

```javascript
// Temp — simule uniquement la logique source ajoutée.

function simulateSource(row, config) {
  const rawSource = (row.source || '').trim()
  let tagFromSource = null
  let source = null
  let error = null

  if (rawSource && config.source_value_mapping && config.source_value_mapping[rawSource]) {
    const action = config.source_value_mapping[rawSource]
    if (action.type === 'map') {
      source = action.source
    } else if (action.type === 'tag') {
      source = config.default_source || 'manuel'
      tagFromSource = rawSource
    } else {
      source = config.default_source || 'manuel'
    }
  } else {
    const validSources = ['facebook_ads', 'instagram_ads', 'follow_ads', 'formulaire', 'manuel', 'funnel']
    if (!validSources.includes(row.source)) {
      if (config.default_source) {
        source = config.default_source
      } else {
        error = `Source inconnue : ${row.source}`
      }
    } else {
      source = row.source
    }
  }
  return { source, tagFromSource, error }
}

const config = {
  default_source: null,
  source_value_mapping: {
    'Meta Ads':         { type: 'map', source: 'facebook_ads' },
    'Bouche-à-oreille': { type: 'tag' },
    'Obsolète':         { type: 'ignore' },
  },
}

const cases = [
  // [input, expected.source, expected.tag, expected.error]
  ['Meta Ads',         'facebook_ads', null,                null],
  ['Bouche-à-oreille', 'manuel',       'Bouche-à-oreille',  null],  // default_source is null → 'manuel'
  ['Obsolète',         'manuel',       null,                null],
  ['funnel',           'funnel',       null,                null],
  ['',                 null,           null,                'Source inconnue : '],  // empty + no default
  ['XYZ',              null,           null,                'Source inconnue : XYZ'],
]

let pass = 0, fail = 0
for (const [input, expSrc, expTag, expErr] of cases) {
  const { source, tagFromSource, error } = simulateSource({ source: input }, config)
  const ok = source === expSrc && tagFromSource === expTag && (error ? error.startsWith('Source inconnue') : error === expErr)
  console.log(ok ? '✓' : '✗', JSON.stringify(input).padEnd(22), '→',
    `source=${source}`.padEnd(25), `tag=${tagFromSource}`,
    error ? `err=${error}` : '',
    ok ? '' : ` EXPECTED source=${expSrc} tag=${expTag} err=${expErr}`)
  if (ok) pass++; else fail++
}

// Test with default_source set
const config2 = {
  default_source: 'formulaire',
  source_value_mapping: {},
}
const { source: s1 } = simulateSource({ source: 'Inconnu' }, config2)
const ok2 = s1 === 'formulaire'
console.log(ok2 ? '✓' : '✗', 'with default=formulaire:', 'Inconnu'.padEnd(22), '→', `source=${s1}`, ok2 ? '' : ' EXPECTED formulaire')
if (ok2) pass++; else fail++

console.log(`\n${pass}/${pass + fail} passed`)
```

- [ ] **Step 5: Exécuter le script**

Run:
```bash
node test-validate-row-source.mjs
```

Expected : `7/7 passed`.

- [ ] **Step 6: Vérifier la compilation**

Run:
```bash
npx tsc --noEmit 2>&1 | grep "import-engine"
```

Expected : aucune erreur dans `import-engine.ts`.

- [ ] **Step 7: Supprimer le script et commit**

```bash
rm test-validate-row-source.mjs
git add src/lib/leads/import-engine.ts
git commit -m "feat(leads): apply source_value_mapping in validateRow

- Branches for 'map', 'tag', 'ignore' actions on source
- Tag action pushes the raw CSV source value into lead tags
- Falls back to existing enum check when no mapping entry (compat)
- Source tag appended after status tag for deterministic ordering

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4 — UI : composant `SourceValueMapper`

**Files:**
- Create: `src/components/leads/import/SourceValueMapper.tsx`

- [ ] **Step 1: Lire le `StatusValueMapper` comme base de référence**

Run:
```bash
wc -l src/components/leads/import/StatusValueMapper.tsx
```

Expected : ~152 lignes. Cette tâche crée un clone avec les substitutions décrites.

- [ ] **Step 2: Créer `SourceValueMapper.tsx` avec le contenu complet**

Create: `src/components/leads/import/SourceValueMapper.tsx`

```tsx
'use client'

import { useMemo } from 'react'
import { AlertCircle, CheckCircle2, Tag } from 'lucide-react'
import type { LeadSource, SourceMappingAction } from '@/types'

interface Props {
  uniqueValues: string[]
  mapping: Record<string, SourceMappingAction>
  onChange: (mapping: Record<string, SourceMappingAction>) => void
}

const SOURCE_LABELS: Record<LeadSource, string> = {
  facebook_ads: 'Facebook Ads',
  instagram_ads: 'Instagram Ads',
  follow_ads: 'Follow Ads',
  formulaire: 'Formulaire',
  manuel: 'Manuel',
  funnel: 'Funnel',
}

// Derived from SOURCE_LABELS so TypeScript enforces exhaustiveness: adding a
// new LeadSource forces adding a label, which flows through to this order.
const SOURCE_ORDER = Object.keys(SOURCE_LABELS) as LeadSource[]

// Encoded value for the <select> (separates action type from source)
function encodeAction(action: SourceMappingAction | undefined): string {
  if (!action) return ''
  if (action.type === 'map') return `map:${action.source}`
  if (action.type === 'tag') return 'tag'
  return 'ignore'
}

function decodeAction(value: string): SourceMappingAction | null {
  if (!value) return null
  if (value === 'tag') return { type: 'tag' }
  if (value === 'ignore') return { type: 'ignore' }
  if (value.startsWith('map:')) {
    return { type: 'map', source: value.slice(4) as LeadSource }
  }
  return null
}

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '6px 8px', borderRadius: 6, fontSize: 13,
  background: 'var(--bg-input)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)',
  cursor: 'pointer',
}

export default function SourceValueMapper({ uniqueValues, mapping, onChange }: Props) {
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
          Valeurs de source détectées ({uniqueValues.length})
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
                      aria-label={`Action pour « ${value} »`}
                      value={selectValue}
                      onChange={(e) => handleChange(value, e.target.value)}
                      style={{
                        ...selectStyle,
                        color: selectValue ? 'var(--text-primary)' : 'var(--text-muted)',
                        borderColor: selectValue ? 'var(--border-primary)' : '#E53E3E',
                      }}
                    >
                      <option value="">— Choisir… —</option>
                      <optgroup label="Mapper vers une source ClosRM">
                        {SOURCE_ORDER.map((s) => (
                          <option key={s} value={`map:${s}`}>{SOURCE_LABELS[s]}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Autres">
                        <option value="tag">Convertir en tag</option>
                        <option value="ignore">Ignorer (source par défaut)</option>
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

- [ ] **Step 3: Vérifier la compilation**

Run:
```bash
npx tsc --noEmit 2>&1 | grep "SourceValueMapper"
```

Expected : aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add src/components/leads/import/SourceValueMapper.tsx
git commit -m "feat(leads): add SourceValueMapper component

Clone of StatusValueMapper for source values. Keeps identical UX:
- Table of unique CSV source values with a dropdown per value
- Map to a ClosRM source / convert to tag / ignore
- Red 'X à régler' counter in the header
- aria-label on each select for screen readers
- SOURCE_ORDER derived from SOURCE_LABELS keys for exhaustiveness

Deliberate duplication rather than refactor to a generic ValueMapper,
to avoid touching T-034 just after its merge. A-035-01 in
ameliorations.md tracks the follow-up DRY-ification.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5 — UI : intégration dans Step2 + gating

**Files:**
- Modify: `src/app/(dashboard)/leads/import/import-client.tsx` (INITIAL_CONFIG)
- Modify: `src/components/leads/import/Step2_MappingConfig.tsx`

- [ ] **Step 1: Initialiser `source_value_mapping` dans INITIAL_CONFIG**

Dans `src/app/(dashboard)/leads/import/import-client.tsx`, localiser `INITIAL_CONFIG` et ajouter le champ (juste après `status_value_mapping: {}`) :

```typescript
const INITIAL_CONFIG: ImportConfig = {
  mapping: {},
  default_source: null,
  default_status: 'nouveau',
  batch_tags: [],
  dedup_strategy: 'email',
  dedup_action: 'skip',
  status_value_mapping: {},
  source_value_mapping: {},
}
```

- [ ] **Step 2: Étendre les imports dans Step2**

Dans `src/components/leads/import/Step2_MappingConfig.tsx`, remplacer la ligne d'import du csv-parser :

```typescript
import { TARGET_FIELDS, applyMapping, extractUniqueStatusValues, suggestStatusMapping } from '@/lib/leads/csv-parser'
```

par :

```typescript
import {
  TARGET_FIELDS,
  applyMapping,
  extractUniqueStatusValues,
  suggestStatusMapping,
  extractUniqueSourceValues,
  suggestSourceMapping,
} from '@/lib/leads/csv-parser'
```

Puis ajouter l'import du nouveau composant à côté de `StatusValueMapper` :

```typescript
import SourceValueMapper from '@/components/leads/import/SourceValueMapper'
```

- [ ] **Step 3: Ajouter les memos + useEffect pour les sources**

Trouver les memos `statusCsvHeader` / `uniqueStatusValues` (autour de la ligne 85). **Juste après** leur `useEffect` d'auto-suggestion (celui dont les deps sont `[uniqueStatusValues]`), ajouter les équivalents pour les sources :

```typescript
  // Détecter la colonne CSV mappée vers "source"
  const sourceCsvHeader = useMemo(
    () => columnMappings.find((m) => m.targetField === 'source')?.csvHeader || null,
    [columnMappings],
  )

  // Extraire les valeurs uniques de cette colonne (vide si pas mappée)
  const uniqueSourceValues = useMemo(() => {
    if (!sourceCsvHeader) return []
    return extractUniqueSourceValues(state.rows, sourceCsvHeader)
  }, [state.rows, sourceCsvHeader])

  // Auto-suggérer le mapping quand la colonne est (re)mappée ou les valeurs changent
  useEffect(() => {
    if (uniqueSourceValues.length === 0) {
      if (Object.keys(config.source_value_mapping).length > 0) {
        updateConfig({ source_value_mapping: {} })
      }
      return
    }
    const next = { ...config.source_value_mapping }
    let changed = false
    for (const value of uniqueSourceValues) {
      if (!next[value]) {
        const suggested = suggestSourceMapping(value)
        if (suggested) {
          next[value] = { type: 'map', source: suggested }
          changed = true
        }
      }
    }
    for (const key of Object.keys(next)) {
      if (!uniqueSourceValues.includes(key)) {
        delete next[key]
        changed = true
      }
    }
    if (changed) {
      updateConfig({ source_value_mapping: next })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uniqueSourceValues])
```

- [ ] **Step 4: Étendre `canContinue` avec le gate sur les sources**

Localiser `hasUnresolvedStatusValues` (juste avant `canContinue`). Ajouter son miroir et mettre à jour `canContinue` :

```typescript
  const hasUnresolvedStatusValues = useMemo(() => {
    return uniqueStatusValues.some((v) => !config.status_value_mapping[v])
  }, [uniqueStatusValues, config.status_value_mapping])

  const hasUnresolvedSourceValues = useMemo(() => {
    return uniqueSourceValues.some((v) => !config.source_value_mapping[v])
  }, [uniqueSourceValues, config.source_value_mapping])

  const canContinue = hasRequiredField && !hasUnresolvedStatusValues && !hasUnresolvedSourceValues
```

- [ ] **Step 5: Rendre le `SourceValueMapper` dans le JSX**

Localiser le rendu conditionnel de `<StatusValueMapper ... />` dans le bloc gauche (autour de la ligne 207). **Juste après** son bloc conditionnel, ajouter :

```tsx
          {sourceCsvHeader && uniqueSourceValues.length > 0 && (
            <SourceValueMapper
              uniqueValues={uniqueSourceValues}
              mapping={config.source_value_mapping}
              onChange={(m) => updateConfig({ source_value_mapping: m })}
            />
          )}
```

- [ ] **Step 6: Vérifier la compilation**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -E "Step2_Mapping|import-client" | head
```

Expected : aucune erreur.

Run aussi un check global :
```bash
npx tsc --noEmit 2>&1 | grep -v node_modules | head -20
```

Expected : seulement les erreurs pré-existantes non liées (postal-mime, react-day-picker, @aws-sdk, webhooks/resend) qui existaient avant T-035.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(dashboard)/leads/import/import-client.tsx" "src/components/leads/import/Step2_MappingConfig.tsx"
git commit -m "feat(leads): integrate SourceValueMapper into Step2

- Auto-detect unique CSV source values when the source column is mapped
- Pre-fill source_value_mapping using SOURCE_SYNONYMS auto-suggestions
- Clear stale entries when the mapped column changes
- Extend 'Continuer' gating with hasUnresolvedSourceValues

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6 — Test manuel end-to-end

**Files:**
- Manual test with `test-import-source.csv` (non commité)

- [ ] **Step 1: Préparer le CSV de test**

Create: `test-import-source.csv` at project root:

```csv
Prénom;Nom;Email;Téléphone;Source;Statut
Camille;Dupont;camille.d@test.com;0612345678;Meta Ads;Nouveau
Lucas;Martin;lucas.m@test.com;0623456789;Instagram;Nouveau
Sarah;Doe;sarah@test.com;0634567890;Salle;Nouveau
Paul;Roy;paul@test.com;0645678901;Bouche-à-oreille;Nouveau
Marie;Leblanc;marie@test.com;0656789012;funnel;Nouveau
Max;Dubois;max@test.com;0667890123;Formulaire;Nouveau
```

- [ ] **Step 2: Lancer le dev server (s'il ne tourne pas déjà)**

Run:
```bash
npm run dev
```

Expected : serveur démarré sur http://localhost:3000.

- [ ] **Step 3: Tester le flux dans le navigateur**

1. Aller sur http://localhost:3000/leads/import
2. Uploader `test-import-source.csv`
3. **Étape 2** : vérifier que `Source` est auto-mappé vers `source` (sinon mapper manuellement)
4. Observer que **deux blocs** apparaissent maintenant sous le tableau de mapping des colonnes :
   - `Valeurs de statut détectées (1)` — "Nouveau" auto-mappé vers `nouveau` ✓
   - `Valeurs de source détectées (6)` avec :
     - Meta Ads → `facebook_ads` ✓ (vert)
     - Instagram → ⚠ Choisir (rouge)
     - Salle → ⚠ Choisir (rouge)
     - Bouche-à-oreille → ⚠ Choisir (rouge)
     - funnel → `funnel` ✓ (vert)
     - Formulaire → `formulaire` ✓ (vert)
5. Vérifier que le bouton **Continuer est désactivé** (3 valeurs non résolues)
6. Mettre "Instagram", "Salle", "Bouche-à-oreille" en **"Convertir en tag"**
7. Le bouton Continuer doit se déverrouiller
8. Finir l'import
9. Sur `/leads` vérifier que :
   - 6 leads créés
   - Camille = source `facebook_ads`, pas de tag "Meta Ads"
   - Lucas = source `manuel`, tag `Instagram`
   - Sarah = source `manuel`, tag `Salle`
   - Paul = source `manuel`, tag `Bouche-à-oreille`
   - Marie = source `funnel`
   - Max = source `formulaire`

- [ ] **Step 4: Tester la régression (sans colonne source)**

1. Créer un CSV minimal sans colonne source :
   ```csv
   Prénom;Nom;Email;Téléphone
   Test;One;test1@example.com;0611111111
   ```
2. Importer. À l'étape 2, sans colonne mappée vers `source`, le bloc `Valeurs de source détectées` ne doit **pas** apparaître.
3. Le bouton Continuer doit rester activé une fois Email/Téléphone validés.
4. L'import doit réussir (le lead prend `default_source` si configuré, sinon `manuel`).

- [ ] **Step 5: Tester combinaison status + source en tag**

Vérifier qu'un lead peut avoir **à la fois** un tag venant du status et un tag venant de la source. Créer un CSV avec une ligne qui force les deux :

```csv
Prénom;Nom;Email;Téléphone;Source;Statut
Combo;Test;combo@test.com;0699999999;Bouche-à-oreille;Foo Bar XYZ
```

Après import avec "Bouche-à-oreille" → tag et "Foo Bar XYZ" → tag, le lead doit avoir **les deux tags** (`Bouche-à-oreille` et `Foo Bar XYZ`) dans l'ordre : status en premier, source en second.

- [ ] **Step 6: Cleanup**

Run:
```bash
rm test-import-source.csv
```

**Pas de commit** (tests manuels). Si bug trouvé, retourner à la tâche concernée, fixer, re-commit.

---

## Task 7 — Finalisation

**Files:**
- Modify: `taches/tache-035-import-source-mapping.md`
- Modify: `ameliorations.md` (nouvelle entrée A-035-01)

- [ ] **Step 1: Ajouter l'amélioration A-035-01 dans ameliorations.md**

Dans `ameliorations.md`, ajouter avant la ligne `*Mis a jour le ...*` :

```markdown
### A-035-01 · Factoriser `StatusValueMapper` + `SourceValueMapper` en composant générique
- **Contexte :** Identifié pendant T-035. Les deux composants sont ~95 % identiques (encodeAction/decodeAction, useMemo, UI table). Duplication volontaire pour ne pas toucher T-034 fraîchement mergé.
- **Description :** Créer un composant générique `<ValueMapper<T extends string> />` paramétré par : labels map, ordered keys, action type discriminator. Remplacer les deux composants par le générique. Garder le pattern `encodeAction`/`decodeAction` interne.
- **Priorité estimée :** Basse
- **Effort estimé :** Moyen (~2-3h incluant re-test manuel des deux)
- **Statut :** En attente de validation
```

- [ ] **Step 2: Mettre à jour le fichier de tâche**

Dans `taches/tache-035-import-source-mapping.md`, changer :

```markdown
**Statut :** spec validée, à implémenter
```

par :

```markdown
**Statut :** terminé (2026-04-24)
```

Ajouter en bas du fichier :

```markdown
## Résultat

Commits :
- `feat(types)` — `SourceMappingAction` + `ImportConfig.source_value_mapping`
- `feat(leads): add SOURCE_SYNONYMS` — dictionnaire conservateur + helpers
- `feat(leads): apply source_value_mapping in validateRow` — branche engine
- `feat(leads): add SourceValueMapper component` — clone UI
- `feat(leads): integrate SourceValueMapper into Step2` — intégration + gating

Testé manuellement avec un CSV de 6 sources couvrant les 3 actions (map / tag / ignore) + auto-suggestion conservatrice + blocage du bouton + combo tag-from-status + tag-from-source.

## Améliorations identifiées

- `A-035-01` · factoriser `StatusValueMapper` + `SourceValueMapper` en composant générique
```

- [ ] **Step 3: Commit final et push**

```bash
git add taches/tache-035-import-source-mapping.md ameliorations.md
git commit -m "docs(leads): mark T-035 (import source mapping) as done

Adds A-035-01 improvement (DRY-ify the two ValueMapper components).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push -u origin feature/remy-source-import-mapping
```

- [ ] **Step 4: Ouvrir la PR vers `develop`**

Run:
```bash
gh pr create --base develop --title "feat(leads): import wizard — mapping des sources (T-035)" --body "$(cat <<'EOF'
Suite de T-034 : applique le même pattern de mapping au champ \`source\` du CSV à l'étape 2 du wizard d'import.

## Summary
- Détection des valeurs uniques de la colonne source mappée, auto-suggestion par dictionnaire conservateur \`SOURCE_SYNONYMS\` (pas d'ambiguïté "Instagram" / "Facebook" seuls)
- 3 actions par valeur : mapper vers une source ClosRM / convertir en tag / ignorer
- Bouton 'Continuer' désactivé tant qu'une valeur n'est pas résolue
- Nouveau composant \`SourceValueMapper\` (clone volontaire de \`StatusValueMapper\` — facto future trackée dans \`A-035-01\`)

**Spec :** [docs/superpowers/specs/2026-04-24-import-source-mapping-design.md](docs/superpowers/specs/2026-04-24-import-source-mapping-design.md)
**Plan :** [docs/superpowers/plans/2026-04-24-import-source-mapping.md](docs/superpowers/plans/2026-04-24-import-source-mapping.md)

## Test plan
- [x] Parser : 13/13 cas unit-testés (dont 4 sources historiques de Rémy + régressions)
- [x] Engine : 7/7 cas simulés
- [x] Type-check clean
- [x] Import manuel 6 leads (3 auto-reconnues, 3 en tag)
- [x] Régression sans colonne source mappée : aucun blocage
- [x] Combo status-tag + source-tag : les deux tags présents
- [ ] Vérifier en prod après merge

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected : URL de la PR retournée.

---

## Self-Review (à effectuer avant de commencer)

- **Spec coverage :** chaque section de la spec a une tâche dédiée (types → T1, parser → T2, engine → T3, composant → T4, intégration → T5, tests → T6, finalisation → T7).
- **Placeholder scan :** tous les blocs de code sont complets, pas de "…" ou "TODO".
- **Type consistency :** `SourceMappingAction`, `source_value_mapping`, `extractUniqueSourceValues`, `suggestSourceMapping`, `SOURCE_SYNONYMS` — noms identiques dans toutes les tâches.
- **Compat descendante :** le fallback enum dans `validateRow` est conservé pour les appels programmatiques sans `source_value_mapping`.
- **Cohabitation avec T-034 :** les deux `ValueMapper` coexistent dans Step2, les deux tags (`tagFromStatus` + `tagFromSource`) sont injectés dans `data.tags` sans conflit.
