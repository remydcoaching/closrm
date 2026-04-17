import Papa from 'papaparse'

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
