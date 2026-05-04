import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { getBrief, getApiKey } from '@/lib/ai/brief'
import { callClaude } from '@/lib/ai/client'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60

interface Body {
  hook?: string
  title?: string
  pillar_id?: string | null
  content_kind?: 'post' | 'story' | 'reel'
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const body = (await request.json()) as Body

    if (!body.hook && !body.title) {
      return NextResponse.json(
        { error: 'Un hook ou un titre est requis pour générer le script.' },
        { status: 400 }
      )
    }

    const brief = await getBrief(workspaceId)
    const apiKey = await getApiKey(workspaceId)
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Clé API non configurée. Allez dans Paramètres > Assistant IA.' },
        { status: 400 }
      )
    }

    let pillarName: string | null = null
    if (body.pillar_id) {
      const supabase = await createClient()
      const { data } = await supabase
        .from('ig_content_pillars')
        .select('name')
        .eq('id', body.pillar_id)
        .eq('workspace_id', workspaceId)
        .maybeSingle()
      pillarName = data?.name ?? null
    }

    const kindLabel =
      body.content_kind === 'story' ? 'story Instagram (24h, format vertical, durée totale ≤ 60s en plusieurs slides)'
      : body.content_kind === 'reel' ? 'reel/short vidéo verticale (durée ≤ 60s)'
      : 'post réseaux sociaux'

    const prompt = `Tu es un scénariste-copywriter expert en contenu court pour coachs indépendants sur les réseaux sociaux.

CONTEXTE DU COACH :
${brief?.generated_brief ?? 'Pas de brief — utilise un ton chaleureux, direct, et orienté résultat.'}

TÂCHE :
Génère un script complet pour un ${kindLabel}.
${pillarName ? `Type de contenu (pillar) : ${pillarName}` : ''}
${body.hook ? `Hook (à conserver tel quel ou très peu modifié) :\n"${body.hook}"\n` : ''}
${body.title ? `Sujet : ${body.title}` : ''}

CONTRAINTES :
- Français
- Structure claire en sections : HOOK, INTRO/CONTEXTE, CORPS (3 points clés ou démonstration), CTA
- Chaque section : tag entre crochets en MAJUSCULES suivi du texte (ex : [HOOK] / [INTRO] / [CORPS] / [CTA])
- Indique aussi les indications de tournage entre parenthèses (ex : "(face caméra)", "(plan large)", "(texte à l'écran)")
- Pas d'emojis dans le script
- Reste actionnable et concret, pas de blabla
- Total ≤ 250 mots

Renvoie UNIQUEMENT le script structuré, rien d'autre.`

    const result = await callClaude(prompt, apiKey, 'claude-sonnet-4-20250514')
    if (!result.trim()) throw new Error('Réponse vide du modèle')

    return NextResponse.json({ script: result.trim() })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
