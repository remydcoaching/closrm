/**
 * Compile an email_template (visual blocks) + substitute booking variables
 * into the rendered HTML and subject.
 *
 * Variables supported (all optional in the template — undefined values are
 * replaced by an empty string):
 *   {{prenom_lead}}     — lead's first name
 *   {{nom_lead}}        — lead's last name
 *   {{nom_coach}}       — workspace's brand/coach display name
 *   {{date_rdv}}        — formatted FR long date (e.g. "mercredi 29 avril 2026")
 *   {{heure_rdv}}       — HH:mm
 *   {{lieu_rdv}}        — physical location name
 *   {{adresse_rdv}}     — physical location address
 *   {{lien_meet}}       — Google Meet URL
 *   {{nom_calendrier}}  — calendar's name
 *
 * Used by the booking confirmation email and the email reminder cron.
 */

import { compileBlocksV2 } from '@/lib/email/compiler-v2'
import type { EmailBlock } from '@/types'
import type { EmailPresetOverride } from '@/lib/email/design-types'

export interface BookingTemplateRow {
  subject: string
  blocks: EmailBlock[] | unknown
  preview_text: string | null
  preset_id: string | null
  preset_override: EmailPresetOverride | null
}

export interface BookingTemplateVariables {
  prenom_lead?: string
  nom_lead?: string
  nom_coach?: string
  date_rdv?: string
  heure_rdv?: string
  lieu_rdv?: string
  adresse_rdv?: string
  lien_meet?: string
  nom_calendrier?: string
}

export interface RenderedBookingTemplate {
  subject: string
  html: string
}

function substitute(text: string, vars: BookingTemplateVariables): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = (vars as Record<string, string | undefined>)[key]
    return value ?? ''
  })
}

/**
 * Substitute variables in every string field of an EmailBlock config,
 * recursively. Non-string leaves are returned untouched. Arrays/objects are
 * traversed.
 */
function substituteInBlock(value: unknown, vars: BookingTemplateVariables): unknown {
  if (typeof value === 'string') return substitute(value, vars)
  if (Array.isArray(value)) return value.map((v) => substituteInBlock(v, vars))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = substituteInBlock(v, vars)
    }
    return out
  }
  return value
}

export function renderBookingTemplate(
  template: BookingTemplateRow,
  vars: BookingTemplateVariables,
): RenderedBookingTemplate {
  const blocks = Array.isArray(template.blocks) ? (template.blocks as EmailBlock[]) : []
  const substitutedBlocks = substituteInBlock(blocks, vars) as EmailBlock[]

  const html = compileBlocksV2({
    blocks: substitutedBlocks,
    previewText: template.preview_text ? substitute(template.preview_text, vars) : null,
    presetId: template.preset_id,
    presetOverride: template.preset_override,
  })

  return {
    subject: substitute(template.subject || '', vars),
    html,
  }
}
