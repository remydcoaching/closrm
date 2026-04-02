# T-017 — Meta Ads Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time Meta Ads performance dashboard at `/acquisition/publicites` with KPIs, charts, funnel, and campaign/adset/ad drill-down.

**Architecture:** Single API route (`GET /api/meta/insights`) calls Meta Marketing API in real-time with `level` param. Frontend uses tabbed layout (Overview / Campaigns / Ad Sets / Ads). OAuth scopes extended with `ads_read,read_insights`. Ad account ID stored in encrypted credentials.

**Tech Stack:** Next.js 14 (App Router), Recharts, Meta Marketing API v18.0, Supabase, Tailwind CSS inline styles (matching existing codebase pattern)

**Spec:** `docs/superpowers/specs/2026-04-01-meta-ads-dashboard-design.md`

---

## File Structure

### Created
| File | Responsibility |
|------|---------------|
| `src/app/api/meta/insights/route.ts` | API route — fetches Meta Marketing API insights, returns formatted data |
| `src/app/(dashboard)/acquisition/publicites/publicites-client.tsx` | Client component — tabs, period selector, data fetching orchestration |
| `src/app/(dashboard)/acquisition/publicites/ads-overview-tab.tsx` | Overview tab — 5 KPI cards + leads/day chart + marketing funnel |
| `src/app/(dashboard)/acquisition/publicites/ads-table-tab.tsx` | Reusable table tab — campaigns/adsets/ads with sortable columns |
| `src/app/(dashboard)/acquisition/publicites/ads-period-selector.tsx` | Period selector — preset buttons + custom date picker |
| `src/app/(dashboard)/acquisition/publicites/ads-meta-banner.tsx` | Banner — not connected / needs upgrade / error states |

### Modified
| File | Change |
|------|--------|
| `src/lib/meta/client.ts` | Add `ads_read,read_insights` scopes, `getAdAccounts()`, `getInsights()`, new types |
| `src/app/api/integrations/meta/callback/route.ts` | Add ad account selection after page selection |
| `src/app/(dashboard)/acquisition/publicites/page.tsx` | Replace stub with server component that checks Meta integration state |
| `src/lib/stats/queries.ts` | Update `fetchMetaStats()` to return real data from Meta API |
| `src/components/stats/meta-section.tsx` | No code change needed — already handles non-null values |

---

### Task 1: Extend Meta Client — Scopes, Types, and API Functions

**Files:**
- Modify: `src/lib/meta/client.ts`

- [ ] **Step 1: Add `ads_read,read_insights` to OAuth scopes**

In `src/lib/meta/client.ts`, update the `buildOAuthUrl` function scope string:

```ts
// Old:
scope: 'leads_retrieval,pages_show_list,pages_manage_metadata,pages_read_engagement,business_management',

// New:
scope: 'leads_retrieval,pages_show_list,pages_manage_metadata,pages_read_engagement,business_management,ads_read,read_insights',
```

- [ ] **Step 2: Add new types after the existing types block**

Add after the `MetaCredentials` interface (around line 56):

```ts
// ─── Ad Accounts ────────────────────────────────────────────────────────────

export interface MetaAdAccount {
  id: string        // format "act_123456"
  name: string
  account_status: number  // 1=ACTIVE, 2=DISABLED, 3=UNSETTLED, etc.
}

// ─── Marketing API Insights ─────────────────────────────────────────────────

export interface MetaInsightAction {
  action_type: string
  value: string
}

export interface MetaInsightRow {
  date_start: string
  date_stop: string
  campaign_id?: string
  campaign_name?: string
  adset_id?: string
  adset_name?: string
  ad_id?: string
  ad_name?: string
  spend: string
  impressions: string
  clicks: string
  ctr: string
  actions?: MetaInsightAction[]
  cost_per_action_type?: MetaInsightAction[]
}

export interface InsightsParams {
  level: 'account' | 'campaign' | 'adset' | 'ad'
  dateFrom: string  // YYYY-MM-DD
  dateTo: string    // YYYY-MM-DD
}
```

Also update `MetaCredentials` to include `ad_account_id`:

```ts
export interface MetaCredentials {
  user_access_token: string
  token_expires_at: string | null
  page_id: string
  page_name: string
  page_access_token: string
  ad_account_id?: string  // added in T-017
}
```

- [ ] **Step 3: Add `getAdAccounts` function**

Add after the `getPages` function block:

```ts
// ─── Ad Accounts ────────────────────────────────────────────────────────────

export async function getAdAccounts(userToken: string): Promise<MetaAdAccount[]> {
  const res = await fetch(
    `${GRAPH_URL}/me/adaccounts?fields=id,name,account_status&access_token=${userToken}`
  )
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Meta ad accounts fetch failed: ${JSON.stringify(err)}`)
  }
  const data: { data: MetaAdAccount[] } = await res.json()
  return data.data ?? []
}
```

- [ ] **Step 4: Add `getInsights` function**

Add after `getAdAccounts`:

```ts
// ─── Marketing API Insights ─────────────────────────────────────────────────

export async function getInsights(
  adAccountId: string,
  token: string,
  params: InsightsParams
): Promise<MetaInsightRow[]> {
  const timeRange = JSON.stringify({ since: params.dateFrom, until: params.dateTo })

  const fields = [
    'spend', 'impressions', 'clicks', 'ctr',
    'actions', 'cost_per_action_type',
  ].join(',')

  const searchParams = new URLSearchParams({
    fields,
    level: params.level,
    time_range: timeRange,
    access_token: token,
  })

  // Daily breakdown for account-level (chart data)
  if (params.level === 'account') {
    searchParams.set('time_increment', '1')
  } else {
    searchParams.set('limit', '100')
  }

  const res = await fetch(
    `${GRAPH_URL}/${adAccountId}/insights?${searchParams.toString()}`
  )

  if (!res.ok) {
    const err = await res.json()
    const metaError = err?.error
    if (metaError?.code === 190) {
      throw new Error('META_TOKEN_EXPIRED')
    }
    if (metaError?.code === 17 || metaError?.code === 4) {
      throw new Error('META_RATE_LIMITED')
    }
    throw new Error(`Meta insights fetch failed: ${JSON.stringify(err)}`)
  }

  const data: { data: MetaInsightRow[] } = await res.json()
  return data.data ?? []
}

// ─── Insight helpers ────────────────────────────────────────────────────────

export function extractLeadCount(row: MetaInsightRow): number {
  if (!row.actions) return 0
  const leadAction = row.actions.find(
    a => a.action_type === 'lead' || a.action_type === 'offsite_conversion.fb_pixel_lead'
  )
  return leadAction ? parseInt(leadAction.value, 10) : 0
}

export function extractCostPerLead(row: MetaInsightRow): number | null {
  if (!row.cost_per_action_type) return null
  const cplAction = row.cost_per_action_type.find(
    a => a.action_type === 'lead' || a.action_type === 'offsite_conversion.fb_pixel_lead'
  )
  return cplAction ? parseFloat(cplAction.value) : null
}
```

- [ ] **Step 5: Verify build compiles**

Run: `npx next build --no-lint 2>&1 | head -20`
Expected: No type errors related to the meta client changes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/meta/client.ts
git commit -m "feat: extend Meta client with Marketing API scopes, types, and insight functions"
```

---

### Task 2: Update OAuth Callback — Ad Account Selection

**Files:**
- Modify: `src/app/api/integrations/meta/callback/route.ts`

- [ ] **Step 1: Add `getAdAccounts` import**

Update the import from `@/lib/meta/client`:

```ts
import {
  exchangeCodeForToken,
  getLongLivedToken,
  getPages,
  getAdAccounts,
  subscribePageToLeadgen,
  type MetaCredentials,
} from '@/lib/meta/client'
```

- [ ] **Step 2: Add ad account fetching after page selection**

In the `GET` handler, after the line `await subscribePageToLeadgen(page.id, page.access_token)` (line 60) and before the credentials object creation (line 63), add:

```ts
    // 5. Fetch ad accounts (for Marketing API — T-017)
    let adAccountId: string | undefined
    try {
      const adAccounts = await getAdAccounts(longToken)
      if (adAccounts.length > 0) {
        // V1: auto-select first active account, or first overall
        const active = adAccounts.find(a => a.account_status === 1)
        adAccountId = (active ?? adAccounts[0]).id
      }
    } catch (e) {
      // Non-blocking: ads features won't work but leads webhook still will
      console.warn('Failed to fetch ad accounts (non-blocking):', e)
    }
```

- [ ] **Step 3: Add `ad_account_id` to credentials object**

Update the credentials object:

```ts
    const credentials: MetaCredentials = {
      user_access_token: longToken,
      token_expires_at: expires_at,
      page_id: page.id,
      page_name: page.name,
      page_access_token: page.access_token,
      ad_account_id: adAccountId,
    }
```

- [ ] **Step 4: Verify build compiles**

Run: `npx next build --no-lint 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/integrations/meta/callback/route.ts
git commit -m "feat: fetch and store ad account ID during Meta OAuth callback"
```

---

### Task 3: API Route — `/api/meta/insights`

**Files:**
- Create: `src/app/api/meta/insights/route.ts`

- [ ] **Step 1: Create the insights API route**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { decrypt } from '@/lib/meta/encryption'
import {
  getInsights,
  extractLeadCount,
  extractCostPerLead,
  type MetaCredentials,
  type InsightsParams,
} from '@/lib/meta/client'

interface KpisData {
  spend: number
  impressions: number
  clicks: number
  ctr: number
  leads: number
  cpl: number | null
}

interface BreakdownRow {
  id: string
  name: string
  status: string
  spend: number
  impressions: number
  clicks: number
  ctr: number
  leads: number
  cpl: number | null
}

interface DailyRow {
  date: string
  spend: number
  leads: number
  impressions: number
  clicks: number
}

export interface MetaInsightsResponse {
  kpis: KpisData
  breakdown: BreakdownRow[]
  daily: DailyRow[]
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function getDefaultDateRange(preset: string): { dateFrom: string; dateTo: string } {
  const now = new Date()
  const dateTo = formatDate(now)

  const daysMap: Record<string, number> = {
    today: 0,
    '7d': 7,
    '14d': 14,
    '30d': 30,
    '90d': 90,
  }

  const days = daysMap[preset]
  if (days === undefined) {
    // Default 7d
    const from = new Date()
    from.setDate(from.getDate() - 7)
    return { dateFrom: formatDate(from), dateTo }
  }

  if (days === 0) {
    return { dateFrom: dateTo, dateTo }
  }

  const from = new Date()
  from.setDate(from.getDate() - days)
  return { dateFrom: formatDate(from), dateTo }
}

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    // Parse query params
    const searchParams = request.nextUrl.searchParams
    const level = (searchParams.get('level') ?? 'account') as InsightsParams['level']
    const preset = searchParams.get('preset') ?? '7d'
    const customFrom = searchParams.get('date_from')
    const customTo = searchParams.get('date_to')

    // Validate level
    if (!['account', 'campaign', 'adset', 'ad'].includes(level)) {
      return NextResponse.json({ error: 'Invalid level parameter' }, { status: 400 })
    }

    // Date range
    const { dateFrom, dateTo } = customFrom && customTo
      ? { dateFrom: customFrom, dateTo: customTo }
      : getDefaultDateRange(preset)

    // Fetch Meta integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('credentials_encrypted, is_active')
      .eq('workspace_id', workspaceId)
      .eq('type', 'meta')
      .eq('is_active', true)
      .maybeSingle()

    if (!integration?.credentials_encrypted) {
      return NextResponse.json({ error: 'Meta not connected' }, { status: 404 })
    }

    // Decrypt credentials
    const credentials: MetaCredentials = JSON.parse(
      decrypt(integration.credentials_encrypted)
    )

    if (!credentials.ad_account_id) {
      return NextResponse.json(
        { error: 'needs_upgrade', message: 'Reconnectez Meta pour accéder aux publicités' },
        { status: 403 }
      )
    }

    // Fetch insights from Meta Marketing API
    const rows = await getInsights(credentials.ad_account_id, credentials.user_access_token, {
      level,
      dateFrom,
      dateTo,
    })

    // Build response based on level
    if (level === 'account') {
      // Aggregate KPIs from daily rows
      let totalSpend = 0
      let totalImpressions = 0
      let totalClicks = 0
      let totalLeads = 0
      const daily: DailyRow[] = []

      for (const row of rows) {
        const spend = parseFloat(row.spend || '0')
        const impressions = parseInt(row.impressions || '0', 10)
        const clicks = parseInt(row.clicks || '0', 10)
        const leads = extractLeadCount(row)

        totalSpend += spend
        totalImpressions += impressions
        totalClicks += clicks
        totalLeads += leads

        daily.push({
          date: row.date_start,
          spend,
          leads,
          impressions,
          clicks,
        })
      }

      const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0

      const response: MetaInsightsResponse = {
        kpis: {
          spend: totalSpend,
          impressions: totalImpressions,
          clicks: totalClicks,
          ctr: Math.round(ctr * 100) / 100,
          leads: totalLeads,
          cpl: totalLeads > 0 ? Math.round((totalSpend / totalLeads) * 100) / 100 : null,
        },
        breakdown: [],
        daily: daily.sort((a, b) => a.date.localeCompare(b.date)),
      }

      return NextResponse.json(response)
    }

    // Campaign / AdSet / Ad level — build breakdown
    let totalSpend = 0
    let totalImpressions = 0
    let totalClicks = 0
    let totalLeads = 0

    const breakdown: BreakdownRow[] = rows.map(row => {
      const spend = parseFloat(row.spend || '0')
      const impressions = parseInt(row.impressions || '0', 10)
      const clicks = parseInt(row.clicks || '0', 10)
      const leads = extractLeadCount(row)
      const cpl = extractCostPerLead(row)
      const rowCtr = parseFloat(row.ctr || '0')

      totalSpend += spend
      totalImpressions += impressions
      totalClicks += clicks
      totalLeads += leads

      // Determine id and name based on level
      let id = ''
      let name = ''
      if (level === 'campaign') {
        id = row.campaign_id ?? ''
        name = row.campaign_name ?? 'Sans nom'
      } else if (level === 'adset') {
        id = row.adset_id ?? ''
        name = row.adset_name ?? 'Sans nom'
      } else if (level === 'ad') {
        id = row.ad_id ?? ''
        name = row.ad_name ?? 'Sans nom'
      }

      return {
        id,
        name,
        status: 'ACTIVE', // Meta insights only return data for items with activity
        spend: Math.round(spend * 100) / 100,
        impressions,
        clicks,
        ctr: Math.round(rowCtr * 100) / 100,
        leads,
        cpl: cpl !== null ? Math.round(cpl * 100) / 100 : null,
      }
    })

    const overallCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0

    const response: MetaInsightsResponse = {
      kpis: {
        spend: totalSpend,
        impressions: totalImpressions,
        clicks: totalClicks,
        ctr: Math.round(overallCtr * 100) / 100,
        leads: totalLeads,
        cpl: totalLeads > 0 ? Math.round((totalSpend / totalLeads) * 100) / 100 : null,
      },
      breakdown: breakdown.sort((a, b) => b.spend - a.spend),
      daily: [],
    }

    return NextResponse.json(response)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'

    if (message === 'META_TOKEN_EXPIRED') {
      return NextResponse.json(
        { error: 'token_expired', message: 'Reconnectez votre compte Meta' },
        { status: 401 }
      )
    }
    if (message === 'META_RATE_LIMITED') {
      return NextResponse.json(
        { error: 'rate_limited', message: 'Trop de requêtes, réessayez dans quelques minutes' },
        { status: 429 }
      )
    }
    if (message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    console.error('Meta insights error:', err)
    return NextResponse.json(
      { error: 'meta_error', message: 'Erreur lors de la récupération des données Meta' },
      { status: 502 }
    )
  }
}
```

- [ ] **Step 2: Verify build compiles**

Run: `npx next build --no-lint 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/meta/insights/route.ts
git commit -m "feat: add /api/meta/insights route for Marketing API data"
```

---

### Task 4: Frontend — Banner, Period Selector, and Page Shell

**Files:**
- Create: `src/app/(dashboard)/acquisition/publicites/ads-meta-banner.tsx`
- Create: `src/app/(dashboard)/acquisition/publicites/ads-period-selector.tsx`
- Modify: `src/app/(dashboard)/acquisition/publicites/page.tsx`

- [ ] **Step 1: Create the Meta banner component**

```tsx
// src/app/(dashboard)/acquisition/publicites/ads-meta-banner.tsx
'use client'

interface AdsMetaBannerProps {
  state: 'not_connected' | 'needs_upgrade' | 'error'
  errorMessage?: string
  onRetry?: () => void
}

export default function AdsMetaBanner({ state, errorMessage, onRetry }: AdsMetaBannerProps) {
  if (state === 'not_connected') {
    return (
      <div style={{
        background: 'rgba(24, 119, 242, 0.06)',
        border: '1px dashed rgba(24, 119, 242, 0.3)',
        borderRadius: 12,
        padding: '24px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            Connecte ton compte Meta
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Relie ton compte publicitaire pour voir tes performances Facebook & Instagram Ads en temps réel.
          </div>
        </div>
        <a
          href="/parametres/integrations"
          style={{
            background: '#1877F2',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            padding: '10px 20px',
            borderRadius: 8,
            textDecoration: 'none',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          Connecter Meta →
        </a>
      </div>
    )
  }

  if (state === 'needs_upgrade') {
    return (
      <div style={{
        background: 'rgba(214, 158, 46, 0.06)',
        border: '1px dashed rgba(214, 158, 46, 0.3)',
        borderRadius: 12,
        padding: '24px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            Mets à jour ta connexion Meta
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            De nouvelles permissions sont nécessaires pour accéder aux statistiques publicitaires. Tes leads continuent d&apos;arriver normalement.
          </div>
        </div>
        <a
          href="/api/integrations/meta"
          style={{
            background: '#D69E2E',
            color: '#000',
            fontSize: 13,
            fontWeight: 600,
            padding: '10px 20px',
            borderRadius: 8,
            textDecoration: 'none',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          Mettre à jour →
        </a>
      </div>
    )
  }

  // Error state
  return (
    <div style={{
      background: 'rgba(229, 62, 62, 0.06)',
      border: '1px dashed rgba(229, 62, 62, 0.3)',
      borderRadius: 12,
      padding: '24px 28px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
    }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          Erreur de connexion Meta
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {errorMessage ?? 'Impossible de récupérer les données publicitaires.'}
        </div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            background: '#E53E3E',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            padding: '10px 20px',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Réessayer
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create the period selector component**

```tsx
// src/app/(dashboard)/acquisition/publicites/ads-period-selector.tsx
'use client'

import { useState } from 'react'

export type PeriodPreset = 'today' | '7d' | '14d' | '30d' | '90d' | 'custom'

interface AdsPeriodSelectorProps {
  value: PeriodPreset
  dateFrom: string
  dateTo: string
  onChange: (preset: PeriodPreset, dateFrom?: string, dateTo?: string) => void
}

const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: 'today', label: "Aujourd'hui" },
  { value: '7d', label: '7j' },
  { value: '14d', label: '14j' },
  { value: '30d', label: '30j' },
  { value: '90d', label: '90j' },
  { value: 'custom', label: 'Personnalisé' },
]

const btnBase: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 6,
  border: '1px solid var(--border-primary)',
  background: 'transparent',
  color: 'var(--text-secondary)',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.15s',
}

const btnActive: React.CSSProperties = {
  ...btnBase,
  background: '#1877F2',
  borderColor: '#1877F2',
  color: '#fff',
  fontWeight: 600,
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-primary)',
  borderRadius: 6,
  padding: '6px 10px',
  color: 'var(--text-primary)',
  fontSize: 12,
  outline: 'none',
}

export default function AdsPeriodSelector({ value, dateFrom, dateTo, onChange }: AdsPeriodSelectorProps) {
  const [showCustom, setShowCustom] = useState(value === 'custom')
  const [localFrom, setLocalFrom] = useState(dateFrom)
  const [localTo, setLocalTo] = useState(dateTo)

  function handlePreset(preset: PeriodPreset) {
    if (preset === 'custom') {
      setShowCustom(true)
      onChange('custom', localFrom, localTo)
    } else {
      setShowCustom(false)
      onChange(preset)
    }
  }

  function handleCustomApply() {
    if (localFrom && localTo) {
      onChange('custom', localFrom, localTo)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {PRESETS.map(p => (
        <button
          key={p.value}
          onClick={() => handlePreset(p.value)}
          style={value === p.value ? btnActive : btnBase}
        >
          {p.label}
        </button>
      ))}

      {showCustom && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Du</span>
          <input
            type="date"
            value={localFrom}
            onChange={e => setLocalFrom(e.target.value)}
            style={inputStyle}
          />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>au</span>
          <input
            type="date"
            value={localTo}
            onChange={e => setLocalTo(e.target.value)}
            style={inputStyle}
          />
          <button
            onClick={handleCustomApply}
            style={{
              ...btnBase,
              background: '#1877F2',
              borderColor: '#1877F2',
              color: '#fff',
            }}
          >
            OK
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Update the page server component**

Replace `src/app/(dashboard)/acquisition/publicites/page.tsx` entirely:

```tsx
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/meta/encryption'
import type { MetaCredentials } from '@/lib/meta/client'
import PublicitesClient from './publicites-client'

export type MetaConnectionState = 'not_connected' | 'needs_upgrade' | 'connected'

export default async function PublicitesPage() {
  const { workspaceId } = await getWorkspaceId()
  const supabase = await createClient()

  const { data: integration } = await supabase
    .from('integrations')
    .select('credentials_encrypted, is_active')
    .eq('workspace_id', workspaceId)
    .eq('type', 'meta')
    .eq('is_active', true)
    .maybeSingle()

  let connectionState: MetaConnectionState = 'not_connected'

  if (integration?.credentials_encrypted) {
    try {
      const credentials: MetaCredentials = JSON.parse(
        decrypt(integration.credentials_encrypted)
      )
      connectionState = credentials.ad_account_id ? 'connected' : 'needs_upgrade'
    } catch {
      connectionState = 'not_connected'
    }
  }

  return <PublicitesClient connectionState={connectionState} />
}
```

- [ ] **Step 4: Verify build compiles**

Run: `npx next build --no-lint 2>&1 | head -20`
Expected: May fail because `PublicitesClient` doesn't exist yet — that's fine, it's created in the next task. Confirm there are no type errors in the files created so far.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/acquisition/publicites/ads-meta-banner.tsx src/app/\(dashboard\)/acquisition/publicites/ads-period-selector.tsx src/app/\(dashboard\)/acquisition/publicites/page.tsx
git commit -m "feat: add Meta banner, period selector, and page server component for Publicités"
```

---

### Task 5: Frontend — Overview Tab

**Files:**
- Create: `src/app/(dashboard)/acquisition/publicites/ads-overview-tab.tsx`

- [ ] **Step 1: Create the overview tab component**

```tsx
// src/app/(dashboard)/acquisition/publicites/ads-overview-tab.tsx
'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { MetaInsightsResponse } from '@/app/api/meta/insights/route'

interface AdsOverviewTabProps {
  data: MetaInsightsResponse | null
  closedCount: number
  closedRevenue: number
  loading: boolean
}

function formatEuro(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + '€'
}

function formatNumber(n: number): string {
  return n.toLocaleString('fr-FR')
}

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-primary)',
  borderRadius: 10,
  padding: 16,
}

export default function AdsOverviewTab({ data, closedCount, closedRevenue, loading }: AdsOverviewTabProps) {
  if (loading || !data) {
    return <OverviewSkeleton />
  }

  const { kpis, daily } = data
  const roas = kpis.spend > 0 ? Math.round((closedRevenue / kpis.spend) * 10) / 10 : null

  // Funnel steps
  const funnelSteps = [
    { label: 'Impressions', value: kpis.impressions, color: '#1877F2' },
    { label: 'Clics', value: kpis.clicks, color: '#1877F2', pct: kpis.impressions > 0 ? ((kpis.clicks / kpis.impressions) * 100).toFixed(1) + '%' : '—' },
    { label: 'Leads', value: kpis.leads, color: 'var(--color-primary)', pct: kpis.clicks > 0 ? ((kpis.leads / kpis.clicks) * 100).toFixed(1) + '%' : '—' },
    { label: 'Closés', value: closedCount, color: 'var(--color-primary)', pct: kpis.leads > 0 ? ((closedCount / kpis.leads) * 100).toFixed(1) + '%' : '—' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        <KpiCard label="Budget dépensé" value={formatEuro(kpis.spend)} color="#1877F2" />
        <KpiCard label="Leads générés" value={formatNumber(kpis.leads)} color="var(--color-primary)" />
        <KpiCard label="Coût / lead" value={kpis.cpl !== null ? kpis.cpl.toFixed(2) + '€' : '—'} color="var(--text-primary)" />
        <KpiCard label="CTR" value={kpis.ctr.toFixed(2) + '%'} color="var(--text-primary)" />
        <KpiCard label="ROAS estimé" value={roas !== null ? roas + 'x' : '—'} color="var(--color-primary)" />
      </div>

      {/* Chart: Leads per day */}
      <div style={{ ...cardStyle, padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12 }}>
          Leads / jour (Meta Ads)
        </div>
        {daily.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={daily}>
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => d.slice(5)} // "03-28"
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(d: string) => `Date : ${d}`}
                formatter={(value: number) => [value, 'Leads']}
              />
              <Bar dataKey="leads" fill="#1877F2" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>
            Aucune donnée pour cette période
          </div>
        )}
      </div>

      {/* Funnel */}
      <div style={{ ...cardStyle, padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 16 }}>
          Funnel marketing
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
          {funnelSteps.map((step, i) => (
            <div key={step.label} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              <div style={{ textAlign: 'center', minWidth: 80 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: step.color }}>
                  {formatNumber(step.value)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {step.label}
                </div>
                {'pct' in step && step.pct && (
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>
                    ({step.pct})
                  </div>
                )}
              </div>
              {i < funnelSteps.length - 1 && (
                <span style={{ color: 'var(--border-primary)', fontSize: 18, margin: '0 8px' }}>→</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
    </div>
  )
}

function OverviewSkeleton() {
  const skeletonCard: React.CSSProperties = {
    ...cardStyle,
    height: 72,
    background: 'var(--bg-elevated)',
    animation: 'pulse 1.5s ease-in-out infinite',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        {[1, 2, 3, 4, 5].map(i => <div key={i} style={skeletonCard} />)}
      </div>
      <div style={{ ...skeletonCard, height: 230 }} />
      <div style={{ ...skeletonCard, height: 100 }} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/acquisition/publicites/ads-overview-tab.tsx
git commit -m "feat: add AdsOverviewTab with KPIs, leads chart, and marketing funnel"
```

---

### Task 6: Frontend — Table Tab

**Files:**
- Create: `src/app/(dashboard)/acquisition/publicites/ads-table-tab.tsx`

- [ ] **Step 1: Create the reusable table tab component**

```tsx
// src/app/(dashboard)/acquisition/publicites/ads-table-tab.tsx
'use client'

import { useState } from 'react'
import type { MetaInsightsResponse } from '@/app/api/meta/insights/route'

interface AdsTableTabProps {
  data: MetaInsightsResponse | null
  loading: boolean
}

type SortKey = 'name' | 'spend' | 'impressions' | 'clicks' | 'ctr' | 'leads' | 'cpl'
type SortDir = 'asc' | 'desc'

function formatEuro(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€'
}

function formatNumber(n: number): string {
  return n.toLocaleString('fr-FR')
}

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-muted)',
  textAlign: 'left',
  cursor: 'pointer',
  userSelect: 'none',
  borderBottom: '1px solid var(--border-primary)',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 12,
  color: 'var(--text-secondary)',
  borderBottom: '1px solid var(--border-secondary, rgba(255,255,255,0.04))',
}

export default function AdsTableTab({ data, loading }: AdsTableTabProps) {
  const [sortKey, setSortKey] = useState<SortKey>('spend')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  if (loading || !data) {
    return <TableSkeleton />
  }

  if (data.breakdown.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: 60,
        color: 'var(--text-muted)',
        fontSize: 13,
      }}>
        Aucune donnée pour cette période
      </div>
    )
  }

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = [...data.breakdown].sort((a, b) => {
    const valA = a[sortKey] ?? 0
    const valB = b[sortKey] ?? 0
    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
    }
    return sortDir === 'asc'
      ? (valA as number) - (valB as number)
      : (valB as number) - (valA as number)
  })

  const arrow = (key: SortKey) => sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-primary)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={thStyle} onClick={() => handleSort('name')}>Nom{arrow('name')}</th>
            <th style={thStyle}>Statut</th>
            <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('spend')}>Dépensé{arrow('spend')}</th>
            <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('impressions')}>Impressions{arrow('impressions')}</th>
            <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('clicks')}>Clics{arrow('clicks')}</th>
            <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('ctr')}>CTR{arrow('ctr')}</th>
            <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('leads')}>Leads{arrow('leads')}</th>
            <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('cpl')}>CPL{arrow('cpl')}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(row => (
            <tr
              key={row.id}
              style={{ transition: 'background 0.1s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <td style={{ ...tdStyle, fontWeight: 500, color: 'var(--text-primary)' }}>{row.name}</td>
              <td style={tdStyle}>
                <span style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: row.status === 'ACTIVE' ? 'rgba(0,200,83,0.1)' : 'rgba(255,255,255,0.05)',
                  color: row.status === 'ACTIVE' ? 'var(--color-primary)' : 'var(--text-muted)',
                }}>
                  {row.status === 'ACTIVE' ? 'Actif' : 'Pausé'}
                </span>
              </td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{formatEuro(row.spend)}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{formatNumber(row.impressions)}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{formatNumber(row.clicks)}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{row.ctr.toFixed(2)}%</td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: 'var(--color-primary)' }}>{row.leads}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{row.cpl !== null ? formatEuro(row.cpl) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TableSkeleton() {
  const skeletonRow: React.CSSProperties = {
    height: 42,
    background: 'var(--bg-elevated)',
    animation: 'pulse 1.5s ease-in-out infinite',
  }
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-primary)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{ ...skeletonRow, borderBottom: '1px solid var(--border-primary)' }} />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/acquisition/publicites/ads-table-tab.tsx
git commit -m "feat: add AdsTableTab with sortable columns for campaigns/adsets/ads"
```

---

### Task 7: Frontend — PublicitesClient (Main Orchestrator)

**Files:**
- Create: `src/app/(dashboard)/acquisition/publicites/publicites-client.tsx`

- [ ] **Step 1: Create the main client component**

```tsx
// src/app/(dashboard)/acquisition/publicites/publicites-client.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import type { MetaConnectionState } from './page'
import type { MetaInsightsResponse } from '@/app/api/meta/insights/route'
import AdsMetaBanner from './ads-meta-banner'
import AdsPeriodSelector, { type PeriodPreset } from './ads-period-selector'
import AdsOverviewTab from './ads-overview-tab'
import AdsTableTab from './ads-table-tab'

type TabKey = 'overview' | 'campaigns' | 'adsets' | 'ads'

interface PublicitesClientProps {
  connectionState: MetaConnectionState
}

const TAB_LABELS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: "Vue d'ensemble" },
  { key: 'campaigns', label: 'Campagnes' },
  { key: 'adsets', label: 'Ad Sets' },
  { key: 'ads', label: 'Ads' },
]

const TAB_TO_LEVEL: Record<TabKey, string> = {
  overview: 'account',
  campaigns: 'campaign',
  adsets: 'adset',
  ads: 'ad',
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function getDefaultDates(): { dateFrom: string; dateTo: string } {
  const now = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 7)
  return { dateFrom: formatDate(from), dateTo: formatDate(now) }
}

export default function PublicitesClient({ connectionState }: PublicitesClientProps) {
  const [tab, setTab] = useState<TabKey>('overview')
  const [period, setPeriod] = useState<PeriodPreset>('7d')
  const [dateFrom, setDateFrom] = useState(getDefaultDates().dateFrom)
  const [dateTo, setDateTo] = useState(getDefaultDates().dateTo)
  const [data, setData] = useState<MetaInsightsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [closedCount, setClosedCount] = useState(0)
  const [closedRevenue] = useState(0) // V1: no revenue tracking yet

  const fetchInsights = useCallback(async () => {
    if (connectionState !== 'connected') return

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        level: TAB_TO_LEVEL[tab],
      })

      if (period === 'custom') {
        params.set('date_from', dateFrom)
        params.set('date_to', dateTo)
      } else {
        params.set('preset', period)
      }

      const res = await fetch(`/api/meta/insights?${params.toString()}`)

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (body.error === 'needs_upgrade') {
          setError('needs_upgrade')
        } else if (body.error === 'token_expired') {
          setError('Votre token Meta a expiré. Reconnectez votre compte.')
        } else if (body.error === 'rate_limited') {
          setError('Trop de requêtes vers Meta. Réessayez dans quelques minutes.')
        } else {
          setError(body.message ?? 'Erreur lors de la récupération des données')
        }
        setData(null)
        return
      }

      const json: MetaInsightsResponse = await res.json()
      setData(json)
    } catch {
      setError('Erreur réseau. Vérifiez votre connexion.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [connectionState, tab, period, dateFrom, dateTo])

  // Fetch closed leads count from Supabase for the funnel
  const fetchClosedCount = useCallback(async () => {
    if (connectionState !== 'connected') return

    try {
      // Use the leads API with status filter
      const params = new URLSearchParams({
        status: 'clos',
        source: 'facebook_ads,instagram_ads',
        page: '1',
        per_page: '1',
      })
      const res = await fetch(`/api/leads?${params.toString()}`)
      if (res.ok) {
        const json = await res.json()
        setClosedCount(json.total ?? 0)
      }
    } catch {
      // Non-critical, funnel will show 0
    }
  }, [connectionState])

  useEffect(() => {
    fetchInsights()
  }, [fetchInsights])

  useEffect(() => {
    fetchClosedCount()
  }, [fetchClosedCount])

  function handlePeriodChange(preset: PeriodPreset, customFrom?: string, customTo?: string) {
    setPeriod(preset)
    if (preset === 'custom' && customFrom && customTo) {
      setDateFrom(customFrom)
      setDateTo(customTo)
    }
  }

  // Banner states
  if (connectionState === 'not_connected') {
    return (
      <div style={{ padding: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>Publicités</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Performance de tes campagnes Meta Ads</p>
        <AdsMetaBanner state="not_connected" />
      </div>
    )
  }

  if (connectionState === 'needs_upgrade') {
    return (
      <div style={{ padding: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>Publicités</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Performance de tes campagnes Meta Ads</p>
        <AdsMetaBanner state="needs_upgrade" />
      </div>
    )
  }

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>Publicités</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Performance de tes campagnes Meta Ads</p>
        </div>
        <AdsPeriodSelector
          value={period}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onChange={handlePeriodChange}
        />
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: 0,
        borderBottom: '1px solid var(--border-primary)',
        marginBottom: 20,
      }}>
        {TAB_LABELS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: tab === t.key ? 600 : 400,
              color: tab === t.key ? '#1877F2' : 'var(--text-muted)',
              background: 'transparent',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid #1877F2' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div style={{ marginBottom: 16 }}>
          <AdsMetaBanner state="error" errorMessage={error} onRetry={fetchInsights} />
        </div>
      )}

      {/* Tab content */}
      {!error && tab === 'overview' && (
        <AdsOverviewTab
          data={data}
          closedCount={closedCount}
          closedRevenue={closedRevenue}
          loading={loading}
        />
      )}
      {!error && tab !== 'overview' && (
        <AdsTableTab data={data} loading={loading} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify full build compiles**

Run: `npx next build --no-lint 2>&1 | tail -20`
Expected: Build succeeds with no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/acquisition/publicites/publicites-client.tsx
git commit -m "feat: add PublicitesClient orchestrator with tabs, period selector, and data fetching"
```

---

### Task 8: Update Statistics Page — Real Meta Data

**Files:**
- Modify: `src/lib/stats/queries.ts`

- [ ] **Step 1: Add imports and update `fetchMetaStats` to return real data**

First, add these imports at the top of `src/lib/stats/queries.ts`, after the existing `import { createClient }` line:

```ts
import { decrypt } from '@/lib/meta/encryption'
import { getInsights, extractLeadCount, type MetaCredentials } from '@/lib/meta/client'
```

Then replace the `fetchMetaStats` function:

```ts
export async function fetchMetaStats(workspaceId: string): Promise<MetaStats> {
  const supabase = await createClient()
  const { data: integration } = await supabase
    .from('integrations')
    .select('credentials_encrypted')
    .eq('workspace_id', workspaceId)
    .eq('type', 'meta')
    .eq('is_active', true)
    .maybeSingle()

  if (!integration?.credentials_encrypted) {
    return { isConnected: false, costPerLead: null, roas: null, budgetSpent: null }
  }

  try {
    const credentials: MetaCredentials = JSON.parse(decrypt(integration.credentials_encrypted))

    if (!credentials.ad_account_id) {
      return { isConnected: true, costPerLead: null, roas: null, budgetSpent: null }
    }

    const now = new Date()
    const from = new Date()
    from.setDate(from.getDate() - 30)

    const rows = await getInsights(credentials.ad_account_id, credentials.user_access_token, {
      level: 'account',
      dateFrom: from.toISOString().slice(0, 10),
      dateTo: now.toISOString().slice(0, 10),
    })

    let totalSpend = 0
    let totalLeads = 0
    for (const row of rows) {
      totalSpend += parseFloat(row.spend || '0')
      totalLeads += extractLeadCount(row)
    }

    return {
      isConnected: true,
      costPerLead: totalLeads > 0 ? Math.round((totalSpend / totalLeads) * 100) / 100 : null,
      roas: null,
      budgetSpent: Math.round(totalSpend * 100) / 100,
    }
  } catch (err) {
    console.warn('Failed to fetch Meta stats (non-blocking):', err)
    return { isConnected: true, costPerLead: null, roas: null, budgetSpent: null }
  }
}
```

- [ ] **Step 3: Verify build compiles**

Run: `npx next build --no-lint 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/lib/stats/queries.ts
git commit -m "feat: wire real Meta Marketing API data into statistics page MetaSection"
```

---

### Task 9: Create Task File and Update Project State

**Files:**
- Create: `taches/tache-017-module-publicites.md`
- Modify: `etat.md`
- Modify: `ameliorations.md`

- [ ] **Step 1: Create task file**

Create `taches/tache-017-module-publicites.md`:

```markdown
# Tâche 017 — Module Publicités (Meta Ads Dashboard — Bloc B)

**Développeur :** Rémy
**Date de début :** 2026-04-01
**Statut :** ✅ Terminé

## Description

Dashboard de performance Meta Ads en temps réel à `/acquisition/publicites`.

## Objectif

Permettre à un coach de visualiser les performances de ses campagnes Meta Ads (budget, CPL, ROAS, leads/jour, funnel marketing) avec drill-down par campagne, ad set et ad.

## Spec

Spec : `docs/superpowers/specs/2026-04-01-meta-ads-dashboard-design.md`
Plan : `docs/superpowers/plans/2026-04-01-meta-ads-dashboard.md`

Décisions clés :
- Données temps réel via Meta Marketing API (pas de cache V1)
- Layout avec onglets : Vue d'ensemble / Campagnes / Ad Sets / Ads
- Sélecteur de période : Aujourd'hui / 7j / 14j / 30j / 90j / Custom
- Scopes OAuth ajoutés : ads_read, read_insights
- Ad account auto-sélectionné au callback OAuth

## Fichiers créés / modifiés

- `src/app/api/meta/insights/route.ts` — API route Marketing API
- `src/app/(dashboard)/acquisition/publicites/page.tsx` — Server component
- `src/app/(dashboard)/acquisition/publicites/publicites-client.tsx` — Client orchestrator
- `src/app/(dashboard)/acquisition/publicites/ads-overview-tab.tsx` — Onglet overview
- `src/app/(dashboard)/acquisition/publicites/ads-table-tab.tsx` — Tableau campagnes/adsets/ads
- `src/app/(dashboard)/acquisition/publicites/ads-period-selector.tsx` — Sélecteur de période
- `src/app/(dashboard)/acquisition/publicites/ads-meta-banner.tsx` — Banners d'état
- `src/lib/meta/client.ts` — Scopes + getAdAccounts + getInsights
- `src/app/api/integrations/meta/callback/route.ts` — Ajout sélection ad account
- `src/lib/stats/queries.ts` — fetchMetaStats avec vraies données

## Tâches liées

- T-013 : Meta Ads Bloc A (OAuth + webhook leads) — prérequis
- T-011 : Module Statistiques — MetaSection mise à jour
```

- [ ] **Step 2: Update `etat.md`**

Update the row for Module Publicités from `⬜ Non démarré` to `✅ Terminé` and update the date in the header.

- [ ] **Step 3: Update `ameliorations.md`**

Add any improvements identified during implementation (cache, multi ad accounts, etc.).

- [ ] **Step 4: Commit**

```bash
git add taches/tache-017-module-publicites.md etat.md ameliorations.md
git commit -m "chore: add T-017 task file and update project state"
```
