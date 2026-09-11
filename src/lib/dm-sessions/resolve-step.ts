import type { SupabaseClient } from '@supabase/supabase-js'
import type { PriorityCategory } from './priority'
import { pickTemplate, type RenderedTemplate } from './templates'

interface ResolveStepContext {
  firstName: string
  daysSinceLastContact: number | null
}

/**
 * Résout le message à afficher pendant une session DM : d'abord depuis le
 * process de setting actif du workspace (setting_processes/steps, éditable
 * par l'admin), sinon depuis pickTemplate() comme filet de sécurité tant
 * qu'aucun process n'est configuré. Ne supprime pas templates.ts — c'est le
 * fallback explicite pendant la migration (cf. docs/superpowers/specs).
 */
export async function resolveSessionStep(
  supabase: SupabaseClient,
  workspaceId: string,
  category: PriorityCategory,
  ctx: ResolveStepContext
): Promise<RenderedTemplate & { process_id: string | null; step_id: string | null }> {
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

    const { data: steps } = await supabase
      .from('setting_process_steps')
      .select('id, title, step_type, content, delay_days')
      .eq('process_id', activeProcess.id)
      .order('position', { ascending: true })

    if (steps && steps.length > 0) {
      const step = isFirstContact
        ? steps.find((s) => s.step_type === 'message') ?? steps[0]
        : steps.find((s) => s.step_type === 'relance') ?? steps[steps.length - 1]

      const name = ctx.firstName || 'là'
      return {
        label: step.title,
        text: step.content.replaceAll('{{prenom}}', name),
        process_id: activeProcess.id,
        step_id: step.id,
      }
    }
  }

  return { ...pickTemplate(category, ctx), process_id: null, step_id: null }
}
