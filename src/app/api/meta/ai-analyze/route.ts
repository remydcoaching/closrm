import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { callClaude } from '@/lib/ai/client'
import { getApiKey } from '@/lib/ai/brief'

/**
 * Analyse IA d'un ensemble de campagnes, ad sets ou ads Meta.
 *
 * Le client envoie toutes les lignes affichées en mémoire (déjà triées et
 * filtrées), pas besoin de re-fetcher Meta. On construit un prompt
 * comparatif et structuré pour Claude Sonnet, qui retourne une analyse
 * globale en markdown.
 */

interface AnalyzeRow {
  id: string
  name: string
  data: Record<string, unknown>
}

interface AnalyzeBody {
  level: 'campaign' | 'adset' | 'ad'
  rows: AnalyzeRow[]
  dateFrom?: string
  dateTo?: string
}

const LEVEL_FR: Record<AnalyzeBody['level'], string> = {
  campaign: 'campagne',
  adset: 'ad set',
  ad: 'ad (création)',
}

const LEVEL_FR_PLURAL: Record<AnalyzeBody['level'], string> = {
  campaign: 'campagnes',
  adset: 'ad sets',
  ad: 'ads (créations)',
}

function buildPrompt(body: AnalyzeBody): string {
  const levelFr = LEVEL_FR[body.level]
  const levelPlural = LEVEL_FR_PLURAL[body.level]
  const period = body.dateFrom && body.dateTo
    ? `Période analysée : du ${body.dateFrom} au ${body.dateTo}.`
    : 'Période : 7 derniers jours.'

  const rowsJson = body.rows.map((r, i) => {
    return `### ${i + 1}. ${r.name}\n\`\`\`json\n${JSON.stringify(r.data, null, 2)}\n\`\`\``
  }).join('\n\n')

  const count = body.rows.length

  return `Tu es un expert media buyer Meta Ads qui audite des comptes pour un coach sportif indépendant. Tu connais parfaitement les funnels de vente B2C par appel téléphonique (ticket 1000–3000€).

Tu vas analyser **${count} ${count > 1 ? levelPlural : levelFr}** en comparatif.

${period}

## Données complètes (Meta insights + CRM rattachement)
${rowsJson}

## Tâche

Donne une analyse **globale, comparative et actionable** en markdown (max 500 mots), structurée comme suit :

### 🎯 Vue d'ensemble
1 paragraphe : santé globale du compte au niveau ${levelFr}, où va le budget, quels sont les leviers actuels.

### 🏆 Top performers
Identifie nominativement les 1-3 ${levelPlural} qui sortent du lot, avec UN chiffre clé qui le prouve. Sois précis (cite les noms exacts).

### ❌ À couper / pauser
Identifie nominativement les ${levelPlural} qui plombent le compte. Explique pourquoi en 1 ligne chacun.

### 🔄 Patterns observés
2-3 patterns qui ressortent (ex: "les ${levelPlural} avec hook < 30% ont toutes un CPL > 25€", "les ads vidéo > 45s convertissent 2x mieux", etc.). Sois CONCRET et basé sur les chiffres.

### 🔧 3 actions concrètes (priorisées)
3 actions max. Pour chacune : quoi faire, sur quel ${levelFr} précisément, et l'impact attendu. Tranche entre :
- **Scaler** (augmenter budget, dupliquer) sur ${levelFr} X
- **Tester variante** (nouveau hook, nouvelle audience, nouveau créatif) sur ${levelFr} Y
- **Couper** (assumer la perte) sur ${levelFr} Z
- **Attendre** (volume insuffisant) sur ${levelFr} W

Sois direct, parle "tu" au coach, pas de blabla générique, **cite TOUJOURS les noms exacts des ${levelPlural}**, base-toi UNIQUEMENT sur les chiffres fournis.`
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()

    const apiKey = await getApiKey(workspaceId)
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Clé API IA non configurée. Va dans Paramètres > Assistant IA pour la définir.' },
        { status: 400 },
      )
    }

    const body = await request.json() as AnalyzeBody
    if (!body.level || !Array.isArray(body.rows) || body.rows.length === 0) {
      return NextResponse.json({ error: 'level et rows (array non vide) sont requis' }, { status: 400 })
    }

    // Cap raisonnable pour ne pas exploser le contexte ni les coûts.
    // Au-delà, on tronque en gardant les 30 premiers (déjà triés côté client).
    const cappedRows = body.rows.slice(0, 30)

    const prompt = buildPrompt({ ...body, rows: cappedRows })
    const analysis = await callClaude(prompt, apiKey, 'claude-sonnet-4-20250514', 2500)

    return NextResponse.json({
      analysis,
      analyzedCount: cappedRows.length,
      totalCount: body.rows.length,
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    console.error('[ai-analyze] error', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}
