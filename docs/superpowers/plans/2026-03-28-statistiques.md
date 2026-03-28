# Module Statistiques — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire la page `/statistiques` avec 5 KPIs, 3 charts Recharts (leads/jour, funnel, sources) et une section Meta Ads conditionnelle.

**Architecture:** Server Component (`statistiques/page.tsx`) qui lit `?period` depuis les URL params, lance 5 queries Supabase en parallèle, vérifie si Meta est connecté, puis passe tout en props à `StatsClient` (Client Component). Changement de période = navigation URL → re-render serveur automatique.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase JS, Recharts v3

---

## Structure des fichiers

| Fichier | Action | Rôle |
|---------|--------|------|
| `src/lib/stats/queries.ts` | Créer | Types + 5 fonctions de query Supabase |
| `src/components/stats/stats-period-selector.tsx` | Créer | Sélecteur 7j/30j/90j/Tout (version stats) |
| `src/components/stats/kpi-cards.tsx` | Créer | 5 cards KPI |
| `src/components/stats/leads-chart.tsx` | Créer | BarChart leads par jour (Recharts) |
| `src/components/stats/funnel-chart.tsx` | Créer | BarChart funnel conversion (Recharts) |
| `src/components/stats/source-chart.tsx` | Créer | PieChart répartition par source (Recharts) |
| `src/components/stats/meta-section.tsx` | Créer | Banner Meta ou métriques si connecté |
| `src/components/stats/stats-client.tsx` | Créer | Layout client + assemblage des composants |
| `src/app/(dashboard)/statistiques/page.tsx` | Modifier | Server Component — fetching + rendu |

---

## Task 1 : Queries Supabase (`src/lib/stats/queries.ts`)

**Files:**
- Create: `src/lib/stats/queries.ts`

- [ ] **Créer le fichier avec types et 5 fonctions**

```typescript
import { createClient } from '@/lib/supabase/server'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface StatsKpis {
  totalLeads: number
  bookedCalls: number
  bookingRate: number | null   // null si 0 leads
  closedDeals: number
  winRate: number | null       // null si 0 calls bookés
}

export interface LeadsPerDay {
  date: string   // "2026-03-01"
  count: number
}

export interface FunnelData {
  label: string
  count: number
  pct: number    // % par rapport au total leads
  color: string
}

export interface SourceData {
  source: string
  count: number
  label: string  // libellé lisible
  color: string
}

export interface MetaStats {
  isConnected: boolean
  // Données temps réel Meta non disponibles en V1 — placeholder
  costPerLead: number | null
  roas: number | null
  budgetSpent: number | null
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getSinceIso(period: number): string | null {
  if (period === 0) return null   // "Tout" = pas de filtre
  const since = new Date()
  since.setDate(since.getDate() - period)
  return since.toISOString()
}

// ─── KPIs ───────────────────────────────────────────────────────────────────

export async function fetchStatsKpis(workspaceId: string, period: number): Promise<StatsKpis> {
  const supabase = await createClient()
  const since = getSinceIso(period)

  let leadsQuery = supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
  if (since) leadsQuery = leadsQuery.gte('created_at', since)

  let callsQuery = supabase
    .from('calls')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
  if (since) callsQuery = callsQuery.gte('created_at', since)

  let closedQuery = supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'clos')
  if (since) closedQuery = closedQuery.gte('updated_at', since)

  const [leadsRes, callsRes, closedRes] = await Promise.all([leadsQuery, callsQuery, closedQuery])

  const totalLeads = leadsRes.count ?? 0
  const bookedCalls = callsRes.count ?? 0
  const closedDeals = closedRes.count ?? 0
  const bookingRate = totalLeads > 0 ? Math.round((bookedCalls / totalLeads) * 100) : null
  const winRate = bookedCalls > 0 ? Math.round((closedDeals / bookedCalls) * 100) : null

  return { totalLeads, bookedCalls, bookingRate, closedDeals, winRate }
}

// ─── Leads par jour ──────────────────────────────────────────────────────────

export async function fetchLeadsPerDay(workspaceId: string, period: number): Promise<LeadsPerDay[]> {
  const supabase = await createClient()
  const since = getSinceIso(period)

  let query = supabase
    .from('leads')
    .select('created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })
  if (since) query = query.gte('created_at', since)

  const { data } = await query

  // Grouper par date (YYYY-MM-DD) côté JS
  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    const day = row.created_at.slice(0, 10)
    counts[day] = (counts[day] ?? 0) + 1
  }
  return Object.entries(counts).map(([date, count]) => ({ date, count }))
}

// ─── Funnel ──────────────────────────────────────────────────────────────────

export async function fetchFunnelData(workspaceId: string, period: number): Promise<FunnelData[]> {
  const supabase = await createClient()
  const since = getSinceIso(period)

  // Leads total
  let leadsQ = supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
  if (since) leadsQ = leadsQ.gte('created_at', since)

  // Setting bookés (appels setting planifiés)
  let settingQ = supabase
    .from('calls')
    .select('lead_id')
    .eq('workspace_id', workspaceId)
    .eq('type', 'setting')
  if (since) settingQ = settingQ.gte('created_at', since)

  // Closing bookés
  let closingQ = supabase
    .from('calls')
    .select('lead_id')
    .eq('workspace_id', workspaceId)
    .eq('type', 'closing')
  if (since) closingQ = closingQ.gte('created_at', since)

  // Closés
  let closedQ = supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'clos')
  if (since) closedQ = closedQ.gte('updated_at', since)

  const [leadsRes, settingRes, closingRes, closedRes] = await Promise.all([
    leadsQ, settingQ, closingQ, closedQ,
  ])

  const totalLeads = leadsRes.count ?? 0
  // DISTINCT lead_id côté JS
  const settingCount = new Set((settingRes.data ?? []).map(r => r.lead_id)).size
  const closingCount = new Set((closingRes.data ?? []).map(r => r.lead_id)).size
  const closedCount = closedRes.count ?? 0

  const pct = (n: number) => totalLeads > 0 ? Math.round((n / totalLeads) * 100) : 0

  return [
    { label: 'Leads', count: totalLeads, pct: 100, color: '#3b82f6' },
    { label: 'Setting', count: settingCount, pct: pct(settingCount), color: '#f59e0b' },
    { label: 'Closing', count: closingCount, pct: pct(closingCount), color: '#a855f7' },
    { label: 'Closé ✅', count: closedCount, pct: pct(closedCount), color: '#00C853' },
  ]
}

// ─── Sources ─────────────────────────────────────────────────────────────────

const SOURCE_META: Record<string, { label: string; color: string }> = {
  facebook_ads:  { label: 'Facebook Ads',   color: '#1877F2' },
  instagram_ads: { label: 'Instagram Ads',  color: '#E1306C' },
  formulaire:    { label: 'Formulaire',     color: '#f59e0b' },
  manuel:        { label: 'Manuel',         color: '#555' },
}

export async function fetchSourceData(workspaceId: string, period: number): Promise<SourceData[]> {
  const supabase = await createClient()
  const since = getSinceIso(period)

  let query = supabase
    .from('leads')
    .select('source')
    .eq('workspace_id', workspaceId)
  if (since) query = query.gte('created_at', since)

  const { data } = await query

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    counts[row.source] = (counts[row.source] ?? 0) + 1
  }

  return Object.entries(counts)
    .map(([source, count]) => ({
      source,
      count,
      label: SOURCE_META[source]?.label ?? source,
      color: SOURCE_META[source]?.color ?? '#888',
    }))
    .sort((a, b) => b.count - a.count)
}

// ─── Meta status ─────────────────────────────────────────────────────────────

export async function fetchMetaStats(workspaceId: string): Promise<MetaStats> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('integrations')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('type', 'meta')
    .eq('is_active', true)
    .maybeSingle()

  return {
    isConnected: !!data,
    // Données Meta temps réel non disponibles en V1
    costPerLead: null,
    roas: null,
    budgetSpent: null,
  }
}
```

- [ ] **Vérifier la compilation TypeScript**

```bash
cd /c/Users/remyd/Desktop/coaching/closrm && npx tsc --noEmit 2>&1 | head -30
```

Attendu : aucune erreur sur `src/lib/stats/queries.ts`

- [ ] **Committer**

```bash
git add src/lib/stats/queries.ts
git commit -m "feat: T-011 — stats queries (kpis, leads/day, funnel, sources, meta)"
```

---

## Task 2 : Sélecteur de période avec "Tout" (`src/components/stats/stats-period-selector.tsx`)

**Files:**
- Create: `src/components/stats/stats-period-selector.tsx`

- [ ] **Créer le composant**

```typescript
// Composant Server — génère des liens <a> qui rechargent avec ?period=X
// Étend le PeriodSelector du dashboard en ajoutant "Tout" (period=0)

interface StatsPeriodSelectorProps {
  current: number  // 7, 30, 90 ou 0 (Tout)
}

const PERIODS = [
  { value: 7,  label: '7j' },
  { value: 30, label: '30j' },
  { value: 90, label: '90j' },
  { value: 0,  label: 'Tout' },
]

export default function StatsPeriodSelector({ current }: StatsPeriodSelectorProps) {
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

- [ ] **Committer**

```bash
git add src/components/stats/stats-period-selector.tsx
git commit -m "feat: T-011 — StatsPeriodSelector with Tout option"
```

---

## Task 3 : KPI Cards (`src/components/stats/kpi-cards.tsx`)

**Files:**
- Create: `src/components/stats/kpi-cards.tsx`

- [ ] **Créer le composant**

```typescript
import { Users, Phone, TrendingUp, Target, BarChart2 } from 'lucide-react'
import type { StatsKpis } from '@/lib/stats/queries'

interface KpiCardsProps {
  kpis: StatsKpis
}

const CARDS = [
  {
    key: 'totalLeads' as const,
    label: 'Leads totaux',
    icon: Users,
    color: '#3b82f6',
    format: (v: number | null) => v ?? 0,
  },
  {
    key: 'bookedCalls' as const,
    label: 'Calls bookés',
    icon: Phone,
    color: '#f59e0b',
    format: (v: number | null) => v ?? 0,
  },
  {
    key: 'bookingRate' as const,
    label: 'Taux de booking',
    icon: BarChart2,
    color: '#3b82f6',
    format: (v: number | null) => v !== null ? `${v}%` : '—',
  },
  {
    key: 'closedDeals' as const,
    label: 'Deals closés',
    icon: Target,
    color: '#00C853',
    format: (v: number | null) => v ?? 0,
  },
  {
    key: 'winRate' as const,
    label: 'Win rate',
    icon: TrendingUp,
    color: '#a855f7',
    format: (v: number | null) => v !== null ? `${v}%` : '—',
  },
]

export default function KpiCards({ kpis }: KpiCardsProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
      gap: 10,
      marginBottom: 14,
    }}>
      {CARDS.map(({ key, label, icon: Icon, color, format }) => (
        <div key={key} style={{
          background: '#0f0f11',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 12,
          padding: 18,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: color + '18',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 12,
          }}>
            <Icon size={15} color={color} />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: key === 'closedDeals' ? '#00C853' : key === 'winRate' ? '#a855f7' : key === 'bookingRate' ? '#3b82f6' : '#fff' }}>
            {format(kpis[key] as number | null)}
          </div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{label}</div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Committer**

```bash
git add src/components/stats/kpi-cards.tsx
git commit -m "feat: T-011 — StatsKpiCards (5 métriques)"
```

---

## Task 4 : Graphique Leads par jour (`src/components/stats/leads-chart.tsx`)

**Files:**
- Create: `src/components/stats/leads-chart.tsx`

- [ ] **Créer le composant**

```typescript
'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import type { LeadsPerDay } from '@/lib/stats/queries'

interface LeadsChartProps {
  data: LeadsPerDay[]
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export default function LeadsChart({ data }: LeadsChartProps) {
  if (data.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 140, color: '#555', fontSize: 13 }}>
        Aucune donnée sur cette période
      </div>
    )
  }

  const formatted = data.map(d => ({ ...d, dateLabel: formatDate(d.date) }))
  const maxCount = Math.max(...data.map(d => d.count))

  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={formatted} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <XAxis
          dataKey="dateLabel"
          tick={{ fontSize: 10, fill: '#555' }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#555' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{ background: '#141416', border: '1px solid #2a2a35', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#aaa' }}
          itemStyle={{ color: '#00C853' }}
          cursor={{ fill: 'rgba(255,255,255,0.03)' }}
        />
        <Bar dataKey="count" name="Leads" radius={[4, 4, 0, 0]}>
          {formatted.map((entry, index) => (
            <Cell
              key={entry.date}
              fill={index === formatted.length - 1 ? '#00C85380' : '#00C85330'}
              stroke="#00C853"
              strokeWidth={1}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Committer**

```bash
git add src/components/stats/leads-chart.tsx
git commit -m "feat: T-011 — LeadsChart (BarChart Recharts)"
```

---

## Task 5 : Funnel de conversion (`src/components/stats/funnel-chart.tsx`)

**Files:**
- Create: `src/components/stats/funnel-chart.tsx`

- [ ] **Créer le composant**

```typescript
'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts'
import type { FunnelData } from '@/lib/stats/queries'

interface FunnelChartProps {
  data: FunnelData[]
}

export default function FunnelChart({ data }: FunnelChartProps) {
  if (data.every(d => d.count === 0)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 140, color: '#555', fontSize: 13 }}>
        Aucune donnée sur cette période
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={data} margin={{ top: 16, right: 4, bottom: 0, left: -20 }}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: '#555' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#555' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{ background: '#141416', border: '1px solid #2a2a35', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#aaa' }}
          cursor={{ fill: 'rgba(255,255,255,0.03)' }}
          formatter={(value: number, _name: string, props: { payload?: FunnelData }) => [
            `${value} (${props.payload?.pct ?? 0}%)`,
            'Leads',
          ]}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          <LabelList
            dataKey="pct"
            position="top"
            formatter={(v: number) => v > 0 ? `${v}%` : ''}
            style={{ fontSize: 10, fill: '#888' }}
          />
          {data.map((entry) => (
            <Cell key={entry.label} fill={entry.color} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Committer**

```bash
git add src/components/stats/funnel-chart.tsx
git commit -m "feat: T-011 — FunnelChart (conversion funnel)"
```

---

## Task 6 : Répartition par source (`src/components/stats/source-chart.tsx`)

**Files:**
- Create: `src/components/stats/source-chart.tsx`

- [ ] **Créer le composant**

```typescript
'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { SourceData } from '@/lib/stats/queries'

interface SourceChartProps {
  data: SourceData[]
}

export default function SourceChart({ data }: SourceChartProps) {
  if (data.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 140, color: '#555', fontSize: 13 }}>
        Aucune donnée sur cette période
      </div>
    )
  }

  const total = data.reduce((sum, d) => sum + d.count, 0)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 140 }}>
      <ResponsiveContainer width={110} height={110}>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={28}
            outerRadius={50}
            paddingAngle={2}
          >
            {data.map((entry) => (
              <Cell key={entry.source} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: '#141416', border: '1px solid #2a2a35', borderRadius: 8, fontSize: 12 }}
            formatter={(value: number) => [`${value} (${Math.round((value / total) * 100)}%)`, '']}
          />
        </PieChart>
      </ResponsiveContainer>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        {data.map((entry) => (
          <div key={entry.source} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: entry.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: '#888', flex: 1 }}>{entry.label}</span>
            <span style={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>
              {Math.round((entry.count / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Committer**

```bash
git add src/components/stats/source-chart.tsx
git commit -m "feat: T-011 — SourceChart (PieChart par source)"
```

---

## Task 7 : Section Meta Ads (`src/components/stats/meta-section.tsx`)

**Files:**
- Create: `src/components/stats/meta-section.tsx`

- [ ] **Créer le composant**

```typescript
import type { MetaStats } from '@/lib/stats/queries'

interface MetaSectionProps {
  meta: MetaStats
}

export default function MetaSection({ meta }: MetaSectionProps) {
  if (!meta.isConnected) {
    return (
      <div style={{
        background: 'rgba(24, 119, 242, 0.04)',
        border: '1px dashed rgba(24, 119, 242, 0.2)',
        borderRadius: 12,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>📊</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#aaa', marginBottom: 3 }}>
              Performance Meta Ads
            </div>
            <div style={{ fontSize: 12, color: '#555' }}>
              Connecte ton compte Meta pour voir le coût par lead et le ROAS estimé.
            </div>
          </div>
        </div>
        <a
          href="/parametres/integrations"
          style={{
            background: '#1877F2',
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            padding: '7px 16px',
            borderRadius: 8,
            textDecoration: 'none',
            flexShrink: 0,
          }}
        >
          Connecter Meta →
        </a>
      </div>
    )
  }

  // Meta connecté — V1 : données temps réel non disponibles
  const cards = [
    { label: 'Coût / lead', value: meta.costPerLead !== null ? `${meta.costPerLead.toFixed(2)}€` : '—' },
    { label: 'ROAS estimé',  value: meta.roas !== null ? `${meta.roas.toFixed(1)}x` : '—' },
    { label: 'Budget dépensé', value: meta.budgetSpent !== null ? `${meta.budgetSpent.toFixed(0)}€` : '—' },
  ]

  return (
    <div style={{
      background: 'rgba(24, 119, 242, 0.04)',
      border: '1px solid rgba(24, 119, 242, 0.15)',
      borderRadius: 12,
      padding: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 16 }}>📊</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#aaa' }}>Performance Meta Ads</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {cards.map(({ label, value }) => (
          <div key={label} style={{
            background: '#0f0f11',
            border: '1px solid rgba(24, 119, 242, 0.2)',
            borderRadius: 8,
            padding: 14,
          }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#1877F2' }}>{value}</div>
            <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Committer**

```bash
git add src/components/stats/meta-section.tsx
git commit -m "feat: T-011 — MetaSection (banner ou métriques)"
```

---

## Task 8 : Client Component Layout (`src/components/stats/stats-client.tsx`)

**Files:**
- Create: `src/components/stats/stats-client.tsx`

- [ ] **Créer le composant**

```typescript
'use client'

import StatsPeriodSelector from '@/components/stats/stats-period-selector'
import KpiCards from '@/components/stats/kpi-cards'
import LeadsChart from '@/components/stats/leads-chart'
import FunnelChart from '@/components/stats/funnel-chart'
import SourceChart from '@/components/stats/source-chart'
import MetaSection from '@/components/stats/meta-section'
import type { StatsKpis, LeadsPerDay, FunnelData, SourceData, MetaStats } from '@/lib/stats/queries'

interface StatsClientProps {
  period: number
  kpis: StatsKpis
  leadsPerDay: LeadsPerDay[]
  funnelData: FunnelData[]
  sourceData: SourceData[]
  meta: MetaStats
}

const CARD_STYLE = {
  background: '#0f0f11',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 12,
  padding: 16,
}

const CARD_TITLE_STYLE = {
  fontSize: 11,
  fontWeight: 600,
  color: '#888',
  letterSpacing: '0.5px',
  marginBottom: 12,
  textTransform: 'uppercase' as const,
}

export default function StatsClient({
  period, kpis, leadsPerDay, funnelData, sourceData, meta,
}: StatsClientProps) {
  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 }}>Statistiques</h1>
        <StatsPeriodSelector current={period} />
      </div>

      {/* 5 KPIs */}
      <KpiCards kpis={kpis} />

      {/* 3 charts en grille égale */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div style={CARD_STYLE}>
          <div style={CARD_TITLE_STYLE}>Leads par jour</div>
          <LeadsChart data={leadsPerDay} />
        </div>
        <div style={CARD_STYLE}>
          <div style={CARD_TITLE_STYLE}>Funnel de conversion</div>
          <FunnelChart data={funnelData} />
        </div>
        <div style={CARD_STYLE}>
          <div style={CARD_TITLE_STYLE}>Par source</div>
          <SourceChart data={sourceData} />
        </div>
      </div>

      {/* Section Meta */}
      <MetaSection meta={meta} />
    </div>
  )
}
```

- [ ] **Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Committer**

```bash
git add src/components/stats/stats-client.tsx
git commit -m "feat: T-011 — StatsClient layout"
```

---

## Task 9 : Server Component page (`src/app/(dashboard)/statistiques/page.tsx`)

**Files:**
- Modify: `src/app/(dashboard)/statistiques/page.tsx`

- [ ] **Remplacer le contenu du fichier**

```typescript
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import {
  fetchStatsKpis,
  fetchLeadsPerDay,
  fetchFunnelData,
  fetchSourceData,
  fetchMetaStats,
} from '@/lib/stats/queries'
import StatsClient from '@/components/stats/stats-client'

const VALID_PERIODS = [0, 7, 30, 90] as const
type Period = (typeof VALID_PERIODS)[number]

interface Props {
  searchParams: Promise<{ period?: string }>
}

export default async function StatistiquesPage({ searchParams }: Props) {
  const params = await searchParams
  const periodParam = Number(params.period)
  const period: Period = (VALID_PERIODS.includes(periodParam as Period) ? periodParam : 30) as Period

  const { workspaceId } = await getWorkspaceId()

  const [kpis, leadsPerDay, funnelData, sourceData, meta] = await Promise.all([
    fetchStatsKpis(workspaceId, period),
    fetchLeadsPerDay(workspaceId, period),
    fetchFunnelData(workspaceId, period),
    fetchSourceData(workspaceId, period),
    fetchMetaStats(workspaceId),
  ])

  return (
    <StatsClient
      period={period}
      kpis={kpis}
      leadsPerDay={leadsPerDay}
      funnelData={funnelData}
      sourceData={sourceData}
      meta={meta}
    />
  )
}
```

- [ ] **Vérifier TypeScript complet**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Attendu : 0 erreurs

- [ ] **Tester manuellement dans le navigateur**

```bash
npm run dev
```

Ouvrir `http://localhost:3000/statistiques`
- Vérifier que la page se charge sans erreur console
- Tester les 4 boutons de période (7j / 30j / 90j / Tout)
- Vérifier que les 3 charts s'affichent (même vides = état "Aucune donnée" visible)
- Vérifier que le banner Meta s'affiche si Meta non connecté

- [ ] **Commit final**

```bash
git add src/app/(dashboard)/statistiques/page.tsx
git commit -m "feat: T-011 — page Statistiques branchée Supabase"
```

---

## Self-Review

**Couverture de la spec :**
- ✅ 5 KPIs : leads totaux, calls bookés, taux de booking, deals closés, win rate
- ✅ Sélecteur période 7j / 30j / 90j / Tout
- ✅ Graphique leads/jour (BarChart Recharts)
- ✅ Funnel conversion (BarChart avec 4 étapes)
- ✅ Répartition par source (PieChart)
- ✅ Section Meta masquée si non connecté / affichée si connecté
- ✅ Layout C validé (5 KPIs + 3 charts grille + Meta en bas)

**Types cohérents :**
- `StatsKpis`, `LeadsPerDay`, `FunnelData`, `SourceData`, `MetaStats` définis dans `queries.ts` et importés dans tous les composants
- `period: number` passé partout, `0` = Tout (cohérent dans `getSinceIso`)

**Placeholders :** La section Meta connecté dit "données non disponibles V1" — c'est intentionnel et documenté dans la spec.
