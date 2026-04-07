import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { ContactRow } from '@/types'
import BaseDeDonneesClient from './base-de-donnees-client'

export default async function BaseDeDonneesPage() {
  const { workspaceId } = await getWorkspaceId()
  const supabase = await createClient()

  const { data, count } = await supabase
    .from('leads')
    .select('id, workspace_id, first_name, last_name, phone, email, status, source, tags, reached, call_attempts, notes, created_at, updated_at, calls(count)', { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .range(0, 24)

  // Transform: extract aggregated call count (same logic as API route)
  const contacts: ContactRow[] = (data ?? []).map((lead) => {
    const { calls, ...leadFields } = lead as Record<string, unknown>
    const callsAgg = calls as { count: number }[] | undefined
    const nb_calls = callsAgg?.[0]?.count ?? 0

    return {
      ...leadFields,
      nb_calls,
      last_call_at: null,
    } as ContactRow
  })

  return <BaseDeDonneesClient initialContacts={contacts} initialTotal={count ?? 0} />
}
