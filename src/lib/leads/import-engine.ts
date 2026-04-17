import { SupabaseClient } from '@supabase/supabase-js'
import { createLeadSchema } from '@/lib/validations/leads'
import { fireTriggersForEvent } from '@/lib/workflows/trigger'
import type {
  ImportConfig,
  ImportDedupStrategy,
  ImportError,
  ImportPreviewResult,
  LeadSource,
  LeadStatus,
} from '@/types'

// ------------------------------------------------------------------
// Phone normalization: keep digits and +
// ------------------------------------------------------------------
function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '')
}

// ------------------------------------------------------------------
// Email normalization
// ------------------------------------------------------------------
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

// ------------------------------------------------------------------
// Validate a single row with Zod, applying defaults from config
// ------------------------------------------------------------------
function validateRow(
  row: Record<string, string>,
  config: ImportConfig,
  rowIndex: number,
): { valid: boolean; data?: Record<string, unknown>; errors: ImportError[] } {
  const errors: ImportError[] = []

  // Prepare data with defaults
  const normalizedPhone = row.phone ? normalizePhone(row.phone) : ''
  const prepared: Record<string, unknown> = {
    first_name: row.first_name || '',
    last_name: row.last_name || '',
    phone: normalizedPhone,
    email: row.email ? normalizeEmail(row.email) : '',
    source: row.source || config.default_source || 'manuel',
    status: row.status || config.default_status,
    instagram_handle: row.instagram_handle
      ? row.instagram_handle.replace(/^@/, '')
      : '',
    tags: row.tags
      ? row.tags.split(';').map((t: string) => t.trim()).filter(Boolean)
      : [],
    notes: row.notes || '',
  }

  // Add batch tags
  if (config.batch_tags.length > 0) {
    prepared.tags = [...(prepared.tags as string[]), ...config.batch_tags]
  }

  // Validate phone: must be 8-15 digits (international standard)
  if (normalizedPhone && !/^\+?\d{8,15}$/.test(normalizedPhone)) {
    errors.push({
      row: rowIndex + 1,
      field: 'phone',
      value: row.phone || '',
      reason: `Numéro de téléphone invalide (${normalizedPhone.length} chiffres, attendu 8-15)`,
    })
    return { valid: false, errors }
  }

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

  // Validate status against enum
  const validStatuses: LeadStatus[] = ['nouveau', 'setting_planifie', 'no_show_setting', 'closing_planifie', 'no_show_closing', 'clos', 'dead']
  if (!validStatuses.includes(prepared.status as LeadStatus)) {
    prepared.status = config.default_status
  }

  const parsed = createLeadSchema.safeParse(prepared)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push({
        row: rowIndex + 1,
        field: issue.path.join('.') || 'unknown',
        value: String(row[issue.path[0] as string] || ''),
        reason: issue.message,
      })
    }
    return { valid: false, errors }
  }

  return { valid: true, data: { ...parsed.data, status: prepared.status } as Record<string, unknown>, errors: [] }
}

// ------------------------------------------------------------------
// Load existing leads for dedup (single batch query)
// ------------------------------------------------------------------
interface DedupIndex {
  byEmail: Map<string, Record<string, unknown>>
  byPhone: Map<string, Record<string, unknown>>
}

async function loadDedupIndex(
  supabase: SupabaseClient,
  workspaceId: string,
  strategy: ImportDedupStrategy,
): Promise<DedupIndex> {
  const index: DedupIndex = { byEmail: new Map(), byPhone: new Map() }
  if (strategy === 'none') return index

  const { data } = await supabase
    .from('leads')
    .select('*')
    .eq('workspace_id', workspaceId)

  if (!data) return index

  for (const lead of data) {
    if (lead.email) index.byEmail.set(normalizeEmail(lead.email), lead)
    if (lead.phone) index.byPhone.set(normalizePhone(lead.phone), lead)
  }

  return index
}

function findDuplicateInIndex(
  index: DedupIndex,
  row: Record<string, unknown>,
  strategy: ImportDedupStrategy,
): Record<string, unknown> | null {
  if (strategy === 'none') return null

  const email = row.email as string
  const phone = row.phone as string

  if (strategy === 'email') {
    if (!email) return null
    return index.byEmail.get(email) || null
  }

  if (strategy === 'phone') {
    if (!phone) return null
    return index.byPhone.get(phone) || null
  }

  // email_and_phone: both must match the SAME lead
  if (strategy === 'email_and_phone') {
    if (!email || !phone) return null
    const byEmail = index.byEmail.get(email)
    const byPhone = index.byPhone.get(phone)
    if (byEmail && byPhone && (byEmail as Record<string, string>).id === (byPhone as Record<string, string>).id) {
      return byEmail
    }
    return null
  }

  return null
}

// ------------------------------------------------------------------
// Preview: dry-run the import and return diff stats
// ------------------------------------------------------------------
export async function previewImport(
  supabase: SupabaseClient,
  workspaceId: string,
  rows: Record<string, string>[],
  config: ImportConfig,
): Promise<ImportPreviewResult> {
  const index = await loadDedupIndex(supabase, workspaceId, config.dedup_strategy)

  let toCreate = 0
  let toUpdate = 0
  let toSkip = 0
  const errorDetails: ImportError[] = []
  const sampleCreates: Record<string, string>[] = []
  const sampleUpdates: { before: Record<string, string>; after: Record<string, string> }[] = []

  for (let i = 0; i < rows.length; i++) {
    const { valid, data, errors } = validateRow(rows[i], config, i)

    if (!valid) {
      errorDetails.push(...errors)
      continue
    }

    const existing = findDuplicateInIndex(index, data!, config.dedup_strategy)

    if (existing) {
      if (config.dedup_action === 'skip') {
        toSkip++
      } else if (config.dedup_action === 'update') {
        toUpdate++
        if (sampleUpdates.length < 5) {
          sampleUpdates.push({
            before: existing as Record<string, string>,
            after: data as Record<string, string>,
          })
        }
      } else {
        toCreate++
        if (sampleCreates.length < 5) {
          sampleCreates.push(data as Record<string, string>)
        }
      }
    } else {
      toCreate++
      if (sampleCreates.length < 5) {
        sampleCreates.push(data as Record<string, string>)
      }
    }
  }

  return {
    to_create: toCreate,
    to_update: toUpdate,
    to_skip: toSkip,
    errors: errorDetails.length,
    error_details: errorDetails,
    sample_creates: sampleCreates,
    sample_updates: sampleUpdates,
  }
}

// ------------------------------------------------------------------
// Execute import: insert/update leads in chunks
// ------------------------------------------------------------------
export async function executeImport(
  supabase: SupabaseClient,
  workspaceId: string,
  batchId: string,
  rows: Record<string, string>[],
  config: ImportConfig,
): Promise<void> {
  const index = await loadDedupIndex(supabase, workspaceId, config.dedup_strategy)

  let createdCount = 0
  let updatedCount = 0
  let skippedCount = 0
  const allErrors: ImportError[] = []

  const CHUNK_SIZE = 100

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE)
    const toInsert: Record<string, unknown>[] = []

    for (let j = 0; j < chunk.length; j++) {
      const rowIndex = i + j
      const { valid, data, errors } = validateRow(chunk[j], config, rowIndex)

      if (!valid) {
        allErrors.push(...errors)
        continue
      }

      const existing = findDuplicateInIndex(index, data!, config.dedup_strategy)

      if (existing) {
        if (config.dedup_action === 'skip') {
          skippedCount++
        } else if (config.dedup_action === 'update') {
          // Update only non-empty fields
          const updateData: Record<string, unknown> = {}
          for (const [key, value] of Object.entries(data!)) {
            if (value !== '' && value !== null && value !== undefined) {
              updateData[key] = value
            }
          }
          await supabase
            .from('leads')
            .update(updateData)
            .eq('id', (existing as Record<string, string>).id)
          updatedCount++
        } else {
          // create anyway
          toInsert.push({
            ...data,
            workspace_id: workspaceId,
            import_batch_id: batchId,
            call_attempts: 0,
            reached: false,
          })
        }
      } else {
        toInsert.push({
          ...data,
          workspace_id: workspaceId,
          import_batch_id: batchId,
          call_attempts: 0,
          reached: false,
        })
      }
    }

    // Bulk insert the chunk
    if (toInsert.length > 0) {
      const { error } = await supabase.from('leads').insert(toInsert)
      if (error) {
        allErrors.push({
          row: i + 1,
          field: 'batch',
          value: '',
          reason: `Erreur d'insertion batch : ${error.message}`,
        })
      } else {
        createdCount += toInsert.length
      }
    }

    // Update batch progress
    await supabase
      .from('lead_import_batches')
      .update({
        created_count: createdCount,
        updated_count: updatedCount,
        skipped_count: skippedCount,
        error_count: allErrors.length,
        errors: allErrors,
      })
      .eq('id', batchId)
  }

  // Finalize batch
  await supabase
    .from('lead_import_batches')
    .update({
      status: allErrors.length > 0 && createdCount === 0 && updatedCount === 0 ? 'failed' : 'completed',
      created_count: createdCount,
      updated_count: updatedCount,
      skipped_count: skippedCount,
      error_count: allErrors.length,
      errors: allErrors,
      completed_at: new Date().toISOString(),
    })
    .eq('id', batchId)

  // Fire workflow trigger
  fireTriggersForEvent(workspaceId, 'lead_imported', {
    batch_id: batchId,
    lead_count: createdCount + updatedCount,
    source: config.default_source || undefined,
  }).catch(() => {})
}
