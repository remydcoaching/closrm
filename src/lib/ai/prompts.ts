import { AiCoachBrief, Lead, IgMessage } from '@/types'

interface PromptContext {
  brief: AiCoachBrief | null
  lead: Lead
  messages: IgMessage[]
  goldenExamples: { messages: string }[]
}

export function buildSuggestionPrompt(ctx: PromptContext): string {
  const toneLabel = ctx.brief?.tone === 'tu' ? 'tutoiement' : ctx.brief?.tone === 'vous' ? 'vouvoiement' : 'adaptatif'
  const goalLabel = ctx.brief?.goal === 'book_call' ? 'Amener le prospect a booker un appel' : ctx.brief?.goal === 'sell_dm' ? 'Vendre en DM' : 'Booker un appel ou vendre en DM'

  const messagesText = ctx.messages
    .map(m => `[${m.sender_type === 'user' ? 'COACH' : 'PROSPECT'}] ${m.text || '(media)'}`)
    .join('\n')

  const goldenText = ctx.goldenExamples.length > 0
    ? ctx.goldenExamples.map((ex, i) => `### Exemple ${i + 1}\n${ex.messages}`).join('\n\n')
    : 'Aucun exemple disponible pour le moment.'

  return `Tu es l'assistant IA de relance d'un coach. Ton role est d'analyser une conversation Instagram et de suggerer le prochain message a envoyer.

## BRIEF DU COACH
${ctx.brief?.generated_brief || 'Pas de brief configure. Genere un message professionnel et engageant.'}

Ton : ${toneLabel}
Offre : ${ctx.brief?.offer_description || 'Non renseigne'}
Cible : ${ctx.brief?.target_audience || 'Non renseigne'}
Objectif : ${goalLabel}
${ctx.brief?.lead_magnets ? `\n## CONTENUS DISPONIBLES (lead magnets, videos, ressources)\n${ctx.brief.lead_magnets}\n\nIMPORTANT : quand tu suggeres d'envoyer du contenu, utilise UNIQUEMENT les contenus listes ci-dessus. Ne les invente pas.\n` : ''}
## INFOS DU PROSPECT
Prenom : ${ctx.lead.first_name}
Statut actuel : ${ctx.lead.status}
Source : ${ctx.lead.source}
Tags : ${ctx.lead.tags?.join(', ') || 'aucun'}
Notes : ${ctx.lead.notes || 'aucune'}
Pseudo IG : ${ctx.lead.instagram_handle || 'inconnu'}

## CONVERSATION (du plus ancien au plus recent)
${messagesText || 'Aucun message echange.'}

## EXEMPLES DE CONVERSATIONS QUI ONT CONVERTI
${goldenText}

## INSTRUCTIONS
Reponds UNIQUEMENT en JSON valide (sans markdown, sans backticks) avec cette structure :
{
  "guidance": "2-3 phrases expliquant la situation du prospect et la strategie recommandee",
  "message": "le message a envoyer au prospect, dans le style du coach, naturel et personnalise, 2-4 phrases max",
  "status_suggestion": null ou { "to": "nouveau_statut", "reason": "pourquoi changer" }
}

Le message doit etre naturel, personnalise, pas de formules generiques. Adapte le ton au brief du coach.`
}

export function buildBriefGenerationPrompt(answers: {
  offer_description: string
  target_audience: string
  tone: string
  approach: string
  example_messages: string
  goal: string
}): string {
  return `A partir des reponses d'un coach, genere un brief de 200 mots max decrivant son style de communication et sa strategie de relance Instagram.

Reponses du coach :
- Offre : ${answers.offer_description}
- Cible : ${answers.target_audience}
- Ton : ${answers.tone === 'tu' ? 'Tutoiement' : answers.tone === 'vous' ? 'Vouvoiement' : 'Adaptatif'}
- Approche de relance : ${answers.approach}
- Exemples de messages qui marchent : ${answers.example_messages}
- Objectif : ${answers.goal === 'book_call' ? 'Booker un appel' : answers.goal === 'sell_dm' ? 'Vendre en DM' : 'Les deux'}

Genere un brief structure qui decrit :
1. Le style de communication (ton, expressions typiques, niveau de familiarite)
2. La strategie de relance (comment il approche les prospects, les etapes)
3. Les types de messages qui fonctionnent (basé sur les exemples)
4. Les signaux d'achat a detecter chez les prospects

Reponds UNIQUEMENT avec le brief, sans introduction ni commentaire.`
}
