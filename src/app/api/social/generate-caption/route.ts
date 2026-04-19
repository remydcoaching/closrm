import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { getBrief, getApiKey } from '@/lib/ai/brief'
import { callClaude } from '@/lib/ai/client'

export const maxDuration = 30

interface Body {
  platform: 'instagram' | 'youtube' | 'both'
  mediaType: 'IMAGE' | 'VIDEO' | 'SHORT' | 'CAROUSEL' | null
  hint?: string
  currentCaption?: string
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const body = (await request.json()) as Body
    const brief = await getBrief(workspaceId)
    const apiKey = await getApiKey(workspaceId)
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Clé API non configurée. Allez dans Paramètres > Assistant IA.' },
        { status: 400 },
      )
    }

    const platformTxt =
      body.platform === 'instagram'
        ? 'Instagram (Reel ou post)'
        : body.platform === 'youtube'
          ? 'YouTube (titre + description)'
          : 'Instagram ET YouTube simultanément'

    const formatTxt =
      body.mediaType === 'SHORT'
        ? 'une vidéo verticale courte (Reel / YouTube Short, ≤60s)'
        : body.mediaType === 'VIDEO'
          ? 'une vidéo longue'
          : body.mediaType === 'CAROUSEL'
            ? 'un carrousel de photos'
            : body.mediaType === 'IMAGE'
              ? 'une image'
              : 'un post'

    const prompt = `Tu es un copywriter expert en contenu court pour coachs indépendants sur les réseaux sociaux.

CONTEXTE DU COACH :
${brief?.generated_brief ?? 'Pas de brief configuré — utilise un ton chaleureux et direct.'}

TÂCHE :
Génère une caption pour ${formatTxt} à publier sur ${platformTxt}.

${body.hint ? `SUJET / IDÉE DU COACH :\n${body.hint}\n` : ''}
${body.currentCaption ? `CAPTION ACTUELLE (à améliorer) :\n${body.currentCaption}\n` : ''}

CONTRAINTES :
- Français uniquement
- Accrocheur dès la première ligne (hook fort)
- Max 200 mots
- Termine par un CTA clair (commenter, partager, sauvegarder, etc.)
- 5-8 hashtags pertinents à la fin, sur la dernière ligne, séparés par des espaces
- Pas d'emojis excessifs (1-3 bien placés max)
- Pas de markdown, pas de guillemets autour de la réponse

Renvoie UNIQUEMENT la caption finale, rien d'autre.`

    const result = await callClaude(prompt, apiKey, 'claude-sonnet-4-20250514')
    if (!result.trim()) throw new Error('Réponse vide du modèle')

    const lines = result.trim().split('\n').filter(Boolean)
    let hashtagLine = ''
    let captionBody = result.trim()
    if (lines.length > 1) {
      const last = lines[lines.length - 1].trim()
      const tokens = last.split(/\s+/)
      if (tokens.length >= 2 && tokens.every((t) => t.startsWith('#'))) {
        hashtagLine = last
        captionBody = lines.slice(0, -1).join('\n').trim()
      }
    }

    return NextResponse.json({
      caption: captionBody,
      hashtags: hashtagLine,
    })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    console.error('[generate-caption] error:', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
