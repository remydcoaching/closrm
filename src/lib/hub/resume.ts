import type { DashboardKpisV2, DayPlanItem, KpiValue, PriorityLead } from '@/lib/dashboard/v2-queries'
import type { Action, ReponseClosrm } from './contrat'

export type EntreesClosrm = {
  plan: DayPlanItem[]
  relances: number
  kpis: DashboardKpisV2
  chauds: PriorityLead[]
  risques: PriorityLead[]
  derniereActivite: string | null
  origine: string
  maintenant: Date
}

const heureParis = (iso: string) =>
  new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
const kpi = (k: KpiValue) => ({ valeur: k.current, deltaPct: k.delta_pct, sparkline: k.sparkline })

export function resumeClosrm(e: EntreesClosrm): ReponseClosrm {
  const actions: Action[] = []
  if (e.relances > 0) {
    actions.push({ id: 'closrm:relances', libelle: `${e.relances} relance${e.relances > 1 ? 's' : ''} en attente`, urgence: 2, lien: `${e.origine}/follow-ups` })
  }
  const noShows = e.plan.filter((p) => p.type === 'no_show')
  for (const n of noShows) {
    actions.push({ id: `closrm:no-show:${n.lead_id}`, libelle: `Recaler le no-show de ${n.lead_name}`, urgence: 3, lien: `${e.origine}/leads` })
  }
  const importance = noShows.length > 0 ? 'urgent' : e.plan.some((p) => p.type === 'booking') || e.relances > 0 ? 'a_signaler' : 'calme'
  return {
    version: 1,
    appli: 'closrm',
    genereLe: e.maintenant.toISOString(),
    derniereActivite: e.derniereActivite,
    importance,
    actions,
    donnees: {
      plan: e.plan.map((p) => ({ type: p.type, nom: p.lead_name, contexte: p.context, heure: p.scheduled_at ? heureParis(p.scheduled_at) : null })),
      relancesEnAttente: e.relances,
      kpis: { cash: kpi(e.kpis.cash_collected), showRate: kpi(e.kpis.show_rate), closeRate: kpi(e.kpis.close_rate) },
      chauds: e.chauds.map((c) => ({ nom: c.name, contexte: c.context })),
      aRisque: e.risques.length,
    },
  }
}
