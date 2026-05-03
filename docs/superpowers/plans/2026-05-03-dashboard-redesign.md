# Dashboard Refonte v2 — Plan d'implémentation

**Goal:** Refondre le dashboard admin (`/dashboard`) en command center adaptatif (Hero + KPIs Stripe-style + listes algo + funnel + activity realtime + brief IA manuel).

**Architecture:** Server component `page.tsx` → fetch parallèle queries → client component `dashboard-client.tsx` orchestrateur → composants séparés par section. Pas de TDD (aligné convention projet, pas de tests existants). Implémentation par phases mergeables.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (queries + realtime), Anthropic SDK existant (`src/lib/ai`), inline styles avec CSS variables (convention projet, voir feedback memory).

**Spec source:** `docs/superpowers/specs/2026-05-03-dashboard-redesign-design.md`

**Branche:** `feature/pierre-sidebar-refacto` (continuer dessus, sera renommée mentalement "dashboard-v2" mais on évite le rebase)

---

## File Structure

**Création :**
```
src/components/dashboard/v2/
  hero/
    next-call-card.tsx           # Card prochain RDV adaptative
    day-plan-card.tsx            # Card plan du jour
    pre-call-brief-modal.tsx     # Modal brief IA
  kpis/
    kpi-card.tsx                 # Card KPI réutilisable
    sparkline.tsx                # SVG sparkline
    kpi-grid.tsx                 # Grid 5 cards
  lists/
    risk-leads-card.tsx          # Liste leads à risque (algo)
    hot-leads-card.tsx           # Liste leads chauds (algo)
    list-row.tsx                 # Row réutilisable
  funnel/
    conversion-funnel.tsx        # Funnel cliquable 4 étapes
  activity/
    realtime-activity-feed.tsx   # Feed Supabase realtime
  period-selector-v2.tsx         # Period selector amélioré (7/30/90/mois)

src/lib/dashboard/
  v2-queries.ts                  # Toutes les queries v2 (KPIs, listes, funnel, sparkline)
  algorithms.ts                  # Score lead, prio day plan
  realtime.ts                    # Helper Supabase realtime channels

src/app/api/dashboard/
  brief/route.ts                 # POST génération brief IA (réutilise infra T-032)

supabase/migrations/
  061_ai_call_briefs.sql         # Table cache briefs IA
```

**Modification :**
```
src/app/(dashboard)/dashboard/page.tsx     # Router vers v2 pour role admin
src/components/dashboard/dashboard-client.tsx → REMPLACÉ par v2 layout
```

---

## Phase 1 — Foundation : Layout + Period + KPI Cards

### Task 1.1 : Migration table briefs IA

**Files:**
- Create: `supabase/migrations/061_ai_call_briefs.sql`

- [ ] **Step 1: Écrire la migration**

```sql
-- Cache des briefs IA générés avant call (économie crédits)
create table if not exists ai_call_briefs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  booking_id uuid references bookings(id) on delete set null,
  brief_content jsonb not null,
  generated_at timestamptz not null default now(),
  generated_by uuid references users(id),
  unique (lead_id, booking_id)
);

create index if not exists ai_call_briefs_lead_idx
  on ai_call_briefs(lead_id, generated_at desc);

create index if not exists ai_call_briefs_workspace_idx
  on ai_call_briefs(workspace_id);

alter table ai_call_briefs enable row level security;

create policy "ai_call_briefs_workspace_select"
  on ai_call_briefs for select
  using (workspace_id in (
    select workspace_id from workspace_members
    where user_id = auth.uid() and status = 'active'
  ));

create policy "ai_call_briefs_workspace_insert"
  on ai_call_briefs for insert
  with check (workspace_id in (
    select workspace_id from workspace_members
    where user_id = auth.uid() and status = 'active'
  ));

create policy "ai_call_briefs_workspace_update"
  on ai_call_briefs for update
  using (workspace_id in (
    select workspace_id from workspace_members
    where user_id = auth.uid() and status = 'active'
  ));
```

- [ ] **Step 2: Appliquer en local**

```bash
supabase db push
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/061_ai_call_briefs.sql
git commit -m "feat(dashboard): migration table cache briefs IA"
```

### Task 1.2 : Module v2-queries — KPIs étendus avec delta + sparkline

**Files:**
- Create: `src/lib/dashboard/v2-queries.ts`

- [ ] **Step 1: Écrire le module avec tous les types et fonctions KPI**

```typescript
import { createClient } from '@/lib/supabase/server'

export interface KpiValue {
  current: number
  previous: number
  delta_pct: number | null
  sparkline: number[]  // 14 points (jours)
  format?: 'currency' | 'percent' | 'integer'
}

export interface DashboardKpisV2 {
  cash_collected: KpiValue
  show_rate: KpiValue
  close_rate: KpiValue
  cost_per_booking: KpiValue | null  // null si Meta non connecté
  pipeline_value: KpiValue
}

function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return Math.round(((current - previous) / previous) * 100)
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function buildSparkline(rows: { date: string; value: number }[], days = 14): number[] {
  const map = new Map(rows.map(r => [r.date, r.value]))
  const out: number[] = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    out.push(map.get(dayKey(d)) ?? 0)
  }
  return out
}

export async function fetchKpisV2(workspaceId: string, period: number): Promise<DashboardKpisV2> {
  const supabase = await createClient()
  const now = new Date()
  const sinceCurrent = new Date(now.getTime() - period * 86400000).toISOString()
  const sincePrevious = new Date(now.getTime() - period * 2 * 86400000).toISOString()
  const sparklineSince = new Date(now.getTime() - 14 * 86400000).toISOString()

  // Cash collected
  const { data: dealsCurrent } = await supabase
    .from('deals')
    .select('cash_collected, created_at')
    .eq('workspace_id', workspaceId)
    .gte('created_at', sinceCurrent)

  const { data: dealsPrevious } = await supabase
    .from('deals')
    .select('cash_collected')
    .eq('workspace_id', workspaceId)
    .gte('created_at', sincePrevious)
    .lt('created_at', sinceCurrent)

  const cashCurrent = (dealsCurrent ?? []).reduce((s, d) => s + Number(d.cash_collected ?? 0), 0)
  const cashPrevious = (dealsPrevious ?? []).reduce((s, d) => s + Number(d.cash_collected ?? 0), 0)

  const { data: dealsSparkline } = await supabase
    .from('deals')
    .select('cash_collected, created_at')
    .eq('workspace_id', workspaceId)
    .gte('created_at', sparklineSince)

  const cashByDay = new Map<string, number>()
  for (const d of dealsSparkline ?? []) {
    const k = dayKey(new Date(d.created_at))
    cashByDay.set(k, (cashByDay.get(k) ?? 0) + Number(d.cash_collected ?? 0))
  }
  const cashSparkline = buildSparkline(
    Array.from(cashByDay, ([date, value]) => ({ date, value }))
  )

  // Show rate (calls passés avec outcome reached)
  const { data: pastCalls } = await supabase
    .from('calls')
    .select('outcome, scheduled_at')
    .eq('workspace_id', workspaceId)
    .gte('scheduled_at', sinceCurrent)
    .lt('scheduled_at', now.toISOString())

  const showCurrent = pastCalls?.filter(c => c.outcome === 'fait' || c.outcome === 'closed').length ?? 0
  const totalPastCurrent = pastCalls?.length ?? 0
  const showRateCurrent = totalPastCurrent > 0 ? Math.round((showCurrent / totalPastCurrent) * 100) : 0

  const { data: pastCallsPrev } = await supabase
    .from('calls')
    .select('outcome')
    .eq('workspace_id', workspaceId)
    .gte('scheduled_at', sincePrevious)
    .lt('scheduled_at', sinceCurrent)

  const showPrevious = pastCallsPrev?.filter(c => c.outcome === 'fait' || c.outcome === 'closed').length ?? 0
  const totalPastPrev = pastCallsPrev?.length ?? 0
  const showRatePrevious = totalPastPrev > 0 ? Math.round((showPrevious / totalPastPrev) * 100) : 0

  // Close rate (deals closés / calls présents)
  const { data: closedDealsCurrent } = await supabase
    .from('deals')
    .select('id, created_at')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .gte('created_at', sinceCurrent)

  const closeRateCurrent = showCurrent > 0
    ? Math.round(((closedDealsCurrent?.length ?? 0) / showCurrent) * 100)
    : 0

  // Pipeline value (deals ouverts)
  const { data: openDeals } = await supabase
    .from('deals')
    .select('amount')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')

  const pipelineValue = (openDeals ?? []).reduce((s, d) => s + Number(d.amount ?? 0), 0)

  return {
    cash_collected: {
      current: cashCurrent,
      previous: cashPrevious,
      delta_pct: pctDelta(cashCurrent, cashPrevious),
      sparkline: cashSparkline,
      format: 'currency',
    },
    show_rate: {
      current: showRateCurrent,
      previous: showRatePrevious,
      delta_pct: pctDelta(showRateCurrent, showRatePrevious),
      sparkline: [], // TODO phase 1.5 si besoin
      format: 'percent',
    },
    close_rate: {
      current: closeRateCurrent,
      previous: 0,
      delta_pct: null,
      sparkline: [],
      format: 'percent',
    },
    cost_per_booking: null,  // Meta non géré en phase 1
    pipeline_value: {
      current: pipelineValue,
      previous: 0,
      delta_pct: null,
      sparkline: [],
      format: 'currency',
    },
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/dashboard/v2-queries.ts
git commit -m "feat(dashboard): v2-queries fetchKpisV2 avec delta + sparkline"
```

### Task 1.3 : Composant Sparkline SVG

**Files:**
- Create: `src/components/dashboard/v2/kpis/sparkline.tsx`

- [ ] **Step 1: Composant sparkline**

```typescript
'use client'

interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  color?: string
}

export default function Sparkline({
  values,
  width = 80,
  height = 28,
  color = 'var(--color-primary)',
}: SparklineProps) {
  if (values.length < 2) return <div style={{ width, height }} />

  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const stepX = width / (values.length - 1)

  const points = values.map((v, i) => {
    const x = i * stepX
    const y = height - ((v - min) / range) * height
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        points={points}
      />
    </svg>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/v2/kpis/sparkline.tsx
git commit -m "feat(dashboard): composant Sparkline SVG"
```

### Task 1.4 : Composant KpiCard

**Files:**
- Create: `src/components/dashboard/v2/kpis/kpi-card.tsx`

- [ ] **Step 1: Composant KPI card**

```typescript
'use client'

import Sparkline from './sparkline'
import type { KpiValue } from '@/lib/dashboard/v2-queries'

function formatValue(v: number, fmt?: KpiValue['format']): string {
  if (fmt === 'currency') return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
  if (fmt === 'percent') return `${v}%`
  return new Intl.NumberFormat('fr-FR').format(v)
}

export default function KpiCard({ label, value }: { label: string; value: KpiValue }) {
  const delta = value.delta_pct
  const isPositive = delta !== null && delta >= 0
  const deltaColor = delta === null ? 'var(--text-muted)' : isPositive ? 'var(--color-success)' : 'var(--color-danger)'

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-primary)',
      borderRadius: 12,
      padding: 16,
      display: 'flex', flexDirection: 'column', gap: 8,
      minHeight: 110,
    }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
          {formatValue(value.current, value.format)}
        </div>
        {value.sparkline.length > 0 && <Sparkline values={value.sparkline} />}
      </div>
      <div style={{ fontSize: 12, color: deltaColor, fontWeight: 500 }}>
        {delta === null ? '—' : `${isPositive ? '↑' : '↓'} ${Math.abs(delta)}% vs période préc.`}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/v2/kpis/kpi-card.tsx
git commit -m "feat(dashboard): composant KpiCard 3 layers"
```

### Task 1.5 : KpiGrid (orchestrateur 5 cards)

**Files:**
- Create: `src/components/dashboard/v2/kpis/kpi-grid.tsx`

- [ ] **Step 1: Grid 5 cards**

```typescript
'use client'

import KpiCard from './kpi-card'
import type { DashboardKpisV2 } from '@/lib/dashboard/v2-queries'

export default function KpiGrid({ kpis }: { kpis: DashboardKpisV2 }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: 12,
      marginBottom: 16,
    }}>
      <KpiCard label="Cash collecté" value={kpis.cash_collected} />
      <KpiCard label="Show rate" value={kpis.show_rate} />
      <KpiCard label="Close rate" value={kpis.close_rate} />
      {kpis.cost_per_booking && <KpiCard label="Coût par RDV" value={kpis.cost_per_booking} />}
      <KpiCard label="Pipeline" value={kpis.pipeline_value} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/v2/kpis/kpi-grid.tsx
git commit -m "feat(dashboard): KpiGrid orchestrateur 5 cards"
```

### Task 1.6 : PeriodSelectorV2

**Files:**
- Create: `src/components/dashboard/v2/period-selector-v2.tsx`

- [ ] **Step 1: Period selector pill-style**

```typescript
'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const OPTIONS = [
  { value: 7, label: '7 jours' },
  { value: 30, label: '30 jours' },
  { value: 90, label: '90 jours' },
] as const

export default function PeriodSelectorV2({ current }: { current: number }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function setPeriod(p: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('period', String(p))
    router.push(`?${params.toString()}`)
  }

  return (
    <div style={{
      display: 'inline-flex',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-primary)',
      borderRadius: 10,
      padding: 3,
      gap: 2,
    }}>
      {OPTIONS.map(opt => {
        const active = current === opt.value
        return (
          <button
            key={opt.value}
            onClick={() => setPeriod(opt.value)}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 500,
              borderRadius: 7,
              border: active ? '1px solid var(--border-primary)' : '1px solid transparent',
              background: active ? 'var(--bg-secondary)' : 'transparent',
              color: active ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              boxShadow: active ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/v2/period-selector-v2.tsx
git commit -m "feat(dashboard): PeriodSelectorV2 pill-style"
```

### Task 1.7 : DashboardClientV2 (squelette + KPIs uniquement)

**Files:**
- Create: `src/components/dashboard/v2/dashboard-client-v2.tsx`

- [ ] **Step 1: Layout principal v2 avec KPIs seulement (placeholders pour autres sections)**

```typescript
'use client'

import KpiGrid from './kpis/kpi-grid'
import PeriodSelectorV2 from './period-selector-v2'
import type { DashboardKpisV2 } from '@/lib/dashboard/v2-queries'

interface Props {
  firstName: string
  period: number
  kpis: DashboardKpisV2
}

export default function DashboardClientV2({ firstName, period, kpis }: Props) {
  return (
    <div style={{ padding: 32, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Bonjour, {firstName} 👋
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Voici votre command center
          </p>
        </div>
        <PeriodSelectorV2 current={period} />
      </div>

      {/* TODO Phase 2 : Hero (Next call + Day plan) */}

      {/* KPIs */}
      <KpiGrid kpis={kpis} />

      {/* TODO Phase 3 : Lists (risk + hot leads) */}
      {/* TODO Phase 4 : Funnel */}
      {/* TODO Phase 5 : Activity feed realtime */}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/v2/dashboard-client-v2.tsx
git commit -m "feat(dashboard): DashboardClientV2 squelette + KPIs"
```

### Task 1.8 : Brancher v2 dans la page admin

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Remplacer l'admin path par v2**

```typescript
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { fetchKpisV2 } from '@/lib/dashboard/v2-queries'
import DashboardClientV2 from '@/components/dashboard/v2/dashboard-client-v2'
import SetterDashboard from '@/components/dashboard/SetterDashboard'
import CloserDashboard from '@/components/dashboard/CloserDashboard'

const VALID_PERIODS = [7, 30, 90] as const
type Period = (typeof VALID_PERIODS)[number]

interface Props {
  searchParams: Promise<{ period?: string }>
}

export default async function DashboardPage({ searchParams }: Props) {
  const params = await searchParams
  const periodParam = Number(params.period)
  const period: Period = (VALID_PERIODS.includes(periodParam as Period) ? periodParam : 30) as Period

  const { workspaceId, userId, role } = await getWorkspaceId()

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', userId)
    .single()

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Coach'

  if (role === 'setter') return <SetterDashboard firstName={firstName} userId={userId} />
  if (role === 'closer') return <CloserDashboard firstName={firstName} userId={userId} />

  // Admin → v2
  const kpis = await fetchKpisV2(workspaceId, period)

  return (
    <DashboardClientV2
      firstName={firstName}
      period={period}
      kpis={kpis}
    />
  )
}
```

- [ ] **Step 2: Lancer le dev server et vérifier**

```bash
npm run dev
# Ouvrir http://localhost:3000/dashboard
# Vérifier : header + period selector + 5 KPIs avec sparkline cash
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat(dashboard): brancher v2 admin avec KPIs"
```

---

## Phase 2 — Hero adaptatif (Next call + Day plan)

### Task 2.1 : Query `getNextBooking` + `getDayPlan` dans v2-queries

**Files:**
- Modify: `src/lib/dashboard/v2-queries.ts`

- [ ] **Step 1: Ajouter types et fonctions**

```typescript
export interface NextBooking {
  id: string
  lead_id: string
  lead_name: string
  scheduled_at: string
  source: string | null
  email: string | null
  phone: string | null
  meet_url: string | null
  location_type: 'presentiel' | 'meet' | 'visio' | null
}

export interface DayPlanItem {
  type: 'booking' | 'hot_lead' | 'overdue_followup' | 'no_show'
  lead_id: string
  lead_name: string
  context: string  // ex: "RDV 14h", "Inactif 3j", "FU en retard 2j"
  scheduled_at?: string
  priority: number  // 1 = top
}

export async function getNextBooking(workspaceId: string): Promise<NextBooking | null> {
  const supabase = await createClient()
  const now = new Date().toISOString()
  const in24h = new Date(Date.now() + 24 * 86400000).toISOString()

  const { data } = await supabase
    .from('bookings')
    .select('id, scheduled_at, meet_url, location_type, leads(id, first_name, last_name, source, email, phone)')
    .eq('workspace_id', workspaceId)
    .gte('scheduled_at', now)
    .lte('scheduled_at', in24h)
    .neq('status', 'cancelled')
    .order('scheduled_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!data) return null
  const lead = data.leads as unknown as { id: string; first_name: string; last_name: string; source: string | null; email: string | null; phone: string | null }

  return {
    id: data.id,
    lead_id: lead.id,
    lead_name: `${lead.first_name} ${lead.last_name}`,
    scheduled_at: data.scheduled_at,
    source: lead.source,
    email: lead.email,
    phone: lead.phone,
    meet_url: data.meet_url,
    location_type: data.location_type as 'presentiel' | 'meet' | 'visio' | null,
  }
}

export async function getDayPlan(workspaceId: string): Promise<DayPlanItem[]> {
  const supabase = await createClient()
  const now = new Date()
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString()

  const items: DayPlanItem[] = []

  // 1. RDV aujourd'hui (priority 1)
  const { data: bookings } = await supabase
    .from('bookings')
    .select('scheduled_at, leads(id, first_name, last_name)')
    .eq('workspace_id', workspaceId)
    .gte('scheduled_at', now.toISOString())
    .lte('scheduled_at', todayEnd)
    .neq('status', 'cancelled')

  for (const b of bookings ?? []) {
    const l = b.leads as unknown as { id: string; first_name: string; last_name: string }
    const time = new Date(b.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    items.push({
      type: 'booking',
      lead_id: l.id,
      lead_name: `${l.first_name} ${l.last_name}`,
      context: `RDV ${time}`,
      scheduled_at: b.scheduled_at,
      priority: 1,
    })
  }

  // 2. Follow-ups en retard (priority 2)
  const { data: fus } = await supabase
    .from('follow_ups')
    .select('scheduled_at, leads(id, first_name, last_name)')
    .eq('workspace_id', workspaceId)
    .eq('status', 'en_attente')
    .lt('scheduled_at', now.toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(3)

  for (const f of fus ?? []) {
    const l = f.leads as unknown as { id: string; first_name: string; last_name: string }
    const days = Math.max(1, Math.floor((Date.now() - new Date(f.scheduled_at).getTime()) / 86400000))
    items.push({
      type: 'overdue_followup',
      lead_id: l.id,
      lead_name: `${l.first_name} ${l.last_name}`,
      context: `FU en retard ${days}j`,
      priority: 2,
    })
  }

  // 3. No-shows à reprogrammer (priority 3)
  const { data: noShows } = await supabase
    .from('calls')
    .select('scheduled_at, leads(id, first_name, last_name)')
    .eq('workspace_id', workspaceId)
    .eq('outcome', 'no_show')
    .gte('scheduled_at', sevenDaysAgo)
    .limit(2)

  for (const c of noShows ?? []) {
    const l = c.leads as unknown as { id: string; first_name: string; last_name: string }
    items.push({
      type: 'no_show',
      lead_id: l.id,
      lead_name: `${l.first_name} ${l.last_name}`,
      context: `No-show à reprogrammer`,
      priority: 3,
    })
  }

  return items.sort((a, b) => a.priority - b.priority).slice(0, 7)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/dashboard/v2-queries.ts
git commit -m "feat(dashboard): queries getNextBooking + getDayPlan"
```

### Task 2.2 : Composant NextCallCard

**Files:**
- Create: `src/components/dashboard/v2/hero/next-call-card.tsx`

- [ ] **Step 1: Card adaptative**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { Video, Phone as PhoneIcon, Mail, Sparkles, ExternalLink } from 'lucide-react'
import type { NextBooking } from '@/lib/dashboard/v2-queries'

function useCountdown(targetIso: string) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])
  const diff = new Date(targetIso).getTime() - now
  if (diff <= 0) return 'maintenant'
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `dans ${mins} min`
  const hrs = Math.floor(mins / 60)
  return `dans ${hrs}h${(mins % 60).toString().padStart(2, '0')}`
}

interface Props {
  booking: NextBooking | null
  onGenerateBrief: (bookingId: string, leadId: string) => void
}

export default function NextCallCard({ booking, onGenerateBrief }: Props) {
  if (!booking) {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>PROCHAIN RDV</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
          🎯 À jour
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
          Aucun RDV dans les 24 prochaines heures.
        </div>
      </div>
    )
  }

  const countdown = useCountdown(booking.scheduled_at)
  const time = new Date(booking.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>PROCHAIN RDV</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
        {booking.lead_name}
      </div>
      <div style={{ fontSize: 14, color: 'var(--color-primary)', fontWeight: 600, marginTop: 4 }}>
        {time} · {countdown}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        {booking.source && <span>📍 {booking.source}</span>}
        {booking.email && <span><Mail size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> {booking.email}</span>}
        {booking.phone && <span><PhoneIcon size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> {booking.phone}</span>}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        {booking.meet_url && (
          <a href={booking.meet_url} target="_blank" rel="noopener" style={primaryBtnStyle}>
            <Video size={14} /> Rejoindre Meet
          </a>
        )}
        <button onClick={() => onGenerateBrief(booking.id, booking.lead_id)} style={secondaryBtnStyle}>
          <Sparkles size={14} /> Générer brief IA
        </button>
        <a href={`/leads/${booking.lead_id}`} style={ghostBtnStyle}>
          <ExternalLink size={14} /> Fiche lead
        </a>
      </div>
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-primary)',
  borderRadius: 12,
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
  minHeight: 200,
}
const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', borderRadius: 8,
  background: 'var(--color-primary)', color: '#fff',
  fontSize: 13, fontWeight: 600, textDecoration: 'none', border: 'none', cursor: 'pointer',
}
const secondaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', borderRadius: 8,
  background: 'var(--bg-elevated)', color: 'var(--text-primary)',
  fontSize: 13, fontWeight: 600, border: '1px solid var(--border-primary)', cursor: 'pointer',
}
const ghostBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', borderRadius: 8,
  background: 'transparent', color: 'var(--text-muted)',
  fontSize: 13, fontWeight: 500, border: '1px solid var(--border-primary)', textDecoration: 'none',
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/v2/hero/next-call-card.tsx
git commit -m "feat(dashboard): NextCallCard adaptative avec countdown"
```

### Task 2.3 : Composant DayPlanCard

**Files:**
- Create: `src/components/dashboard/v2/hero/day-plan-card.tsx`

- [ ] **Step 1: Card day plan**

```typescript
'use client'

import { Calendar, Clock, RefreshCw, Flame } from 'lucide-react'
import type { DayPlanItem } from '@/lib/dashboard/v2-queries'

const ICONS = {
  booking: Calendar,
  overdue_followup: Clock,
  no_show: RefreshCw,
  hot_lead: Flame,
} as const

const COLORS = {
  booking: 'var(--color-primary)',
  overdue_followup: 'var(--color-warning)',
  no_show: 'var(--color-danger)',
  hot_lead: '#f59e0b',
} as const

export default function DayPlanCard({ items }: { items: DayPlanItem[] }) {
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-primary)',
      borderRadius: 12,
      padding: 20,
      minHeight: 200,
    }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
        PLAN DU JOUR
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Rien d'urgent aujourd'hui ✨
        </div>
      ) : (
        <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((item, i) => {
            const Icon = ICONS[item.type]
            const color = COLORS[item.type]
            return (
              <li key={`${item.type}-${item.lead_id}-${i}`}>
                <a href={`/leads/${item.lead_id}`} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 8,
                  textDecoration: 'none',
                  color: 'var(--text-primary)',
                  background: 'transparent',
                  transition: 'background 0.15s ease',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ width: 18, color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>{i + 1}.</span>
                  <Icon size={14} style={{ color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{item.lead_name}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.context}</span>
                </a>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/v2/hero/day-plan-card.tsx
git commit -m "feat(dashboard): DayPlanCard avec liste prio"
```

### Task 2.4 : API route brief IA

**Files:**
- Create: `src/app/api/dashboard/brief/route.ts`

- [ ] **Step 1: Route POST génération brief**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { getApiKey } from '@/lib/ai/brief'
import { callClaude } from '@/lib/ai/client'

export async function POST(req: NextRequest) {
  try {
    const { lead_id, booking_id } = await req.json()
    if (!lead_id) return NextResponse.json({ error: 'lead_id requis' }, { status: 400 })

    const { workspaceId, userId } = await getWorkspaceId()
    const supabase = await createClient()

    // Cache : si brief existe pour ce booking < 24h, retourner
    if (booking_id) {
      const { data: cached } = await supabase
        .from('ai_call_briefs')
        .select('brief_content, generated_at')
        .eq('lead_id', lead_id)
        .eq('booking_id', booking_id)
        .maybeSingle()

      if (cached && (Date.now() - new Date(cached.generated_at).getTime()) < 86400000) {
        return NextResponse.json({ brief: cached.brief_content, cached: true })
      }
    }

    // Fetch lead context
    const { data: lead } = await supabase
      .from('leads')
      .select('first_name, last_name, source, status, tags, notes, email, phone')
      .eq('id', lead_id)
      .single()

    if (!lead) return NextResponse.json({ error: 'Lead introuvable' }, { status: 404 })

    const apiKey = await getApiKey(workspaceId)
    if (!apiKey) return NextResponse.json({ error: 'Clé API IA non configurée. Va dans Paramètres > Assistant IA.' }, { status: 400 })

    const prompt = `Tu es un assistant pour un coach qui s'apprête à faire un call de closing.
Génère un brief court et actionnable basé sur ce lead.

Lead : ${lead.first_name} ${lead.last_name}
Source : ${lead.source ?? 'inconnue'}
Statut : ${lead.status}
Tags : ${(lead.tags ?? []).join(', ') || 'aucun'}
Notes : ${lead.notes ?? 'aucune'}

Renvoie UNIQUEMENT du JSON strict avec cette structure :
{
  "summary": ["3 puces max décrivant le lead"],
  "questions": ["2-3 questions d'ouverture suggérées"],
  "risks": ["1-2 risques/objections probables"]
}`

    const response = await callClaude(prompt, apiKey, 'claude-sonnet-4-20250514')
    let brief: { summary: string[]; questions: string[]; risks: string[] }
    try {
      const cleaned = response.replace(/```json\n?|\n?```/g, '').trim()
      brief = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({ error: 'Réponse IA invalide' }, { status: 500 })
    }

    if (booking_id) {
      await supabase
        .from('ai_call_briefs')
        .upsert({
          workspace_id: workspaceId,
          lead_id,
          booking_id,
          brief_content: brief,
          generated_by: userId,
        }, { onConflict: 'lead_id,booking_id' })
    }

    return NextResponse.json({ brief, cached: false })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/dashboard/brief/route.ts
git commit -m "feat(dashboard): API route POST génération brief IA"
```

### Task 2.5 : Modal pre-call brief

**Files:**
- Create: `src/components/dashboard/v2/hero/pre-call-brief-modal.tsx`

- [ ] **Step 1: Modal**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { X, Sparkles, AlertCircle } from 'lucide-react'

interface BriefContent {
  summary: string[]
  questions: string[]
  risks: string[]
}

interface Props {
  open: boolean
  bookingId: string | null
  leadId: string | null
  onClose: () => void
}

export default function PreCallBriefModal({ open, bookingId, leadId, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [brief, setBrief] = useState<BriefContent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cached, setCached] = useState(false)

  useEffect(() => {
    if (!open || !leadId) return
    setLoading(true)
    setBrief(null)
    setError(null)
    fetch('/api/dashboard/brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: leadId, booking_id: bookingId }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else { setBrief(data.brief); setCached(data.cached) }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [open, leadId, bookingId])

  if (!open) return null

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-secondary)', borderRadius: 12, padding: 24,
        width: '90%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto',
        border: '1px solid var(--border-primary)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, fontSize: 18, color: 'var(--text-primary)' }}>
            <Sparkles size={18} color="var(--color-primary)" /> Brief pré-call
            {cached && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>(cache)</span>}
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        {loading && <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>Génération en cours…</div>}

        {error && (
          <div style={{ display: 'flex', gap: 8, padding: 12, background: 'var(--bg-elevated)', borderRadius: 8, color: 'var(--color-danger)', fontSize: 13 }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {brief && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Section title="Résumé" items={brief.summary} />
            <Section title="Questions d'ouverture" items={brief.questions} />
            <Section title="Risques / objections" items={brief.risks} />
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-label)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/v2/hero/pre-call-brief-modal.tsx
git commit -m "feat(dashboard): modal pre-call brief avec cache 24h"
```

### Task 2.6 : Brancher Hero dans DashboardClientV2

**Files:**
- Modify: `src/components/dashboard/v2/dashboard-client-v2.tsx`
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Update DashboardClientV2 avec hero**

```typescript
'use client'

import { useState } from 'react'
import KpiGrid from './kpis/kpi-grid'
import PeriodSelectorV2 from './period-selector-v2'
import NextCallCard from './hero/next-call-card'
import DayPlanCard from './hero/day-plan-card'
import PreCallBriefModal from './hero/pre-call-brief-modal'
import type { DashboardKpisV2, NextBooking, DayPlanItem } from '@/lib/dashboard/v2-queries'

interface Props {
  firstName: string
  period: number
  kpis: DashboardKpisV2
  nextBooking: NextBooking | null
  dayPlan: DayPlanItem[]
}

export default function DashboardClientV2({ firstName, period, kpis, nextBooking, dayPlan }: Props) {
  const [briefModal, setBriefModal] = useState<{ bookingId: string | null; leadId: string | null } | null>(null)

  return (
    <div style={{ padding: 32, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Bonjour, {firstName} 👋
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Voici votre command center
          </p>
        </div>
        <PeriodSelectorV2 current={period} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 12, marginBottom: 16 }}>
        <NextCallCard
          booking={nextBooking}
          onGenerateBrief={(bookingId, leadId) => setBriefModal({ bookingId, leadId })}
        />
        <DayPlanCard items={dayPlan} />
      </div>

      <KpiGrid kpis={kpis} />

      <PreCallBriefModal
        open={briefModal !== null}
        bookingId={briefModal?.bookingId ?? null}
        leadId={briefModal?.leadId ?? null}
        onClose={() => setBriefModal(null)}
      />
    </div>
  )
}
```

- [ ] **Step 2: Update page.tsx pour fetcher hero data**

```typescript
// Dans le bloc admin (après if (role === 'closer')):
const [kpis, nextBooking, dayPlan] = await Promise.all([
  fetchKpisV2(workspaceId, period),
  getNextBooking(workspaceId),
  getDayPlan(workspaceId),
])

return (
  <DashboardClientV2
    firstName={firstName}
    period={period}
    kpis={kpis}
    nextBooking={nextBooking}
    dayPlan={dayPlan}
  />
)
```

Et ajouter les imports en haut :
```typescript
import { fetchKpisV2, getNextBooking, getDayPlan } from '@/lib/dashboard/v2-queries'
```

- [ ] **Step 3: Test localhost**

```bash
npm run dev
# http://localhost:3000/dashboard
# Vérifier hero + KPIs s'affichent. Cliquer "Générer brief IA" si un RDV existe.
```

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/v2/dashboard-client-v2.tsx src/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat(dashboard): brancher Hero (NextCall + DayPlan) avec brief modal"
```

---

## Phase 3 — Listes prioritaires (Risk + Hot leads)

### Task 3.1 : Queries `getRiskLeads` + `getHotLeads`

**Files:**
- Modify: `src/lib/dashboard/v2-queries.ts`

- [ ] **Step 1: Ajouter queries**

```typescript
export interface PriorityLead {
  id: string
  name: string
  context: string  // "Inactif 8j" ou "Activité récente"
  last_activity: string | null
  status: string
}

export async function getRiskLeads(workspaceId: string): Promise<PriorityLead[]> {
  const supabase = await createClient()
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()

  const { data } = await supabase
    .from('leads')
    .select('id, first_name, last_name, status, last_activity_at')
    .eq('workspace_id', workspaceId)
    .not('status', 'in', '(clos,dead)')
    .lt('last_activity_at', sevenDaysAgo)
    .order('last_activity_at', { ascending: true })
    .limit(5)

  return (data ?? []).map(l => {
    const days = l.last_activity_at
      ? Math.floor((Date.now() - new Date(l.last_activity_at).getTime()) / 86400000)
      : 999
    return {
      id: l.id,
      name: `${l.first_name} ${l.last_name}`,
      context: `Inactif ${days}j`,
      last_activity: l.last_activity_at,
      status: l.status,
    }
  })
}

export async function getHotLeads(workspaceId: string): Promise<PriorityLead[]> {
  const supabase = await createClient()
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString()

  // Hot = activité < 48h + tags 'chaud' ou status 'nouveau_lead'
  const { data } = await supabase
    .from('leads')
    .select('id, first_name, last_name, status, last_activity_at, tags')
    .eq('workspace_id', workspaceId)
    .gte('last_activity_at', twoDaysAgo)
    .not('status', 'in', '(clos,dead)')
    .order('last_activity_at', { ascending: false })
    .limit(20)

  // Filtrer en JS : tag chaud OU statut nouveau_lead
  const filtered = (data ?? []).filter(l =>
    (l.tags && (l.tags.includes('chaud') || l.tags.includes('VIP'))) ||
    l.status === 'nouveau_lead'
  ).slice(0, 5)

  return filtered.map(l => {
    const hrs = l.last_activity_at
      ? Math.max(1, Math.floor((Date.now() - new Date(l.last_activity_at).getTime()) / 3600000))
      : 0
    return {
      id: l.id,
      name: `${l.first_name} ${l.last_name}`,
      context: `Actif il y a ${hrs}h`,
      last_activity: l.last_activity_at,
      status: l.status,
    }
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/dashboard/v2-queries.ts
git commit -m "feat(dashboard): queries getRiskLeads + getHotLeads (algo)"
```

### Task 3.2 : Composants RiskLeadsCard + HotLeadsCard

**Files:**
- Create: `src/components/dashboard/v2/lists/risk-leads-card.tsx`
- Create: `src/components/dashboard/v2/lists/hot-leads-card.tsx`

- [ ] **Step 1: RiskLeadsCard**

```typescript
'use client'

import { AlertTriangle, ChevronRight } from 'lucide-react'
import type { PriorityLead } from '@/lib/dashboard/v2-queries'

export default function RiskLeadsCard({ leads }: { leads: PriorityLead[] }) {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={14} color="var(--color-warning)" />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-label)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Leads à risque
          </span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{leads.length}</span>
      </div>
      {leads.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucun lead à risque ✨</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {leads.map(l => (
            <li key={l.id}>
              <a href={`/leads/${l.id}`} style={rowStyle}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
                <span style={{ fontSize: 11, color: 'var(--color-warning)' }}>{l.context}</span>
                <ChevronRight size={12} color="var(--text-muted)" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-primary)',
  borderRadius: 12,
  padding: 16,
  minHeight: 180,
}

const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '8px 10px', borderRadius: 6,
  textDecoration: 'none',
  transition: 'background 0.15s ease',
}
```

- [ ] **Step 2: HotLeadsCard (similaire, color #f59e0b + icône Flame)**

```typescript
'use client'

import { Flame, ChevronRight } from 'lucide-react'
import type { PriorityLead } from '@/lib/dashboard/v2-queries'

export default function HotLeadsCard({ leads }: { leads: PriorityLead[] }) {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Flame size={14} color="#f59e0b" />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-label)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Leads chauds
          </span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{leads.length}</span>
      </div>
      {leads.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucun lead chaud actuellement</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {leads.map(l => (
            <li key={l.id}>
              <a href={`/leads/${l.id}`} style={rowStyle}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
                <span style={{ fontSize: 11, color: '#f59e0b' }}>{l.context}</span>
                <ChevronRight size={12} color="var(--text-muted)" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-primary)',
  borderRadius: 12,
  padding: 16,
  minHeight: 180,
}

const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '8px 10px', borderRadius: 6,
  textDecoration: 'none',
  transition: 'background 0.15s ease',
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/v2/lists/
git commit -m "feat(dashboard): RiskLeadsCard + HotLeadsCard"
```

### Task 3.3 : Brancher dans DashboardClientV2 + page.tsx

**Files:**
- Modify: `src/components/dashboard/v2/dashboard-client-v2.tsx`
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Ajouter section listes dans dashboard-client-v2**

Après `<KpiGrid>`, ajouter :

```typescript
import RiskLeadsCard from './lists/risk-leads-card'
import HotLeadsCard from './lists/hot-leads-card'
import type { PriorityLead } from '@/lib/dashboard/v2-queries'

// dans Props :
riskLeads: PriorityLead[]
hotLeads: PriorityLead[]

// Section après KpiGrid :
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12, marginBottom: 16 }}>
  <RiskLeadsCard leads={riskLeads} />
  <HotLeadsCard leads={hotLeads} />
</div>
```

- [ ] **Step 2: Update page.tsx**

```typescript
import { fetchKpisV2, getNextBooking, getDayPlan, getRiskLeads, getHotLeads } from '@/lib/dashboard/v2-queries'

// dans le bloc admin :
const [kpis, nextBooking, dayPlan, riskLeads, hotLeads] = await Promise.all([
  fetchKpisV2(workspaceId, period),
  getNextBooking(workspaceId),
  getDayPlan(workspaceId),
  getRiskLeads(workspaceId),
  getHotLeads(workspaceId),
])
```

- [ ] **Step 3: Test localhost + Commit**

```bash
npm run dev
# Vérifier les 2 listes apparaissent
git add src/components/dashboard/v2/dashboard-client-v2.tsx src/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat(dashboard): brancher listes risk + hot leads"
```

---

## Phase 4 — Funnel de conversion

### Task 4.1 : Query getFunnelData

**Files:**
- Modify: `src/lib/dashboard/v2-queries.ts`

- [ ] **Step 1: Ajouter**

```typescript
export interface FunnelData {
  leads: number
  bookings: number
  showed: number
  closed: number
}

export async function getFunnelData(workspaceId: string, period: number): Promise<FunnelData> {
  const supabase = await createClient()
  const since = new Date(Date.now() - period * 86400000).toISOString()

  const [leadsRes, bookingsRes, callsRes, dealsRes] = await Promise.all([
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).gte('created_at', since),
    supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).gte('created_at', since).neq('status', 'cancelled'),
    supabase.from('calls').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).gte('scheduled_at', since).in('outcome', ['fait', 'closed']),
    supabase.from('deals').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('status', 'active').gte('created_at', since),
  ])

  return {
    leads: leadsRes.count ?? 0,
    bookings: bookingsRes.count ?? 0,
    showed: callsRes.count ?? 0,
    closed: dealsRes.count ?? 0,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/dashboard/v2-queries.ts
git commit -m "feat(dashboard): query getFunnelData"
```

### Task 4.2 : ConversionFunnel component

**Files:**
- Create: `src/components/dashboard/v2/funnel/conversion-funnel.tsx`

- [ ] **Step 1: Composant funnel horizontal**

```typescript
'use client'

import type { FunnelData } from '@/lib/dashboard/v2-queries'

interface Stage {
  label: string
  value: number
  href: string
}

function pct(num: number, denom: number): string {
  if (denom === 0) return '—'
  return `${Math.round((num / denom) * 100)}%`
}

export default function ConversionFunnel({ data }: { data: FunnelData }) {
  const stages: Stage[] = [
    { label: 'Leads', value: data.leads, href: '/leads' },
    { label: 'Bookés', value: data.bookings, href: '/agenda' },
    { label: 'Présents', value: data.showed, href: '/closing' },
    { label: 'Closés', value: data.closed, href: '/leads?status=clos' },
  ]
  const max = Math.max(...stages.map(s => s.value), 1)

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-primary)',
      borderRadius: 12,
      padding: 20,
      marginBottom: 16,
    }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Funnel de conversion
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        {stages.map((s, i) => {
          const w = (s.value / max) * 100
          const prevValue = i > 0 ? stages[i - 1].value : null
          return (
            <div key={s.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
              {prevValue !== null && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'flex-end' }}>
                  {pct(s.value, prevValue)}
                </div>
              )}
              <a href={s.href} style={{
                display: 'block', width: `${Math.max(w, 8)}%`,
                background: `linear-gradient(180deg, var(--color-primary) 0%, var(--color-primary-hover, var(--color-primary)) 100%)`,
                opacity: 0.4 + 0.15 * (4 - i),
                height: 56, borderRadius: 6,
                textDecoration: 'none',
              }} />
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Brancher dans client + page + commit**

```typescript
// dashboard-client-v2.tsx :
import ConversionFunnel from './funnel/conversion-funnel'
// ajouter funnelData: FunnelData dans Props
// rendre <ConversionFunnel data={funnelData} /> après les listes

// page.tsx : ajouter getFunnelData(workspaceId, period) au Promise.all
```

```bash
git add .
git commit -m "feat(dashboard): ConversionFunnel cliquable avec drop-off %"
```

---

## Phase 5 — Activity feed realtime

### Task 5.1 : Query activity initiale + composant realtime

**Files:**
- Modify: `src/lib/dashboard/v2-queries.ts`
- Create: `src/components/dashboard/v2/activity/realtime-activity-feed.tsx`

- [ ] **Step 1: Query initiale dans v2-queries**

```typescript
export interface ActivityEventV2 {
  id: string
  type: 'new_lead' | 'new_booking' | 'call_done' | 'deal_closed' | 'follow_up_done'
  description: string
  created_at: string
}

export async function getRecentActivityV2(workspaceId: string): Promise<ActivityEventV2[]> {
  const supabase = await createClient()
  const since = new Date(Date.now() - 7 * 86400000).toISOString()

  const [leads, bookings, calls, deals] = await Promise.all([
    supabase.from('leads').select('id, first_name, last_name, source, created_at').eq('workspace_id', workspaceId).gte('created_at', since).order('created_at', { ascending: false }).limit(10),
    supabase.from('bookings').select('id, scheduled_at, created_at, leads(first_name, last_name)').eq('workspace_id', workspaceId).gte('created_at', since).order('created_at', { ascending: false }).limit(10),
    supabase.from('calls').select('id, type, outcome, created_at, leads(first_name, last_name)').eq('workspace_id', workspaceId).not('outcome', 'is', null).gte('created_at', since).order('created_at', { ascending: false }).limit(10),
    supabase.from('deals').select('id, amount, created_at, leads(first_name, last_name)').eq('workspace_id', workspaceId).eq('status', 'active').gte('created_at', since).order('created_at', { ascending: false }).limit(5),
  ])

  const events: ActivityEventV2[] = []
  for (const l of leads.data ?? []) events.push({ id: `l-${l.id}`, type: 'new_lead', description: `${l.first_name} ${l.last_name} ajouté(e) (${(l.source ?? '').replaceAll('_', ' ')})`, created_at: l.created_at })
  for (const b of bookings.data ?? []) {
    const lead = b.leads as unknown as { first_name: string; last_name: string }
    events.push({ id: `b-${b.id}`, type: 'new_booking', description: `${lead.first_name} ${lead.last_name} a réservé un RDV`, created_at: b.created_at })
  }
  for (const c of calls.data ?? []) {
    const lead = c.leads as unknown as { first_name: string; last_name: string }
    events.push({ id: `c-${c.id}`, type: 'call_done', description: `Call ${c.type} avec ${lead.first_name} ${lead.last_name} — ${c.outcome}`, created_at: c.created_at })
  }
  for (const d of deals.data ?? []) {
    const lead = d.leads as unknown as { first_name: string; last_name: string }
    events.push({ id: `d-${d.id}`, type: 'deal_closed', description: `Deal closé avec ${lead.first_name} ${lead.last_name} — ${d.amount}€`, created_at: d.created_at })
  }
  return events.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 15)
}
```

- [ ] **Step 2: Composant realtime feed**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { UserPlus, CalendarPlus, PhoneCall, Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ActivityEventV2 } from '@/lib/dashboard/v2-queries'

const ICONS = {
  new_lead: UserPlus,
  new_booking: CalendarPlus,
  call_done: PhoneCall,
  deal_closed: Trophy,
  follow_up_done: PhoneCall,
} as const

const COLORS = {
  new_lead: 'var(--color-primary)',
  new_booking: '#3b82f6',
  call_done: '#a855f7',
  deal_closed: 'var(--color-success)',
  follow_up_done: 'var(--text-muted)',
} as const

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `il y a ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `il y a ${hrs}h`
  return `il y a ${Math.floor(hrs / 24)}j`
}

export default function RealtimeActivityFeed({
  workspaceId,
  initialEvents,
}: {
  workspaceId: string
  initialEvents: ActivityEventV2[]
}) {
  const [events, setEvents] = useState<ActivityEventV2[]>(initialEvents)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`dashboard-activity-${workspaceId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads', filter: `workspace_id=eq.${workspaceId}` }, payload => {
        const l = payload.new as { id: string; first_name: string; last_name: string; source: string | null; created_at: string }
        const ev: ActivityEventV2 = {
          id: `l-${l.id}`,
          type: 'new_lead',
          description: `${l.first_name} ${l.last_name} ajouté(e) (${(l.source ?? '').replaceAll('_', ' ')})`,
          created_at: l.created_at,
        }
        setEvents(prev => [ev, ...prev].slice(0, 20))
        setNewIds(prev => new Set([...prev, ev.id]))
        setTimeout(() => setNewIds(prev => { const n = new Set(prev); n.delete(ev.id); return n }), 4000)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bookings', filter: `workspace_id=eq.${workspaceId}` }, async payload => {
        const b = payload.new as { id: string; lead_id: string; created_at: string }
        const { data: lead } = await supabase.from('leads').select('first_name, last_name').eq('id', b.lead_id).single()
        if (!lead) return
        const ev: ActivityEventV2 = {
          id: `b-${b.id}`,
          type: 'new_booking',
          description: `${lead.first_name} ${lead.last_name} a réservé un RDV`,
          created_at: b.created_at,
        }
        setEvents(prev => [ev, ...prev].slice(0, 20))
        setNewIds(prev => new Set([...prev, ev.id]))
        setTimeout(() => setNewIds(prev => { const n = new Set(prev); n.delete(ev.id); return n }), 4000)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [workspaceId])

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-primary)',
      borderRadius: 12,
      padding: 20,
    }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Activité récente
      </div>
      {events.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucune activité récente</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {events.map(ev => {
            const Icon = ICONS[ev.type]
            const isNew = newIds.has(ev.id)
            return (
              <li key={ev.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 6,
                background: isNew ? 'var(--bg-active)' : 'transparent',
                transition: 'background 0.5s ease',
                animation: isNew ? 'fadeIn 0.5s ease' : undefined,
              }}>
                <Icon size={14} style={{ color: COLORS[ev.type], flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>{ev.description}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{timeAgo(ev.created_at)}</span>
              </li>
            )
          })}
        </ul>
      )}
      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}
```

- [ ] **Step 3: Brancher dans client + page**

Ajouter dans dashboard-client-v2 :
```typescript
import RealtimeActivityFeed from './activity/realtime-activity-feed'
// dans Props : workspaceId: string, initialActivity: ActivityEventV2[]
// après funnel : <RealtimeActivityFeed workspaceId={workspaceId} initialEvents={initialActivity} />
```

Page.tsx : passer workspaceId + appeler getRecentActivityV2.

- [ ] **Step 4: Test localhost + commit**

```bash
npm run dev
# Créer un lead manuel dans un autre onglet → vérifier l'event apparaît avec fade-in
git add .
git commit -m "feat(dashboard): activity feed realtime Supabase"
```

---

## Phase 6 — Polish + Cleanup

### Task 6.1 : Supprimer ancien dashboard-client.tsx + dépendances

**Files:**
- Delete: `src/components/dashboard/dashboard-client.tsx` (et tous ses sous-composants si plus utilisés ailleurs)

- [ ] **Step 1: Vérifier où dashboard-client.tsx est utilisé**

```bash
grep -r "dashboard-client" src/ | grep -v "v2"
grep -r "kpi-cards\|upcoming-calls\|overdue-followups\|recent-activity\|period-selector" src/ | grep -v "v2"
```

- [ ] **Step 2: Supprimer fichiers V1 si plus référencés**

```bash
git rm src/components/dashboard/dashboard-client.tsx
git rm src/components/dashboard/kpi-cards.tsx
git rm src/components/dashboard/upcoming-calls.tsx
git rm src/components/dashboard/overdue-followups.tsx
git rm src/components/dashboard/recent-activity.tsx
git rm src/components/dashboard/period-selector.tsx
# Garder src/lib/dashboard/queries.ts si utilisé par SetterDashboard/CloserDashboard
```

- [ ] **Step 3: Type check + lint**

```bash
npx tsc --noEmit
npm run lint 2>&1 | tail -20
```

- [ ] **Step 4: Test localhost final + commit**

```bash
npm run dev
# Test complet : navigation, period change, brief IA, listes, funnel, realtime
git add .
git commit -m "chore(dashboard): supprimer ancien dashboard v1 + cleanup"
```

### Task 6.2 : Mise à jour etat.md + ameliorations.md

- [ ] **Step 1: Update etat.md**
- [ ] **Step 2: Update ameliorations.md** avec les V2 features identifiées dans le spec
- [ ] **Step 3: Commit final**

```bash
git add etat.md ameliorations.md
git commit -m "docs: maj etat + ameliorations dashboard v2"
```

---

## Validation finale

- [ ] Dashboard charge < 1.5s
- [ ] Period selector fonctionne sur tout le dashboard
- [ ] Hero adaptatif : avec RDV, sans RDV, "À jour"
- [ ] KPIs avec delta + sparkline visibles
- [ ] Listes risk + hot leads cliquables
- [ ] Funnel cliquable avec drop-off %
- [ ] Activity feed realtime (test : créer lead manuel dans autre onglet)
- [ ] Brief IA fonctionne (avec clé API configurée) + cache 24h
- [ ] Type check passe (`npx tsc --noEmit`)
- [ ] Lint passe
- [ ] Pas de régression Setter / Closer dashboards
