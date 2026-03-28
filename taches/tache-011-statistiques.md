# Tâche 011 — Module Statistiques

**Développeur :** Rémy
**Statut :** 🔄 En cours (Tasks 8-9 restantes)
**Branche :** `feature/remy-dashboard`
**Dernière mise à jour :** 2026-03-28

---

## Description

Page `/statistiques` avec 5 KPIs, 3 charts Recharts (leads/jour, funnel, sources) et une section Meta Ads conditionnelle.

## Objectif

Offrir au coach une vue analytique complète de ses performances de vente, distincte du dashboard opérationnel.

## Spec

Chemin : `docs/superpowers/specs/2026-03-28-statistiques-design.md`

Décisions prises lors du brainstorming :
- Layout C : 5 KPIs + 3 charts en grille égale + section Meta en bas
- Composants dédiés (pas de réutilisation des composants dashboard)
- Pattern Server Component (même architecture que le dashboard)
- Section Meta : banner si non connecté, métriques si connecté

## Fichiers créés / modifiés

| Fichier | Statut |
|---------|--------|
| `src/lib/stats/queries.ts` | ✅ Créé |
| `src/components/stats/stats-period-selector.tsx` | ✅ Créé |
| `src/components/stats/kpi-cards.tsx` | ✅ Créé |
| `src/components/stats/leads-chart.tsx` | ✅ Créé |
| `src/components/stats/funnel-chart.tsx` | ✅ Créé |
| `src/components/stats/source-chart.tsx` | ✅ Créé |
| `src/components/stats/meta-section.tsx` | ✅ Créé |
| `src/components/stats/stats-client.tsx` | ⬜ À créer (Task 8) |
| `src/app/(dashboard)/statistiques/page.tsx` | ⬜ À modifier (Task 9) |

## Déviations du plan documentées

- **`leads-chart.tsx`** : recency-highlight (dernière barre plus sombre) plutôt qu'intensity-highlight par valeur relative. Raison : comportement plus lisible pour un graphique temporel ordonné.
- **`source-chart.tsx`** : légende hand-rolled HTML plutôt que `<Legend>` Recharts. Raison : contrôle total du style, pas d'effets de layout Recharts sur le PieChart compact (110px).
- **`kpi-cards.tsx`** : formatters retournent `string` (via `String()`) plutôt que `number | string`. Raison : évite la coercion implicite nombre→string dans JSX.

## Tâches liées

- T-003 Dashboard (base du pattern Server Component réutilisé)
- T-017 Publicités Meta (données temps réel Meta — section placeholder en V1)

---

*Créé le 2026-03-28 — ClosRM*
