/**
 * A-028a-02 — API publique de soumission de formulaire funnel.
 *
 * POST /api/public/f/submit
 * Body: { funnel_page_id, fields: { email, first_name, ... }, visitor_id? }
 *
 * Actions :
 * 1. Résout le workspace_id depuis funnel_page_id
 * 2. Cherche un lead existant (par email puis phone)
 * 3. Crée un nouveau lead si non trouvé (source: 'funnel', tag: 'funnel:{funnel_id}')
 * 4. Fire le trigger 'new_lead' du workflow engine
 * 5. Incrémente submissions_count sur la funnel_page
 * 6. Enregistre l'événement 'form_submit' dans funnel_events
 *
 * Retourne { ok: true, lead_id } ou une erreur.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { fireTriggersForEvent } from '@/lib/workflows/trigger'
import { sendPushToWorkspace } from '@/lib/push/send-to-workspace'
import { z } from 'zod'

const submitSchema = z.object({
  funnel_page_id: z.string(),
  fields: z.record(z.string(), z.string()),
  visitor_id: z.string().optional(),
})

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 })
  }

  const parsed = submitSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Données invalides.', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const { funnel_page_id, fields, visitor_id } = parsed.data
  const supabase = createServiceClient()

  // Resolve workspace_id + funnel_id from funnel_page
  const { data: page, error: pageErr } = await supabase
    .from('funnel_pages')
    .select('workspace_id, funnel_id, submissions_count')
    .eq('id', funnel_page_id)
    .single()

  if (pageErr || !page) {
    return NextResponse.json({ error: 'Page introuvable.' }, { status: 404 })
  }

  const { workspace_id, funnel_id } = page

  // ── Mapping intelligent des clés ──
  // Le coach peut avoir mis "Prénom" (→ clé auto "prenom") ou "first_name".
  // On cherche dans les variantes courantes pour chaque colonne du lead.
  function findField(...keys: string[]): string | null {
    for (const k of keys) {
      const val = fields[k]?.trim()
      if (val) return val
    }
    return null
  }

  const email = findField('email', 'e_mail', 'mail', 'adresse_email')
  const phone = findField('phone', 'telephone', 'tel', 'numero', 'numero_de_telephone')
  const firstName = findField('first_name', 'prenom', 'firstname') || ''
  const lastName = findField('last_name', 'nom', 'nom_de_famille', 'lastname') || ''

  // Champs custom = tout ce qui n'est pas mappé sur une colonne du lead
  const knownKeys = new Set([
    'email', 'e_mail', 'mail', 'adresse_email',
    'phone', 'telephone', 'tel', 'numero', 'numero_de_telephone',
    'first_name', 'prenom', 'firstname',
    'last_name', 'nom', 'nom_de_famille', 'lastname',
  ])
  const customFields: Record<string, string> = {}
  for (const [k, v] of Object.entries(fields)) {
    if (!knownKeys.has(k) && v.trim()) {
      customFields[k] = v.trim()
    }
  }

  // Formater les champs custom en texte lisible pour les notes
  const customNotes = Object.entries(customFields)
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
    .join('\n')
  const notesText = customNotes
    ? `Réponses formulaire funnel :\n${customNotes}`
    : ''

  if (!email && !phone && !firstName) {
    return NextResponse.json({ error: 'Au moins un champ de contact est requis (email, téléphone ou prénom).' }, { status: 422 })
  }

  // Find existing lead
  let leadId: string | null = null

  if (email) {
    const { data: leadByEmail } = await supabase
      .from('leads')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('email', email)
      .maybeSingle()
    if (leadByEmail) leadId = leadByEmail.id
  }

  if (!leadId && phone) {
    const { data: leadByPhone } = await supabase
      .from('leads')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('phone', phone)
      .maybeSingle()
    if (leadByPhone) leadId = leadByPhone.id
  }

  // Create lead if not found
  if (!leadId) {
    const tags = [`funnel:${funnel_id}`]

    const { data: newLead, error: leadError } = await supabase
      .from('leads')
      .insert({
        workspace_id,
        first_name: firstName || 'Inconnu',
        last_name: lastName,
        email: email ?? null,
        phone: phone ?? null,
        source: 'funnel',
        status: 'nouveau',
        tags,
        notes: notesText,
      })
      .select('id')
      .single()

    if (leadError || !newLead) {
      console.error('[funnel-submit] Lead creation error:', leadError)
      return NextResponse.json({ error: 'Erreur lors de la création du lead.' }, { status: 500 })
    }

    leadId = newLead.id

    // Fire new_lead trigger
    fireTriggersForEvent(workspace_id, 'new_lead', {
      lead_id: newLead.id,
      source: 'funnel',
    }).catch(() => {})

    // Push notification (non-blocking)
    const leadName = `${firstName || 'Inconnu'} ${lastName ?? ''}`.trim()
    sendPushToWorkspace({
      workspaceId: workspace_id,
      type: 'new_lead',
      title: 'Nouveau lead',
      body: `${leadName} vient d'arriver via un formulaire funnel.`,
      data: { entity_type: 'lead', entity_id: newLead.id },
    }).catch(() => {})
  }

  // Increment submissions_count
  await supabase
    .from('funnel_pages')
    .update({ submissions_count: (page.submissions_count ?? 0) + 1 })
    .eq('id', funnel_page_id)

  // Record form_submit event
  await supabase.from('funnel_events').insert({
    funnel_page_id,
    workspace_id,
    event_type: 'form_submit',
    visitor_id: visitor_id ?? null,
    metadata: { fields, lead_id: leadId },
  })

  return NextResponse.json({ ok: true, lead_id: leadId }, { status: 201 })
}
