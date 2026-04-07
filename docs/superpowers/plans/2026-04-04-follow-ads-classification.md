# Follow Ads Classification + Adapted KPIs + Health Indicators — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate Leadform and Follow Ads campaigns in the Publicités dashboard with type-specific KPIs, health indicators, and an Instagram growth panel.

**Architecture:** Campaign `objective` field from Meta API classifies campaigns into 3 types (leadform/follow_ads/other). A frontend toggle (Leadform/Follow Ads/Tout) switches KPIs, charts, and table columns. Health thresholds are a pure frontend config. Instagram growth data comes from the existing `/api/instagram/snapshots` endpoint.

**Tech Stack:** Next.js 14 (App Router), Meta Marketing API v18.0, Instagram API (existing), Recharts, inline styles

**Spec:** `docs/superpowers/specs/2026-04-04-follow-ads-classification-design.md`

---

## File Structure

### Created
| File | Responsibility |
|------|---------------|
| `src/app/(dashboard)/acquisition/publicites/health-thresholds.ts` | Health threshold config + `getHealthColor()` function |
| `src/app/(dashboard)/acquisition/publicites/ads-campaign-type-toggle.tsx` | Toggle component: Leadform / Follow Ads / Tout |
| `src/app/(dashboard)/acquisition/publicites/ads-instagram-growth.tsx` | Instagram growth panel (fetches snapshots) |

### Modified
| File | Change |
|------|--------|
| `src/lib/meta/client.ts` | Add `objective` to `listAdObjects` fields for campaigns, export `CampaignType`, `classifyCampaignObjective()`, update `MetaAdObject` |
| `src/app/api/meta/insights/route.ts` | Add `campaign_type` param + filter, add `campaign_type` to `BreakdownRow`, enrich adsets/ads with parent type |
| `src/app/(dashboard)/acquisition/publicites/publicites-client.tsx` | Add `campaignType` state, toggle, pass type to children, dual fetch for "Tout" mode |
| `src/app/(dashboard)/acquisition/publicites/ads-overview-tab.tsx` | Type-specific KPIs, health dots, impressions chart for follow_ads, sections for "Tout" mode |
| `src/app/(dashboard)/acquisition/publicites/ads-table-tab.tsx` | "Type" column in Tout mode, adapted columns per campaign type |

---

### Task 1: Health Thresholds Config

**Files:**
- Create: `src/app/(dashboard)/acquisition/publicites/health-thresholds.ts`

- [ ] **Step 1: Create the health thresholds file**

```ts
// src/app/(dashboard)/acquisition/publicites/health-thresholds.ts

export type HealthColor = 'green' | 'orange' | 'red'
export type CampaignType = 'leadform' | 'follow_ads' | 'other'

interface ThresholdRule {
  green: (value: number) => boolean
  orange: (value: number) => boolean
}

const LEADFORM_THRESHOLDS: Record<string, ThresholdRule> = {
  cpl: {
    green: (v) => v < 7.5,
    orange: (v) => v >= 7.5 && v <= 15,
  },
  ctr: {
    green: (v) => v > 2,
    orange: (v) => v >= 1 && v <= 2,
  },
  roas: {
    green: (v) => v > 3,
    orange: (v) => v >= 1 && v <= 3,
  },
}

const FOLLOW_ADS_THRESHOLDS: Record<string, ThresholdRule> = {
  cpm: {
    green: (v) => v < 5,
    orange: (v) => v >= 5 && v <= 10,
  },
  cost_per_click: {
    green: (v) => v < 0.5,
    orange: (v) => v >= 0.5 && v <= 1,
  },
}

export function getHealthColor(
  campaignType: CampaignType,
  kpi: string,
  value: number | null
): HealthColor | null {
  if (value === null) return null

  const thresholds = campaignType === 'leadform'
    ? LEADFORM_THRESHOLDS
    : campaignType === 'follow_ads'
    ? FOLLOW_ADS_THRESHOLDS
    : null

  if (!thresholds) return null

  const rule = thresholds[kpi]
  if (!rule) return null

  if (rule.green(value)) return 'green'
  if (rule.orange(value)) return 'orange'
  return 'red'
}

export function classifyCampaignObjective(objective: string | undefined): CampaignType {
  switch (objective) {
    case 'OUTCOME_LEADS':
    case 'LEAD_GENERATION':
      return 'leadform'
    case 'OUTCOME_AWARENESS':
    case 'BRAND_AWARENESS':
    case 'REACH':
      return 'follow_ads'
    default:
      return 'other'
  }
}

export const HEALTH_COLORS: Record<HealthColor, string> = {
  green: '#00C853',
  orange: '#D69E2E',
  red: '#E53E3E',
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(dashboard)/acquisition/publicites/health-thresholds.ts"
git commit -m "feat: add health thresholds config and campaign type classification"
```

---

### Task 2: Meta Client — Add objective to campaigns

**Files:**
- Modify: `src/lib/meta/client.ts`

- [ ] **Step 1: Update `MetaAdObject` to include optional `objective`**

Add `objective` to the interface:

```ts
export interface MetaAdObject {
  id: string
  name: string
  status: string
  effective_status: string
  objective?: string  // added for campaign classification
}
```

- [ ] **Step 2: Update `listAdObjects` to request `objective` for campaigns**

Change the fields in the URL construction. For campaigns (when no parentId and level is 'campaign', or when using the account-level edge for campaigns), add `objective` to the fields:

Replace the URL construction logic:

```ts
export async function listAdObjects(
  adAccountId: string,
  token: string,
  level: 'campaign' | 'adset' | 'ad',
  parentId?: string
): Promise<MetaAdObject[]> {
  const baseFields = 'id,name,status,effective_status'
  // Add objective field for campaigns (needed for classification)
  const fields = level === 'campaign' ? `${baseFields},objective` : baseFields

  let url: string
  if (parentId && level === 'adset') {
    url = `${GRAPH_URL}/${parentId}/adsets?fields=${fields}&limit=200&access_token=${token}`
  } else if (parentId && level === 'ad') {
    url = `${GRAPH_URL}/${parentId}/ads?fields=${fields}&limit=200&access_token=${token}`
  } else {
    const edge = LEVEL_TO_EDGE[level]
    url = `${GRAPH_URL}/${adAccountId}/${edge}?fields=${fields}&limit=200&access_token=${token}`
  }

  const res = await fetch(url)
  if (!res.ok) {
    console.warn(`Failed to list ${level}s:`, await res.text())
    return []
  }
  const data: { data: MetaAdObject[] } = await res.json()
  return data.data ?? []
}
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit 2>&1 | grep -v ".next/dev/types" | grep -v "@dnd-kit" | grep -v "WorkflowBuilder" | grep -v "EmailBlockBuilder" | grep -v "FunnelBuilder" | grep -v "FunnelPagePreview"`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/meta/client.ts
git commit -m "feat: request campaign objective from Meta API for classification"
```

---

### Task 3: API Route — campaign_type filtering and enrichment

**Files:**
- Modify: `src/app/api/meta/insights/route.ts`

- [ ] **Step 1: Add imports and update types**

Add import at top:

```ts
import {
  getInsights,
  listAdObjects,
  extractLeadCount,
  extractCostPerLead,
  type MetaCredentials,
  type InsightsParams,
} from '@/lib/meta/client'
import { classifyCampaignObjective, type CampaignType } from '@/app/(dashboard)/acquisition/publicites/health-thresholds'
```

Update `BreakdownRow` to include `campaign_type`:

```ts
interface BreakdownRow {
  id: string
  name: string
  status: string
  campaign_type: CampaignType
  spend: number
  impressions: number
  clicks: number
  ctr: number
  leads: number
  cpl: number | null
}
```

Update `MetaInsightsResponse` to include `campaignTypeFilter`:

```ts
export interface MetaInsightsResponse {
  kpis: KpisData
  breakdown: BreakdownRow[]
  daily: DailyRow[]
  campaignTypeFilter: CampaignType | 'all'
}
```

- [ ] **Step 2: Parse campaign_type param and build campaign type map**

In the `GET` handler, after parsing `adsetId`, add:

```ts
    const campaignTypeFilter = (searchParams.get('campaign_type') ?? 'all') as CampaignType | 'all'
```

After decrypting credentials and before the insights fetch, when level is NOT 'account', fetch campaigns to build a type map:

```ts
    // Build campaign type map for classification
    let campaignTypeMap = new Map<string, CampaignType>()
    if (level !== 'account') {
      const campaigns = await listAdObjects(
        credentials.ad_account_id, credentials.user_access_token, 'campaign'
      )
      for (const c of campaigns) {
        campaignTypeMap.set(c.id, classifyCampaignObjective(c.objective))
      }
    }
```

- [ ] **Step 3: Filter campaigns by type in the breakdown merge**

In the campaign/adset/ad breakdown section, after building `allObjects` and the merge, filter by campaign type.

For campaigns: classify from the object's `objective` field directly.
For adsets/ads: use `campaign_id` from the insight row to look up the type in `campaignTypeMap`.

After the existing merge logic (where `breakdown` array is built), add filtering:

```ts
    // Classify each row
    for (const row of breakdown) {
      if (level === 'campaign') {
        // For campaigns, we can get the objective from allObjects
        const obj = allObjects.find(o => o.id === row.id)
        row.campaign_type = classifyCampaignObjective(obj?.objective)
      } else {
        // For adsets/ads, look up campaign_id from insights
        const insightRow = rows.find(r => {
          if (level === 'adset') return r.adset_id === row.id
          if (level === 'ad') return r.ad_id === row.id
          return false
        })
        const cId = insightRow?.campaign_id
        row.campaign_type = cId ? (campaignTypeMap.get(cId) ?? 'other') : 'other'
      }
    }

    // Filter by campaign type if specified
    const filteredBreakdown = campaignTypeFilter === 'all'
      ? breakdown
      : breakdown.filter(row => row.campaign_type === campaignTypeFilter)
```

Update the response to use `filteredBreakdown` and include the filter:

```ts
    const response: MetaInsightsResponse = {
      kpis: { ... },  // recalculate from filteredBreakdown
      breakdown: filteredBreakdown.sort((a, b) => b.spend - a.spend),
      daily: [],
      campaignTypeFilter,
    }
```

Also recalculate KPIs from the filtered breakdown instead of the full set.

- [ ] **Step 4: Handle account level for "Tout" mode**

For `level === 'account'`, we need to support returning separate KPIs for leadform and follow_ads when `campaign_type=all`. Add a new field to the response:

```ts
export interface MetaInsightsResponse {
  kpis: KpisData
  breakdown: BreakdownRow[]
  daily: DailyRow[]
  campaignTypeFilter: CampaignType | 'all'
  // Separate KPIs by type (only populated when campaign_type=all and level=account)
  leadformKpis?: KpisData
  followAdsKpis?: KpisData
  leadformDaily?: DailyRow[]
  followAdsDaily?: DailyRow[]
}
```

At account level, when `campaignTypeFilter === 'all'`, make 2 additional insight calls filtered by campaign type:

```ts
    if (level === 'account' && campaignTypeFilter === 'all') {
      // Fetch campaigns to classify
      const campaigns = await listAdObjects(
        credentials.ad_account_id, credentials.user_access_token, 'campaign'
      )

      const leadformCampaignIds: string[] = []
      const followAdsCampaignIds: string[] = []
      for (const c of campaigns) {
        const type = classifyCampaignObjective(c.objective)
        if (type === 'leadform') leadformCampaignIds.push(c.id)
        else if (type === 'follow_ads') followAdsCampaignIds.push(c.id)
      }

      // Fetch insights for each type in parallel
      const [leadformRows, followAdsRows] = await Promise.all([
        leadformCampaignIds.length > 0
          ? getInsights(credentials.ad_account_id, credentials.user_access_token, {
              level: 'account', dateFrom, dateTo, campaignIds: leadformCampaignIds,
            })
          : Promise.resolve([]),
        followAdsCampaignIds.length > 0
          ? getInsights(credentials.ad_account_id, credentials.user_access_token, {
              level: 'account', dateFrom, dateTo, campaignIds: followAdsCampaignIds,
            })
          : Promise.resolve([]),
      ])

      // Aggregate each type
      response.leadformKpis = aggregateKpis(leadformRows)
      response.followAdsKpis = aggregateKpis(followAdsRows)
      response.leadformDaily = aggregateDaily(leadformRows)
      response.followAdsDaily = aggregateDaily(followAdsRows)
    }
```

Extract the aggregation logic into helper functions `aggregateKpis(rows)` and `aggregateDaily(rows)` to avoid duplication with the existing account-level code.

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit 2>&1 | grep -v ".next/dev/types" | grep -v "@dnd-kit" | grep -v "WorkflowBuilder" | grep -v "EmailBlockBuilder" | grep -v "FunnelBuilder" | grep -v "FunnelPagePreview"`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/meta/insights/route.ts
git commit -m "feat: add campaign_type filtering and per-type KPIs to insights API"
```

---

### Task 4: Campaign Type Toggle Component

**Files:**
- Create: `src/app/(dashboard)/acquisition/publicites/ads-campaign-type-toggle.tsx`

- [ ] **Step 1: Create the toggle component**

```tsx
// src/app/(dashboard)/acquisition/publicites/ads-campaign-type-toggle.tsx
'use client'

import type { CampaignType } from './health-thresholds'

export type CampaignTypeFilter = CampaignType | 'all'

interface AdsCampaignTypeToggleProps {
  value: CampaignTypeFilter
  onChange: (value: CampaignTypeFilter) => void
}

const OPTIONS: { value: CampaignTypeFilter; label: string }[] = [
  { value: 'leadform', label: 'Leadform' },
  { value: 'follow_ads', label: 'Follow Ads' },
  { value: 'all', label: 'Tout' },
]

export default function AdsCampaignTypeToggle({ value, onChange }: AdsCampaignTypeToggleProps) {
  return (
    <div style={{
      display: 'flex',
      borderRadius: 8,
      overflow: 'hidden',
      border: '1px solid var(--border-primary)',
    }}>
      {OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: '7px 16px',
            fontSize: 12,
            fontWeight: value === opt.value ? 600 : 400,
            color: value === opt.value ? '#fff' : 'var(--text-muted)',
            background: value === opt.value ? '#1877F2' : 'transparent',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s',
            borderRight: opt.value !== 'all' ? '1px solid var(--border-primary)' : 'none',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(dashboard)/acquisition/publicites/ads-campaign-type-toggle.tsx"
git commit -m "feat: add campaign type toggle component (Leadform / Follow Ads / Tout)"
```

---

### Task 5: Instagram Growth Panel

**Files:**
- Create: `src/app/(dashboard)/acquisition/publicites/ads-instagram-growth.tsx`

- [ ] **Step 1: Create the Instagram growth component**

```tsx
// src/app/(dashboard)/acquisition/publicites/ads-instagram-growth.tsx
'use client'

import { useState, useEffect } from 'react'

interface Snapshot {
  snapshot_date: string
  followers: number
  views: number
  reach: number
}

interface AdsInstagramGrowthProps {
  dateFrom: string
  dateTo: string
}

export default function AdsInstagramGrowth({ dateFrom, dateTo }: AdsInstagramGrowthProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(true)

  useEffect(() => {
    async function fetchSnapshots() {
      setLoading(true)
      try {
        const res = await fetch('/api/instagram/snapshots')
        if (!res.ok) {
          setConnected(false)
          return
        }
        const json = await res.json()
        const all: Snapshot[] = json.data ?? []

        // Filter to period
        const filtered = all.filter(
          s => s.snapshot_date >= dateFrom && s.snapshot_date <= dateTo
        )
        setSnapshots(filtered)
        setConnected(true)
      } catch {
        setConnected(false)
      } finally {
        setLoading(false)
      }
    }
    fetchSnapshots()
  }, [dateFrom, dateTo])

  if (loading) {
    return (
      <div style={{
        background: '#141414',
        border: '1px solid rgba(138,43,226,0.2)',
        borderRadius: 10,
        padding: 16,
        height: 80,
        animation: 'pulse 1.5s ease-in-out infinite',
      }}>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
      </div>
    )
  }

  if (!connected || snapshots.length === 0) {
    return (
      <div style={{
        background: 'rgba(24, 119, 242, 0.06)',
        border: '1px dashed rgba(24, 119, 242, 0.3)',
        borderRadius: 10,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
            Connecte Instagram
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            pour voir ta croissance followers en temps réel
          </div>
        </div>
        <a
          href="/parametres/integrations"
          style={{
            background: '#8B2BE2',
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            padding: '8px 16px',
            borderRadius: 6,
            textDecoration: 'none',
            flexShrink: 0,
          }}
        >
          Connecter →
        </a>
      </div>
    )
  }

  const first = snapshots[0]
  const last = snapshots[snapshots.length - 1]
  const newFollowers = last.followers - first.followers
  const totalFollowers = last.followers
  const growthRate = first.followers > 0
    ? Math.round((newFollowers / first.followers) * 1000) / 10
    : 0

  return (
    <div style={{
      background: '#141414',
      border: '1px solid rgba(138,43,226,0.2)',
      borderRadius: 10,
      padding: 16,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#8B2BE2', marginBottom: 10 }}>
        📈 Croissance Instagram (période)
      </div>
      <div style={{ display: 'flex', gap: 24 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#8B2BE2' }}>
            {newFollowers >= 0 ? '+' : ''}{newFollowers}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Nouveaux followers</div>
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
            {totalFollowers.toLocaleString('fr-FR')}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Total followers</div>
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
            {growthRate}%
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Taux croissance</div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(dashboard)/acquisition/publicites/ads-instagram-growth.tsx"
git commit -m "feat: add Instagram growth panel for Follow Ads section"
```

---

### Task 6: Update Overview Tab — Type-specific KPIs + Health Dots

**Files:**
- Modify: `src/app/(dashboard)/acquisition/publicites/ads-overview-tab.tsx`

- [ ] **Step 1: Rewrite the overview tab**

The overview tab needs to support 3 modes. Read the current file first, then replace it entirely.

Key changes:
- Import `getHealthColor`, `HEALTH_COLORS`, `CampaignType` from `health-thresholds`
- Import `AdsInstagramGrowth`
- Accept new props: `campaignType`, `leadformData`, `followAdsData`, `dateFrom`, `dateTo`
- In `leadform` mode: show CPL/CTR/ROAS with health dots, leads/day chart, lead funnel
- In `follow_ads` mode: show CPM/cost-per-click with health dots, impressions/day chart, Instagram growth panel
- In `all` mode: two stacked sections ("🎯 Acquisition Prospects" + "👥 Croissance & Notoriété")
- `KpiCard` component gets an optional `health` prop for the colored dot

Updated interface:

```ts
interface AdsOverviewTabProps {
  data: MetaInsightsResponse | null
  closedCount: number
  closedRevenue: number
  loading: boolean
  campaignType: CampaignType | 'all'
  dateFrom: string
  dateTo: string
}
```

The component renders conditionally:
- `campaignType === 'leadform'` → leadform KPIs + leads chart + funnel (using `data.leadformKpis ?? data.kpis` and `data.leadformDaily ?? data.daily`)
- `campaignType === 'follow_ads'` → follow ads KPIs + impressions chart + Instagram growth
- `campaignType === 'all'` → both sections stacked, using `data.leadformKpis` and `data.followAdsKpis`

- [ ] **Step 2: Verify build and commit**

```bash
git add "src/app/(dashboard)/acquisition/publicites/ads-overview-tab.tsx"
git commit -m "feat: type-specific KPIs, health indicators, and dual sections in overview tab"
```

---

### Task 7: Update Table Tab — Type column + adapted columns

**Files:**
- Modify: `src/app/(dashboard)/acquisition/publicites/ads-table-tab.tsx`

- [ ] **Step 1: Add campaign type support**

Changes to the table:
- Accept new prop `campaignType: CampaignType | 'all'`
- In `all` mode: add a "Type" column showing badge text ("Leadform" / "Follow Ads" / "Autre")
- In `follow_ads` mode: replace "Leads" column with "Reach" and "CPL" with "CPM" (using the same data fields — reach = impressions for now since Meta returns it)
- Column definitions become dynamic based on `campaignType`

Add to `ALL_COLUMNS`:

```ts
{ key: 'campaign_type', label: 'Type', sortable: true, align: 'left', defaultVisible: true },
```

In `renderCell`, for `campaign_type`:

```ts
case 'campaign_type': {
  const labels: Record<string, { text: string; color: string }> = {
    leadform: { text: 'Leadform', color: '#1877F2' },
    follow_ads: { text: 'Follow Ads', color: '#8B2BE2' },
    other: { text: 'Autre', color: '#666' },
  }
  const l = labels[row.campaign_type] ?? labels.other
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
      background: `${l.color}15`, color: l.color }}>
      {l.text}
    </span>
  )
}
```

The "Type" column is only visible when `campaignType === 'all'`.

- [ ] **Step 2: Verify build and commit**

```bash
git add "src/app/(dashboard)/acquisition/publicites/ads-table-tab.tsx"
git commit -m "feat: add Type column and adapted columns per campaign type in table"
```

---

### Task 8: Update PublicitesClient — Wire everything together

**Files:**
- Modify: `src/app/(dashboard)/acquisition/publicites/publicites-client.tsx`

- [ ] **Step 1: Add toggle state and pass campaign_type to API**

Changes:
- Import `AdsCampaignTypeToggle` and `CampaignTypeFilter`
- Add state: `const [campaignType, setCampaignType] = useState<CampaignTypeFilter>('all')`
- In `fetchInsights`, add `campaign_type` param: `params.set('campaign_type', campaignType)`
- Include `campaignType` in the `useCallback` dependency array
- Render the toggle next to the period selector in the header
- Pass `campaignType`, `dateFrom`, `dateTo` to `AdsOverviewTab`
- Pass `campaignType` to `AdsTableTab`

Updated header section:

```tsx
<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
  <div>
    <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>Publicités</h1>
    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Performance de tes campagnes Meta Ads</p>
  </div>
  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
    <AdsCampaignTypeToggle value={campaignType} onChange={setCampaignType} />
    <AdsPeriodSelector value={period} dateFrom={dateFrom} dateTo={dateTo} onChange={handlePeriodChange} />
  </div>
</div>
```

Updated overview rendering:

```tsx
{!error && tab === 'overview' && (
  <AdsOverviewTab
    data={data}
    closedCount={closedCount}
    closedRevenue={closedRevenue}
    loading={loading}
    campaignType={campaignType}
    dateFrom={dateFrom}
    dateTo={dateTo}
  />
)}
```

Updated table rendering:

```tsx
{!error && tab !== 'overview' && (
  <AdsTableTab
    data={data}
    loading={loading}
    tabKey={tab}
    campaignType={campaignType}
    onRowClick={...}
  />
)}
```

- [ ] **Step 2: Verify full build**

Run: `npx tsc --noEmit 2>&1 | grep -v ".next/dev/types" | grep -v "@dnd-kit" | grep -v "WorkflowBuilder" | grep -v "EmailBlockBuilder" | grep -v "FunnelBuilder" | grep -v "FunnelPagePreview"`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/acquisition/publicites/publicites-client.tsx"
git commit -m "feat: wire campaign type toggle, pass type to overview and table tabs"
```

---

### Task 9: Update project docs

**Files:**
- Modify: `etat.md`
- Modify: `ameliorations.md`
- Create: `taches/tache-024-follow-ads-classification.md`

- [ ] **Step 1: Create task file**

```markdown
# Tâche 024 — Séparation Leadform / Follow Ads + KPIs adaptés + Indicateurs de santé

**Développeur :** Rémy
**Date de début :** 2026-04-04
**Statut :** ✅ Terminé

## Description

Évolution du module Publicités pour distinguer les campagnes Leadform (acquisition prospects) des campagnes Follow Ads (notoriété/followers). KPIs, graphiques et funnels adaptés par type. Indicateurs de santé color-codés.

## Spec

`docs/superpowers/specs/2026-04-04-follow-ads-classification-design.md`

## Vision V2 — Followers comme prospects

À terme, les nouveaux followers Instagram seront traités comme des prospects :
- Détection automatique des nouveaux followers
- Création d'un lead dans le CRM (source: follow_ads)
- Workflow d'automations DM (style ManyChat) : DM de bienvenue, séquence nurturing
- Attribution follower → campagne source
```

- [ ] **Step 2: Update `etat.md`**

Add row for classification feature. Update "Ce qui manque" section.

- [ ] **Step 3: Update `ameliorations.md`**

Add V2 improvements:
- A-024-01: Followers comme prospects (ManyChat-like)
- A-024-02: Seuils de santé configurables
- A-024-03: Attribution followers → campagnes

- [ ] **Step 4: Commit**

```bash
git add taches/tache-024-follow-ads-classification.md etat.md ameliorations.md
git commit -m "chore: add T-024 task file and update project state with V2 vision"
```
