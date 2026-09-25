import type { SupabaseClient } from '@supabase/supabase-js'
import type { PriorityCategory } from './priority'
import { pickTemplate, type RenderedTemplate } from './templates'

interface ResolveStepContext {
  firstName: string
  daysSinceLastContact: number | null
}

interface ProcessStep {
  id: string
  title: string
  step_type: string
  content: string
  delay_days: number | null
  next_step_id: string | null
  applies_to_category: string | null
}

// Process actif + ses étapes + toutes leurs transitions, pré-chargés une
// seule fois par appelant (au lieu de le refaire pour chaque item de
// session — ces requêtes ne dépendent que de workspaceId, identiques pour
// tous les items d'une même session). loadActiveProcessSteps() les charge,
// resolveSessionStep() les réutilise.
export interface ActiveProcessSteps {
  processId: string | null
  steps: ProcessStep[]
  transitionsByStepId: Map<string, StepTransition[]>
}

export async function loadActiveProcessSteps(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<ActiveProcessSteps> {
  const { data: activeProcess } = await supabase
    .from('setting_processes')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!activeProcess) return { processId: null, steps: [], transitionsByStepId: new Map() }

  const { data: steps } = await supabase
    .from('setting_process_steps')
    .select('id, title, step_type, content, delay_days, next_step_id, applies_to_category')
    .eq('process_id', activeProcess.id)
    .order('position', { ascending: true })

  const stepIds = (steps ?? []).map((s) => s.id)
  const transitionsByStepId = new Map<string, StepTransition[]>()
  if (stepIds.length > 0) {
    const { data: transitions } = await supabase
      .from('setting_process_step_transitions')
      .select('step_id, outcome_label, target_step_id')
      .in('step_id', stepIds)
    for (const t of transitions ?? []) {
      const list = transitionsByStepId.get(t.step_id) ?? []
      list.push({ outcome_label: t.outcome_label, target_step_id: t.target_step_id })
      transitionsByStepId.set(t.step_id, list)
    }
  }

  return { processId: activeProcess.id, steps: steps ?? [], transitionsByStepId }
}

export interface StepTransition {
  outcome_label: string
  target_step_id: string
}

export interface NextStepPreview {
  title: string
  delay_days: number | null
}

export interface RelanceStepOption {
  step_id: string
  title: string
  delay_days: number | null
}

export interface ResolvedStep extends RenderedTemplate {
  process_id: string | null
  step_id: string | null
  next_step_id: string | null
  delay_days: number | null
  transitions: StepTransition[]
  // Aperçu de l'étape suivante du process (titre + délai par défaut) — permet
  // au setter de voir concrètement "Reprise après une longue absence (30j)"
  // plutôt qu'un simple chiffre de jours sans contexte au moment de valider
  // une relance. Absent si l'étape courante n'a pas de next_step_id (fin de
  // process) ou si aucun process n'est actif.
  next_step: NextStepPreview | null
  // Toutes les étapes de type "relance" du process (ex: Relance J+3, Reprise
  // après une longue absence J+30) — permet au setter de choisir manuellement
  // laquelle programmer plutôt que de subir uniquement l'enchaînement déduit
  // par next_step_id. Vide si aucun process actif.
  relance_step_options: RelanceStepOption[]
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
  ctx: ResolveStepContext,
  preloaded?: ActiveProcessSteps
): Promise<ResolvedStep> {
  const { processId, steps, transitionsByStepId } = preloaded ?? (await loadActiveProcessSteps(supabase, workspaceId))

  if (processId) {
    const isFirstContact = category === 'premier_message' || category === 'engagement_instagram'
    // Regroupement identique à templates.ts::pickTemplate — premier_message et
    // engagement_instagram partagent toujours le même message ("premier
    // contact"), donc une seule catégorie d'étape leur correspond. Idem pour
    // relance_du_jour/relance_en_retard : la distinction ne sert qu'à la
    // priorisation temporelle de la file, le message de relance affiché est
    // identique dans les deux cas.
    const stepCategory: 'premier_contact' | 'relance_en_retard' | 'jamais_recontacte' = isFirstContact
      ? 'premier_contact'
      : category === 'jamais_recontacte'
        ? 'jamais_recontacte'
        : 'relance_en_retard'

    if (steps.length > 0) {
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
      const transitions = transitionsByStepId.get(step.id) ?? []

      const nextStep = step.next_step_id
        ? (steps.find((s) => s.id === step.next_step_id) ?? null)
        : null

      const name = ctx.firstName || 'là'
      return {
        label: step.title,
        text: step.content.replaceAll('{{prenom}}', name),
        process_id: processId,
        step_id: step.id,
        next_step_id: step.next_step_id,
        delay_days: step.delay_days,
        transitions,
        next_step: nextStep ? { title: nextStep.title, delay_days: nextStep.delay_days } : null,
        relance_step_options: relanceSteps.map((s) => ({
          step_id: s.id,
          title: s.title,
          delay_days: s.delay_days,
        })),
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
    next_step: null,
    relance_step_options: [],
  }
}
