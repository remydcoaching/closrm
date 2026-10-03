import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { attachIdentities, isBuyerLurker, loadPeople, peopleKpis, type PersonRow } from '@/lib/instagram/people'
import type { ConfidenceLevel } from '@/lib/leads/confidence'

/**
 * Leads Instagram (page « Leads » d'Insyder) : toutes les personnes qui ont
 * réagi au compte, scorées. ?period_days=30&tab=actifs|nouveaux|confiance|certifies|lurkers
 * &level=tres_eleve&uncontacted=1&q=&page=1&per_page=25 — ou &format=csv (tout le filtre).
 */
const TABS = ['actifs', 'nouveaux', 'confiance', 'certifies', 'lurkers'] as const
type Tab = (typeof TABS)[number]
const LEVELS: ConfidenceLevel[] = ['tres_eleve', 'eleve', 'moyen', 'faible', 'insuffisant']

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const sp = request.nextUrl.searchParams
    const periodDays = Math.min(Math.max(Number(sp.get('period_days')) || 30, 1), 3650)
    const tab = (TABS as readonly string[]).includes(sp.get('tab') ?? '') ? (sp.get('tab') as Tab) : 'actifs'
    const level = LEVELS.includes(sp.get('level') as ConfidenceLevel) ? (sp.get('level') as ConfidenceLevel) : null
    const uncontacted = sp.get('uncontacted') === '1'
    const follows = sp.get('follows') === '0' ? false : sp.get('follows') === '1' ? true : null
    const q = (sp.get('q') ?? '').trim().toLowerCase()
    const page = Math.max(Number(sp.get('page')) || 1, 1)
    // ?all=1: the whole filtered list in one page (desktop export).
    const exportAll = sp.get('all') === '1'
    const perPage = exportAll ? Number.MAX_SAFE_INTEGER : Math.min(Math.max(Number(sp.get('per_page')) || 25, 1), 200)

    const { rows, gestures, scoring, recentStoriesCount } = await loadPeople(supabase, workspaceId)
    const since = new Date(Date.now() - periodDays * 86_400_000).toISOString()
    const inPeriod = (r: PersonRow) => (r.lastAt ?? '') >= since

    let list = rows.filter((r) => {
      if (tab === 'actifs' && !inPeriod(r)) return false
      if (tab === 'nouveaux' && !((r.firstAt ?? '') >= since)) return false
      if (tab === 'confiance' && !inPeriod(r)) return false
      if (tab === 'certifies' && !r.isVerified) return false
      if (tab === 'lurkers' && !isBuyerLurker(r, recentStoriesCount)) return false
      if (level && r.confidence !== level) return false
      if (uncontacted && r.contacted) return false
      if (follows !== null && r.follows !== follows) return false
      if (q && !r.username.includes(q) && !(r.fullName ?? '').toLowerCase().includes(q)) return false
      return true
    })
    const by: Record<Tab, (a: PersonRow, b: PersonRow) => number> = {
      actifs: (a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? '') || b.score - a.score,
      nouveaux: (a, b) => (b.firstAt ?? '').localeCompare(a.firstAt ?? ''),
      confiance: (a, b) => b.score - a.score || b.interactions - a.interactions,
      certifies: (a, b) => b.score - a.score,
      lurkers: (a, b) => b.recentStoriesSeen - a.recentStoriesSeen || (b.lastAt ?? '').localeCompare(a.lastAt ?? ''),
    }
    list = list.sort(by[tab])

    if (sp.get('format') === 'csv') {
      list = await attachIdentities(supabase, workspaceId, list)
      const esc = (v: unknown) => {
        const s = v === null || v === undefined ? '' : String(v)
        return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
      }
      const header = ['username', 'nom', 'profil', 'score', 'niveau_confiance', 'interactions', 'stories_vues', 'jaime', 'commentaires', 'premier_geste', 'source', 'derniere_activite', 'certifie', 'abonne', 'contacte', 'lead_crm']
      const lines = list.map((r) =>
        [r.username, r.fullName, `https://instagram.com/${r.username}`, r.score, r.confidence, r.interactions, r.storyViews, r.likes, r.comments, r.firstAt?.slice(0, 10), r.firstSource, r.lastAt?.slice(0, 10), r.isVerified ? 'oui' : '', r.follows === null ? '' : r.follows ? 'oui' : 'non', r.contacted ? 'oui' : 'non', r.lead ? r.lead.status : ''].map(esc).join(','),
      )
      return new NextResponse([header.join(','), ...lines].join('\n'), {
        headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="leads-instagram-${tab}.csv"` },
      })
    }

    return NextResponse.json({
      data: {
        kpis: peopleKpis(rows, gestures, periodDays, recentStoriesCount, scoring),
        recentStoriesCount,
        total: list.length,
        rows: await attachIdentities(supabase, workspaceId, list.slice((page - 1) * perPage, page * perPage)),
      },
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
