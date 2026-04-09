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

## Notes techniques (décisions prises pendant l'implémentation)

- **Migration SQL** : numéro 015 (suit 014_follow_ads). Toutes les colonnes sont `IF NOT EXISTS` → idempotente. Backfill auto via les `DEFAULT` (`ocean` pour `preset_id`, `'{}'::jsonb` pour `effects_config`). Pas de CHECK constraint sur `preset_id` → flexibilité côté code, fallback `ocean` côté front via `getPresetByIdOrDefault`. Migration appliquée par Rémy sur Supabase dev le 2026-04-07 et vérifiée OK.
- **Cycle d'imports types ↔ lib** : le type `Funnel` dans `src/types/index.ts` doit décrire les champs JSON `preset_override` et `effects_config`, mais ne doit PAS importer depuis `src/lib/funnels/design-types.ts` (cycle). Solution : on duplique volontairement le shape dans `FunnelPresetOverrideJSON` et `FunnelEffectsConfigJSON` côté `types/index.ts`, et le helper `loadFunnelDesign()` cast vers les types lib en interne.
- **Compat backward du builder admin existant** : `FunnelPagePreview` accepte un prop **optionnel** `funnel?`. Si fourni → wrap les blocs dans `.fnl-root` avec CSS vars. Si absent → rendu legacy intact. Comme l'ancien builder buggé n'a pas été modifié pour passer ce prop, il continue de tourner exactement comme avant — backward-compat 100%, conforme à la règle "ne pas fixer l'ancien builder pendant T-028".
- **CSS du design system importés dans `FunnelPagePreview` ET dans la page publique** : les imports CSS Next.js sont dédupliqués au build, donc le double import ne crée pas de bloat. C'est nécessaire car les 2 chemins peuvent être consommés indépendamment.
- **BookingBlock + FormBlock = stubs visuels** : décision validée par Rémy le 2026-04-07. Affichent un badge "À venir" gradient + bordure dashed + désactivés. La logique réelle est documentée dans `ameliorations.md` (A-028a-01 + A-028a-02). À reprendre dans des tâches dédiées une fois T-028 finie.
- **CountdownBlock vs `<Countdown />` (T-028a)** : on a 2 components qui font la même chose. Le `CountdownBlock` historique reste — il a sa propre logique de tick et est piloté par `config.targetDate` (ISO string). Le composant `<Countdown />` de T-028a est destiné aux nouveaux usages via le toggle `e10-countdown` global. Cohabitation OK pour V1, à fusionner en V2 si pertinent.
- **Format des étoiles dans Testimonials** : avant `#f5a623` (orange dur). Après `var(--fnl-primary)` (couleur du preset). Décision : la cohérence avec le preset prime sur la convention "étoiles = jaune". Si un coach veut absolument du jaune, il choisira un preset jaune (`Sunshine`).
- **Hook useState avec lazy initializer** dans CountdownBlock pour figer `targetDate` au mount.
- **Granularité d'override = globale au funnel uniquement** (validé par Rémy le 2026-04-07) : pas d'override par bloc en V1. Permet à T-028b d'avoir une UX simple. La porte reste ouverte pour V2 si un coach le demande.

---

## Résultat final

✅ **Phases 1-7 terminées le 2026-04-07.** Phase 8 = doc + commit + push (ce fichier + suivants).

### Fichiers créés (4)

| Fichier | Rôle |
|---|---|
| `supabase/migrations/015_funnels_design_v2.sql` | Ajoute `preset_id`, `preset_override`, `effects_config` à `funnels` (idempotent, backfill auto) |
| `src/lib/funnels/load-funnel-design.ts` | Helper unique consommé par `FunnelPagePreview` + page publique pour calculer CSS vars + classes fx-* depuis un funnel |
| `src/app/dev/funnels-blocks-matrix/page.tsx` | Page de tests visuels qui rend les 12 blocs avec données de démo + sticky preset bar pour switcher entre les 20 thèmes |

### Fichiers modifiés

**Schema + types + API (Phase 1) :**
- `src/types/index.ts` — interface `Funnel` étendue + `FunnelPresetOverrideJSON` + `FunnelEffectsConfigJSON`
- `src/app/api/funnels/[id]/route.ts` — PUT accepte `preset_id`, `preset_override`, `effects_config` (avec validation minimale)
- `src/app/api/public/f/[workspaceSlug]/[funnelSlug]/[pageSlug]/route.ts` — SELECT inclut les 3 champs design + retourne `funnel: { preset_id, preset_override, effects_config }` dans la réponse

**12 blocs migrés (Phases 2-5) :**
- `src/components/funnels/blocks/SpacerBlock.tsx` — borne 0-500 + aria-hidden
- `src/components/funnels/blocks/TextBlock.tsx` — `var(--fnl-text)` au lieu de `#333`
- `src/components/funnels/blocks/ImageBlock.tsx` — border-radius 16, ombre colorée, hover transition
- `src/components/funnels/blocks/CtaBlock.tsx` — utilise `.fnl-btn` (gradient + shine + ombre + hover) pour primary, ghost custom pour outline
- `src/components/funnels/blocks/HeroBlock.tsx` — `.fnl-hero` + `.fnl-hero-inner` + `.fnl-headline` + `.fnl-hook` + `.fnl-btn`, support image de fond avec overlay sombre
- `src/components/funnels/blocks/VideoBlock.tsx` — border-radius 16, ombre colorée, état vide stylé
- `src/components/funnels/blocks/FaqBlock.tsx` — couleurs preset + animation rotate sur l'icône +/− + bordures teintées
- `src/components/funnels/blocks/PricingBlock.tsx` — ombre colorée, variante highlighted, ✓ en couleur principale, `.fnl-btn`
- `src/components/funnels/blocks/CountdownBlock.tsx` — boxes teintées Poppins 900 tabular-nums + séparateurs `:` en couleur principale
- `src/components/funnels/blocks/TestimonialsBlock.tsx` — étoiles preset, avatars gradient initiales, grid auto-fit
- `src/components/funnels/blocks/BookingBlock.tsx` — **stub "À venir"** : badge gradient + border dashed + icône + label calendar id (cf. A-028a-01)
- `src/components/funnels/blocks/FormBlock.tsx` — **stub "À venir"** : formulaire désactivé visible en preview, bouton submit grisé (cf. A-028a-02)

**Rendu (Phase 6) :**
- `src/components/funnels/FunnelPagePreview.tsx` — prop optionnel `funnel?`, wrap dans `.fnl-root` avec CSS vars + classes fx-* si fourni, importe tous les CSS du design system
- `src/app/f/[workspaceSlug]/[funnelSlug]/[pageSlug]/page.tsx` — consomme `funnel` depuis l'API publique, applique `loadFunnelDesign()`, wrap `<main>` dans `.fnl-root`

### Validation

- ✅ Migration SQL appliquée par Rémy sur Supabase dev (2026-04-07) — vérifiée via `SELECT preset_id, preset_override, effects_config FROM funnels` qui retourne `ocean / NULL / {}` sur les funnels existants
- ✅ `npm run lint` : 85 problèmes (vs 87 baseline = **-2 amélioration**, 0 nouvelle erreur sur les fichiers livrés)
- ✅ `npm run build` : `Compiled successfully`, 2 nouvelles routes statiques `/dev/funnels-sandbox` (T-028a) + `/dev/funnels-blocks-matrix` (T-028c)
- ✅ Validation visuelle Rémy le 2026-04-07 via la matrice (les 12 blocs × 20 presets) — "visuellement c'est nickel"
- ✅ Validation logique d'édition par bloc : Rémy a confirmé que la **granularité globale au funnel** (preset + effets) reste OK, le coach pourra modifier le **contenu** de chaque bloc dans l'inspector T-028b mais pas son style isolément

### Décisions structurantes documentées dans T-028b
- Inspector latéral droit : 1 panneau d'édition par type de bloc avec tous les `config.*` éditables
- Sidebar gauche : preset + 4 color pickers + toggle 🔗 lier les fonds + 10 toggles d'effets + liste de blocs drag&drop
- BookingBlock + FormBlock affichés grisés dans la palette avec label "À venir" non-draggable

---

## Améliorations identifiées pendant cette tâche

- **A-028a-01** (déjà documenté) : Brancher BookingBlock sur `/api/booking-calendars/*` (T-022) → vraie réservation au lieu du stub
- **A-028a-02** (déjà documenté) : Persister les submissions FormBlock + créer un lead + redirection
- **(idée future)** Fusionner `CountdownBlock` (historique) et `<Countdown />` (T-028a) — actuellement 2 composants séparés qui font la même chose. Pas urgent, attendre que le builder T-028b stabilise la convention.
- **(idée future)** Permettre au coach de créer/sauvegarder ses propres presets custom comme overrides nommés (cf. A-028a-03 idée future)
- **(idée future)** Override visuel par bloc spécifique (granularité par instance) — refusé en V1 par Rémy le 2026-04-07 pour garder une UX simple. À reconsidérer si un coach le demande explicitement en feedback V1.
