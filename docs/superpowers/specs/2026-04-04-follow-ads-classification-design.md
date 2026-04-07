# Séparation Leadform / Follow Ads + KPIs adaptés + Indicateurs de santé

> Spec validée le 2026-04-04

---

## Résumé

Évolution du module Publicités pour distinguer les campagnes d'acquisition de prospects (Leadform) des campagnes de croissance/notoriété (Follow Ads). Chaque type a ses propres KPIs, funnel, et indicateurs de santé color-codés. Un encadré "Croissance Instagram" affiche les données followers depuis l'API Instagram existante.

---

## Décisions prises

| Décision | Choix |
|----------|-------|
| Classification | 2 catégories + Autre, basées sur `objective` Meta |
| Données Follow Ads | Métriques Meta uniquement + encadré Instagram en contexte (pas d'attribution) |
| Layout | Toggle 3 positions (Leadform / Follow Ads / Tout) — mode Tout = sections empilées |
| Indicateurs de santé | Seuils fixes par défaut, pas de config UI en V1 |
| Scope V2 | Followers comme prospects + automations DM (ManyChat-like) |

---

## 1. Classification des campagnes par objectif Meta

### Champ `objective`

Ajout du champ `objective` dans la requête `listAdObjects` pour les campagnes : `fields=id,name,status,effective_status,objective`.

### Mapping objectif → type

```ts
type CampaignType = 'leadform' | 'follow_ads' | 'other'

function classifyCampaignObjective(objective: string): CampaignType {
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
```

### Transmission dans l'API

Le champ `campaign_type` est ajouté à `BreakdownRow` :

```ts
interface BreakdownRow {
  id: string
  name: string
  status: string
  campaign_type: CampaignType  // NOUVEAU
  spend: number
  impressions: number
  clicks: number
  ctr: number
  leads: number
  cpl: number | null
}
```

### Filtrage

Nouveau param API `campaign_type` sur `/api/meta/insights` :
- `leadform` → ne retourne que les campagnes Leadform
- `follow_ads` → ne retourne que les campagnes Follow Ads
- `all` (défaut) → retourne toutes les campagnes avec le champ `campaign_type` renseigné

Pour les ad sets et ads : le type est hérité de la campagne parente. Quand un `campaign_id` est passé pour le drill-down, le type est déjà implicite. Quand on est au niveau global, il faut aussi enrichir ad sets/ads avec le type de leur campagne parente.

### Enrichissement des ad sets et ads

Pour enrichir les ad sets/ads avec le `campaign_type` au niveau global (mode "Tout") :
1. Récupérer la liste des campagnes avec `objective`
2. Construire un map `campaign_id → campaign_type`
3. Pour chaque ad set/ad, lire son `campaign_id` (disponible dans les insights) et en déduire le type

---

## 2. Frontend — Toggle et KPIs adaptés

### Toggle 3 positions

Composant `AdsCampaignTypeToggle` affiché à côté du sélecteur de période :
- 3 boutons : `Leadform` | `Follow Ads` | `Tout`
- Par défaut : `Tout`
- Change le state `campaignType` dans `PublicitesClient`
- Trigger un re-fetch de l'API avec le param `campaign_type`

### Mode Leadform — Vue d'ensemble

**5 KPI cards :**
1. Budget dépensé (bleu)
2. Leads générés (vert)
3. CPL (point santé)
4. CTR (point santé)
5. ROAS estimé (point santé)

**Graphique :** Leads / jour (barres bleues, Recharts)

**Funnel :** Impressions → Clics → Leads → Closés (avec % entre chaque)

### Mode Follow Ads — Vue d'ensemble

**6 KPI cards :**
1. Budget dépensé (bleu)
2. Impressions (blanc)
3. Reach (blanc)
4. CPM (point santé)
5. Clics profil (blanc)
6. Coût / clic (point santé)

**Graphique :** Impressions / jour (barres bleues, Recharts)

**Encadré "Croissance Instagram"** (voir section 4) :
- Si Instagram connecté : nouveaux followers, total followers, taux de croissance
- Si non connecté : banner "Connecte Instagram pour voir ta croissance followers"

### Mode Tout — Vue d'ensemble

**2 sections empilées :**

**Section "🎯 Acquisition Prospects" :**
- 5 KPI cards Leadform (avec points santé)
- Funnel Impressions → Clics → Leads → Closés

**Section "👥 Croissance & Notoriété" :**
- 6 KPI cards Follow Ads (avec points santé)
- Encadré Croissance Instagram

### Tableaux (Campagnes / Ad Sets / Ads)

**Mode Leadform ou Follow Ads :**
- Colonnes adaptées au mode :
  - Leadform : Nom, Statut, Dépensé, Impressions, Clics, CTR, Leads, CPL
  - Follow Ads : Nom, Statut, Dépensé, Impressions, Reach, CPM, Clics, Coût/clic
- Drill-down ne montre que les items du type sélectionné

**Mode Tout :**
- Colonne "Type" ajoutée avec badge texte : "Leadform" / "Follow Ads" / "Autre"
- Toutes les colonnes standards affichées
- Drill-down montre tout, avec le badge type sur chaque ligne

---

## 3. Indicateurs de santé

### Concept

Chaque KPI concerné affiche un petit point coloré (8px, rond) à gauche de son label :
- 🟢 Vert = bon, on track
- 🟠 Orange = attention, à optimiser
- 🔴 Rouge = problème, action requise

### Seuils par défaut (V1 — non configurable)

**Leadform :**

| KPI | Vert | Orange | Rouge |
|-----|------|--------|-------|
| CPL | < 7.5€ | 7.5–15€ | > 15€ |
| CTR | > 2% | 1–2% | < 1% |
| ROAS | > 3x | 1–3x | < 1x |

**Follow Ads :**

| KPI | Vert | Orange | Rouge |
|-----|------|--------|-------|
| CPM | < 5€ | 5–10€ | > 10€ |
| Coût/clic | < 0.50€ | 0.50–1€ | > 1€ |

### Implémentation

Fichier `health-thresholds.ts` :

```ts
type HealthColor = 'green' | 'orange' | 'red'

interface Threshold {
  green: (value: number) => boolean
  orange: (value: number) => boolean
  // red = default if neither green nor orange
}

const LEADFORM_THRESHOLDS: Record<string, Threshold> = {
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

const FOLLOW_ADS_THRESHOLDS: Record<string, Threshold> = {
  cpm: {
    green: (v) => v < 5,
    orange: (v) => v >= 5 && v <= 10,
  },
  cost_per_click: {
    green: (v) => v < 0.5,
    orange: (v) => v >= 0.5 && v <= 1,
  },
}

function getHealthColor(type: CampaignType, kpi: string, value: number | null): HealthColor | null
```

Retourne `null` si le KPI n'a pas de seuil (ex: Budget, Impressions — pas de couleur). La couleur est purement frontend, pas stockée.

---

## 4. Encadré Croissance Instagram

### Source de données

Utilise l'API existante `/api/instagram/snapshots` (T-023, Pierre) qui retourne les `ig_snapshots` (followers, views, reach par jour).

### Métriques affichées

- **Nouveaux followers** = followers du dernier snapshot — followers du premier snapshot de la période
- **Total followers** = followers du dernier snapshot
- **Taux de croissance** = (nouveaux / (total - nouveaux)) × 100

### État "Instagram non connecté"

Si pas de compte Instagram actif dans `ig_accounts`, afficher un banner :
- Fond bleu léger, style similaire au banner Meta existant
- Texte : "Connecte Instagram pour voir ta croissance followers"
- Lien vers `/parametres/integrations`

### Design

L'encadré a une bordure et une couleur distinctes (violet/Instagram) pour se différencier des KPI cards Meta en bleu. Affiché sous les KPI cards Follow Ads.

---

## 5. Fichiers impactés

### Modifiés

| Fichier | Changement |
|---------|-----------|
| `src/lib/meta/client.ts` | Ajouter `objective` dans `listAdObjects` fields pour campaigns, ajouter `MetaAdObject.objective`, exporter `CampaignType` et `classifyCampaignObjective()` |
| `src/app/api/meta/insights/route.ts` | Nouveau param `campaign_type`, filtrage par type, ajout `campaign_type` dans `BreakdownRow`, enrichissement ad sets/ads avec type parent |
| `src/app/(dashboard)/acquisition/publicites/publicites-client.tsx` | State `campaignType`, toggle, logique de rendu conditionnel (mode Leadform / Follow Ads / Tout) |
| `src/app/(dashboard)/acquisition/publicites/ads-overview-tab.tsx` | KPIs adaptatifs par type, graphique leads/jour vs impressions/jour, sections empilées en mode Tout, points santé |
| `src/app/(dashboard)/acquisition/publicites/ads-table-tab.tsx` | Colonne "Type" en mode Tout, colonnes adaptées au mode (Leads/CPL vs Reach/CPM) |

### Créés

| Fichier | Responsabilité |
|---------|---------------|
| `src/app/(dashboard)/acquisition/publicites/ads-campaign-type-toggle.tsx` | Toggle 3 positions Leadform / Follow Ads / Tout |
| `src/app/(dashboard)/acquisition/publicites/ads-instagram-growth.tsx` | Encadré Croissance Instagram (appelle `/api/instagram/snapshots`) |
| `src/app/(dashboard)/acquisition/publicites/health-thresholds.ts` | Config des seuils + `getHealthColor()` |

### Documentation

| Fichier | Mise à jour |
|---------|-------------|
| `etat.md` | Module Publicités v2 (classification + follow ads + santé) |
| `ameliorations.md` | Vision V2 : followers comme prospects, ManyChat-like, seuils configurables |

---

## 6. Hors scope — V2

Ces fonctionnalités sont documentées comme vision future mais **ne sont pas implémentées dans cette spec** :

### Followers comme prospects (ManyChat-like)
- **Détection automatique** des nouveaux followers via webhook Instagram ou polling
- **Création d'un lead** dans le CRM pour chaque nouveau follower (source: `follow_ads`)
- **Workflow d'automations** : DM de bienvenue automatique, séquence de nurturing, qualification
- **Attribution** : relier un follower à la campagne Follow Ads qui l'a amené (si techniquement possible via Meta API)

### Seuils de santé configurables
- Interface dans Paramètres > Réglages pour définir ses propres seuils par KPI
- Stockage en DB par workspace

### Attribution followers → campagnes
- Croisement entre les données Meta (campagnes awareness) et Instagram (nouveaux followers) pour estimer quelle campagne a généré quels followers
- Nécessite un tracking plus fin (UTM, pixel, ou heuristique temporelle)

---

## 7. Impact sur la vision projet

Cette évolution pose les bases d'un CRM complet pour les coachs qui utilisent **2 stratégies d'acquisition** :

1. **Lead Gen directe** : Meta Ads → Formulaire → Lead dans le CRM → Appel de closing
2. **Nurturing via contenu** : Meta Ads (notoriété) → Follow Instagram → DM automatique → Prospect qualifié → Appel de closing

Le module Publicités devient le point d'entrée unique pour piloter les deux stratégies côte à côte, avec des métriques adaptées à chaque objectif.
