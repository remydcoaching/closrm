import Papa from 'papaparse'

import type { LeadSource, LeadStatus } from '@/types'

// ------------------------------------------------------------------
// Synonyms map: target field → known CSV header synonyms (FR + EN)
// ------------------------------------------------------------------
const COLUMN_SYNONYMS: Record<string, string[]> = {
  first_name:       ['prenom', 'prénom', 'first_name', 'firstname', 'first name', 'nom de bapteme'],
  last_name:        ['nom', 'nom de famille', 'last_name', 'lastname', 'last name', 'family name'],
  email:            ['email', 'e-mail', 'mail', 'adresse email', 'courriel'],
  phone:            ['telephone', 'téléphone', 'tel', 'phone', 'mobile', 'portable', 'numero', 'numéro'],
  instagram_handle: ['instagram', 'insta', 'ig', 'handle'],
  source:           ['source', 'origine', 'provenance', 'canal'],
  status:           ['statut', 'status', 'etat', 'état', 'pipeline'],
  tags:             ['tags', 'etiquettes', 'étiquettes', 'labels', 'categories', 'catégories'],
  notes:            ['notes', 'commentaires', 'remarques', 'description', 'observations'],
  created_at:       ['date', 'date de creation', 'date de création', 'created_at', 'cree le', 'créé le', 'ajoute le', 'ajouté le', 'date ajout'],
}

// All possible target fields
export const TARGET_FIELDS = Object.keys(COLUMN_SYNONYMS)

export type MappingConfidence = 'exact' | 'partial' | 'none'

export interface ColumnMapping {
  csvHeader: string
  targetField: string | null
  confidence: MappingConfidence
}

// ------------------------------------------------------------------
// Normalize: lowercase, trim, strip accents
// ------------------------------------------------------------------
function normalize(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

// ------------------------------------------------------------------
// Auto-map CSV headers to ClosRM fields
// ------------------------------------------------------------------
export function autoMapColumns(csvHeaders: string[]): ColumnMapping[] {
  const usedTargets = new Set<string>()

  return csvHeaders.map((header) => {
    const norm = normalize(header)

    // Pass 1: exact match
    for (const [target, synonyms] of Object.entries(COLUMN_SYNONYMS)) {
      if (usedTargets.has(target)) continue
      if (synonyms.some((s) => normalize(s) === norm)) {
        usedTargets.add(target)
        return { csvHeader: header, targetField: target, confidence: 'exact' as const }
      }
    }

    // Pass 2: inclusion match
    for (const [target, synonyms] of Object.entries(COLUMN_SYNONYMS)) {
      if (usedTargets.has(target)) continue
      if (synonyms.some((s) => norm.includes(normalize(s)) || normalize(s).includes(norm))) {
        usedTargets.add(target)
        return { csvHeader: header, targetField: target, confidence: 'partial' as const }
      }
    }

    return { csvHeader: header, targetField: null, confidence: 'none' as const }
  })
}

// ------------------------------------------------------------------
// Parse CSV file client-side
// ------------------------------------------------------------------
export interface CsvParseResult {
  headers: string[]
  rows: Record<string, string>[]
  totalRows: number
  detectedDelimiter: string
}

export function parseCsvFile(file: File): Promise<CsvParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete(results) {
        const headers = results.meta.fields || []
        const rows = results.data as Record<string, string>[]
        resolve({
          headers,
          rows,
          totalRows: rows.length,
          detectedDelimiter: results.meta.delimiter,
        })
      },
      error(err) {
        reject(new Error(`Erreur de parsing CSV : ${err.message}`))
      },
    })
  })
}

// ------------------------------------------------------------------
// Apply mapping: transform raw CSV rows to ClosRM lead objects
// ------------------------------------------------------------------
export function applyMapping(
  rows: Record<string, string>[],
  mapping: Record<string, string>, // csvHeader → targetField
): Record<string, string>[] {
  return rows.map((row) => {
    const mapped: Record<string, string> = {}
    for (const [csvHeader, targetField] of Object.entries(mapping)) {
      if (targetField && row[csvHeader] !== undefined) {
        mapped[targetField] = row[csvHeader]
      }
    }
    return mapped
  })
}

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
    'qualifié', 'qualifie',
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

  // Pass 2: inclusion match — the CSV value must CONTAIN the synonym
  // (not the reverse). This prevents short values like "Instagram" or
  // "Facebook" from matching multi-word synonyms like "instagram ads"
  // via substring, which would be a false positive.
  for (const [source, synonyms] of Object.entries(SOURCE_SYNONYMS) as [LeadSource, string[]][]) {
    if (synonyms.some((s) => {
      const ns = normalize(s)
      return ns.length >= 3 && norm.includes(ns)
    })) {
      return source
    }
  }

  return null
}
