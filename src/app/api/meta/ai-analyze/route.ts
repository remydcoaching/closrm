import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { callClaude } from '@/lib/ai/client'
import { getApiKey } from '@/lib/ai/brief'

/**
 * Analyse IA d'une campagne, ad set ou ad Meta.
 *
 * Le client envoie les KPIs déjà chargés en mémoire (pas besoin de
 * re-fetcher Meta côté serveur). On enrichit avec un prompt structuré
 * pour Claude Sonnet, qui retourne une analyse actionable en markdown.
 */

interface AnalyzeBody {
  level: 'campaign' | 'adset' | 'ad'
  name: string
  kpis: Record<string, unknown>
  crm?: Record<string, unknown> | null
  dateFrom?: string
  dateTo?: string
}

const LEVEL_FR: Record<AnalyzeBody['level'], string> = {
  campaign: 'campagne',
  adset: 'ad set',
  ad: 'ad (création)',
}

function buildPrompt(body: AnalyzeBody): string {
  const levelFr = LEVEL_FR[body.level]
  const period = body.dateFrom && body.dateTo
    ? `Période analysée : du ${body.dateFrom} au ${body.dateTo}.`
    : 'Période : 30 derniers jours.'

  const kpisJson = JSON.stringify(body.kpis, null, 2)
  const crmJson = body.crm ? JSON.stringify(body.crm, null, 2) : 'Aucune donnée CRM rattachée.'

  return `Tu es un expert media buyer Meta Ads qui audite des campagnes pour un coach sportif indépendant. Tu connais parfaitement les funnels de vente B2C par appel téléphonique (ticket 1000–3000€).

Tu vas analyser **UN ${levelFr}** spécifique : "${body.name}".

${period}

## Données Meta (insights bruts)
\`\`\`json
${kpisJson}
\`\`\`

## Données CRM (rattachement leads → bookings → ventes)
\`\`\`json
${crmJson}
\`\`\`

## Tâche

Donne une analyse **actionable** et **concise** (max 350 mots), structurée comme suit en markdown :

### 🎯 Verdict en 1 phrase
Un constat franc : ${levelFr} ${body.level === 'ad' ? 'créatif' : ''} performant / sous-performant / mort / à surveiller.

### ✅ Ce qui fonctionne
2-3 points concrets, chiffrés.

### ⚠️ Points faibles
2-3 points concrets, chiffrés. Identifie le maillon le plus faible du funnel (CPM, CTR, hook, CR1, CR2, CR3, taux de joignabilité, conversion appel, etc.).

### 🔧 Actions concrètes (priorisées)
3 actions max. Pour chacune : quoi faire, pourquoi, et l'impact attendu. Tranche entre :
- **Scaler** (augmenter budget, dupliquer)
- **Tester variante** (nouveau hook, nouvelle audience, nouveau créatif)
- **Couper** (assumer la perte)
- **Attendre** (volume insuffisant)

### 📊 Diagnostic court
1-2 phrases sur la santé globale et le contexte (combien de budget, sur quel volume de signaux on parle).

Sois direct, parle "tu" au coach, pas de blabla générique, base-toi UNIQUEMENT sur les chiffres fournis.`
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
    if (!body.level || !body.name || !body.kpis) {
      return NextResponse.json({ error: 'level, name et kpis sont requis' }, { status: 400 })
    }

    const prompt = buildPrompt(body)
    const analysis = await callClaude(prompt, apiKey, 'claude-sonnet-4-20250514', 1500)

    return NextResponse.json({ analysis })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    console.error('[ai-analyze] error', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}
