# Tâche 003 — Dashboard d'accueil avec vraies données

> **Statut :** ✅ Terminée
> **Développeur :** Rémy
> **Date de début :** 2026-03-28
> **Date de fin :** 2026-03-28
> **Branche Git :** `feature/remy-dashboard`

---

## Objectif

Remplacer tous les placeholders hardcodés du dashboard par de vraies données Supabase. Ajouter le message de bienvenue, le sélecteur de période, et la timeline d'activité récente.

---

## Spec

> Spec validée le 2026-03-28 via brainstorming.
> Fichier complet : [`docs/superpowers/specs/2026-03-28-dashboard-design.md`](../docs/superpowers/specs/2026-03-28-dashboard-design.md)

**Décisions clés :**
- **Approche** : Server Component + queries Supabase parallèles directes (pas d'API route)
- **Sélecteur de période** (7j/30j/90j) : affecte uniquement les 4 KPI cards, via query param `?period=`
- **Prochains appels** : appels en retard (sans résultat) + aujourd'hui + 7 prochains jours, max 6
- **Activité récente** : UNION `leads.created_at` + `calls.created_at`, 10 derniers events

---

## Périmètre

### Ce qui est inclus
- Message de bienvenue avec prénom du coach
- 4 KPI cards branchées sur Supabase avec sélecteur de période
- Section "Prochains appels" (en retard + aujourd'hui + 7j à venir)
- Section "Follow-ups en retard" (status pending + date dépassée)
- Section "Activité récente" (leads créés + appels loggués)
- Passage de la page en Server Component

### Ce qui est explicitement exclu
- Variations % par rapport à la période précédente
- Graphiques (→ T-011 Statistiques)
- Actions rapides depuis le dashboard
- "Statut changé" dans l'activité (nécessiterait une table d'audit)

---

## Fichiers concernés

### Fichiers créés
| Fichier | Description |
|---------|-------------|
| `src/lib/dashboard/queries.ts` | Toutes les queries Supabase du dashboard |
| `src/components/dashboard/kpi-cards.tsx` | 4 cards KPI |
| `src/components/dashboard/upcoming-calls.tsx` | Liste prochains appels |
| `src/components/dashboard/overdue-followups.tsx` | Liste follow-ups en retard |
| `src/components/dashboard/recent-activity.tsx` | Timeline activité récente |
| `src/components/dashboard/period-selector.tsx` | Boutons 7j/30j/90j |

### Fichiers modifiés
| Fichier | Modification |
|---------|-------------|
| `src/app/(dashboard)/dashboard/page.tsx` | Server Component + branchement réel |

---

## Tâches liées

| Relation | Tâche | Description |
|----------|-------|-------------|
| Dépend de | T-002 | `getWorkspaceId()` utilisé pour les queries |
| Dépend de | T-004 | Tables `leads` et `calls` créées par T-004 |
| Précède | T-011 | Statistiques (graphiques, funnel) |

---

## Statut des sous-tâches

- [x] Créer `src/lib/dashboard/queries.ts`
- [x] Créer les composants dashboard
- [x] Modifier `dashboard/page.tsx` en Server Component + DashboardClient
- [x] LeadSidePanel sur clic lead (dashboard + liste leads)

---

*Créé le 2026-03-28 par Claude Code — ClosRM*
