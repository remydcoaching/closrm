import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createLeadSchema, leadFiltersSchema } from '@/lib/validations/leads'
import { fireTriggersForEvent } from '@/lib/workflows/trigger'
import { sendPushToWorkspace } from '@/lib/push/send-to-workspace'

export async function GET(request: NextRequest) {
  try {
    const { workspaceId, userId, role } = await getWorkspaceId()
    const supabase = await createClient()

    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())
    const filters = leadFiltersSchema.parse(searchParams)

    let query = supabase
      .from('leads')
      .select('id, first_name, last_name, phone, email, status, source, tags, reached, call_attempts, notes, assigned_to, instagram_handle, meta_campaign_id, meta_adset_id, meta_ad_id, created_at, updated_at', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order(filters.sort, { ascending: filters.order === 'asc' })

    // Filtrage par rôle (sécurité multi-tenant)
    if (role === 'setter') {
      // Setter voit ses leads assignés + les leads non assignés
      query = query.or(`assigned_to.eq.${userId},assigned_to.is.null`)
    } else if (role === 'closer') {
      // Closer voit uniquement ses leads en phase closing
      query = query
        .eq('assigned_to', userId)
        .in('status', ['closing_planifie', 'no_show_closing', 'clos'])
    }
    // admin: pas de filtre supplémentaire (voit tout)

    // Filtre par assigned_to (query param explicite)
    if (filters.assigned_to) {
      query = query.eq('assigned_to', filters.assigned_to)
    }

    // Filtre par statut (liste séparée par virgule)
    if (filters.status) {
      const statuses = filters.status.split(',')
      query = query.in('status', statuses)
    }

    // Filtre par source (liste séparée par virgule)
    if (filters.source) {
      const sources = filters.source.split(',')
      query = query.in('source', sources)
    }

    // Filtre par plage de dates (sur le champ choisi)
    if (filters.date_from) {
      query = query.gte(filters.date_field, filters.date_from)
    }
    if (filters.date_to) {
      query = query.lte(filters.date_field, filters.date_to)
    }

    // Recherche texte (prénom, nom, email, téléphone)
    if (filters.search) {
      const s = filters.search.trim()
      if (s) {
        // Escape special PostgREST characters in search term
        const escaped = s.replace(/[%_]/g, '\\$&')
        query = query.or(
          `first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,email.ilike.%${escaped}%,phone.ilike.%${escaped}%,instagram_handle.ilike.%${escaped}%`
        )
      }
    }

    // Filtre par batch d'import
    if (filters.import_batch_id) {
      query = query.eq('import_batch_id', filters.import_batch_id)
    }

    // Filtre par publicité Meta
    if (filters.meta_campaign_id) query = query.eq('meta_campaign_id', filters.meta_campaign_id)
    if (filters.meta_adset_id) query = query.eq('meta_adset_id', filters.meta_adset_id)
    if (filters.meta_ad_id) query = query.eq('meta_ad_id', filters.meta_ad_id)

    // Filtre par tags (au moins un des tags listés)
    if (filters.tags) {
      const tags = filters.tags.split(',').filter(Boolean)
      if (tags.length > 0) {
        query = query.overlaps('tags', tags)
      }
    }

    // Pagination
    const from = (filters.page - 1) * filters.per_page
    const to = from + filters.per_page - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      console.error('[API /leads] Supabase error:', error.message, '| filters:', JSON.stringify(filters))
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const total = count ?? 0
    const total_pages = Math.ceil(total / filters.per_page)

    return NextResponse.json({
      data: data ?? [],
      meta: {
        total,
        page: filters.page,
        per_page: filters.per_page,
        total_pages,
      },
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

interface InlineWorkflowStep {
  channel: 'whatsapp' | 'email' | 'instagram_dm' | 'manuel'
  delay_days: number
  template_text: string
}

interface InlineWorkflow {
  steps: InlineWorkflowStep[]
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const body = await request.json()
    const inlineWorkflow: InlineWorkflow | undefined = body.inline_workflow
    const parsed = createLeadSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    // Clean instagram handle: strip @ prefix
    const instagramHandle = parsed.data.instagram_handle
      ? parsed.data.instagram_handle.replace(/^@/, '')
      : null

    // Use instagram handle as first_name fallback if not provided
    const firstName = parsed.data.first_name || instagramHandle || 'Inconnu'

    const { data, error } = await supabase
      .from('leads')
      .insert({
        workspace_id: workspaceId,
        status: 'nouveau',
        call_attempts: 0,
        reached: false,
        ...parsed.data,
        first_name: firstName,
        email: parsed.data.email || null,
        notes: parsed.data.notes || null,
        instagram_handle: instagramHandle || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Link existing IG conversation if handle provided
    if (instagramHandle) {
      const { data: conversations } = await supabase
        .from('ig_conversations')
        .select('id')
        .eq('workspace_id', workspaceId)
        .ilike('participant_username', instagramHandle)
        .limit(1)

      if (conversations && conversations.length > 0) {
        await supabase
          .from('ig_conversations')
          .update({ lead_id: data.id })
          .eq('id', conversations[0].id)
      }
    }

    // Create follow-ups directly for this lead if inline workflow provided
    if (inlineWorkflow && inlineWorkflow.steps && inlineWorkflow.steps.length > 0) {
      const now = new Date()
      const followUpsToInsert = inlineWorkflow.steps.map((step) => {
        const scheduledAt = new Date(now)
        scheduledAt.setDate(scheduledAt.getDate() + step.delay_days)
        if (step.delay_days > 0) {
          scheduledAt.setHours(9, 0, 0, 0)
        }
        return {
          workspace_id: workspaceId,
          lead_id: data.id,
          reason: step.template_text,
          scheduled_at: scheduledAt.toISOString(),
          channel: step.channel,
          status: 'en_attente',
          notes: null,
        }
      })

      await supabase.from('follow_ups').insert(followUpsToInsert)
    }

    // Fire workflow triggers (non-blocking)
    fireTriggersForEvent(workspaceId, 'new_lead', {
      lead_id: data.id,
      source: data.source,
    }).catch(() => {})

    // Push notif mobile aux coachs du workspace (non-bloquant)
    void sendPushToWorkspace({
      workspaceId,
      type: 'new_lead',
      title: 'Nouveau prospect',
      body: `${data.first_name} ${data.last_name}`.trim() || 'Nouveau lead',
      data: { entity_type: 'lead', entity_id: data.id },
    })

    // Fire additional trigger if IG handle provided
    if (instagramHandle) {
      fireTriggersForEvent(workspaceId, 'lead_with_ig_handle', {
        lead_id: data.id,
        instagram_handle: instagramHandle,
      }).catch(() => {})
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
