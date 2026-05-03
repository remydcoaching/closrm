# Dashboard ClosRM — Refonte v2

**Date** : 2026-05-03
**Auteur** : Pierre (avec brainstorming Claude)
**Statut** : Spec validée, prêt pour plan d'implémentation
**Cible** : Dashboard admin/coach (`/dashboard`) — les dashboards Setter et Closer restent inchangés

---

## Contexte

Le dashboard admin actuel (`src/components/dashboard/dashboard-client.tsx`) est jugé "horrible et inutile" : grid plat sans hiérarchie (header + KPI cards + upcoming calls + overdue follow-ups + activity feed). Il ne pousse à aucune action et ne valorise pas les données disponibles.

**Objectif :** transformer le dashboard en **command center** opérationnel et performant qui répond le matin à la question "qu'est-ce que je fais maintenant ?", tout en montrant la trajectoire (perf vs N-1) et en surfant sur les leads à activer.

**Recherche concurrentielle** : analyse de 24 dashboards (iClosed, Gong, Stripe, Linear, Attio, GoHighLevel, Motion, Clay, HubSpot, Pipedrive, Close.com, Salesforce, Calendly, Cal.com, Vercel, Notion Calendar, Apollo, Outreach…) pour identifier patterns table-stakes et différenciateurs.

---

## Principes directeurs

1. **Hero adaptatif "next action"** au-dessus du fold (pas de grid plat)
2. **Une seule surface IA**, sur bouton manuel (économie de crédits) — le pre-call brief
3. **Tout le reste = algo déterministe** : gratuit, instantané, transparent
4. **YAGNI strict** : on coupe smart lists épinglées, command-K, forecast interactif, background agents → V2

---

## Architecture visuelle

```
┌──────────────────────────────────────────────────────────┐
│ Header                                                   │
│ Bonjour Pierre 👋                            [Période ▾] │
├──────────────────────────────────────────────────────────┤
│ Section 1 — HERO (2 colonnes responsive)                 │
│ ┌─ Prochain RDV ────────┬─ Day Plan ──────────────────┐  │
│ │ Marc Dupont — 47 min  │ Plan du jour                │  │
│ │ Source : Meta Ads     │ 1. Sophie (chaud) — call    │  │
│ │ Email • Téléphone     │ 2. Tom — relance J+3        │  │
│ │ [Rejoindre Meet]      │ 3. Léa — no-show recovery   │  │
│ │ [✨ Générer brief]    │ 4. Marc — RDV 14h           │  │
│ └───────────────────────┴─────────────────────────────┘  │
├──────────────────────────────────────────────────────────┤
│ Section 2 — KPIs (5 cards Stripe-style)                  │
│ [Cash €] [Show rate] [Close rate] [Coût/RDV] [Pipeline]  │
│ Chaque card : nombre + delta % vs période précédente     │
│              + sparkline 14 jours                        │
├──────────────────────────────────────────────────────────┤
│ Section 3 — Listes prioritaires (2 colonnes)             │
│ ┌─ ⚠️ Leads à risque ──┬─ 🔥 Leads chauds ───────────┐   │
│ │ 5 leads — 7j sans    │ 4 leads — score élevé       │   │
│ │ activité, score+     │ + activité récente          │   │
│ │ (5 lignes max)       │ (5 lignes max)              │   │
│ └──────────────────────┴─────────────────────────────┘   │
├──────────────────────────────────────────────────────────┤
│ Section 4 — Funnel de conversion                         │
│ Leads → Bookés → Présents → Closés                       │
│ Avec drop-off % entre chaque étape, cliquable            │
├──────────────────────────────────────────────────────────┤
│ Section 5 — Activity feed live (Supabase realtime)       │
│ Liste verticale, soft fade-in sur nouvel événement       │
└──────────────────────────────────────────────────────────┘
```

---

## Spécification par section

### Header

- Titre `Bonjour [prénom] 👋`
- Sélecteur de période **global** : `7 jours` / `30 jours` (défaut) / `90 jours` / `Mois en cours`
- Le sélecteur applique à toutes les sections (KPIs, funnel, activity)

### Section 1 — Hero adaptatif

**Card "Prochain RDV"** (gauche, ratio 1:1)

Comportement adaptatif :
- **Si RDV imminent (< 4h)** : nom du lead, countdown live, source d'origine (Meta Ads / Funnel / Manuel), email + téléphone, bouton "Rejoindre Meet" (si Google Meet), bouton "Générer brief IA"
- **Si pas de RDV imminent mais RDV plus tard aujourd'hui** : "Prochain RDV à [heure]" + même infos
- **Si pas de RDV aujourd'hui** : "À jour 🎯 — Prochain RDV [demain / lundi]" + carte "Win récent" si dispo (dernier deal closé)
- **Si aucun RDV planifié** : message d'encouragement + CTA "Voir mes leads" / "Créer un calendrier"

**Card "Day Plan"** (droite, ratio 1:1)

- Liste ordonnée 5-7 actions du jour, **calculée par algo** (pas d'IA)
- Tri par priorité :
  1. RDV à venir aujourd'hui (chronologique)
  2. Leads chauds non contactés depuis 24h+
  3. Follow-ups en retard
  4. No-shows à reprogrammer
  5. Nurturing à activer
- Chaque ligne : icône type, nom du lead, raison/contexte court, action principale (cliquable → side panel lead)
- Bouton "Marquer comme fait" sur chaque action (state local + persisté)

### Section 2 — KPIs (Stripe-style)

5 cards en grid responsive (auto-fill, minmax 200px) :

| KPI | Source de données | Calcul |
|---|---|---|
| **Cash collected** | `deals.cash_collected` | Somme période vs période N-1 |
| **Show rate** | `calls` outcome | (RDV présents / RDV planifiés passés) |
| **Close rate** | `calls` outcome | (Deals closés / RDV présents) |
| **Coût par RDV** | Meta Ads + bookings | Dépenses pub / nb RDV bookés (si Meta connecté, sinon caché) |
| **Pipeline value** | `deals.amount` deals ouverts | Somme deals ouverts pondérés par stage proba |

Chaque card affiche :
- **Nombre** principal (font-size 28, weight 700)
- **Delta** vs période précédente : `↑ +12%` (vert) ou `↓ -5%` (rouge), 12px
- **Sparkline** 14 jours (mini-graphe SVG, hauteur 32px)
- **Label** descriptif sous le nombre (12px, text-muted)
- **Hover** : tooltip avec valeur exacte vs période N-1

### Section 3 — Listes prioritaires (algo pur)

**Card "Leads à risque"** (gauche)

Critères algorithmiques (ET) :
- Lead status ≠ closé/dead
- `last_activity_at` > 7 jours
- Score interne ≥ moyen (calculé sur historique tentatives + intent)

Affichage :
- Badge nombre total
- 5 leads max, cliquable → side panel
- Par ligne : nom, jours d'inactivité, dernière action, bouton rapide "Relancer"
- Lien "Voir tous" → page leads filtrée

**Card "Leads chauds"** (droite)

Critères algorithmiques (ET) :
- Lead avec score chaud (configurable workspace)
- `last_activity_at` < 48h
- Pas de RDV planifié dans les 7 prochains jours

Affichage : identique à risque mais avec icône 🔥 et bouton "Planifier RDV"

### Section 4 — Funnel de conversion

Funnel horizontal 4 étapes :

```
Leads          Bookés         Présents      Closés
[████████]  →  [██████]    →  [████]    →  [██]
   234          134 (57%)     98 (73%)     32 (33%)
```

- Largeur des barres proportionnelle au volume
- % de conversion entre chaque étape (drop-off)
- Click sur une barre → page filtrée correspondante
- Période suit le sélecteur global

### Section 5 — Activity feed live

- Liste verticale chronologique (10 événements max, "Voir plus" pour étendre)
- Types d'événements : nouveau lead, RDV booké, RDV présent/no-show, deal closé, follow-up complété, automation déclenchée
- Chaque ligne : icône colorée par type, texte court, timestamp relatif ("il y a 3 min")
- **Realtime** : Supabase subscription sur `leads` / `bookings` / `calls` / `deals` / `follow_ups` — nouvel événement apparaît avec **fade-in animation** sans refresh page

---

## Fonctionnalité IA — Pre-call brief (unique)

**Trigger** : bouton manuel `[✨ Générer brief]` sur la card Prochain RDV (économie crédits)

**Input** : lead complet (champs, historique calls, source, réponses formulaire booking, messages Insta s'il y en a)

**Output** (généré par Assistant IA T-032 existant, route à créer ou réutiliser) :
- Résumé en 3 puces (qui est le lead, ses pain points, son intent)
- 2-3 questions d'ouverture suggérées
- Risques détectés (objections probables)

**Affichage** :
- Modal ou drawer qui s'ouvre depuis la card RDV
- Loader pendant génération (~3-5s)
- Texte copiable, scrollable
- Brief sauvegardé en base (`ai_call_briefs` table à créer) → si rebrief demandé, on regarde si existe d'abord (cache 24h)

---

## Modèle de données

### Tables existantes utilisées

- `leads` (last_activity_at, status, score, source)
- `calls` (scheduled_at, outcome, reached, duration_seconds)
- `bookings` (scheduled_at, meet_url, location_type)
- `deals` (amount, cash_collected, status, duration_months)
- `follow_ups` (scheduled_at, status)
- `automations_executions` (créée par T-029)

### Nouvelles tables

```sql
-- Cache des briefs IA pré-call (évite regénérer)
create table ai_call_briefs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id),
  lead_id uuid not null references leads(id) on delete cascade,
  booking_id uuid references bookings(id) on delete set null,
  brief_content jsonb not null, -- { summary, questions, risks }
  generated_at timestamptz not null default now(),
  generated_by uuid references users(id),
  unique (lead_id, booking_id)
);
create index ai_call_briefs_lead on ai_call_briefs(lead_id, generated_at desc);
```

### Vue/agrégats

- `dashboard_kpis` : vue matérialisée optionnelle si perfs lentes (à évaluer en V1, pas obligatoire)
- Sinon : queries dédiées dans `src/lib/dashboard/queries.ts` (étendre l'existant)

---

## Architecture composants

```
src/app/(dashboard)/dashboard/
  page.tsx                          # Server component, fetch + role routing

src/components/dashboard/
  dashboard-client.tsx              # Layout principal (refonte complète)
  hero/
    next-call-card.tsx              # Card prochain RDV adaptative
    day-plan-card.tsx               # Card plan du jour algo
    pre-call-brief-modal.tsx        # Modal brief IA
  kpis/
    kpi-card.tsx                    # Card KPI réutilisable (nombre + delta + sparkline)
    sparkline.tsx                   # Mini-graphe SVG
    kpi-grid.tsx                    # Grid 5 cards
  lists/
    risk-leads-card.tsx             # Liste leads à risque
    hot-leads-card.tsx              # Liste leads chauds
  funnel/
    conversion-funnel.tsx           # Funnel 4 étapes
  activity/
    realtime-activity-feed.tsx      # Feed live Supabase

src/lib/dashboard/
  queries.ts                        # Étendre : addKpisExtended, getRiskLeads, getHotLeads, getFunnelData, getDayPlan
  algorithms.ts                     # Logique algo : score, prio day plan, risk/hot detection

src/app/api/dashboard/
  brief/route.ts                    # POST génération brief IA (réutilise infra T-032)
```

---

## Points de complexité / risques

1. **Sparklines** — pas de lib en plus, SVG natif suffit (14 points), à coder maison
2. **Realtime feed** — Supabase realtime déjà utilisé ailleurs ? À vérifier au plan
3. **Score lead** — un score "chaud/froid" existe-t-il ? Si non, calcul simple à définir (nb tentatives × dernière activité × source)
4. **Day plan algo** — règles de tri à valider avec Pierre avant implémentation
5. **Performance** — 5+ queries en parallèle au render. Si lent → matérialisation ou cache server
6. **Brief IA** — réutiliser l'infrastructure Assistant IA existante (T-032), prompt à designer

---

## Hors scope V1 (futurs V2)

- Smart Lists épinglées personnalisées (Close.com pattern)
- Forecast slider interactif (Gong/Salesforce)
- Command palette ⌘K
- Background AI agents (Attio/Clay)
- Drag-drop dashboard builder (HubSpot)
- AI insights sur leads à risque/chauds (gimmick selon décision spec)
- Multi-dashboards par utilisateur
- Widgets configurables

---

## Critères de succès

- ✅ Le coach voit son prochain RDV dès l'ouverture du dashboard
- ✅ Il peut générer un brief en 1 clic et joindre le Meet en 1 clic
- ✅ Les KPIs ont une trajectoire visible (delta + sparkline) sans cliquer
- ✅ Les leads à actionner sont surfacés (5 max chaque) sans IA
- ✅ Le dashboard se rafraîchit en temps réel quand un lead/booking arrive
- ✅ Le tout charge < 1.5s sur connexion normale
- ✅ Pas plus de 1 crédit IA consommé par interaction explicite (jamais en auto)

---

## Workflow d'implémentation suggéré

1. **Phase 1 — Foundation** : layout + period selector + KPI cards (nombre + delta + sparkline)
2. **Phase 2 — Hero** : next call card adaptative + day plan algo
3. **Phase 3 — Lists** : risk leads + hot leads (algos)
4. **Phase 4 — Funnel** : composant funnel cliquable
5. **Phase 5 — Realtime** : activity feed avec Supabase subscriptions
6. **Phase 6 — IA brief** : modal + route API + cache table

Chaque phase est mergeable indépendamment et apporte de la valeur.
