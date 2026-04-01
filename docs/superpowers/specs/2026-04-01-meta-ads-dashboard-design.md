# T-017 — Module Publicités (Meta Ads Dashboard) — Bloc B

> Spec validée le 2026-04-01

---

## Résumé

Dashboard de performance Meta Ads accessible depuis `/acquisition/publicites`. Affiche les KPIs, graphiques et drill-down par campagne/adset/ad en temps réel via la Meta Marketing API. Complète le Bloc A (T-013 : OAuth + webhook leads).

---

## Décisions prises

| Décision | Choix |
|----------|-------|
| Scope | Overview + drill-down campagnes + funnel marketing |
| Source de données | Temps réel via Meta Marketing API (pas de cache V1) |
| Reconnexion OAuth | Banner d'upgrade si scopes manquants |
| Compte publicitaire | Sélection auto si 1 seul, premier si plusieurs (V1) |
| Layout | Onglets séparés : Vue d'ensemble / Campagnes / Ad Sets / Ads |
| Sélecteur de période | Aujourd'hui / 7j / 14j / 30j / 90j / Custom (date picker) |
| Architecture API | 1 API route unique avec param `level` |

---

## 1. Modifications OAuth (Bloc A existant)

### Scopes

Ajouter `ads_read` et `read_insights` dans `buildOAuthUrl()` (`src/lib/meta/client.ts`).

Nouveau scope complet :
```
leads_retrieval,pages_show_list,pages_manage_metadata,pages_read_engagement,business_management,ads_read,read_insights
```

### Sélection du compte publicitaire

Dans le callback OAuth (`/api/integrations/meta/callback`), après la sélection de page :
1. Appeler `GET /me/adaccounts?fields=id,name,account_status` avec le user token
2. Si 1 seul compte → sélection automatique
3. Si plusieurs → prendre le premier (V1)
4. Stocker `ad_account_id` dans `MetaCredentials`

### Type MetaCredentials mis à jour

```ts
interface MetaCredentials {
  user_access_token: string
  token_expires_at: string | null
  page_id: string
  page_name: string
  page_access_token: string
  ad_account_id: string  // NOUVEAU
}
```

### Banner d'upgrade

Sur la page Publicités, si l'intégration Meta est connectée mais `ad_account_id` est absent dans les credentials déchiffrées :
- Afficher un banner orange : "Mettez à jour votre connexion Meta pour accéder aux statistiques publicitaires"
- Bouton "Mettre à jour" → lance le flow OAuth avec les nouveaux scopes
- L'ancien token leads continue de fonctionner indépendamment

---

## 2. API Route `/api/meta/insights`

### Endpoint

`GET /api/meta/insights`

### Query params

| Param | Type | Défaut | Description |
|-------|------|--------|-------------|
| `level` | `account` \| `campaign` \| `adset` \| `ad` | `account` | Niveau d'agrégation |
| `date_from` | `YYYY-MM-DD` | 7 jours avant | Début de période |
| `date_to` | `YYYY-MM-DD` | aujourd'hui | Fin de période |

### Logique

1. Authentifier l'utilisateur via Supabase (même pattern que les autres API routes)
2. Récupérer l'intégration Meta active du workspace
3. Déchiffrer les credentials → extraire `ad_account_id` et `user_access_token`
4. Si `ad_account_id` absent → retourner 400 avec message d'upgrade
5. Appeler la Meta Marketing API :
   ```
   GET /{ad_account_id}/insights
   ?fields=spend,impressions,clicks,ctr,actions,cost_per_action_type
   &level={level}
   &time_range={"since":"{date_from}","until":"{date_to}"}
   &filtering=[{"field":"action_type","operator":"IN","value":["lead"]}]
   ```
6. Si `level=account`, ajouter `time_increment=1` pour les données journalières (graphique)
7. Si `level!=account`, ajouter `limit=100` pour paginer les résultats
8. Mapper les `actions` pour extraire le count de leads (`action_type = "lead"`)
9. Calculer le CPL : `spend / leads` (ou null si 0 leads)

### Format de réponse

```ts
interface MetaInsightsResponse {
  kpis: {
    spend: number
    impressions: number
    clicks: number
    ctr: number
    leads: number
    cpl: number | null
  }
  // Lignes détaillées — vide si level=account
  breakdown: Array<{
    id: string
    name: string
    status: string  // "ACTIVE" | "PAUSED" | etc.
    spend: number
    impressions: number
    clicks: number
    ctr: number
    leads: number
    cpl: number | null
  }>
  // Données journalières — uniquement si level=account
  daily: Array<{
    date: string  // "2026-03-28"
    spend: number
    leads: number
    impressions: number
    clicks: number
  }>
}
```

### Gestion d'erreurs

- Token expiré (erreur Meta 190) → retourner 401 avec message "Reconnectez votre compte Meta"
- Rate limit Meta (erreur 17) → retourner 429 avec message "Trop de requêtes, réessayez dans quelques minutes"
- Autres erreurs Meta → retourner 502 avec le message d'erreur Meta

---

## 3. Meta Client — Nouvelles fonctions

Ajouts dans `src/lib/meta/client.ts` :

### Types

```ts
interface MetaAdAccount {
  id: string        // format "act_123456"
  name: string
  account_status: number
}

interface MetaInsightRow {
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
  actions?: Array<{ action_type: string; value: string }>
  cost_per_action_type?: Array<{ action_type: string; value: string }>
}
```

### Fonctions

- `getAdAccounts(userToken: string): Promise<MetaAdAccount[]>` — `GET /me/adaccounts?fields=id,name,account_status`
- `getInsights(adAccountId: string, token: string, params: InsightsParams): Promise<MetaInsightRow[]>` — appelle la Marketing API avec les params fournis

---

## 4. Frontend — Page Publicités

### Structure des composants

```
src/app/(dashboard)/acquisition/publicites/
├── page.tsx                  # Server component — fetch intégration Meta
├── publicites-client.tsx     # Client component principal
├── ads-overview-tab.tsx      # Onglet Vue d'ensemble
├── ads-table-tab.tsx         # Onglet tableau réutilisable (campagnes/adsets/ads)
├── ads-period-selector.tsx   # Sélecteur de période + date picker
└── ads-meta-banner.tsx       # Banner connexion / upgrade
```

### Page server (`page.tsx`)

- Récupère l'intégration Meta du workspace via Supabase
- Détermine l'état : `not_connected` | `needs_upgrade` | `connected`
- Passe l'état au `PublicitesClient`

### PublicitesClient

- State : onglet actif (`overview` | `campaigns` | `adsets` | `ads`)
- State : période sélectionnée (`today` | `7d` | `14d` | `30d` | `90d` | `custom`)
- State : dates custom (`dateFrom`, `dateTo`)
- Fetch `/api/meta/insights` à chaque changement d'onglet ou de période
- Loading : skeleton loaders

### Onglet Vue d'ensemble (`AdsOverviewTab`)

**5 KPI cards :**
1. Budget dépensé (`spend`) — bleu Meta
2. Leads générés (`leads`) — vert
3. Coût / lead (`cpl`) — blanc
4. CTR (`ctr`) — blanc
5. ROAS estimé — vert (calculé : revenu closé depuis Supabase ÷ spend)

**Graphique leads/jour :**
- Recharts BarChart (cohérent avec page Statistiques)
- Données depuis `daily[]`
- Barres bleues Meta (#1877F2)

**Funnel marketing horizontal :**
- 4 étapes : Impressions → Clics → Leads → Closés
- Taux de conversion entre chaque étape (ex: "2.1%")
- Impressions/Clics/Leads depuis l'API Meta
- Closés depuis Supabase : count des leads avec `source = 'facebook_ads' OR source = 'instagram_ads'` ET `status = 'closed'` dans la période sélectionnée

### Onglets Campagnes / Ad Sets / Ads (`AdsTableTab`)

Composant réutilisable, reçoit le `level` en prop.

**Colonnes du tableau :**
| Colonne | Donnée |
|---------|--------|
| Nom | `name` |
| Statut | Badge vert "Actif" / gris "Pausé" |
| Dépensé | `spend` formaté en € |
| Impressions | `impressions` formaté avec séparateur milliers |
| Clics | `clicks` |
| CTR | `ctr` formaté en % |
| Leads | count depuis `actions` |
| CPL | `cpl` formaté en € |

- Tri par colonne au clic sur le header (client-side)
- Message "Aucune donnée pour cette période" si tableau vide

### Sélecteur de période (`AdsPeriodSelector`)

- Boutons : Aujourd'hui | 7j | 14j | 30j | 90j | Personnalisé
- Au clic sur "Personnalisé" → affiche 2 inputs date (du / au)
- Le bouton actif a un style distinct (fond bleu Meta)

### Banner Meta (`AdsMetaBanner`)

3 variantes selon l'état :
- `not_connected` : banner bleu "Connecte ton compte Meta pour voir tes performances publicitaires" → lien `/parametres/integrations`
- `needs_upgrade` : banner orange "Mets à jour tes permissions Meta pour accéder aux stats publicitaires" → bouton reconnexion OAuth
- `error` : banner rouge avec message d'erreur + bouton "Réessayer"

---

## 5. Mise à jour page Statistiques

Le composant `MetaSection` (`src/components/stats/meta-section.tsx`) affiche actuellement des placeholders `null`.

**Changement :** `fetchMetaStats()` dans `src/lib/stats/queries.ts` appelle `/api/meta/insights?level=account` (ou directement les fonctions Meta client côté serveur) pour récupérer les vraies valeurs de `costPerLead`, `roas`, `budgetSpent`.

---

## 6. Fichiers impactés

### Créés
- `src/app/(dashboard)/acquisition/publicites/publicites-client.tsx`
- `src/app/(dashboard)/acquisition/publicites/ads-overview-tab.tsx`
- `src/app/(dashboard)/acquisition/publicites/ads-table-tab.tsx`
- `src/app/(dashboard)/acquisition/publicites/ads-period-selector.tsx`
- `src/app/(dashboard)/acquisition/publicites/ads-meta-banner.tsx`
- `src/app/api/meta/insights/route.ts`

### Modifiés
- `src/lib/meta/client.ts` — scopes OAuth + fonctions `getAdAccounts()`, `getInsights()`, nouveaux types
- `src/app/api/integrations/meta/callback/route.ts` — ajout sélection ad account
- `src/app/(dashboard)/acquisition/publicites/page.tsx` — remplacement du stub
- `src/types/index.ts` — mise à jour `MetaCredentials` si nécessaire
- `src/lib/stats/queries.ts` — `fetchMetaStats()` avec vraies données
- `src/components/stats/meta-section.tsx` — éventuellement ajuster si le type `MetaStats` change

---

## Hors scope (V2)

- Cache des données Meta en DB
- Sélecteur de compte pub UI (multi-comptes)
- Comparaison de périodes (cette semaine vs semaine dernière)
- Export des données pub en CSV
- Alertes automatiques (CPL trop élevé, budget épuisé)
