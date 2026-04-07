# Tâches Rémy — ClosRM

> Toutes les tâches de Rémy, dans l'ordre. Chaque module = API + Frontend, autonome.
> Dernière mise à jour : 2026-04-07

---

## Tâches terminées

| # | Tâche | Statut | Date |
|---|-------|--------|------|
| — | Setup initial projet (Next.js + Supabase + Auth + Layout) | ✅ | 2026-03-27 |
| T-004 | Module Leads (liste + fiche + filtres + LeadSidePanel) | ✅ | 2026-03-27 |
| T-003 | Dashboard d'accueil (KPIs + prochains appels + activité) | ✅ | 2026-03-28 |
| T-011 | Module Statistiques (KPIs + funnel + sources + Recharts) | ✅ | 2026-03-28 |
| T-012 | Base de données (vue globale + recherche + export CSV) | ✅ | 2026-03-28 |
| T-013 | Intégration Meta Ads — Bloc A (OAuth + webhook + UI) | ✅ | 2026-03-30 |
| T-017 | Module Publicités (dashboard Meta Ads — KPIs, plateformes, drill-down) | ✅ | 2026-04-01 |
| T-025 | Follow Ads Classification + KPIs adaptés + indicateurs de santé | ✅ | 2026-04-07 |
| A-007 | Source `follow_ads` + channel `instagram_dm` (migration 014, types, UI) | ✅ | 2026-04-07 |
| T-026 | ❌ Followers-as-prospects ABANDONNÉE (Instagram API ne donne pas les droits) | ❌ | 2026-04-07 |

---

## Tâches à venir

> ℹ️ T-027 (Lead++) a été **réassignée à Pierre** le 2026-04-07. Voir
> `taches/taches-pierre.md`. C'est une exception assumée : Pierre la prend
> car il maîtrise déjà le module Instagram et le moteur Workflows.
> Coordination requise avec Rémy avant tout push sur le module Leads.

### T-028 · Funnels v2 — refonte builder + analytics + templates ⭐ EN PARALLÈLE T-029 PIERRE
**Priorité :** Haute
**Statut :** ⬜ Non démarré
**Fiche détaillée :** `taches/tache-028-funnels-v2.md`

**Résumé :**
- Phase 1 : audit du module Funnels v1 livré par Pierre (T-023)
- Phase 2 : refonte builder UX (inspector latéral, undo/redo, preview multi-device, drag&drop amélioré)
- Phase 3 : nouveaux blocs (Témoignages avancé, Garantie, Avant/Après, Quizz, Logo bar)
- Phase 4 : galerie de templates par niche (coaching biz / sport / mindset / immo / formation / mastermind / bootcamp)
- Phase 5 : analytics par funnel (vues, leads, taux conversion, A/B test simple)
- Phase 6 : domaines custom + page de remerciement configurable
- **Coordination Pierre :** valider le périmètre du refactor (Rémy refait blocs / Pierre garde le moteur ?)
- ⚠️ Tâche volontairement large — découper en T-028a/b/c après audit Phase 1

---

### T-031 · Import portefeuille de leads (CSV + alternatives)
**Priorité :** Moyenne
**Statut :** ⬜ Non démarré
**Fiche détaillée :** `taches/tache-031-import-leads.md`

**Résumé :**
- Phase 1 (V1) : import CSV avec assistant 7 étapes (upload → preview → mapping
  colonnes → config dédup → preview diff → import en background → récap)
- Phase 2 : trigger workflow `lead_imported` à la fin (cf. T-029 Pierre)
- Phase 3 : annulation d'un import (soft-delete batch)
- Phase 4 (post-V1) : sources alternatives — Excel, vCard, Google Contacts,
  Coller du texte, Notion DB, Airtable, HubSpot/Pipedrive, API REST documentée
- **Reco V1 :** CSV uniquement, prioriser Excel + Google Contacts ensuite
- Migration SQL : `lead_import_batches` + colonne `leads.import_batch_id`
- **Coordination Pierre :** consommer le trigger `lead_imported` exposé par T-029

---

## Résumé

| # | Tâche | Priorité | Statut |
|---|-------|----------|--------|
| **T-028** | **Funnels v2 (refonte builder + analytics + templates)** | **Haute** | **⬜** |
| **T-031** | **Import portefeuille leads (CSV + alternatives)** | **Moyenne** | **⬜** |

---

## Ordre de bataille suggéré

1. **T-028 d'abord (en parallèle de T-029 Pierre)** — gros morceau,
   à découper en sous-tâches après audit Phase 1.
2. **T-031 ensuite** — bloque sur le trigger `lead_imported` que Pierre
   doit exposer en T-029. Démarrable dès qu'il a poussé son côté du contrat.

**À surveiller côté T-027 (Pierre)** : il va toucher au module Leads (LeadForm,
API leads, types, migration `leads.instagram_handle`). Te coordonner avec lui
avant chaque push sur ces fichiers pour éviter les conflits.

---

*Mis à jour le 2026-04-07 — ClosRM*
