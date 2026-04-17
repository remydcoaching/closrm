# Tâches Rémy — ClosRM

> Toutes les tâches de Rémy, dans l'ordre. Chaque module = API + Frontend, autonome.
> Dernière mise à jour : 2026-04-15

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
| A-028a-01 | BookingBlock fonctionnel — calendrier intégré dans les funnels | ✅ | 2026-04-10 |
| A-028a-02 | FormBlock fonctionnel — création lead, workflows, RedirectPicker unifié | ✅ | 2026-04-10 |

---

## Tâches à venir

> ℹ️ T-027 (Lead++) a été **réassignée à Pierre** le 2026-04-07. Voir
> `taches/taches-pierre.md`. C'est une exception assumée : Pierre la prend
> car il maîtrise déjà le module Instagram et le moteur Workflows.
> Coordination requise avec Rémy avant tout push sur le module Leads.

### T-028 · Funnels v2 — refonte qualitative ⭐ EN PARALLÈLE T-029 PIERRE
**Priorité :** Haute
**Statut :** ⬜ Non démarré (planification validée le 2026-04-07)
**Fiche parente :** `taches/tache-028-funnels-v2.md`

> **Découpée en 3 sous-tâches** validées avec Rémy le 2026-04-07.
> Ordre d'exécution : **T-028a → T-028c → T-028b**
> Référence visuelle : `mockups/t028a-preview.html` (mockup HTML statique avec 20 presets + 8 effets implémentés)

#### T-028a · Direction artistique (presets + effets + design tokens)
**Fiche :** `taches/tache-028a-direction-artistique.md`
- 20 presets de couleurs (Ocean, Forêt, Luxe, Violet, Minimal, Énergie, Rose Gold, Impact, Zen, Bootcamp, Prestige, Naturel, Sunset, Midnight, Bordeaux, Terracotta, Sunshine, Anthracite, Tropical, Lavande)
- 15 effets visuels E1→E15 (5 forcés + 10 toggleables, granularité globale au funnel)
- Design tokens via CSS vars `--fnl-*` + helpers `lighten/darken/hexToRgb`
- Page sandbox interne `/dev/funnels-sandbox` pour tester chaque preset/effet en live
- Override de couleur principale post-preset

#### T-028c · Migration des 12 blocs au design system v2
**Fiche :** `taches/tache-028c-blocks-migration.md`
- Porter les 12 blocs existants ([HeroBlock, VideoBlock, FormBlock, BookingBlock, PricingBlock, FaqBlock, CountdownBlock, CtaBlock, TextBlock, ImageBlock, SpacerBlock, TestimonialsBlock]) au nouveau design system
- Migration SQL : ajouter `preset_id`, `preset_override`, `effects_config` à la table `funnels`
- Refonte du rendu public + composant preview
- Matrice de tests visuels 12 blocs × 20 presets

#### T-028b · Refonte du Builder UX
**Fiche :** `taches/tache-028b-builder-ux.md`
- Layout 3 colonnes : sidebar gauche (presets + toggles effets + sections drag&drop) | preview centrale multi-device | inspector latéral
- Undo/Redo + raccourcis clavier
- Drag & drop amélioré (snap visuel, drop zones claires)
- Autosave debounced
- Suppression du legacy builder à la fin

**Coordination Pierre :** valider qu'il accepte la refonte du module Funnels qu'il a livré en T-023. Au 2026-04-07, sa branche `feature/pierre-funnel-builder` ne touche plus aux fichiers funnels (il bosse Instagram + Booking) — pas de risque de conflit.

⚠️ **Règle pendant T-028 :** ne pas fixer les bugs du builder existant — il sera remplacé en T-028b. Patcher l'ancien = perte de temps.

---

### T-031 · Import portefeuille de leads (CSV + alternatives)
**Priorité :** Moyenne
**Statut :** ✅ Terminé (2026-04-15)
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
| **T-028a** | **Funnels v2 — Direction artistique (presets + effets)** | **Haute** | **✅** |
| **T-028c** | **Funnels v2 — Migration des 12 blocs** | **Haute** | **✅** |
| **T-028b** | **Funnels v2 — Refonte builder UX** | **Haute** | **✅** |
| **A-028a-01** | **BookingBlock fonctionnel (calendrier intégré)** | **Haute** | **✅** |
| **A-028a-02** | **FormBlock fonctionnel (lead + workflows + RedirectPicker)** | **Haute** | **✅** |
| **T-031** | **Import portefeuille leads (CSV wizard 5 étapes)** | **Moyenne** | **✅** |

---

## Ordre de bataille suggéré

1. **T-028a en premier** — direction artistique, prérequis design system de tout T-028.
2. **T-028c ensuite** — migration des 12 blocs au nouveau design system. Bloquée par T-028a.
3. **T-028b en dernier** — refonte du builder UX. Bloquée par T-028a + T-028c (le builder doit afficher les nouveaux blocs).
4. **T-031 en parallèle** dès que possible — bloque sur le trigger `lead_imported` que Pierre doit exposer en T-029. Démarrable indépendamment de T-028.

**À surveiller côté T-027 (Pierre)** : il va toucher au module Leads (LeadForm,
API leads, types, migration `leads.instagram_handle`). Te coordonner avec lui
avant chaque push sur ces fichiers pour éviter les conflits.

**À surveiller côté T-029 (Pierre)** : sa branche `feature/pierre-funnel-builder` est utilisée pour bosser Instagram + Booking, pas Funnels. Au 2026-04-07, aucun risque de conflit sur le module Funnels. À revérifier régulièrement pendant T-028.

---

*Mis à jour le 2026-04-15 — ClosRM*
