import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { getApiKey } from '@/lib/ai/brief'
import { callClaude } from '@/lib/ai/client'

export async function POST(req: NextRequest) {
  try {
    const { lead_id, booking_id } = await req.json()
    if (!lead_id) return NextResponse.json({ error: 'lead_id requis' }, { status: 400 })

    const { workspaceId, userId } = await getWorkspaceId()
    const supabase = await createClient()

    if (booking_id) {
      const { data: cached } = await supabase
        .from('ai_call_briefs')
        .select('brief_content, generated_at')
        .eq('lead_id', lead_id)
        .eq('booking_id', booking_id)
        .maybeSingle()

      if (cached && Date.now() - new Date(cached.generated_at).getTime() < 86400000) {
        return NextResponse.json({ brief: cached.brief_content, cached: true })
      }
    }

    const { data: lead } = await supabase
      .from('leads')
      .select('first_name, last_name, source, status, tags, notes, email, phone')
      .eq('id', lead_id)
      .single()

    if (!lead) return NextResponse.json({ error: 'Lead introuvable' }, { status: 404 })

    const apiKey = await getApiKey(workspaceId)
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Clé API IA non configurée. Va dans Paramètres > Assistant IA.' },
        { status: 400 }
      )
    }

    const prompt = `Tu es un assistant pour un coach qui s'apprête à faire un call de closing.
Génère un brief court et actionnable basé sur ce lead.

Lead : ${lead.first_name} ${lead.last_name}
Source : ${lead.source ?? 'inconnue'}
Statut : ${lead.status}
Tags : ${(lead.tags ?? []).join(', ') || 'aucun'}
Notes : ${lead.notes ?? 'aucune'}

Renvoie UNIQUEMENT du JSON strict avec cette structure :
{
  "summary": ["3 puces max décrivant le lead"],
  "questions": ["2-3 questions d'ouverture suggérées"],
  "risks": ["1-2 risques/objections probables"]
}`

    const response = await callClaude(prompt, apiKey, 'claude-sonnet-4-20250514')

    let brief: { summary: string[]; questions: string[]; risks: string[] }
    try {
      const cleaned = response.replace(/```json\n?|\n?```/g, '').trim()
      brief = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({ error: 'Réponse IA invalide' }, { status: 500 })
    }

    if (booking_id) {
      await supabase.from('ai_call_briefs').upsert(
        {
          workspace_id: workspaceId,
          lead_id,
          booking_id,
          brief_content: brief,
          generated_by: userId,
        },
        { onConflict: 'lead_id,booking_id' }
      )
    }

    return NextResponse.json({ brief, cached: false })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur' },
      { status: 500 }
    )
  }
}
