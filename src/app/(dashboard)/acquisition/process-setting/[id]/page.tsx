import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import ProcessDetailClient from './process-detail-client'

export default async function ProcessDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { workspaceId, role } = await getWorkspaceId()
  const supabase = await createClient()

  const { data: process } = await supabase
    .from('setting_processes')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .single()

  if (!process) notFound()

  const { data: steps } = await supabase
    .from('setting_process_steps')
    .select('*, transitions:setting_process_step_transitions(*)')
    .eq('process_id', id)
    .order('position', { ascending: true })

  return (
    <ProcessDetailClient
      process={{ ...process, steps: steps ?? [] }}
      canManage={role === 'admin'}
    />
  )
}
