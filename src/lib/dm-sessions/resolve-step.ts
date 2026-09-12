import type { SupabaseClient } from '@supabase/supabase-js'
import type { PriorityCategory } from './priority'
import { pickTemplate, type RenderedTemplate } from './templates'

interface ResolveStepContext {
  firstName: string
  daysSinceLastContact: number | null
}

export interface StepTransition {
  outcome_label: string
  target_step_id: string
}

export interface ResolvedStep extends RenderedTemplate {
  process_id: string | null
  step_id: string | null
  next_step_id: string | null
  delay_days: number | null
  transitions: StepTransition[]
}

/**
 * Résout le message à afficher pendant une session DM : d'abord depuis le
 * process de setting actif du workspace (setting_processes/steps, éditable
 * par l'admin), sinon depuis pickTemplate() comme filet de sécurité tant
 * qu'aucun process n'est configuré. Ne supprime pas templates.ts — c'est le
 * fallback explicite pendant la migration (cf. docs/superpowers/specs).
 *
 * Expose aussi les transitions nommées de l'étape résolue (ex: "repondu" ->
 * une étape spécifique) — le mobile doit les proposer explicitement plutôt
 * que d'avancer bêtement à la position suivante.
 */
export async function resolveSessionStep(
  supabase: SupabaseClient,
  workspaceId: string,
  category: PriorityCategory,
  ctx: ResolveStepContext
): Promise<ResolvedStep> {
  const { data: activeProcess } = await supabase
    .from('setting_processes')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (activeProcess) {
    const isFirstContact = category === 'premier_message' || category === 'engagement_instagram'
    // Regroupement identique à templates.ts::pickTemplate — premier_message et
    // engagement_instagram partagent toujours le même message ("premier
    // contact"), donc une seule catégorie d'étape leur correspond.
    const stepCategory: 'premier_contact' | 'relance_en_retard' | 'jamais_recontacte' = isFirstContact
      ? 'premier_contact'
      : category === 'jamais_recontacte'
        ? 'jamais_recontacte'
        : 'relance_en_retard'

    const { data: steps } = await supabase
      .from('setting_process_steps')
      .select('id, title, step_type, content, delay_days, next_step_id, applies_to_category')
      .eq('process_id', activeProcess.id)
      .order('position', { ascending: true })

    if (steps && steps.length > 0) {
      // Priorité 1 : une étape a explicitement cette catégorie assignée
      // (colonne applies_to_category) — robuste à l'ordre/au réordonnancement.
      // Priorité 2 (process créé avant que l'UI expose ce champ, ou jamais
      // renseigné) : heuristique par position, identique à l'ancien
      // comportement — 1ère étape "message" pour le premier contact, dernière
      // étape "relance" pour un ancien lead, 1ère étape "relance" sinon.
      const relanceSteps = steps.filter((s) => s.step_type === 'relance')
      const byCategory = steps.find((s) => s.applies_to_category === stepCategory)
      const byHeuristic = isFirstContact
        ? steps.find((s) => s.step_type === 'message') ?? steps[0]
        : stepCategory === 'jamais_recontacte'
          ? relanceSteps[relanceSteps.length - 1] ?? steps[steps.length - 1]
          : relanceSteps[0] ?? steps[steps.length - 1]
      const step = byCategory ?? byHeuristic

      const { data: transitions } = await supabase
        .from('setting_process_step_transitions')
        .select('outcome_label, target_step_id')
        .eq('step_id', step.id)

      const name = ctx.firstName || 'là'
      return {
        label: step.title,
        text: step.content.replaceAll('{{prenom}}', name),
        process_id: activeProcess.id,
        step_id: step.id,
        next_step_id: step.next_step_id,
        delay_days: step.delay_days,
        transitions: transitions ?? [],
      }
    }
  }

  return {
    ...pickTemplate(category, ctx),
    process_id: null,
    step_id: null,
    next_step_id: null,
    delay_days: null,
    transitions: [],
  }
}
