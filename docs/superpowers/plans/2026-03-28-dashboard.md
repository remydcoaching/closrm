# Dashboard d'accueil — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Brancher de vraies données Supabase sur le dashboard d'accueil — KPIs, prochains appels, follow-ups en retard, activité récente.

**Architecture:** Server Component unique (`dashboard/page.tsx`) qui lance 4 requêtes Supabase en parallèle via `Promise.all`. La période est transmise via query param `?period=7|30|90` (défaut 30). Chaque section est un composant fils Server Component indépendant.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase JS client (`@supabase/supabase-js`), `date-fns`

---

## Structure des fichiers

| Fichier | Action | Rôle |
|---------|--------|------|
| `src/lib/dashboard/queries.ts` | Créer | Toutes les queries Supabase du dashboard |
| `src/components/dashboard/period-selector.tsx` | Créer | Boutons 7j/30j/90j (liens `<a>`) |
| `src/components/dashboard/kpi-cards.tsx` | Créer | 4 cards KPI |
| `src/components/dashboard/upcoming-calls.tsx` | Créer | Liste prochains appels |
| `src/components/dashboard/overdue-followups.tsx` | Créer | Liste follow-ups en retard |
| `src/components/dashboard/recent-activity.tsx` | Créer | Timeline activité récente |
| `src/app/(dashboard)/dashboard/page.tsx` | Modifier | Passage en Server Component + branchement |

---

## Task 1 : Queries Supabase (`src/lib/dashboard/queries.ts`)

**Files:**
- Create: `src/lib/dashboard/queries.ts`

- [ ] **Étape 1 : Créer le fichier avec les types et les 4 fonctions**

```ts
import { createClient } from '@/lib/supabase/server'

// ─── Types retournés par les queries ─────────────────────────────────────────

export interface DashboardKpis {
  newLeads: number
  plannedCalls: number
  closedDeals: number
  closingRate: number | null  // null si aucun appel planifié (évite division par zéro)
}

export interface UpcomingCall {
  id: string
  lead_id: string
  lead_name: string
  type: 'setting' | 'closing'
  scheduled_at: string
  category: 'overdue' | 'today' | 'upcoming'
}

export interface OverdueFollowUp {
  id: string
  lead_id: string
  lead_name: string
  channel: 'whatsapp' | 'email' | 'manuel'
  scheduled_at: string
  days_overdue: number
}

export interface ActivityEvent {
  id: string
  type: 'new_lead' | 'call_logged'
  description: string
  created_at: string
}

// ─── KPIs ────────────────────────────────────────────────────────────────────

export async function fetchKpis(workspaceId: string, period: number): Promise<DashboardKpis> {
  const supabase = await createClient()
  const since = new Date()
  since.setDate(since.getDate() - period)
  const sinceIso = since.toISOString()

  const [leadsRes, callsRes, closedRes] = await Promise.all([
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .gte('created_at', sinceIso),
    supabase
      .from('calls')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .gte('created_at', sinceIso),
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'clos')
      .gte('updated_at', sinceIso),
  ])

  const newLeads = leadsRes.count ?? 0
  const plannedCalls = callsRes.count ?? 0
  const closedDeals = closedRes.count ?? 0
  const closingRate = plannedCalls > 0 ? Math.round((closedDeals / plannedCalls) * 100) : null

  return { newLeads, plannedCalls, closedDeals, closingRate }
}

// ─── Prochains appels ────────────────────────────────────────────────────────

export async function fetchUpcomingCalls(workspaceId: string): Promise<UpcomingCall[]> {
  const supabase = await createClient()
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

  // Récupère : appels en retard (outcome null + date passée) + appels dans les 7 prochains jours
  const { data } = await supabase
    .from('calls')
    .select('id, lead_id, type, scheduled_at, outcome, leads(first_name, last_name)')
    .eq('workspace_id', workspaceId)
    .or(
      `and(outcome.is.null,scheduled_at.lt.${todayStart}),` +
      `and(scheduled_at.gte.${todayStart},scheduled_at.lte.${in7Days})`
    )
    .order('scheduled_at', { ascending: true })
    .limit(6)

  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()

  return (data ?? []).map((row) => {
    const lead = row.leads as { first_name: string; last_name: string }
    let category: 'overdue' | 'today' | 'upcoming' = 'upcoming'
    if (!row.outcome && row.scheduled_at < todayStart) {
      category = 'overdue'
    } else if (row.scheduled_at >= todayStart && row.scheduled_at <= todayEnd) {
      category = 'today'
    }
    return {
      id: row.id,
      lead_id: row.lead_id,
      lead_name: `${lead.first_name} ${lead.last_name}`,
      type: row.type as 'setting' | 'closing',
      scheduled_at: row.scheduled_at,
      category,
    }
  })
}

// ─── Follow-ups en retard ─────────────────────────────────────────────────────

export async function fetchOverdueFollowUps(workspaceId: string): Promise<OverdueFollowUp[]> {
  const supabase = await createClient()
  const now = new Date().toISOString()

  const { data } = await supabase
    .from('follow_ups')
    .select('id, lead_id, channel, scheduled_at, leads(first_name, last_name)')
    .eq('workspace_id', workspaceId)
    .eq('status', 'en_attente')
    .lt('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(6)

  return (data ?? []).map((row) => {
    const lead = row.leads as { first_name: string; last_name: string }
    const daysOverdue = Math.max(1, Math.floor(
      (Date.now() - new Date(row.scheduled_at).getTime()) / (1000 * 60 * 60 * 24)
    ))
    return {
      id: row.id,
      lead_id: row.lead_id,
      lead_name: `${lead.first_name} ${lead.last_name}`,
      channel: row.channel as 'whatsapp' | 'email' | 'manuel',
      scheduled_at: row.scheduled_at,
      days_overdue: daysOverdue,
    }
  })
}

// ─── Activité récente ─────────────────────────────────────────────────────────

export async function fetchRecentActivity(workspaceId: string): Promise<ActivityEvent[]> {
  const supabase = await createClient()

  const [leadsRes, callsRes] = await Promise.all([
    supabase
      .from('leads')
      .select('id, first_name, last_name, source, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('calls')
      .select('id, type, created_at, leads(first_name, last_name)')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const events: ActivityEvent[] = []

  for (const lead of leadsRes.data ?? []) {
    events.push({
      id: `lead-${lead.id}`,
      type: 'new_lead',
      description: `${lead.first_name} ${lead.last_name} ajouté(e) (${lead.source.replace('_', ' ')})`,
      created_at: lead.created_at,
    })
  }

  for (const call of callsRes.data ?? []) {
    const lead = call.leads as { first_name: string; last_name: string }
    events.push({
      id: `call-${call.id}`,
      type: 'call_logged',
      description: `${lead.first_name} ${lead.last_name} — appel ${call.type} enregistré`,
      created_at: call.created_at,
    })
  }

  return events
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 10)
}
```

- [ ] **Étape 2 : Vérifier que TypeScript compile sans erreur**

```bash
cd c:/Users/remyd/Desktop/coaching/closrm
npx tsc --noEmit
```

Résultat attendu : aucune erreur. Si erreur sur les types Supabase (ex: `row.leads`), c'est normal — le client Supabase ne connaît pas le schéma. Les cast `as { first_name: string; last_name: string }` sont intentionnels.

- [ ] **Étape 3 : Commit**

```bash
git add src/lib/dashboard/queries.ts
git commit -m "feat: add dashboard Supabase queries (KPIs, calls, follow-ups, activity)"
```

---

## Task 2 : Composant `period-selector.tsx`

**Files:**
- Create: `src/components/dashboard/period-selector.tsx`

- [ ] **Étape 1 : Créer le composant**

```tsx
// Composant Server — pas besoin de 'use client'
// Génère des liens <a> simples qui rechargent la page avec ?period=X

interface PeriodSelectorProps {
  current: number  // période active (7, 30, ou 90)
}

const PERIODS = [
  { value: 7, label: '7j' },
  { value: 30, label: '30j' },
  { value: 90, label: '90j' },
]

export default function PeriodSelector({ current }: PeriodSelectorProps) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {PERIODS.map((p) => {
        const isActive = current === p.value
        return (
          <a
            key={p.value}
            href={`?period=${p.value}`}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              textDecoration: 'none',
              border: isActive ? '1px solid #00C853' : '1px solid #262626',
              color: isActive ? '#00C853' : '#666',
              background: isActive ? 'rgba(0,200,83,0.08)' : 'transparent',
            }}
          >
            {p.label}
          </a>
        )
      })}
    </div>
  )
}
```

- [ ] **Étape 2 : Commit**

```bash
git add src/components/dashboard/period-selector.tsx
git commit -m "feat: add PeriodSelector component"
```

---

## Task 3 : Composant `kpi-cards.tsx`

**Files:**
- Create: `src/components/dashboard/kpi-cards.tsx`

- [ ] **Étape 1 : Créer le composant**

```tsx
import { Users, Phone, Target, TrendingUp } from 'lucide-react'
import type { DashboardKpis } from '@/lib/dashboard/queries'

interface KpiCardsProps {
  kpis: DashboardKpis
}

const CARDS = [
  {
    key: 'newLeads' as const,
    label: 'Nouveaux leads',
    icon: Users,
    color: '#3b82f6',
    format: (v: number | null) => v ?? 0,
  },
  {
    key: 'plannedCalls' as const,
    label: 'Appels planifiés',
    icon: Phone,
    color: '#f59e0b',
    format: (v: number | null) => v ?? 0,
  },
  {
    key: 'closedDeals' as const,
    label: 'Deals closés',
    icon: Target,
    color: '#00C853',
    format: (v: number | null) => v ?? 0,
  },
  {
    key: 'closingRate' as const,
    label: 'Taux de closing',
    icon: TrendingUp,
    color: '#a855f7',
    format: (v: number | null) => v !== null ? `${v}%` : '—',
  },
]

export default function KpiCards({ kpis }: KpiCardsProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
      gap: 12,
      marginBottom: 14,
    }}>
      {CARDS.map(({ key, label, icon: Icon, color, format }) => (
        <div key={key} style={{
          background: '#0f0f11',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 14,
          padding: 20,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: color + '18',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 14,
          }}>
            <Icon size={16} color={color} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#fff' }}>
            {format(kpis[key] as number | null)}
          </div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{label}</div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Étape 2 : Commit**

```bash
git add src/components/dashboard/kpi-cards.tsx
git commit -m "feat: add KpiCards component"
```

---

## Task 4 : Composant `upcoming-calls.tsx`

**Files:**
- Create: `src/components/dashboard/upcoming-calls.tsx`

- [ ] **Étape 1 : Créer le composant**

```tsx
import Link from 'next/link'
import { Phone } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { UpcomingCall } from '@/lib/dashboard/queries'

interface UpcomingCallsProps {
  calls: UpcomingCall[]
}

const CATEGORY_CONFIG = {
  overdue: { label: 'En retard', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: '#ef4444' },
  today:   { label: "Aujourd'hui", color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: '#f59e0b' },
  upcoming: { label: 'À venir', color: '#888', bg: 'rgba(255,255,255,0.05)', border: '#333' },
}

export default function UpcomingCalls({ calls }: UpcomingCallsProps) {
  const card: React.CSSProperties = {
    background: '#0f0f11',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 20,
  }

  return (
    <div style={card}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Phone size={14} color="#f59e0b" />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Prochains appels</span>
        </div>
        <span style={{ fontSize: 10, color: '#555' }}>Aujourd'hui + 7j</span>
      </div>

      {calls.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '28px 0' }}>
          <Phone size={22} color="#333" />
          <p style={{ fontSize: 13, color: '#888', marginTop: 10 }}>Aucun appel planifié</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {calls.map((call) => {
            const cfg = CATEGORY_CONFIG[call.category]
            return (
              <Link
                key={call.id}
                href={`/leads/${call.lead_id}`}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 10px', background: '#0a0a0c',
                  borderRadius: 8, borderLeft: `2px solid ${cfg.border}`,
                  textDecoration: 'none',
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{call.lead_name}</div>
                  <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                    {call.type === 'setting' ? 'Setting' : 'Closing'} ·{' '}
                    {format(new Date(call.scheduled_at), "d MMM 'à' HH'h'mm", { locale: fr })}
                  </div>
                </div>
                <span style={{
                  fontSize: 10, color: cfg.color, background: cfg.bg,
                  padding: '3px 8px', borderRadius: 99, flexShrink: 0,
                }}>
                  {cfg.label}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Étape 2 : Commit**

```bash
git add src/components/dashboard/upcoming-calls.tsx
git commit -m "feat: add UpcomingCalls component"
```

---

## Task 5 : Composant `overdue-followups.tsx`

**Files:**
- Create: `src/components/dashboard/overdue-followups.tsx`

- [ ] **Étape 1 : Créer le composant**

```tsx
import Link from 'next/link'
import { Clock } from 'lucide-react'
import type { OverdueFollowUp } from '@/lib/dashboard/queries'

interface OverdueFollowUpsProps {
  followUps: OverdueFollowUp[]
}

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  manuel: 'Manuel',
}

export default function OverdueFollowUps({ followUps }: OverdueFollowUpsProps) {
  const card: React.CSSProperties = {
    background: '#0f0f11',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 20,
  }

  return (
    <div style={card}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={14} color="#ef4444" />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Follow-ups en retard</span>
        </div>
        {followUps.length > 0 ? (
          <span style={{
            fontSize: 10, color: '#ef4444', background: 'rgba(239,68,68,0.1)',
            padding: '3px 10px', borderRadius: 99, fontWeight: 600,
          }}>
            {followUps.length} en retard
          </span>
        ) : (
          <span style={{
            fontSize: 10, color: '#00C853', background: 'rgba(0,200,83,0.08)',
            padding: '3px 10px', borderRadius: 99, fontWeight: 600,
          }}>
            À jour
          </span>
        )}
      </div>

      {followUps.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '28px 0' }}>
          <Clock size={22} color="#333" />
          <p style={{ fontSize: 13, color: '#888', marginTop: 10 }}>Aucun follow-up en retard</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {followUps.map((fu) => (
            <Link
              key={fu.id}
              href={`/leads/${fu.lead_id}`}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 10px', background: '#0a0a0c', borderRadius: 8,
                textDecoration: 'none',
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{fu.lead_name}</div>
                <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                  {CHANNEL_LABEL[fu.channel]}
                </div>
              </div>
              <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>
                -{fu.days_overdue}j
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Étape 2 : Commit**

```bash
git add src/components/dashboard/overdue-followups.tsx
git commit -m "feat: add OverdueFollowUps component"
```

---

## Task 6 : Composant `recent-activity.tsx`

**Files:**
- Create: `src/components/dashboard/recent-activity.tsx`

- [ ] **Étape 1 : Créer le fichier avec le helper `formatRelativeTime`**

```tsx
import { Activity } from 'lucide-react'
import type { ActivityEvent } from '@/lib/dashboard/queries'

interface RecentActivityProps {
  events: ActivityEvent[]
}

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 60) return `il y a ${minutes}min`
  if (hours < 24) return `il y a ${hours}h`
  if (days === 1) return 'hier'
  return `il y a ${days}j`
}

const TYPE_CONFIG = {
  new_lead:    { label: 'Nouveau lead', color: '#00C853' },
  call_logged: { label: 'Appel logué',  color: '#3b82f6' },
}

export default function RecentActivity({ events }: RecentActivityProps) {
  const card: React.CSSProperties = {
    background: '#0f0f11',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 20,
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Activity size={14} color="#888" />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Activité récente</span>
      </div>

      {events.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '28px 0' }}>
          <p style={{ fontSize: 13, color: '#888' }}>Aucune activité pour le moment</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {events.map((event, i) => {
            const cfg = TYPE_CONFIG[event.type]
            return (
              <div
                key={event.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  fontSize: 12, padding: '7px 0',
                  borderBottom: i < events.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}
              >
                <span style={{
                  color: cfg.color, fontSize: 11, fontWeight: 600,
                  width: 90, flexShrink: 0,
                }}>
                  {cfg.label}
                </span>
                <span style={{ color: '#ccc', flex: 1 }}>{event.description}</span>
                <span style={{ color: '#444', fontSize: 11, flexShrink: 0 }}>
                  {formatRelativeTime(event.created_at)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Étape 2 : Commit**

```bash
git add src/components/dashboard/recent-activity.tsx
git commit -m "feat: add RecentActivity component"
```

---

## Task 7 : Assembler `dashboard/page.tsx`

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Étape 1 : Remplacer intégralement le contenu du fichier**

```tsx
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import {
  fetchKpis,
  fetchUpcomingCalls,
  fetchOverdueFollowUps,
  fetchRecentActivity,
} from '@/lib/dashboard/queries'
import KpiCards from '@/components/dashboard/kpi-cards'
import PeriodSelector from '@/components/dashboard/period-selector'
import UpcomingCalls from '@/components/dashboard/upcoming-calls'
import OverdueFollowUps from '@/components/dashboard/overdue-followups'
import RecentActivity from '@/components/dashboard/recent-activity'

const VALID_PERIODS = [7, 30, 90] as const
type Period = (typeof VALID_PERIODS)[number]

interface Props {
  searchParams: Promise<{ period?: string }>
}

export default async function DashboardPage({ searchParams }: Props) {
  const params = await searchParams
  const periodParam = Number(params.period)
  const period: Period = (VALID_PERIODS.includes(periodParam as Period) ? periodParam : 30) as Period

  const { workspaceId, userId } = await getWorkspaceId()

  // Fetch du profil coach pour le prénom
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', userId)
    .single()

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Coach'

  // 4 requêtes en parallèle
  const [kpis, upcomingCalls, overdueFollowUps, recentActivity] = await Promise.all([
    fetchKpis(workspaceId, period),
    fetchUpcomingCalls(workspaceId),
    fetchOverdueFollowUps(workspaceId),
    fetchRecentActivity(workspaceId),
  ])

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28,
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 }}>
            Bonjour, {firstName} 👋
          </h1>
          <p style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
            Voici votre activité du moment
          </p>
        </div>
        <PeriodSelector current={period} />
      </div>

      {/* KPIs */}
      <KpiCards kpis={kpis} />

      {/* Prochains appels + Follow-ups en retard */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
        gap: 14,
        marginBottom: 14,
      }}>
        <UpcomingCalls calls={upcomingCalls} />
        <OverdueFollowUps followUps={overdueFollowUps} />
      </div>

      {/* Activité récente */}
      <RecentActivity events={recentActivity} />
    </div>
  )
}
```

- [ ] **Étape 2 : Vérifier que TypeScript compile**

```bash
npx tsc --noEmit
```

Résultat attendu : aucune erreur.

- [ ] **Étape 3 : Lancer le serveur de dev et vérifier visuellement**

```bash
npm run dev
```

Ouvrir `http://localhost:3000/dashboard` dans le navigateur. Vérifier :
- Le prénom du coach s'affiche dans le header
- Les 3 boutons de période sont visibles, "30j" actif par défaut
- Cliquer "7j" → URL change en `?period=7`, les KPIs se rechargent
- Les 4 KPI cards affichent des chiffres (0 si pas de données, pas d'erreur)
- Les sections appels/follow-ups affichent soit des données, soit l'état vide
- L'activité récente affiche les derniers events

- [ ] **Étape 4 : Commit final**

```bash
git add src/app/(dashboard)/dashboard/page.tsx
git commit -m "feat: T-003 — dashboard avec vraies données Supabase (KPIs, appels, follow-ups, activité)"
```

---

## Self-review

**Couverture spec :**
- ✅ Message de bienvenue avec prénom → Task 7
- ✅ 4 KPI cards branchées Supabase → Tasks 1 + 3
- ✅ Sélecteur période 7j/30j/90j → Task 2 (affecte uniquement KPIs)
- ✅ Prochains appels (en retard + aujourd'hui + 7j) → Tasks 1 + 4
- ✅ Follow-ups en retard → Tasks 1 + 5
- ✅ Activité récente (leads créés + appels) → Tasks 1 + 6
- ✅ Division par zéro sur taux closing → `closingRate = null` → Task 1
- ✅ Server Component → Task 7 (pas de `'use client'`)

**Hors scope (pas de tâche) :**
- Variations % → V1 non requis
- "Statut changé" dans activité → pas de table d'audit, exclu délibérément

---

*Plan créé le 2026-03-28 — ClosRM T-003*
