# Tâche 012 — Base de données (vue globale)

**Développeur :** Rémy
**Statut :** ✅ Terminé
**Branche :** `feature/remy-database`
**Dernière mise à jour :** 2026-03-28

---

## Description

Page `/base-de-donnees` : vue complète de tous les contacts (tous statuts), recherche, filtres avancés, colonnes enrichies et export CSV configurable.

## Objectif

Offrir au coach une vue globale de sa base de contacts avec recherche, filtrage par statut/source/date/joint, groupement par statut, pagination et export CSV.

## Spec

Chemin : `docs/superpowers/specs/2026-03-28-base-de-donnees-design.md`

Décisions prises lors du brainstorming :
- Nouvelle route `/api/contacts` avec LEFT JOIN leads + calls (nb_calls, last_call_at)
- Tableau enrichi : colonnes Nb appels + Dernier appel en sous-texte
- Export CSV configurable côté client (blob, UTF-8 BOM, plafonné à 1000)
- Réutilise LeadSidePanel existant pour l'affichage du détail

## Fichiers créés / modifiés

| Fichier | Statut |
|---------|--------|
| `src/app/api/contacts/route.ts` | ✅ Créé |
| `src/lib/validations/contacts.ts` | ✅ Créé |
| `src/components/database/DatabaseFilters.tsx` | ✅ Créé |
| `src/components/database/DatabaseTable.tsx` | ✅ Créé |
| `src/components/database/ExportModal.tsx` | ✅ Créé |
| `src/types/index.ts` | ✅ Modifié |
| `src/app/(dashboard)/base-de-donnees/page.tsx` | ✅ Modifié |

## Déviations du plan documentées

- **Pagination côté client** : tous les contacts chargés en 1 requête (pas de serveur-side pagination) pour éviter complexité. Limite acceptable en V1 (max ~1000 leads pour un coach).
- **group_by=tags** : retiré de V1 car un lead peut avoir N tags — tri non trivial. À implémenter via une vue agrégée Supabase en V2.
- **Suppression en masse** : non implémentée. À ajouter en V2 via checkboxes.

## Tâches liées

- T-004 Module Leads (réutilise StatusBadge, SourceBadge, LeadSidePanel)
- T-011 Statistiques (même pattern Server Component)

---

*Créé le 2026-03-28 — ClosRM*
