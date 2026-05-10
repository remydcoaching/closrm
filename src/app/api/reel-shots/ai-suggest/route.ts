import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { callClaude } from '@/lib/ai/client'
import { getApiKey } from '@/lib/ai/brief'

/**
 * POST /api/reel-shots/ai-suggest
 * Body: { social_post_ids?: string[] }  // si absent, tout le workspace non placé
 *
 * Demande à Claude Haiku de proposer un lieu pour chaque phrase non placée.
 * Met à jour ai_suggested_location (mais PAS location — l'user override).
 * Retourne la liste des suggestions.
 */
export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const body = await request.json().catch(() => ({}))
    const ids: string[] | undefined = Array.isArray(body.social_post_ids)
      ? body.social_post_ids.filter((i: unknown) => typeof i === 'string')
      : undefined

    // 1. Lit les shots non placés
    let q = supabase
      .from('reel_shots')
      .select('id, text, social_post_id')
      .eq('workspace_id', workspaceId)
      .is('location', null)
      .eq('done', false)
    if (ids && ids.length > 0) q = q.in('social_post_id', ids)

    const { data: shots, error: sErr } = await q
    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 })
    if (!shots || shots.length === 0) {
      return NextResponse.json({ suggestions: [], applied: 0, total: 0 })
    }

    // 2. Lit les lieux connus (autocomplete + cohérence)
    const { data: locRows } = await supabase
      .from('reel_shots')
      .select('location')
      .eq('workspace_id', workspaceId)
      .not('location', 'is', null)
    const knownLocations = [...new Set((locRows ?? []).map(r => r.location).filter(Boolean) as string[])]

    const apiKey = await getApiKey(workspaceId)
    if (!apiKey) {
      return NextResponse.json({
        error: 'Configure ta clé API Anthropic dans le brief IA (Paramètres → Coach IA)',
      }, { status: 400 })
    }

    // 3. Prompt Claude Haiku — JSON strict
    const prompt = `Tu es l'assistant tournage d'un coach. Pour chaque phrase d'un script de reel, identifie le LIEU de tournage le plus probable (ex: poulie, banc plat, sol, devant le miroir...).

Lieux déjà utilisés par le coach (privilégie ceux-ci pour cohérence) :
${knownLocations.length > 0 ? knownLocations.map(l => `- ${l}`).join('\n') : '(aucun pour l\'instant — tu peux en proposer)'}

Phrases à classer :
${shots.map((s, i) => `${i + 1}. "${s.text}"`).join('\n')}

Réponds UNIQUEMENT par un JSON array de la forme :
[{"phrase_index": 1, "location": "Poulie"}, {"phrase_index": 2, "location": "Banc plat"}, ...]

Une entrée par phrase. Si tu ne peux vraiment pas deviner, mets "location": null. Pas de texte avant ou après le JSON.`

    let raw = ''
    try {
      raw = await callClaude(prompt, apiKey, 'claude-haiku-4-5-20251001')
    } catch (e) {
      return NextResponse.json({ error: 'Appel IA: ' + (e as Error).message }, { status: 500 })
    }

    // Parse — tolère un wrapper markdown ou texte autour
    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'IA: réponse non-JSON', raw }, { status: 500 })
    }
    interface Suggestion { phrase_index: number; location: string | null }
    let parsed: Suggestion[]
    try {
      parsed = JSON.parse(jsonMatch[0]) as Suggestion[]
    } catch {
      return NextResponse.json({ error: 'IA: JSON invalide', raw }, { status: 500 })
    }

    // 4. Apply : update ai_suggested_location ET location (V1 = placement direct, plus user-friendly)
    const suggestions: { id: string; location: string | null }[] = []
    let applied = 0
    for (const sug of parsed) {
      const idx = sug.phrase_index - 1
      if (idx < 0 || idx >= shots.length) continue
      const shotId = shots[idx].id
      const loc = sug.location && typeof sug.location === 'string' ? sug.location.trim() || null : null
      suggestions.push({ id: shotId, location: loc })
      if (loc) {
        await supabase
          .from('reel_shots')
          .update({ ai_suggested_location: loc, location: loc })
          .eq('id', shotId)
          .eq('workspace_id', workspaceId)
        applied++
      }
    }

    return NextResponse.json({ suggestions, applied, total: shots.length })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
