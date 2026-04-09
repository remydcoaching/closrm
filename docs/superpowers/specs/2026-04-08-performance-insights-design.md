# Spec — Performance Insights Dashboard (style Mochi)

> **Date :** 2026-04-08
> **Auteur :** Pierre
> **Inspiration :** Mochi / Nick Setting — Profile Funnel Dashboard
> **Scope :** Nouvel onglet "Performance" dans la page Publicites, focus Follow Ads

---

## Objectif

Ajouter un onglet "Performance" dans la page Publicites qui reproduit le dashboard Mochi : funnel visuel vertical, cost analysis avec targets, ad source attribution, et surtout les **Performance Insights** — des cards intelligentes avec code couleur (vert/orange/rouge) qui disent au coach exactement quoi faire pour ameliorer ses resultats.

---

## Layout — 3 zones

### Zone 1 : Overview Metrics (top, 3 cards horizontales)
- **Total Followers** : nombre + % variation vs periode precedente
- **Conversion Rate** : visit-to-follower rate + variation
- **Ad Spend** : total depense + variation

### Zone 2 : 2 colonnes (milieu)

**Colonne gauche — Sales Funnel (vertical)**
```
Profile Visits (14.15% conversion)
    ↓
Followers (49.63% conversion)
    ↓
Qualified Followers (68.78% conversion)
    ↓
Conversations (8.5% conversion)
    ↓
Appointments (81.34% conversion)
    ↓
Show Ups
    ↓
Cash Collected
```

Chaque etape : gros chiffre bleu + label + taux de conversion en dessous + fleche vers l'etape suivante.

**Colonne droite — Cost Analysis + Attribution**

Card "Cost Analysis" :
- Cost Per Follower : valeur actuelle + badge variation% + "Previous: X" + "Target: X"
- Cost Per Appointment : idem

Card "Ad Source Attribution" :
- Barre horizontale par source (Story Ads vs Video Ads)
- Pour chaque : nombre followers (%), cout total, CPF
- Total Followers en bas
- Profile Visits avec icone
- Conversations avec icone

### Zone 3 : Performance Insights (bas, grille 2 colonnes)

**6 cards insight en grille 2x3.** Chaque card :

Structure :
```
[Icone] Titre                              [Badge statut]
        Current: X → Target: Y

Description contextuelle (1-2 phrases)

    EXPECTED IMPACT
    Chiffre d'impact estime

    • ACTION STEPS
    1. Action concrete 1
    2. Action concrete 2
    3. Action concrete 3
    4. Action concrete 4
```

Bordure gauche coloree :
- 🔴 Rouge (4px) = "Action Required"
- 🟠 Orange (4px) = "Needs Optimization"  
- 🟢 Vert (4px) = "On Track"

**Les 6 insights :**
1. Conversation-to-Appointment Gap (conversations → appointments rate)
2. Optimize Ad Spend Efficiency (comparaison CPF par source)
3. Profile Conversion (visit-to-follower rate)
4. Cost Per Follower (CPF vs target)
5. Show-Up Rate (appointments → show ups)
6. Qualification Success (followers → qualified followers)

---

## Donnees sources

| Metrique | Source | Comment |
|---|---|---|
| Ad Spend | Meta API insights | Deja fetche |
| Impressions, Clicks | Meta API insights | Deja fetche |
| CPF, CPM | Meta API insights | Calcule |
| Profile Visits | Instagram Insights API | `ig_snapshots` ou API directe |
| Followers | `ig_snapshots` table | Deja synchro |
| Qualified Followers | Leads avec source follow_ads | Count depuis `leads` table |
| Conversations | `ig_conversations` count | Deja en base |
| Appointments | `bookings` count | Deja en base |
| Show Ups | `bookings` WHERE status != 'no_show' | Deja en base |
| Cash Collected | Pas encore en base | A ajouter ou saisie manuelle |

---

## Calcul des insights

Chaque insight est calcule a partir des donnees reelles :

```typescript
interface PerformanceInsight {
  id: string
  icon: string // lucide icon name
  title: string
  status: 'action_required' | 'needs_optimization' | 'on_track'
  currentValue: string // ex: "8.50%"
  targetValue: string // ex: "15%+"
  description: string // contextuel
  expectedImpact: string // ex: "+102 appointments = +$20,000+ revenue/month"
  actionSteps: string[] // 4 actions concretes
}
```

Les seuils et action steps sont definis par des regles metier dans le code (pas d'IA necessaire en V1).

---

## Fichiers a creer

| Fichier | Description |
|---|---|
| `src/app/(dashboard)/acquisition/publicites/ads-performance-tab.tsx` | Onglet Performance complet |
| `src/app/(dashboard)/acquisition/publicites/performance/funnel-column.tsx` | Funnel vertical |
| `src/app/(dashboard)/acquisition/publicites/performance/cost-analysis.tsx` | Cost analysis + attribution |
| `src/app/(dashboard)/acquisition/publicites/performance/insight-card.tsx` | Card insight reutilisable |
| `src/app/(dashboard)/acquisition/publicites/performance/overview-metrics.tsx` | 3 KPI cards top |
| `src/app/api/performance/follow-ads/route.ts` | API qui agrege toutes les donnees |

## Fichiers a modifier

| Fichier | Modification |
|---|---|
| `src/app/(dashboard)/acquisition/publicites/publicites-client.tsx` | Ajouter onglet "Performance" |
