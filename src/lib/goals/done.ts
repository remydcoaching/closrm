import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * After a goal was checked or unchecked: each ancestor is done exactly when
 * all its sub-goals are done (same rule as the desktop's propagateDone).
 */
export async function syncAncestorsDone(supabase: SupabaseClient, workspaceId: string, parentId: string | null) {
  let current = parentId
  for (let depth = 0; current && depth < 10; depth++) {
    const [{ data: parent }, { data: children }] = await Promise.all([
      supabase.from('goals').select('id, parent_id, done_at').eq('id', current).eq('workspace_id', workspaceId).maybeSingle(),
      supabase.from('goals').select('done_at').eq('parent_id', current).eq('workspace_id', workspaceId),
    ])
    if (!parent || !children) return
    const allDone = children.length > 0 && children.every((c) => c.done_at)
    const doneAt = allDone ? (parent.done_at ?? new Date().toISOString()) : null
    if (doneAt === parent.done_at) return
    await supabase.from('goals').update({ done_at: doneAt }).eq('id', parent.id).eq('workspace_id', workspaceId)
    current = parent.parent_id
  }
}
