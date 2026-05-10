import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export default async function SessionBriefRedirectPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params
  const { workspaceId } = await getWorkspaceId()
  const supabase = await createClient()

  const { data: links } = await supabase
    .from('tournage_session_reels')
    .select('social_post_id, position, session:tournage_sessions!inner(workspace_id)')
    .eq('session_id', sessionId)
    .order('position', { ascending: true })

  const ids = (links ?? [])
    .filter(l => {
      const s = l.session as unknown as { workspace_id: string } | null
      return s?.workspace_id === workspaceId
    })
    .map(l => l.social_post_id as string)

  if (ids.length === 0) {
    redirect('/acquisition/reels/tournage/brief?session=' + sessionId)
  }
  redirect(`/acquisition/reels/tournage/brief?reel=${ids.join(',')}&session=${sessionId}`)
}
