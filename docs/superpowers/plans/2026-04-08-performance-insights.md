# Performance Insights Dashboard — Plan d'implementation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ajouter un onglet "Performance" dans la page Publicites avec un dashboard style Mochi : funnel vertical, cost analysis, ad source attribution, et Performance Insights (cards vert/orange/rouge avec action steps).

**Architecture:** Nouvel onglet dans publicites-client.tsx + nouveau composant AdsPerformanceTab + nouvelle API /api/performance/follow-ads qui agrege Meta Ads + Instagram + Leads + Bookings. Zero modification des fichiers existants de Remy sauf 3 lignes dans publicites-client.tsx pour ajouter le tab.

**Tech Stack:** Next.js 14, TypeScript, Supabase, Meta Marketing API (deja integre)

**Spec :** `docs/superpowers/specs/2026-04-08-performance-insights-design.md`

---

## Donnees du funnel et leurs sources

| Etape funnel | Source | Table/API | Deja dispo ? |
|---|---|---|---|
| Ad Spend | Meta API insights | `/api/meta/insights` (data.kpis.spend) | ✅ Oui |
| Profile Visits | Instagram Insights | `ig_snapshots.total_reach` ou Meta API | ⚠️ Approximatif |
| Followers | Instagram | `ig_snapshots.followers` | ✅ Oui |
| Qualified Followers | Supabase | `leads` WHERE source IN ('follow_ads','instagram_ads') | ✅ Oui |
| Conversations | Supabase | `ig_conversations` count | ✅ Oui |
| Appointments | Supabase | `bookings` count (periode) | ✅ Oui |
| Show Ups | Supabase | `bookings` WHERE status != 'no_show' AND status != 'cancelled' | ✅ Oui |
| Cash Collected | Pas en base | Saisie manuelle ou futur module Stripe | ❌ Non — on affiche "—" |

---

## PRINCIPE FONDAMENTAL : ne rien casser

**Fichiers de Remy a NE PAS MODIFIER :**
- `ads-overview-tab.tsx` ❌
- `ads-table-tab.tsx` ❌
- `ads-campaign-type-toggle.tsx` ❌
- `ads-instagram-growth.tsx` ❌
- `ads-chart-inner.tsx` ❌
- `ads-period-selector.tsx` ❌
- `ads-meta-banner.tsx` ❌
- `health-thresholds.ts` ❌
- `/api/meta/insights/route.ts` ❌

**Fichier de Remy a MODIFIER (3 lignes seulement) :**
- `publicites-client.tsx` — ajouter `'performance'` dans le type TabKey + ajouter le bouton tab + ajouter le rendu conditionnel

---

## Task 1 : API /api/performance/follow-ads

**Fichier a creer :** `src/app/api/performance/follow-ads/route.ts`

Cette API agrege toutes les donnees necessaires au dashboard Performance depuis Supabase + les donnees Meta deja fetchees cote client.

```typescript
GET /api/performance/follow-ads?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD

Response: {
  funnel: {
    ad_spend: number          // Passe par le client (data.kpis.spend)
    profile_visits: number    // ig_snapshots.total_reach (approximation)
    followers: number         // ig_snapshots dernier - premier dans la periode
    followers_total: number   // ig_snapshots dernier
    qualified_followers: number // leads count (source follow_ads/instagram_ads, created in period)
    conversations: number     // ig_conversations count (created in period)
    appointments: number      // bookings count (scheduled in period)
    show_ups: number          // bookings WHERE status IN ('completed','confirmed') in period
    cash_collected: number | null // null pour V1
  }
  previous_period: {         // Meme structure, periode precedente (pour comparaison %)
    ...
  }
  ad_source_attribution: {   // Sera rempli par les donnees Meta cote client
    // Pas dans cette API — calcule cote frontend depuis data.breakdown
  }
}
```

**Logique :**
1. Calculer les dates de la periode precedente (meme duree, decalee)
2. Fetch ig_snapshots pour followers + profile visits
3. Count leads WHERE source IN ('follow_ads','instagram_ads') AND created_at dans la periode
4. Count ig_conversations WHERE created_at dans la periode
5. Count bookings WHERE scheduled_at dans la periode
6. Count bookings WHERE status IN ('completed','confirmed') dans la periode
7. Meme chose pour la periode precedente
8. Retourner les deux periodes

---

## Task 2 : Composants Performance

### Fichiers a creer

#### `src/app/(dashboard)/acquisition/publicites/performance/overview-metrics.tsx`
3 cards en ligne (comme Mochi) :
- Total Followers (nombre + variation %)
- Conversion Rate visit→follower (% + variation)
- Ad Spend (€ + variation %)

Chaque card : fond blanc/elevated, icone coloree, gros chiffre, badge variation (+X% vert ou -X% rouge).

#### `src/app/(dashboard)/acquisition/publicites/performance/funnel-column.tsx`
Funnel vertical avec les etapes :
- Chaque etape : gros chiffre bleu + label + taux de conversion vers l'etape suivante
- Fleche ↓ entre chaque etape
- Derniere etape (Cash Collected) en vert/or

#### `src/app/(dashboard)/acquisition/publicites/performance/cost-analysis.tsx`
Card "Cost Analysis" avec :
- Cost Per Follower : valeur + badge variation % + "Previous: X" + "Target: X"
- Cost Per Appointment : idem

Card "Ad Source Attribution" :
- Barres horizontales par type de campagne (depuis data.breakdown groupe par campaign_type)
- Pour chaque : nombre, %, cout total, CPF
- En bas : Total Followers + Profile Visits + Conversations (avec icones)

#### `src/app/(dashboard)/acquisition/publicites/performance/insight-card.tsx`
Composant reutilisable pour une carte insight :

```typescript
interface InsightCardProps {
  icon: LucideIcon
  title: string
  status: 'action_required' | 'needs_optimization' | 'on_track'
  currentValue: string
  targetValue: string
  description: string
  expectedImpact: string
  actionSteps: string[]
}
```

Design :
- Bordure gauche 4px coloree (rouge/orange/vert)
- Badge en haut a droite ("Action Required" rouge, "On Track" vert)
- Titre + sous-titre "Current: X → Target: Y" en couleur
- Description contextuelle
- Section "EXPECTED IMPACT" avec icone graphique
- Section "ACTION STEPS" avec liste numerotee (1. 2. 3. 4.)

#### `src/app/(dashboard)/acquisition/publicites/performance/insights-engine.ts`
Moteur de generation des insights a partir des donnees :

```typescript
function generateInsights(
  funnel: FunnelData,
  previousFunnel: FunnelData,
  kpis: KpisData,
  campaignType: string
): PerformanceInsight[]
```

6 insights calcules :
1. **Conversation-to-Appointment Gap** : conversations / appointments rate vs target 15%
2. **Optimize Ad Spend Efficiency** : compare CPF par source (breakdown)
3. **Profile Conversion** : profile visits → followers rate vs target 20%
4. **Cost Per Follower** : CPF vs target configurable
5. **Show-Up Rate** : appointments → show ups vs target 80%
6. **Qualification Success** : followers → qualified rate vs target 50%

Chaque insight : calcule status (vert/orange/rouge) + genere description + expected impact + action steps.

#### `src/app/(dashboard)/acquisition/publicites/ads-performance-tab.tsx`
Composant principal qui assemble tout :

Layout :
```
[Overview Metrics — 3 cards horizontales]

[Funnel Column (gauche)]  [Cost Analysis + Attribution (droite)]

[Performance Insights — grille 2x3 de cards]
```

Props : memes que AdsOverviewTab (data, loading, campaignType, dateFrom, dateTo)

---

## Task 3 : Integration dans publicites-client.tsx (3 lignes)

### Modification 1 : Type TabKey
```typescript
// AVANT
type TabKey = 'overview' | 'campaigns' | 'adsets' | 'ads'

// APRES
type TabKey = 'overview' | 'performance' | 'campaigns' | 'adsets' | 'ads'
```

### Modification 2 : Bouton tab
Ajouter dans le rendu des tabs, apres 'overview' et avant 'campaigns' :
```typescript
{ key: 'performance', label: 'Performance', icon: TrendingUp }
```

### Modification 3 : Rendu conditionnel
```typescript
{!error && tab === 'performance' && (
  <AdsPerformanceTab
    data={data}
    loading={loading}
    campaignType={campaignType}
    dateFrom={dateFrom}
    dateTo={dateTo}
    closedCount={closedCount}
  />
)}
```

Import en haut :
```typescript
import AdsPerformanceTab from './ads-performance-tab'
```

### TAB_TO_LEVEL
```typescript
performance: 'account',  // Utilise les donnees account-level
```

---

## Task 4 : Targets configurables

Les targets (Cost Per Follower target: $4.00, etc.) doivent etre configurables par le coach.

**Option simple (V1)** : hardcoder des valeurs par defaut raisonnables, les afficher mais pas editables.

**Option V2** : section dans Parametres ou le coach definit ses targets (CPF, taux conversion, etc.). Pour V1, on hardcode.

Valeurs par defaut :
```typescript
const DEFAULT_TARGETS = {
  cost_per_follower: 4.00,        // €
  cost_per_appointment: 120.00,   // €
  conversation_to_appointment: 15, // %
  visit_to_follower: 20,          // %
  show_up_rate: 80,               // %
  qualification_rate: 50,         // %
}
```

---

## Resume des fichiers

### A creer (7 fichiers)
| Fichier | Description |
|---|---|
| `src/app/api/performance/follow-ads/route.ts` | API funnel data aggregation |
| `src/app/(dashboard)/acquisition/publicites/ads-performance-tab.tsx` | Composant principal Performance |
| `src/app/(dashboard)/acquisition/publicites/performance/overview-metrics.tsx` | 3 KPI cards top |
| `src/app/(dashboard)/acquisition/publicites/performance/funnel-column.tsx` | Funnel vertical |
| `src/app/(dashboard)/acquisition/publicites/performance/cost-analysis.tsx` | Cost analysis + attribution |
| `src/app/(dashboard)/acquisition/publicites/performance/insight-card.tsx` | Card insight reutilisable |
| `src/app/(dashboard)/acquisition/publicites/performance/insights-engine.ts` | Moteur de generation insights |

### A modifier (1 fichier, 3 lignes)
| Fichier | Modification |
|---|---|
| `src/app/(dashboard)/acquisition/publicites/publicites-client.tsx` | TabKey + tab button + rendu conditionnel |

---

*Plan genere le 2026-04-08 — ClosRM / Pierre*
