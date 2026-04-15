# Plan — Colonnes KPI avancees + Modale Closing

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Ajouter un systeme complet de colonnes selectionnables dans la table Ads (26 KPIs couvrant tout le funnel), une modale closing avec montant du deal, et les video metrics Meta.

**Architecture:** Migration SQL pour les champs financiers sur leads, enrichissement de l'API Meta avec video metrics, nouvelle API CRM funnel, column picker enrichi avec categories, modale closing intercalée dans le changement de statut.

**Tech Stack:** Next.js 14, TypeScript, Supabase, Meta Marketing API v18.0

**Spec :** `docs/superpowers/specs/2026-04-09-ads-kpi-columns-design.md`

---

## Task 1 : Migration SQL + Types

**Fichiers :**
- Creer : `supabase/migrations/022_lead_deal_fields.sql`
- Modifier : `src/types/index.ts`

### Migration
```sql
ALTER TABLE leads ADD COLUMN IF NOT EXISTS deal_amount NUMERIC;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS deal_installments INTEGER DEFAULT 1;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS cash_collected NUMERIC DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
```

### Types
Ajouter a l'interface `Lead` :
```typescript
deal_amount: number | null
deal_installments: number
cash_collected: number
closed_at: string | null
```

---

## Task 2 : Modale Closing

**Fichiers :**
- Creer : `src/components/leads/ClosingModal.tsx`
- Modifier : `src/components/shared/LeadSidePanel.tsx`
- Modifier : `src/app/api/leads/[id]/route.ts`

### ClosingModal.tsx
Modale qui s'affiche quand le coach clique sur le statut "Clos" :
- Champ : Montant total du deal (input number €)
- Champ : Mode de paiement (select : Unique / 2x / 3x / 4x / 6x / 12x)
- Champ : Montant encaisse aujourd'hui (input number €, pre-rempli avec le total si unique)
- Bouton "Valider le closing"
- Style : meme pattern que FollowUpActionModal (modale centree, fond overlay)

### LeadSidePanel.tsx
Intercepter le clic sur le bouton "Clos" :
- Au lieu de `patchLead({ status: 'clos' })` directement
- Ouvrir ClosingModal
- A la validation → `patchLead({ status: 'clos', deal_amount, deal_installments, cash_collected, closed_at })`

### API PATCH leads/[id]
Accepter les nouveaux champs dans le body :
- `deal_amount`, `deal_installments`, `cash_collected`, `closed_at`
- Les inclure dans le UPDATE Supabase

---

## Task 3 : Enrichir les Meta insights avec video metrics

**Fichiers :**
- Modifier : `src/lib/meta/client.ts` (getInsights — ajouter fields)
- Modifier : `src/app/api/meta/insights/route.ts` (extraire + retourner les nouveaux champs)

### client.ts — getInsights()
Ajouter aux fields de la requete Meta :
```
video_play_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,frequency
```

Ajouter a MetaInsightRow :
```typescript
video_play_actions?: MetaInsightAction[]
video_p25_watched_actions?: MetaInsightAction[]
video_p50_watched_actions?: MetaInsightAction[]
video_p75_watched_actions?: MetaInsightAction[]
frequency?: string
```

### route.ts — BreakdownRow enrichi
Ajouter a BreakdownRow :
```typescript
frequency: number
video_plays: number
video_p25: number
video_p50: number
video_p75: number
hook_rate: number  // video_plays / impressions * 100
hold_rate_25: number  // video_p25 / video_plays * 100
hold_rate_50: number
hold_rate_75: number
```

Extraire les valeurs des actions Meta (meme pattern que extractLeadCount).

---

## Task 4 : API funnel KPIs CRM par periode

**Fichiers :**
- Creer : `src/app/api/performance/crm-funnel/route.ts`

Route GET qui retourne les counts CRM filtres par periode :
```
GET /api/performance/crm-funnel?date_from=X&date_to=Y

Response : {
  calls_total: number         // appels passes
  calls_reached: number       // appels repondus
  bookings_total: number      // seances bookees
  bookings_show_up: number    // seances presentes
  closings: number            // leads status=clos
  deal_amount_total: number   // SUM deal_amount
  cash_collected_total: number // SUM cash_collected
}
```

Toutes les queries filtrees par workspace_id ET par periode (created_at ou scheduled_at).

---

## Task 5 : Column picker enrichi dans ads-table-tab

**Fichiers :**
- Modifier : `src/app/(dashboard)/acquisition/publicites/ads-table-tab.tsx`

### Etendre ColumnKey
```typescript
type ColumnKey = 
  // Existants
  | 'name' | 'status' | 'campaign_type' | 'spend' | 'impressions' | 'clicks' | 'ctr' | 'leads' | 'cpl' | 'cpm' | 'cost_per_click'
  // Meta video
  | 'frequency' | 'hook_rate' | 'hold_rate_25' | 'hold_rate_50' | 'hold_rate_75'
  // CRM funnel
  | 'cr1' | 'calls_total' | 'calls_reached' | 'cpar' | 'joignabilite' | 'cr2' | 'bookings_total' | 'cpsb' | 'cr3' | 'bookings_show_up' | 'cpsp' | 'no_show_rate' | 'closings' | 'cpclose' | 'closing_rate'
  // Financier
  | 'deal_amount' | 'cash_collected' | 'marge_brute'
```

### Column picker par categories
Le dropdown "Colonnes" affiche les colonnes groupees :
- **Meta Ads** : Impressions, CPM, Clics, CPC, CTR, Leads, CPL, Repetition
- **Video** : Hook rate, Hold 25%, Hold 50%, Hold 75%
- **Appels** : Appels passes, Appels repondus, CPAr, % Joignabilite
- **Conversions** : CR1, CR2, CR3
- **Bookings** : Seances bookees, CPSb, Seances presentes, CPSp, % No show
- **Closing** : Closings, CPClose, % Closing
- **Financier** : CA contracte, Cash collecte, Marge brute

### Donnees CRM
Le composant fetch `/api/performance/crm-funnel` en parallele des Meta insights.
Les colonnes CRM utilisent les donnees CRM, les colonnes Meta utilisent les donnees Meta.
Le spend est partage (vient de Meta) pour calculer les CPx.

### Rendu des colonnes
Chaque colonne a un `renderCell` specifique :
- % → format pourcentage avec couleur (vert si bon, rouge si mauvais)
- € → format euro
- Nombre → format FR avec separateurs

---

## Task 6 : Integration modale closing dans les autres endroits

**Fichiers :**
- Modifier : `src/app/(dashboard)/leads/leads-client.tsx` (si changement statut inline)
- Modifier : `src/app/(dashboard)/closing/closing-client.tsx` (page closing)

Partout ou le statut peut passer a "clos", intercepter et ouvrir ClosingModal.

---

## Resume des fichiers

### A creer (3 fichiers)
| Fichier | Tache |
|---|---|
| `supabase/migrations/022_lead_deal_fields.sql` | T1 |
| `src/components/leads/ClosingModal.tsx` | T2 |
| `src/app/api/performance/crm-funnel/route.ts` | T4 |

### A modifier (6 fichiers)
| Fichier | Tache |
|---|---|
| `src/types/index.ts` | T1 |
| `src/components/shared/LeadSidePanel.tsx` | T2 |
| `src/app/api/leads/[id]/route.ts` | T2 |
| `src/lib/meta/client.ts` | T3 |
| `src/app/api/meta/insights/route.ts` | T3 |
| `src/app/(dashboard)/acquisition/publicites/ads-table-tab.tsx` | T5 |

---

## Amelioration notee (V2)
- **Indicateurs personnalises** : le coach cree ses propres KPIs avec un builder (nom + formule + format + seuils couleur)

---

*Plan genere le 2026-04-09 — ClosRM / Pierre*
