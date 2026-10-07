import { createServiceClient } from '@/lib/supabase/service'
import { fetchKpisV2, getDayPlan, getHotLeads, getRiskLeads } from '@/lib/dashboard/v2-queries'
import { hubAutorise } from '@/lib/hub/autorise'
import { resumeClosrm } from '@/lib/hub/resume'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!hubAutorise(request)) return Response.json({ erreur: 'Non autorisé' }, { status: 401 })
  const ws = process.env.HUB_WORKSPACE_ID
  if (!ws) return Response.json({ erreur: 'HUB_WORKSPACE_ID manquant' }, { status: 500 })
  try {
    const sb = createServiceClient()
    const maintenant = new Date()
    const [plan, kpis, chauds, risques, relances, derniere] = await Promise.all([
      getDayPlan(ws, sb),
      fetchKpisV2(ws, 7, sb),
      getHotLeads(ws, sb),
      getRiskLeads(ws, sb),
      sb.from('follow_ups').select('id', { count: 'exact', head: true })
        .eq('workspace_id', ws).eq('status', 'en_attente').lt('scheduled_at', maintenant.toISOString()),
      sb.from('leads').select('last_activity_at').eq('workspace_id', ws)
        .not('last_activity_at', 'is', null).order('last_activity_at', { ascending: false }).limit(1).maybeSingle(),
    ])
    return Response.json(resumeClosrm({
      plan, kpis, chauds, risques,
      relances: relances.count ?? 0,
      derniereActivite: (derniere.data?.last_activity_at as string | undefined) ?? null,
      origine: new URL(request.url).origin,
      maintenant,
    }))
  } catch (err) {
    return Response.json({ erreur: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
