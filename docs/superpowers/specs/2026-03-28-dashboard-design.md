# Spec — T-003 Dashboard d'accueil

> Date : 2026-03-28
> Développeur : Rémy
> Branche : `feature/remy-dashboard`

---

## Objectif

Brancher de vraies données Supabase sur le dashboard d'accueil, remplacer tous les placeholders hardcodés, et ajouter le sélecteur de période + la timeline d'activité récente.

---

## Architecture

### Approche : Server Component + queries parallèles

`src/app/(dashboard)/dashboard/page.tsx` devient un **Server Component** (suppression de `'use client'`). Les données sont fetchées côté serveur avant que la page soit envoyée au navigateur — pas de spinner, pas d'API route intermédiaire.

La période est transmise via un query param `?period=7|30|90` (défaut : 30). Le sélecteur est un simple lien qui recharge la page.

Les 4 requêtes sont lancées en parallèle avec `Promise.all` :

```ts
const [kpis, upcomingCalls, overdueFollowups, recentActivity] = await Promise.all([
  fetchKpis(workspaceId, period),
  fetchUpcomingCalls(workspaceId),
  fetchOverdueFollowups(workspaceId),
  fetchRecentActivity(workspaceId),
])
```

---

## Sections du dashboard

### 1. Header
- Message de bienvenue : `Bonjour, {first_name} 👋`
- Sous-titre : `Voici votre activité du moment`
- Sélecteur de période : 3 boutons **7j / 30j / 90j** — bouton actif en vert (#00C853), inactifs en gris

### 2. KPI Cards (4 cards)

| Card | Donnée | Source |
|------|--------|--------|
| Nouveaux leads | `COUNT(leads)` sur la période | table `leads` |
| Appels planifiés | `COUNT(calls)` sur la période | table `calls` |
| Deals closés | `COUNT(leads WHERE status = 'clos')` sur la période | table `leads` |
| Taux de closing | `deals_closés / appels_planifiés * 100` | calculé |

Le sélecteur de période affecte **uniquement ces 4 cards**. Pas de variation % (simplifié pour V1).

### 3. Prochains appels

Affiche jusqu'à **6 appels** triés par `scheduled_at` ASC, en 3 catégories :

1. **En retard** (`scheduled_at < maintenant` ET `outcome IS NULL`) — badge rouge "En retard"
2. **Aujourd'hui** (`scheduled_at` entre 00h00 et 23h59 du jour courant) — badge orange "Aujourd'hui"
3. **À venir** (`scheduled_at` dans les 7 prochains jours) — badge gris avec la date

Chaque ligne affiche : nom du lead, type d'appel, date/heure, badge statut. Lien vers la fiche lead.

### 4. Follow-ups en retard

Affiche jusqu'à **6 follow-ups** avec `scheduled_at < maintenant` ET `status = 'pending'`, triés du plus ancien au plus récent.

Chaque ligne : nom du lead, canal (WhatsApp/Email/Manuel), retard en jours. Badge rouge avec le nombre total en retard.

### 5. Activité récente

Les **10 derniers événements** issus de 2 sources, triés du plus récent au plus ancien :

| Type | Source | Couleur |
|------|--------|---------|
| Nouveau lead | `leads.created_at` | Vert (#00C853) |
| Appel logué | `calls.created_at` | Bleu (#3b82f6) |

Implémentation : UNION de `leads` et `calls` triée par `created_at DESC LIMIT 10`. Chaque ligne : type coloré, description, timestamp relatif ("il y a 2h", "hier").

> "Statut changé" nécessiterait une table d'audit dédiée — hors scope V1, pas de `updated_at` car trop imprécis.

---

## Composants à créer

| Fichier | Rôle |
|---------|------|
| `src/components/dashboard/kpi-cards.tsx` | 4 cards KPI (Server Component) |
| `src/components/dashboard/upcoming-calls.tsx` | Liste prochains appels (Server Component) |
| `src/components/dashboard/overdue-followups.tsx` | Liste follow-ups en retard (Server Component) |
| `src/components/dashboard/recent-activity.tsx` | Timeline activité récente (Server Component) |
| `src/components/dashboard/period-selector.tsx` | Boutons 7j/30j/90j — Client Component (lien href) |
| `src/lib/dashboard/queries.ts` | Toutes les queries Supabase du dashboard |

---

## Fichiers modifiés

| Fichier | Modification |
|---------|-------------|
| `src/app/(dashboard)/dashboard/page.tsx` | Passage en Server Component, branchement réel |

---

## Gestion des cas limites

- **Aucun lead / appel / follow-up** → chaque section affiche son état vide actuel (déjà implémenté visuellement)
- **Taux de closing** : si `appels_planifiés = 0` → afficher `—` au lieu de diviser par zéro
- **Activité récente** : si aucun event → message "Aucune activité pour le moment"
- **Workspace non trouvé** → `getWorkspaceId()` lève une erreur → redirect vers login (géré par le middleware existant)

---

## Hors scope (V1)

- Variation % par rapport à la période précédente
- Graphiques (prévu dans T-011 Statistiques)
- Actions rapides "Ajouter lead / Planifier appel" depuis le dashboard (accessible via la sidebar)

---

*Spec créée le 2026-03-28 — ClosRM T-003*
