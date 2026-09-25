// Persists DiscoveryResult.interactions (who liked / commented which
// content) into discovery_interactions (migration 104). Bulk inserts by
// chunk — a scan easily yields thousands of rows, one request per row
// would blow the function's time budget.
import type { DiscoveryResult } from './discovery'

export const INTERACTIONS_CHUNK = 500

export interface PersistInteractionsResult {
  interactionsPersisted: number
  errors: string[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function persistDiscoveryInteractions(supabase: any, workspaceId: string, discoveryRunId: string, result: DiscoveryResult): Promise<PersistInteractionsResult> {
  const errors: string[] = []
  let interactionsPersisted = 0

  // Dedup on the table's unique key before sending — a duplicate inside one
  // chunk would make the whole upsert fail.
  const seen = new Set<string>()
  const rows = []
  for (const i of result.interactions) {
    const key = `${i.sourceContentId}|${i.username}|${i.interactionType}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({
      workspace_id: workspaceId,
      discovery_run_id: discoveryRunId,
      content_id: i.sourceContentId,
      instagram_user_id: i.instagramUserId,
      instagram_username: i.username,
      full_name: i.fullName,
      interaction_type: i.interactionType,
      observed_at: i.observedAt,
    })
  }

  for (let from = 0; from < rows.length; from += INTERACTIONS_CHUNK) {
    const chunk = rows.slice(from, from + INTERACTIONS_CHUNK)
    const { error } = await supabase
      .from('discovery_interactions')
      .upsert(chunk, { onConflict: 'discovery_run_id,content_id,instagram_username,interaction_type', ignoreDuplicates: true })
    if (error) {
      errors.push(`Failed to persist discovery interactions ${from}-${from + chunk.length - 1}: ${error.message}`)
    } else {
      interactionsPersisted += chunk.length
    }
  }

  return { interactionsPersisted, errors }
}
