# Tâche 028c — Migration des 12 blocs Funnels au design system v2

> **Statut :** ⬜ Non démarré (bloquée par T-028a)
> **Développeur :** Rémy
> **Sous-tâche de :** [T-028](tache-028-funnels-v2.md)
> **Branche Git prévue :** `feature/remy-funnels-v2-blocks-migration`
> **Date de planification :** 2026-04-07

---

## Objectif

Porter les 12 blocs Funnels existants (livrés par Pierre en T-023) au nouveau design system livré par T-028a : remplacer les anciens styles inline / classes obsolètes par les CSS vars `--fnl-*`, les CSS modules d'effets, et le helper `applyPreset`.

À la fin de cette tâche, chaque bloc :
- Respecte les CSS vars du `.fnl-root` parent (donc s'adapte au preset choisi)
- Utilise les classes des effets de T-028a (`.fnl-shimmer`, `.fnl-btn`, `.fnl-badge`, etc.)
- Rendu public identique au mockup [mockups/t028a-preview.html](../mockups/t028a-preview.html)
- Code legacy nettoyé (anciennes classes inline, styles dupliqués, hex codés en dur)

---

## Périmètre

### Inclus

**12 blocs à migrer** (liste exacte issue de [src/components/funnels/blocks/](../src/components/funnels/blocks/)) :

| # | Bloc | Fichier | Effets candidats |
|---|---|---|---|
| 1 | Hero | `HeroBlock.tsx` | E2 hero glow, E1 shimmer, E5 badge pulse, E13 parallax |
| 2 | Video | `VideoBlock.tsx` | E2 hero glow, hover scale |
| 3 | Form | `FormBlock.tsx` | ⚠️ **Redesign visuel seulement** — bloqué avec label "À venir" tant que l'API de submission n'existe pas (voir A-028a-02) |
| 4 | Booking | `BookingBlock.tsx` | ⚠️ **Redesign visuel seulement** — bloqué avec label "À venir" tant que le branchement sur T-022 n'est pas fait (voir A-028a-01) |
| 5 | Pricing | `PricingBlock.tsx` | E4, E8 reveal scroll, hover cards |
| 6 | FAQ | `FaqBlock.tsx` | E8 reveal scroll, accordéon |
| 7 | Countdown | `CountdownBlock.tsx` | **E10 countdown timer** (composant dédié) |
| 8 | CTA | `CtaBlock.tsx` | E3 button shine, E4 colored shadow |
| 9 | Text | `TextBlock.tsx` | E1 shimmer optionnel sur portion |
| 10 | Image | `ImageBlock.tsx` | hover scale + glow, E6 lightbox |
| 11 | Spacer | `SpacerBlock.tsx` | (rien — juste vérifier qu'il respecte le padding system) |
| 12 | Testimonials | `TestimonialsBlock.tsx` | E6 lightbox, E11 avant/après, E8 reveal |

- **Refactor du rendu public** : `src/app/(public)/funnels/[slug]/page.tsx` doit appliquer le preset au container racine `.fnl-root` + injecter les CSS vars + activer les effets selon `effects_config` du funnel.
- **Migration de la table funnels en base** : ajouter colonnes `preset_id` (TEXT, default `'ocean'`), `preset_override` (JSONB, nullable, contient `{ primary?: string }`), `effects_config` (JSONB, default le mapping des defaults). Migration SQL dans `supabase/migrations/0XX_funnels_design_v2.sql`.
- **Données existantes** : backfill des funnels existants avec preset par défaut (`ocean` + effets defaults).
- **Composant `<FunnelPagePreview>`** existant : doit utiliser le preset stocké en base et plus les couleurs hardcodées.
- **Tests visuels** : créer une page de test qui rend chaque bloc isolément avec chaque preset (matrice 12 × 20). Utilisable via la sandbox de T-028a.

### Exclus

- ❌ Création de nouveaux blocs (Témoignages avancé, Quizz, Garantie, Avant/Après, Logo bar) → reportés post-V1 ou intégrés via les effets E9/E11 sans nouveau bloc dédié
- ❌ Refonte du builder UX (sidebar, drag&drop, inspector) → **T-028b**
- ❌ Implémentation des effets eux-mêmes (déjà fait en T-028a)
- ❌ Builder de templates pré-faits → reporté hors V1
- ❌ **Intégration fonctionnelle réelle de BookingBlock et FormBlock** : audit Phase 1 a révélé que les 2 blocs sont des stubs non connectés (BookingBlock = placeholder visuel, FormBlock = `console.log` sur submit). Décision : on **redesigne uniquement leur apparence** en T-028c sans toucher à leur logique, et on les affiche dans la palette de blocs avec un **label "À venir"** + **drag&drop désactivé** + **opacity réduite**. Tâches dédiées à créer :
  - `A-028a-01` dans `ameliorations.md` : brancher BookingBlock sur le module Calendriers interne (T-022 — API `/api/booking-calendars`)
  - `A-028a-02` dans `ameliorations.md` : brancher FormBlock sur `POST /api/public/funnels/[funnelId]/submit` + création lead + redirection

---

## Fichiers concernés

### Fichiers à créer

| Fichier | Description |
|---|---|
| `supabase/migrations/0XX_funnels_design_v2.sql` | Colonnes `preset_id`, `preset_override`, `effects_config` + backfill |
| `src/lib/funnels/load-funnel-design.ts` | Helper qui charge preset + effects depuis le funnel |

### Fichiers à modifier

| Fichier | Nature |
|---|---|
| Les 12 fichiers `src/components/funnels/blocks/*Block.tsx` | Remplacer styles legacy par classes du design system v2 |
| `src/components/funnels/FunnelPagePreview.tsx` | Appliquer preset au container, injecter effects config |
| `src/app/(public)/funnels/[slug]/page.tsx` | Idem pour le rendu public |
| `src/types/index.ts` (`FunnelBlockConfig`, `Funnel`) | Ajouter `preset_id`, `preset_override`, `effects_config` |
| `src/app/api/funnels/route.ts` + `[id]/route.ts` | Inclure les nouveaux champs en GET / PATCH |

### Fichiers à consulter

| Fichier | Raison |
|---|---|
| Tous les outputs de T-028a | C'est ce qu'on consomme |
| `supabase/migrations/008_funnels.sql` | Schéma actuel à étendre |

---

## Phases d'exécution

### Phase 1 — Migration SQL + types
- Écrire la migration SQL (idempotent, backfill safe)
- Mettre à jour `Funnel` type
- Tester la migration sur la base dev

### Phase 2 — Refacto blocs simples (Spacer, Text, Image, CTA)
- Les plus rapides — calage de la méthodo de migration
- Vérifier visuellement chaque bloc isolément dans la sandbox de T-028a

### Phase 3 — Refacto blocs moyens (Hero, Video, FAQ, Pricing, Form, Booking)
- Hero = priorité (porteur de E2 + E1 + E5)

### Phase 4 — Refacto blocs avancés (Countdown, Testimonials)
- Countdown = nouveau composant E10
- Testimonials = porte E6 lightbox + E11 avant/après

### Phase 5 — Refonte du rendu public + preview
- `FunnelPagePreview` + page publique `[slug]`
- Brancher `load-funnel-design` sur le container racine

### Phase 6 — Matrice de tests visuels
- Page interne qui rend les 12 blocs avec chaque preset (12 × 20 = 240 vues)
- Repérer les ratés visuels (textes illisibles, contrastes pétés, etc.)

### Phase 7 — Nettoyage legacy
- Supprimer les anciens fichiers CSS de funnels qui ne servent plus
- Supprimer les hex couleurs en dur dans les blocs

### Phase 8 — Validation Rémy → enchaînement T-028b

---

## Tâches liées

| Relation | Tâche | Description |
|---|---|---|
| Sous-tâche de | [T-028](tache-028-funnels-v2.md) | Tâche parente |
| Dépend de | [T-028a](tache-028a-direction-artistique.md) | Consomme presets + effets CSS modules |
| Bloque | [T-028b](tache-028b-builder-ux.md) | T-028b doit afficher les blocs migrés |

---

## Notes techniques

- **Risque :** certains blocs peuvent avoir des dépendances cachées sur l'ancien CSS (classes globales, sélecteurs descendants). À traquer méthodiquement bloc par bloc.
- **Migration safe :** on garde l'ancien CSS en parallèle pendant le développement, on supprime à la Phase 7 seulement.
- **Backfill défensif :** un funnel existant qui n'a pas `preset_id` → fallback `ocean` côté front (ne pas crash).
- **RLS :** vérifier que les nouvelles colonnes héritent bien de la policy `funnels_workspace` existante.
- **Pierre :** s'assurer qu'il ne touche pas aux blocs Funnels en parallèle (sa branche actuelle ne touche pas à ce module au 2026-04-07).

---

## Résultat final

_À remplir à la fin de la tâche._

---

## Améliorations identifiées pendant cette tâche

_À remplir au fil de l'eau._
